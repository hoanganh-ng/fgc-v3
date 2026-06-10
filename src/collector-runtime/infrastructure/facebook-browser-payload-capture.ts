import { chromium } from "playwright";
import type {
  Browser,
  BrowserContext,
  BrowserContextOptions,
  Page,
  Response,
} from "playwright";
import { errorToMessage } from "../application";
import type {
  CapturedFacebookPayload,
  CollectorRuntimeWarning,
  FacebookGroupPayloadCaptureInput,
  FacebookGroupPayloadCapturePort,
  FacebookPayloadCaptureResult,
  RuntimeProfileConfiguration,
  RuntimeProfileConfigurationPort,
} from "../application";

const DEFAULT_MAX_SCROLLS = 3;
const DEFAULT_MAX_DURATION_MS = 30_000;
const POST_NAVIGATION_SETTLE_MS = 1_500;
const BETWEEN_SCROLL_SETTLE_MS = 1_200;
const MIN_SCROLL_DISTANCE_PX = 800;

interface PlaywrightProxySettings {
  readonly server: string;
  readonly username?: string;
  readonly password?: string;
}

type StorageStateObject = Exclude<
  BrowserContextOptions["storageState"],
  string | undefined
>;

interface PlaywrightStorageCookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires: number;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "Strict" | "Lax" | "None";
}

interface PlaywrightLocalStorageOrigin {
  readonly origin: string;
  readonly localStorage: {
    readonly name: string;
    readonly value: string;
  }[];
}

export interface FacebookBrowserPayloadCaptureAdapterOptions {
  readonly runtimeProfileConfigurationPort: RuntimeProfileConfigurationPort;
  readonly maxScrolls?: number;
  readonly maxDurationMs?: number;
  readonly abortSignal?: AbortSignal;
  readonly now?: () => Date;
}

export interface FacebookGraphQLResponseMetadata {
  readonly url: string;
  readonly headers?: Record<string, string | undefined>;
}

export class PlaywrightFacebookBrowserPayloadCaptureAdapter
  implements FacebookGroupPayloadCapturePort {
  private readonly runtimeProfileConfigurationPort: RuntimeProfileConfigurationPort;
  private readonly maxScrolls: number;
  private readonly maxDurationMs: number;
  private readonly abortSignal: AbortSignal | undefined;
  private readonly now: () => Date;

  public constructor(options: FacebookBrowserPayloadCaptureAdapterOptions) {
    this.runtimeProfileConfigurationPort =
      options.runtimeProfileConfigurationPort;
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
    const capturedPayloads: CapturedFacebookPayload[] = [];
    const sensitiveValues = new Set<string>();
    let browser: Browser | undefined;
    let context: BrowserContext | undefined;
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

      browser = await chromium.launch({
        headless: false,
      });
      context = await browser.newContext(toBrowserContextOptions(configuration));
      abortCloseListener = createAbortCloseListener(
        this.abortSignal,
        context,
        browser,
      );

      const page = await context.newPage();
      const pendingCaptures: Promise<void>[] = [];
      const deadlineAt = Date.now() + this.maxDurationMs;
      const pageFailureWatcher = createPageFailureWatcher(
        page,
        sensitiveValues,
      );

      page.on("response", (response) => {
        const capture = captureGraphQLResponse(
          response,
          capturedPayloads,
          this.now,
        );

        if (capture !== undefined) {
          pendingCaptures.push(capture);
        }
      });

      try {
        const navigationResponse = await Promise.race([
          page.goto(input.sourceGroupUrl, {
            waitUntil: "domcontentloaded",
            timeout: this.maxDurationMs,
          }),
          pageFailureWatcher.promise,
        ]);

        throwIfAborted(this.abortSignal);

        if (navigationResponse !== null && navigationResponse.status() >= 400) {
          return {
            ok: false,
            errorCode: "FACEBOOK_GROUP_NAVIGATION_FAILED",
            errorMessage: `Facebook group navigation returned HTTP ${navigationResponse.status()}.`,
            warnings,
          };
        }

        if (isFacebookLoginOrCheckpointUrl(page.url())) {
          return {
            ok: false,
            errorCode: "FACEBOOK_LOGIN_REQUIRED",
            errorMessage:
              "Facebook redirected to login or checkpoint. Re-provision the profile session before retrying.",
            warnings,
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

        if (isFacebookLoginOrCheckpointUrl(page.url())) {
          return {
            ok: false,
            errorCode: "FACEBOOK_LOGIN_REQUIRED",
            errorMessage:
              "Facebook redirected to login or checkpoint. Re-provision the profile session before retrying.",
            warnings,
          };
        }

        await settlePendingCaptures(pendingCaptures);
      } finally {
        pageFailureWatcher.dispose();
      }

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
      };
    } catch (error) {
      if (isAbortLikeError(error, this.abortSignal)) {
        return {
          ok: false,
          errorCode: "FACEBOOK_BROWSER_CAPTURE_INTERRUPTED",
          errorMessage:
            "Facebook browser payload capture was interrupted before completion.",
          warnings,
        };
      }

      return {
        ok: false,
        errorCode: "FACEBOOK_BROWSER_CAPTURE_FAILED",
        errorMessage: redactSensitiveText(
          errorToMessage(error),
          sensitiveValues,
        ),
        warnings,
      };
    } finally {
      abortCloseListener?.();
      await closePlaywrightSession(context, browser, warnings);
    }
  }
}

