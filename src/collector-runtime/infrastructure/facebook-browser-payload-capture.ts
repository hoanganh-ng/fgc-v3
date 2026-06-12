import type {
  BrowserProviderPage,
  BrowserProviderPort,
  BrowserProviderResponse,
  BrowserProviderSession,
} from "../application";
import { errorToMessage } from "../application";
import type {
  CapturedFacebookPayload,
  CollectorRuntimeWarning,
  FacebookGroupPayloadCaptureInput,
  FacebookGroupPayloadCapturePort,
  FacebookPayloadCaptureDiagnostics,
  FacebookPayloadCaptureResult,
  RuntimeProfileConfiguration,
  RuntimeProfileConfigurationPort,
} from "../application";
import { BrowserProviderError } from "../application";
import {
  PlaywrightChromiumBrowserProvider,
  buildBrowserProviderLaunchConfig,
} from "./browser-providers";

const DEFAULT_MAX_SCROLLS = 3;
const DEFAULT_MAX_DURATION_MS = 30_000;
const POST_NAVIGATION_SETTLE_MS = 1_500;
const BETWEEN_SCROLL_SETTLE_MS = 1_200;
const MIN_SCROLL_DISTANCE_PX = 800;
const PAGE_CONTEXT_CAPTURE_BINDING_NAME = "__fgcFacebookPayloadCaptured";
const PAGE_CONTEXT_PARSE_FAILURE_BINDING_NAME =
  "__fgcFacebookPayloadParseFailed";
const FACEBOOK_JSON_PREFIX = "for (;;);";

export interface FacebookBrowserPayloadCaptureAdapterOptions {
  readonly runtimeProfileConfigurationPort: RuntimeProfileConfigurationPort;
  readonly browserProvider: BrowserProviderPort;
  readonly maxScrolls?: number;
  readonly maxDurationMs?: number;
  readonly abortSignal?: AbortSignal;
  readonly now?: () => Date;
}

export type PlaywrightFacebookBrowserPayloadCaptureAdapterOptions = Omit<
  FacebookBrowserPayloadCaptureAdapterOptions,
  "browserProvider"
>;

export interface FacebookGraphQLResponseMetadata {
  readonly url: string;
  readonly headers?: Record<string, string | undefined>;
}

export type FacebookPageContextCaptureTransport = "fetch" | "xhr";

export interface FacebookPageContextPayloadCaptureMessage {
  readonly url: string;
  readonly pageUrl: string;
  readonly body: unknown;
  readonly capturedAt: string;
  readonly transport: FacebookPageContextCaptureTransport;
}

export interface FacebookJsonParseResult {
  readonly bodies: readonly unknown[];
  readonly parseFailed: boolean;
}

export class FacebookBrowserPayloadCaptureAdapter
  implements FacebookGroupPayloadCapturePort {
  private readonly runtimeProfileConfigurationPort: RuntimeProfileConfigurationPort;
  private readonly browserProvider: BrowserProviderPort;
  private readonly maxScrolls: number;
  private readonly maxDurationMs: number;
  private readonly abortSignal: AbortSignal | undefined;
  private readonly now: () => Date;

  public constructor(options: FacebookBrowserPayloadCaptureAdapterOptions) {
    this.runtimeProfileConfigurationPort =
      options.runtimeProfileConfigurationPort;
    this.browserProvider = options.browserProvider;
    this.maxScrolls = normalizeNonNegativeInteger(
      options.maxScrolls,
      DEFAULT_MAX_SCROLLS,
    );
    this.maxDurationMs = normalizePositiveInteger(
      options.maxDurationMs,
      DEFAULT_MAX_DURATION_MS,
    );
    this.abortSignal = options.abortSignal;
    this.now = options.now ?? (() => new Date());
  }

  public async captureGroupPayloads(
    input: FacebookGroupPayloadCaptureInput,
  ): Promise<FacebookPayloadCaptureResult> {
    const warnings: CollectorRuntimeWarning[] = [];
    const sensitiveValues = new Set<string>();
    let captureBuffer: FacebookPayloadCaptureBuffer | undefined;
    let browserSession: BrowserProviderSession | undefined;
    let abortCloseListener: (() => void) | undefined;

    try {
      throwIfAborted(this.abortSignal);

      const configurationResult =
        await this.runtimeProfileConfigurationPort.getRuntimeProfileConfiguration(
          input.leaseId,
        );

      if (!configurationResult.ok) {
        return {
          ok: false,
          errorCode: "RUNTIME_PROFILE_CONFIGURATION_FAILED",
          errorMessage: configurationResult.errorMessage,
          warnings,
        };
      }

      const configuration = configurationResult.configuration;
      addRuntimeConfigurationSensitiveValues(sensitiveValues, configuration);

      if (
        configuration.profileId !== input.profileId ||
        configuration.leaseId !== input.leaseId
      ) {
        return {
          ok: false,
          errorCode: "RUNTIME_PROFILE_CONFIGURATION_MISMATCH",
          errorMessage:
            "Runtime configuration did not match the checked-out profile lease.",
          warnings,
        };
      }

      browserSession = await this.browserProvider.launch(
        buildBrowserProviderLaunchConfig({
          providerName: this.browserProvider.providerName,
          configuration,
          headless: false,
        }),
      );
      abortCloseListener = createAbortCloseListener(
        this.abortSignal,
        browserSession,
      );

      const page = await browserSession.newPage();
      const pageCaptureBuffer = new FacebookPayloadCaptureBuffer(this.now);
      captureBuffer = pageCaptureBuffer;
      await installFacebookPageContextCapture(page, pageCaptureBuffer);
      const pendingCaptures: Promise<void>[] = [];
      const deadlineAt = Date.now() + this.maxDurationMs;
      const pageFailureWatcher = createPageFailureWatcher(
        page,
        sensitiveValues,
      );

      page.onResponse((response) => {
        const capture = captureNetworkResponse(
          response,
          pageCaptureBuffer,
          () => page.url(),
        );

        if (capture !== undefined) {
          pendingCaptures.push(capture);
        }
      });

      try {
        const navigationResponse = await Promise.race([
          page.goto({
            url: input.sourceGroupUrl,
            waitUntil: "domcontentloaded",
            timeoutMs: this.maxDurationMs,
          }),
          pageFailureWatcher.promise,
        ]);

        throwIfAborted(this.abortSignal);

        if (navigationResponse !== null && navigationResponse.status >= 400) {
          pageCaptureBuffer.recordFinalPageUrl(page.url());
          return {
            ok: false,
            errorCode: "FACEBOOK_GROUP_NAVIGATION_FAILED",
            errorMessage: `Facebook group navigation returned HTTP ${navigationResponse.status}.`,
            warnings,
            diagnostics: pageCaptureBuffer.toDiagnostics(),
          };
        }

        const initialAccessFailure = classifyFacebookAccessFailure(page.url());
        if (initialAccessFailure !== undefined) {
          pageCaptureBuffer.recordFinalPageUrl(page.url());
          return {
            ok: false,
            errorCode: initialAccessFailure.errorCode,
            errorMessage: initialAccessFailure.errorMessage,
            warnings,
            diagnostics: pageCaptureBuffer.toDiagnostics(),
          };
        }

        await Promise.race([
          scrollFacebookGroupPage(
            page,
            this.maxScrolls,
            deadlineAt,
            this.abortSignal,
          ),
          pageFailureWatcher.promise,
        ]);

        const finalAccessFailure = classifyFacebookAccessFailure(page.url());
        if (finalAccessFailure !== undefined) {
          pageCaptureBuffer.recordFinalPageUrl(page.url());
          return {
            ok: false,
            errorCode: finalAccessFailure.errorCode,
            errorMessage: finalAccessFailure.errorMessage,
            warnings,
            diagnostics: pageCaptureBuffer.toDiagnostics(),
          };
        }

        await settlePendingCaptures(pendingCaptures);
        pageCaptureBuffer.recordFinalPageUrl(page.url());
      } finally {
        pageFailureWatcher.dispose();
      }

      const capturedPayloads = pageCaptureBuffer.getCapturedPayloads();

      if (capturedPayloads.length === 0) {
        warnings.push({
          code: "NO_FACEBOOK_GRAPHQL_PAYLOADS_CAPTURED",
          message:
            "No Facebook GraphQL JSON responses were captured before the stop condition.",
        });
      }

      return {
        ok: true,
        capturedPayloads,
        warnings,
        diagnostics: pageCaptureBuffer.toDiagnostics(),
      };
    } catch (error) {
      if (isAbortLikeError(error, this.abortSignal)) {
        return {
          ok: false,
          errorCode: "FACEBOOK_BROWSER_CAPTURE_INTERRUPTED",
          errorMessage:
            "Facebook browser payload capture was interrupted before completion.",
          warnings,
          ...(captureBuffer !== undefined
            ? { diagnostics: captureBuffer.toDiagnostics() }
            : {}),
        };
      }

      return {
        ok: false,
        errorCode:
          error instanceof BrowserProviderError
            ? error.code
            : "FACEBOOK_BROWSER_CAPTURE_FAILED",
        errorMessage: redactSensitiveText(
          errorToMessage(error),
          sensitiveValues,
        ),
        warnings,
        ...(captureBuffer !== undefined
          ? { diagnostics: captureBuffer.toDiagnostics() }
          : {}),
      };
    } finally {
      abortCloseListener?.();
      await closeBrowserProviderSession(browserSession, warnings);
    }
  }
}