export function shouldCaptureFacebookGraphQLResponse(
  response: FacebookGraphQLResponseMetadata,
): boolean {
  if (!response.url.includes("/api/graphql")) {
    return false;
  }

  const contentType = readHeader(response.headers, "content-type");

  if (contentType === undefined) {
    return true;
  }

  return contentType.toLowerCase().includes("application/json");
}

function captureGraphQLResponse(
  response: Response,
  capturedPayloads: CapturedFacebookPayload[],
  now: () => Date,
): Promise<void> | undefined {
  if (
    !shouldCaptureFacebookGraphQLResponse({
      url: response.url(),
      headers: response.headers(),
    })
  ) {
    return undefined;
  }

  return response
    .json()
    .then((payload: unknown) => {
      capturedPayloads.push({
        payload,
        capturedAt: now(),
        sourceUrlHint: response.url(),
      });
    })
    .catch(() => {
      // Ignore unparsable or non-JSON GraphQL-looking responses.
    });
}

async function scrollFacebookGroupPage(
  page: Page,
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

function toBrowserContextOptions(
  configuration: RuntimeProfileConfiguration,
): BrowserContextOptions {
  const hardwareFingerprint = toRecord(configuration.hardwareFingerprint);
  const networkContext = toRecord(configuration.networkContext);
  const storageState = toStorageState(configuration.authenticationState);
  const options: BrowserContextOptions = {
    storageState,
  };

  const userAgent = readString(hardwareFingerprint, "userAgent");

  if (userAgent !== undefined) {
    options.userAgent = userAgent;
  }

  const viewport = toRecord(hardwareFingerprint?.viewport);
  const viewportWidth = readPositiveNumber(viewport, "width");
  const viewportHeight = readPositiveNumber(viewport, "height");

  if (viewportWidth !== undefined && viewportHeight !== undefined) {
    options.viewport = {
      width: Math.round(viewportWidth),
      height: Math.round(viewportHeight),
    };
  }

  const deviceScaleFactor = readPositiveNumber(viewport, "deviceScaleFactor");

  if (deviceScaleFactor !== undefined) {
    options.deviceScaleFactor = deviceScaleFactor;
  }

  const languages = readStringArray(hardwareFingerprint, "languages");
  const firstLanguage = languages[0];

  if (firstLanguage !== undefined) {
    options.locale = firstLanguage;
    options.extraHTTPHeaders = {
      "Accept-Language": languages.join(","),
    };
  }

  const timezone =
    readString(hardwareFingerprint, "timezone") ??
    readString(toRecord(configuration.temporalRoutine), "timezone");

  if (timezone !== undefined) {
    options.timezoneId = timezone;
  }

  const proxy = toPlaywrightProxySettings(toRecord(networkContext?.proxy));

  if (proxy !== undefined) {
    options.proxy = proxy;
  }

  return options;
}

function toStorageState(authenticationState: unknown): StorageStateObject {
  const state = toRecord(authenticationState);

  return {
    cookies: readUnknownArray(state, "cookies")
      .map(toPlaywrightStorageCookie)
      .filter(
        (cookie): cookie is PlaywrightStorageCookie => cookie !== undefined,
      ),
    origins: toLocalStorageOrigins(readUnknownArray(state, "localStorage")),
  };
}

function toPlaywrightStorageCookie(
  value: unknown,
): PlaywrightStorageCookie | undefined {
  const cookie = toRecord(value);
  const name = readString(cookie, "name");
  const cookieValue = readNullableString(cookie, "value");
  const domain = readString(cookie, "domain");
  const path = readString(cookie, "path");

  if (
    name === undefined ||
    cookieValue === undefined ||
    domain === undefined ||
    path === undefined
  ) {
    return undefined;
  }

  const expires = toCookieExpires(readNullableString(cookie, "expiresAt"));
  const sameSite = toPlaywrightSameSite(readString(cookie, "sameSite"));

  return {
    name,
    value: cookieValue,
    domain,
    path,
    expires: expires ?? -1,
    httpOnly: readBoolean(cookie, "httpOnly") ?? false,
    secure: readBoolean(cookie, "secure") ?? false,
    sameSite: sameSite ?? "Lax",
  };
}

function toLocalStorageOrigins(
  entries: readonly unknown[],
): PlaywrightLocalStorageOrigin[] {
  const origins = new Map<string, Array<{ name: string; value: string }>>();

  for (const entryValue of entries) {
    const entry = toRecord(entryValue);
    const origin = readHttpOrigin(readString(entry, "origin"));
    const key = readString(entry, "key");
    const value = readNullableString(entry, "value");

    if (origin === undefined || key === undefined || value === undefined) {
      continue;
    }

    const originEntries = origins.get(origin) ?? [];
    originEntries.push({
      name: key,
      value,
    });
    origins.set(origin, originEntries);
  }

  return [...origins.entries()].map(([origin, localStorage]) => ({
    origin,
    localStorage,
  }));
}

function toCookieExpires(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const expiresMs = Date.parse(value);

  if (!Number.isFinite(expiresMs)) {
    return undefined;
  }

  return Math.floor(expiresMs / 1000);
}

function toPlaywrightSameSite(
  value: string | undefined,
): "Strict" | "Lax" | "None" | undefined {
  if (value === "STRICT") {
    return "Strict";
  }

  if (value === "LAX") {
    return "Lax";
  }

  if (value === "NONE") {
    return "None";
  }

  return undefined;
}

function toPlaywrightProxySettings(
  proxy: Record<string, unknown> | undefined,
): PlaywrightProxySettings | undefined {
  if (proxy === undefined) {
    return undefined;
  }

  const protocol = readString(proxy, "protocol");
  const host = readString(proxy, "host");
  const port = readPositiveNumber(proxy, "port");

  if (protocol === undefined || host === undefined || port === undefined) {
    return undefined;
  }

  const credentials = toRecord(proxy.credentials);
  const username = readString(credentials, "username");
  const password = readString(credentials, "password");

  return {
    server: `${toProxyScheme(protocol)}://${host}:${Math.round(port)}`,
    ...(username !== undefined && password !== undefined
      ? {
          username,
          password,
        }
      : {}),
  };
}

function toProxyScheme(protocol: string): string {
  if (protocol === "SOCKS5") {
    return "socks5";
  }

  return protocol.toLowerCase();
}

function createAbortCloseListener(
  signal: AbortSignal | undefined,
  context: BrowserContext,
  browser: Browser,
): (() => void) | undefined {
  if (signal === undefined) {
    return undefined;
  }

  const onAbort = (): void => {
    void closePlaywrightSession(context, browser, []);
  };

  signal.addEventListener("abort", onAbort, { once: true });

  return () => {
    signal.removeEventListener("abort", onAbort);
  };
}

function createPageFailureWatcher(
  page: Page,
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

  page.once("pageerror", onPageError);
  page.once("crash", onCrash);

  return {
    promise,
    dispose: () => {
      page.off("pageerror", onPageError);
      page.off("crash", onCrash);
    },
  };
}

async function closePlaywrightSession(
  context: BrowserContext | undefined,
  browser: Browser | undefined,
  warnings: CollectorRuntimeWarning[],
): Promise<void> {
  try {
    await context?.close();
  } catch {
    warnings.push({
      code: "BROWSER_CONTEXT_CLOSE_FAILED",
      message:
        "Browser context close reported an error. Check for a leftover Chromium process before retrying.",
    });
  }

  try {
    await browser?.close();
  } catch {
    warnings.push({
      code: "BROWSER_CLOSE_FAILED",
      message:
        "Browser close reported an error. Check for a leftover Chromium process before retrying.",
    });
  }
}

function isFacebookLoginOrCheckpointUrl(value: string): boolean {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    return false;
  }

  const pathname = parsedUrl.pathname.toLowerCase();

  return pathname.includes("/login") || pathname.includes("/checkpoint");
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