export class PlaywrightFacebookBrowserPayloadCaptureAdapter extends FacebookBrowserPayloadCaptureAdapter {
  public constructor(
    options: PlaywrightFacebookBrowserPayloadCaptureAdapterOptions,
  ) {
    super({
      ...options,
      browserProvider: new PlaywrightChromiumBrowserProvider(),
    });
  }
}

export function shouldCaptureFacebookGraphQLResponse(
  response: FacebookGraphQLResponseMetadata,
): boolean {
  return shouldCaptureFacebookPayload(
    response.url,
    readHeader(response.headers, "content-type"),
  );
}

export function shouldCaptureFacebookPayload(
  url: string,
  contentType: string | undefined,
): boolean {
  return (
    url.includes("/api/graphql") ||
    url.includes("/graphql") ||
    url.includes("/ajax/") ||
    contentType?.toLowerCase().includes("application/json") === true
  );
}

export function parseFacebookJson(value: string): FacebookJsonParseResult {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return {
      bodies: [],
      parseFailed: true,
    };
  }

  const wholePayload = parseSingleFacebookJson(normalizedValue);

  if (wholePayload.ok) {
    return {
      bodies: [wholePayload.value],
      parseFailed: false,
    };
  }

  const bodies: unknown[] = [];

  for (const part of value.split(/\r?\n/)) {
    const normalizedPart = part.trim();

    if (normalizedPart.length === 0) {
      continue;
    }

    const parsedPart = parseSingleFacebookJson(normalizedPart);

    if (parsedPart.ok) {
      bodies.push(parsedPart.value);
    }
  }

  return {
    bodies,
    parseFailed: bodies.length === 0,
  };
}

export function sanitizeFacebookDiagnosticUrl(value: string): string | undefined {
  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return `${url.origin}${url.pathname}`;
    }

    if (url.protocol === "about:") {
      return `${url.protocol}${url.pathname}`;
    }

    return undefined;
  } catch {
    return undefined;
  }
}

class FacebookPayloadCaptureBuffer {
  private readonly now: () => Date;
  private readonly capturedPayloads: CapturedFacebookPayload[] = [];
  private readonly dedupeKeys = new Set<string>();
  private pageContextFetchCaptureCount = 0;
  private pageContextXhrCaptureCount = 0;
  private networkListenerCaptureCount = 0;
  private parseFailureCount = 0;
  private finalPageUrl: string | undefined;
  private loginRedirectSuspected = false;

  public constructor(now: () => Date) {
    this.now = now;
  }

  public recordPageContextCapture(message: unknown): void {
    const captureMessage = toPageContextPayloadCaptureMessage(message);

    if (captureMessage === undefined) {
      return;
    }

    if (captureMessage.transport === "fetch") {
      this.pageContextFetchCaptureCount += 1;
    } else {
      this.pageContextXhrCaptureCount += 1;
    }

    this.recordParsedPayload({
      url: captureMessage.url,
      pageUrl: captureMessage.pageUrl,
      body: captureMessage.body,
      capturedAt: toCapturedAt(captureMessage.capturedAt, this.now),
    });
  }

  public recordPageContextParseFailure(message: unknown): void {
    if (isPageContextParseFailureMessage(message)) {
      this.parseFailureCount += 1;
    }
  }

  public recordNetworkResponseText(input: {
    readonly url: string;
    readonly pageUrl: string;
    readonly bodyText: string;
  }): void {
    const parseResult = parseFacebookJson(input.bodyText);

    if (parseResult.parseFailed) {
      this.parseFailureCount += 1;
      return;
    }

    const capturedAt = this.now();

    for (const body of parseResult.bodies) {
      this.networkListenerCaptureCount += 1;
      this.recordParsedPayload({
        url: input.url,
        pageUrl: input.pageUrl,
        body,
        capturedAt,
      });
    }
  }

  public recordParseFailure(): void {
    this.parseFailureCount += 1;
  }

  public recordFinalPageUrl(url: string): void {
    this.finalPageUrl = sanitizeFacebookDiagnosticUrl(url);
    this.loginRedirectSuspected = classifyFacebookAccessFailure(url) !== undefined;
  }

  public getCapturedPayloads(): readonly CapturedFacebookPayload[] {
    return [...this.capturedPayloads];
  }

  public toDiagnostics(): FacebookPayloadCaptureDiagnostics {
    return {
      pageContextFetchCaptureCount: this.pageContextFetchCaptureCount,
      pageContextXhrCaptureCount: this.pageContextXhrCaptureCount,
      networkListenerCaptureCount: this.networkListenerCaptureCount,
      parseFailureCount: this.parseFailureCount,
      totalPayloadsPassedToExtractor: this.capturedPayloads.length,
      ...(this.finalPageUrl !== undefined
        ? { finalPageUrl: this.finalPageUrl }
        : {}),
      loginRedirectSuspected: this.loginRedirectSuspected,
    };
  }

  private recordParsedPayload(input: {
    readonly url: string;
    readonly pageUrl: string;
    readonly body: unknown;
    readonly capturedAt: Date;
  }): void {
    const dedupeKey = createPayloadDedupeKey(input.url, input.body);

    if (this.dedupeKeys.has(dedupeKey)) {
      return;
    }

    this.dedupeKeys.add(dedupeKey);

    const sourceUrlHint =
      sanitizeFacebookDiagnosticUrl(input.pageUrl) ??
      sanitizeFacebookDiagnosticUrl(input.url);

    this.capturedPayloads.push({
      payload: input.body,
      capturedAt: input.capturedAt,
      ...(sourceUrlHint !== undefined ? { sourceUrlHint } : {}),
    });
  }
}

async function installFacebookPageContextCapture(
  page: BrowserProviderPage,
  captureBuffer: FacebookPayloadCaptureBuffer,
): Promise<void> {
  await page.exposeBinding(
    PAGE_CONTEXT_CAPTURE_BINDING_NAME,
    (message: unknown) => {
      captureBuffer.recordPageContextCapture(message);
    },
  );
  await page.exposeBinding(
    PAGE_CONTEXT_PARSE_FAILURE_BINDING_NAME,
    (message: unknown) => {
      captureBuffer.recordPageContextParseFailure(message);
    },
  );
  await page.addInitScript({
    content: createFacebookPageContextCaptureInitScript(),
  });
}

function captureNetworkResponse(
  response: BrowserProviderResponse,
  captureBuffer: FacebookPayloadCaptureBuffer,
  readCurrentPageUrl: () => string,
): Promise<void> | undefined {
  const url = response.url();

  if (!shouldCaptureFacebookPayload(url, readHeader(response.headers(), "content-type"))) {
    return undefined;
  }

  return response
    .text()
    .then((bodyText) => {
      captureBuffer.recordNetworkResponseText({
        url,
        pageUrl: readCurrentPageUrl(),
        bodyText,
      });
    })
    .catch(() => {
      captureBuffer.recordParseFailure();
    });
}

function parseSingleFacebookJson(
  value: string,
): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  try {
    return {
      ok: true,
      value: JSON.parse(stripFacebookJsonPrefix(value)),
    };
  } catch {
    return {
      ok: false,
    };
  }
}

function stripFacebookJsonPrefix(value: string): string {
  const normalizedValue = value.trim();

  if (!normalizedValue.startsWith(FACEBOOK_JSON_PREFIX)) {
    return normalizedValue;
  }

  return normalizedValue.slice(FACEBOOK_JSON_PREFIX.length).trimStart();
}

function toPageContextPayloadCaptureMessage(
  value: unknown,
): FacebookPageContextPayloadCaptureMessage | undefined {
  const record = toRecord(value);
  const url = readString(record, "url");
  const pageUrl = readString(record, "pageUrl");
  const capturedAt = readString(record, "capturedAt");
  const transport = readString(record, "transport");

  if (
    url === undefined ||
    pageUrl === undefined ||
    capturedAt === undefined ||
    (transport !== "fetch" && transport !== "xhr")
  ) {
    return undefined;
  }

  return {
    url,
    pageUrl,
    body: record?.body,
    capturedAt,
    transport,
  };
}

function isPageContextParseFailureMessage(value: unknown): boolean {
  const record = toRecord(value);
  const transport = readString(record, "transport");

  return transport === "fetch" || transport === "xhr";
}

function toCapturedAt(value: string, now: () => Date): Date {
  const capturedAtMs = Date.parse(value);

  return Number.isFinite(capturedAtMs) ? new Date(capturedAtMs) : now();
}

function createPayloadDedupeKey(url: string, body: unknown): string {
  try {
    return `${url}\n${JSON.stringify(body)}`;
  } catch {
    return `${url}\n${String(body)}`;
  }
}

function createFacebookPageContextCaptureInitScript(): string {
  return `
(() => {
  const captureBindingName = ${JSON.stringify(PAGE_CONTEXT_CAPTURE_BINDING_NAME)};
  const parseFailureBindingName = ${JSON.stringify(PAGE_CONTEXT_PARSE_FAILURE_BINDING_NAME)};
  const facebookJsonPrefix = ${JSON.stringify(FACEBOOK_JSON_PREFIX)};

  if (window.__fgcFacebookPayloadCaptureInstalled === true) {
    return;
  }

  window.__fgcFacebookPayloadCaptureInstalled = true;

  function shouldCapture(url, contentType) {
    const normalizedUrl = typeof url === "string" ? url : "";
    const normalizedContentType =
      typeof contentType === "string" ? contentType.toLowerCase() : "";

    return (
      normalizedUrl.includes("/api/graphql") ||
      normalizedUrl.includes("/graphql") ||
      normalizedUrl.includes("/ajax/") ||
      normalizedContentType.includes("application/json")
    );
  }

  function stripFacebookJsonPrefix(value) {
    const normalizedValue = String(value).trim();

    if (!normalizedValue.startsWith(facebookJsonPrefix)) {
      return normalizedValue;
    }

    return normalizedValue.slice(facebookJsonPrefix.length).trimStart();
  }

  function parseSingleFacebookJson(value) {
    try {
      return {
        ok: true,
        value: JSON.parse(stripFacebookJsonPrefix(value)),
      };
    } catch {
      return {
        ok: false,
      };
    }
  }

  function parseFacebookJson(value) {
    const normalizedValue = String(value).trim();

    if (normalizedValue.length === 0) {
      return [];
    }

    const wholePayload = parseSingleFacebookJson(normalizedValue);

    if (wholePayload.ok) {
      return [wholePayload.value];
    }

    const bodies = [];
    const parts = String(value).split(/\\r?\\n/);

    for (const part of parts) {
      const normalizedPart = part.trim();

      if (normalizedPart.length === 0) {
        continue;
      }

      const parsedPart = parseSingleFacebookJson(normalizedPart);

      if (parsedPart.ok) {
        bodies.push(parsedPart.value);
      }
    }

    return bodies;
  }

  function readBridge(name) {
    const bridge = window[name];

    return typeof bridge === "function" ? bridge : undefined;
  }

  function sendBridgeMessage(name, message) {
    try {
      const bridge = readBridge(name);

      if (bridge === undefined) {
        return;
      }

      Promise.resolve(bridge(message)).catch(() => {});
    } catch {}
  }

  function reportParseFailure(transport, url, pageUrl) {
    sendBridgeMessage(parseFailureBindingName, {
      url,
      pageUrl,
      capturedAt: new Date().toISOString(),
      transport,
    });
  }

  function normalizeUrl(value, fallbackUrl) {
    const rawUrl = typeof value === "string" ? value : "";

    if (rawUrl.length === 0) {
      return fallbackUrl;
    }

    try {
      return new URL(rawUrl, window.location.href).href;
    } catch {
      return fallbackUrl;
    }
  }

  function inspectResponse(transport, url, pageUrl, contentType, readText) {
    if (!shouldCapture(url, contentType)) {
      return;
    }

    Promise.resolve()
      .then(readText)
      .then((bodyText) => {
        if (typeof bodyText !== "string") {
          reportParseFailure(transport, url, pageUrl);
          return;
        }

        const bodies = parseFacebookJson(bodyText);

        if (bodies.length === 0) {
          reportParseFailure(transport, url, pageUrl);
          return;
        }

        const capturedAt = new Date().toISOString();

        for (const body of bodies) {
          sendBridgeMessage(captureBindingName, {
            url,
            pageUrl,
            body,
            capturedAt,
            transport,
          });
        }
      })
      .catch(() => {
        reportParseFailure(transport, url, pageUrl);
      });
  }

  function readFetchUrl(input, fallbackUrl) {
    if (typeof input === "string") {
      return normalizeUrl(input, fallbackUrl);
    }

    if (input !== undefined && input !== null && typeof input.url === "string") {
      return normalizeUrl(input.url, fallbackUrl);
    }

    return fallbackUrl;
  }

  if (typeof window.fetch === "function") {
    const originalFetch = window.fetch;

    window.fetch = function fgcFacebookPayloadCaptureFetch(input, init) {
      return originalFetch.apply(this, arguments).then((response) => {
        try {
          const responseUrl =
            response !== undefined && typeof response.url === "string"
              ? response.url
              : window.location.href;
          const url = readFetchUrl(input, responseUrl);
          const contentType =
            response !== undefined &&
            response.headers !== undefined &&
            typeof response.headers.get === "function"
              ? response.headers.get("content-type") ?? ""
              : "";

          if (response !== undefined && typeof response.clone === "function") {
            inspectResponse("fetch", url, window.location.href, contentType, () =>
              response.clone().text(),
            );
          }
        } catch {}

        return response;
      });
    };
  }

  if (
    typeof XMLHttpRequest !== "undefined" &&
    XMLHttpRequest.prototype !== undefined
  ) {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function fgcFacebookPayloadCaptureOpen(
      method,
      url,
    ) {
      try {
        this.__fgcFacebookPayloadCaptureUrl = normalizeUrl(
          typeof url === "string" ? url : String(url),
          window.location.href,
        );
      } catch {}

      return originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function fgcFacebookPayloadCaptureSend() {
      try {
        this.addEventListener(
          "load",
          () => {
            const storedUrl =
              typeof this.__fgcFacebookPayloadCaptureUrl === "string"
                ? this.__fgcFacebookPayloadCaptureUrl
                : window.location.href;
            const url = normalizeUrl(
              typeof this.responseURL === "string" && this.responseURL.length > 0
                ? this.responseURL
                : storedUrl,
              storedUrl,
            );
            const contentType =
              typeof this.getResponseHeader === "function"
                ? this.getResponseHeader("content-type") ?? ""
                : "";

            if (!shouldCapture(url, contentType)) {
              return;
            }

            let responseText = "";

            try {
              responseText =
                typeof this.responseText === "string" ? this.responseText : "";
            } catch {
              reportParseFailure("xhr", url, window.location.href);
              return;
            }

            inspectResponse("xhr", url, window.location.href, contentType, () =>
              responseText,
            );
          },
          { once: true },
        );
      } catch {}

      return originalSend.apply(this, arguments);
    };
  }
})();
`;
}

async function scrollFacebookGroupPage(
  page: BrowserProviderPage,
  maxScrolls: number,
  deadlineAt: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> {
  for (let scrollIndex = 0; scrollIndex < maxScrolls; scrollIndex += 1) {
    throwIfAborted(abortSignal);

    if (Date.now() >= deadlineAt) {
      return;
    }

    await page.evaluate(
      `window.scrollBy(0, Math.max(window.innerHeight, ${MIN_SCROLL_DISTANCE_PX}));`,
    );
    await sleepUntilNextStep(BETWEEN_SCROLL_SETTLE_MS, deadlineAt, abortSignal);
  }

  await sleepUntilNextStep(POST_NAVIGATION_SETTLE_MS, deadlineAt, abortSignal);
}

async function settlePendingCaptures(
  pendingCaptures: readonly Promise<void>[],
): Promise<void> {
  await Promise.allSettled(pendingCaptures);
}

function createAbortCloseListener(
  signal: AbortSignal | undefined,
  browserSession: BrowserProviderSession,
): (() => void) | undefined {
  if (signal === undefined) {
    return undefined;
  }

  const onAbort = (): void => {
    void browserSession.close();
  };

  signal.addEventListener("abort", onAbort, { once: true });

  return () => {
    signal.removeEventListener("abort", onAbort);
  };
}

function createPageFailureWatcher(
  page: BrowserProviderPage,
  sensitiveValues: ReadonlySet<string>,
): {
  readonly promise: Promise<never>;
  readonly dispose: () => void;
} {
  let rejectPromise: (error: Error) => void = () => {};
  const promise = new Promise<never>((_resolve, reject) => {
    rejectPromise = reject;
  });
  const onPageError = (error: Error): void => {
    rejectPromise(
      new Error(redactSensitiveText(errorToMessage(error), sensitiveValues)),
    );
  };
  const onCrash = (): void => {
    rejectPromise(new Error("Facebook browser page crashed."));
  };

  page.oncePageError(onPageError);
  page.onceCrash(onCrash);

  return {
    promise,
    dispose: () => {
      page.offPageError(onPageError);
      page.offCrash(onCrash);
    },
  };
}

async function closeBrowserProviderSession(
  browserSession: BrowserProviderSession | undefined,
  warnings: CollectorRuntimeWarning[],
): Promise<void> {
  try {
    await browserSession?.close();
  } catch {
    warnings.push({
      code: "BROWSER_PROVIDER_CLOSE_FAILED",
      message:
        "Browser provider close reported an error. Check for a leftover browser process before retrying.",
    });
  }
}

function classifyFacebookAccessFailure(
  value: string,
): { readonly errorCode: string; readonly errorMessage: string } | undefined {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    return undefined;
  }

  const pathname = parsedUrl.pathname.toLowerCase();

  if (pathname.includes("/checkpoint")) {
    return {
      errorCode: "CHECKPOINT_REQUIRED",
      errorMessage:
        "Facebook redirected to checkpoint. Re-provision or review the profile session before retrying.",
    };
  }

  if (pathname.includes("/login")) {
    return {
      errorCode: "LOGIN_REQUIRED",
      errorMessage:
        "Facebook redirected to login. Re-provision the profile session before retrying.",
    };
  }

  return undefined;
}

function readHeader(
  headers: Record<string, string | undefined> | undefined,
  headerName: string,
): string | undefined {
  if (headers === undefined) {
    return undefined;
  }

  const normalizedHeaderName = headerName.toLowerCase();

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === normalizedHeaderName && value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function readHttpOrigin(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return undefined;
    }

    return url.origin;
  } catch {
    return undefined;
  }
}

function readUnknownArray(
  value: Record<string, unknown> | undefined,
  key: string,
): readonly unknown[] {
  const rawValue = value?.[key];

  return Array.isArray(rawValue) ? rawValue : [];
}

function readString(
  value: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const rawValue = value?.[key];

  if (typeof rawValue !== "string") {
    return undefined;
  }

  const normalizedValue = rawValue.trim();

  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function readNullableString(
  value: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const rawValue = value?.[key];

  if (typeof rawValue !== "string") {
    return undefined;
  }

  return rawValue;
}

function readStringArray(
  value: Record<string, unknown> | undefined,
  key: string,
): readonly string[] {
  const rawValue = value?.[key];

  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue.flatMap((item) => {
    if (typeof item !== "string") {
      return [];
    }

    const normalizedItem = item.trim();

    return normalizedItem.length > 0 ? [normalizedItem] : [];
  });
}

function readPositiveNumber(
  value: Record<string, unknown> | undefined,
  key: string,
): number | undefined {
  const rawValue = value?.[key];

  return typeof rawValue === "number" && Number.isFinite(rawValue) && rawValue > 0
    ? rawValue
    : undefined;
}

function readBoolean(
  value: Record<string, unknown> | undefined,
  key: string,
): boolean | undefined {
  const rawValue = value?.[key];

  return typeof rawValue === "boolean" ? rawValue : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeNonNegativeInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}

function normalizePositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function addRuntimeConfigurationSensitiveValues(
  sensitiveValues: Set<string>,
  configuration: RuntimeProfileConfiguration,
): void {
  const networkContext = toRecord(configuration.networkContext);
  const proxy = toRecord(networkContext?.proxy);
  const credentials = toRecord(proxy?.credentials);

  addSensitiveValue(sensitiveValues, readString(credentials, "username"));
  addSensitiveValue(sensitiveValues, readString(credentials, "password"));

  const authenticationState = toRecord(configuration.authenticationState);

  for (const cookieValue of readUnknownArray(authenticationState, "cookies")) {
    const cookie = toRecord(cookieValue);

    addSensitiveValue(sensitiveValues, readString(cookie, "name"));
    addSensitiveValue(sensitiveValues, readNullableString(cookie, "value"));
  }

  for (const localStorageValue of readUnknownArray(
    authenticationState,
    "localStorage",
  )) {
    const entry = toRecord(localStorageValue);

    addSensitiveValue(sensitiveValues, readString(entry, "key"));
    addSensitiveValue(sensitiveValues, readNullableString(entry, "value"));
  }
}

function addSensitiveValue(
  sensitiveValues: Set<string>,
  value: string | undefined,
): void {
  const normalizedValue = value?.trim();

  if (normalizedValue !== undefined && normalizedValue.length >= 3) {
    sensitiveValues.add(normalizedValue);
  }
}

function redactSensitiveText(
  text: string,
  sensitiveValues: ReadonlySet<string>,
): string {
  let redactedText = text;

  for (const sensitiveValue of sensitiveValues) {
    redactedText = redactedText.split(sensitiveValue).join("[redacted]");
  }

  return redactedText;
}

async function sleepUntilNextStep(
  requestedDelayMs: number,
  deadlineAt: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> {
  const remainingMs = deadlineAt - Date.now();

  if (remainingMs <= 0) {
    return;
  }

  const delayMs = Math.min(requestedDelayMs, remainingMs);

  let onAbort: (() => void) | undefined;

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    onAbort = () => {
      clearTimeout(timeout);
      reject(new FacebookBrowserCaptureInterruptedError());
    };

    if (abortSignal?.aborted === true) {
      onAbort();
      return;
    }

    abortSignal?.addEventListener("abort", onAbort, { once: true });
  }).finally(() => {
    if (onAbort !== undefined) {
      abortSignal?.removeEventListener("abort", onAbort);
    }
  });
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new FacebookBrowserCaptureInterruptedError();
  }
}

class FacebookBrowserCaptureInterruptedError extends Error {
  public constructor() {
    super("Facebook browser payload capture was interrupted.");
    this.name = "FacebookBrowserCaptureInterruptedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function isAbortLikeError(
  error: unknown,
  signal: AbortSignal | undefined,
): boolean {
  return (
    signal?.aborted === true ||
    error instanceof FacebookBrowserCaptureInterruptedError ||
    (error instanceof Error && error.name === "AbortError")
  );
}
