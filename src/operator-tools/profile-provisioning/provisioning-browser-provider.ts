import { chromium } from "playwright";
import type {
  ProvisioningBrowserCookie,
  ProvisioningCapturedSessionState,
  ProvisioningConfiguration,
  ProvisioningCookieSameSite,
  ProvisioningLocalStorageEntry,
  ProvisioningProxyRouting,
} from "./provisioning-http-client";
import type {
  ProvisioningBrowserLauncher,
  ProvisioningBrowserSession,
} from "./provisioning-runner";

export type ProvisioningBrowserProviderCliValue =
  | "playwright"
  | "cloakbrowser";

export type ProvisioningBrowserProviderName =
  | "PLAYWRIGHT_CHROMIUM"
  | "CLOAK_BROWSER";

export interface ProvisioningBrowserProviderEnvironment {
  readonly BROWSER_PROVIDER?: string;
}

export interface ProvisioningBrowserProviderProxySettings {
  readonly server: string;
  readonly username?: string;
  readonly password?: string;
}

export interface ProvisioningBrowserProviderViewport {
  readonly width: number;
  readonly height: number;
}

export interface ProvisioningBrowserProviderFingerprintConfig {
  readonly seed: string;
  readonly source: "PROFILE_ID" | "PROFILE_MANAGER";
  readonly profileOwnedConfig?: unknown;
}

export interface ProvisioningBrowserProviderLaunchConfig {
  readonly providerName: ProvisioningBrowserProviderName;
  readonly profileId: string;
  readonly headless: false;
  readonly proxy?: ProvisioningBrowserProviderProxySettings;
  readonly viewport?: ProvisioningBrowserProviderViewport;
  readonly deviceScaleFactor?: number;
  readonly userAgent?: string;
  readonly locale?: string;
  readonly acceptLanguageHeader?: string;
  readonly timezoneId?: string;
  readonly fingerprint?: ProvisioningBrowserProviderFingerprintConfig;
}

export interface ProvisioningBrowserProviderPort {
  readonly providerName: ProvisioningBrowserProviderName;
  launch(
    config: ProvisioningBrowserProviderLaunchConfig,
  ): Promise<ProvisioningBrowserProviderSession>;
}

export interface ProvisioningBrowserProviderSession {
  newPage(): Promise<ProvisioningBrowserProviderPage>;
  cookies(urls: readonly string[]): Promise<readonly ProvisioningCookieShape[]>;
  close(): Promise<void>;
}

export interface ProvisioningBrowserProviderPage {
  goto(
    url: string,
    options: {
      readonly waitUntil: "domcontentloaded";
      readonly timeout: number;
    },
  ): Promise<unknown>;
  evaluate<T = unknown>(script: string): Promise<T>;
  close(): Promise<void>;
}

export interface ProvisioningCookieShape {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires: number;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite?: string;
}

export type ProvisioningBrowserProviderResolution =
  | {
      readonly ok: true;
      readonly providerName: ProvisioningBrowserProviderName;
      readonly provider: ProvisioningBrowserProviderPort;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

const FACEBOOK_LOGIN_URL = "https://fb.com";
const FACEBOOK_LOCAL_STORAGE_ORIGINS = [
  "https://www.facebook.com",
  "https://m.facebook.com",
  "https://fb.com",
] as const;

interface CapturedLocalStorageValue {
  readonly key: string;
  readonly value: string;
}

type UnknownModuleImporter = (moduleName: string) => Promise<unknown>;
type PlaywrightChromiumLaunch = (options: {
  readonly headless: boolean;
}) => Promise<ProvisioningPlaywrightLikeBrowser>;

interface ProvisioningPlaywrightLikeBrowser {
  newContext(
    options: Record<string, unknown>,
  ): Promise<ProvisioningPlaywrightLikeContext>;
  close(): Promise<void>;
}

interface ProvisioningPlaywrightLikeContext {
  newPage(): Promise<ProvisioningPlaywrightLikePage>;
  cookies(urls: readonly string[]): Promise<readonly ProvisioningCookieShape[]>;
  close(): Promise<void>;
}

interface ProvisioningPlaywrightLikePage {
  goto(
    url: string,
    options: {
      readonly waitUntil: "domcontentloaded";
      readonly timeout: number;
    },
  ): Promise<unknown>;
  evaluate<T = unknown>(script: string): Promise<T>;
  close(): Promise<void>;
}

interface PlaywrightProvisioningBrowserProviderOptions {
  readonly launchChromium?: PlaywrightChromiumLaunch;
}

interface CloakBrowserProvisioningProviderOptions {
  readonly importModule?: UnknownModuleImporter;
}

interface CloakBrowserLaunchResult {
  readonly browser: ProvisioningPlaywrightLikeBrowser;
  readonly context: ProvisioningPlaywrightLikeContext;
}

export class ResolvedProvisioningBrowserLauncher
  implements ProvisioningBrowserLauncher {
  public readonly providerLabel: string;

  public constructor(
    private readonly provider: ProvisioningBrowserProviderPort,
  ) {
    this.providerLabel = toProviderLabel(provider.providerName);
  }

  public async launch(
    configuration: ProvisioningConfiguration,
  ): Promise<ProvisioningBrowserSession> {
    const providerSession = await this.provider.launch(
      buildProvisioningBrowserProviderLaunchConfig({
        providerName: this.provider.providerName,
        configuration,
      }),
    );

    return new ProvisioningBrowserProviderBackedSession(providerSession);
  }
}

export class PlaywrightProvisioningBrowserProvider
  implements ProvisioningBrowserProviderPort {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  private readonly launchChromium: PlaywrightChromiumLaunch;

  public constructor(options: PlaywrightProvisioningBrowserProviderOptions = {}) {
    this.launchChromium =
      options.launchChromium ??
      (async (launchOptions) => chromium.launch(launchOptions));
  }

  public async launch(
    config: ProvisioningBrowserProviderLaunchConfig,
  ): Promise<ProvisioningBrowserProviderSession> {
    assertProviderConfigMatches(config, this.providerName);

    let browser: ProvisioningPlaywrightLikeBrowser | undefined;

    try {
      browser = await this.launchChromium({
        headless: config.headless,
      });
      const context = await browser.newContext(toPlaywrightContextOptions(config));

      return new ProvisioningPlaywrightLikeSession(browser, context);
    } catch (error) {
      if (browser !== undefined) {
        await closeIgnoringErrors(browser);
      }

      throw error;
    }
  }
}

export class CloakBrowserProvisioningProvider
  implements ProvisioningBrowserProviderPort {
  public readonly providerName = "CLOAK_BROWSER" as const;
  private readonly importModule: UnknownModuleImporter;

  public constructor(options: CloakBrowserProvisioningProviderOptions = {}) {
    this.importModule = options.importModule ?? importUnknownModule;
  }

  public async launch(
    config: ProvisioningBrowserProviderLaunchConfig,
  ): Promise<ProvisioningBrowserProviderSession> {
    assertProviderConfigMatches(config, this.providerName);

    let moduleValue: unknown;

    try {
      moduleValue = await this.importModule("cloakbrowser");
    } catch {
      throw new Error(
        "CloakBrowser provider is experimental and is not available locally. Install and configure CloakBrowser for this workspace, or use BROWSER_PROVIDER=playwright.",
      );
    }

    const launchResult = await launchCloakBrowserForProvisioning(
      moduleValue,
      config,
    );

    return new ProvisioningPlaywrightLikeSession(
      launchResult.browser,
      launchResult.context,
    );
  }
}

export function resolveProvisioningBrowserProvider(input: {
  readonly browserProvider?: ProvisioningBrowserProviderCliValue;
  readonly environment?: ProvisioningBrowserProviderEnvironment;
} = {}): ProvisioningBrowserProviderResolution {
  const normalizedValue = normalizeProvisioningBrowserProviderValue(
    input.browserProvider ?? input.environment?.BROWSER_PROVIDER,
  );

  if (!normalizedValue.ok) {
    return normalizedValue;
  }

  if (normalizedValue.value === "cloakbrowser") {
    return {
      ok: true,
      providerName: "CLOAK_BROWSER",
      provider: new CloakBrowserProvisioningProvider(),
    };
  }

  return {
    ok: true,
    providerName: "PLAYWRIGHT_CHROMIUM",
    provider: new PlaywrightProvisioningBrowserProvider(),
  };
}

export function normalizeProvisioningBrowserProviderValue(
  value: string | undefined,
):
  | { readonly ok: true; readonly value: ProvisioningBrowserProviderCliValue }
  | { readonly ok: false; readonly message: string } {
  const normalizedValue = value?.trim().toLowerCase();

  if (normalizedValue === undefined || normalizedValue.length === 0) {
    return {
      ok: true,
      value: "playwright",
    };
  }

  if (normalizedValue === "playwright") {
    return {
      ok: true,
      value: "playwright",
    };
  }

  if (normalizedValue === "cloakbrowser") {
    return {
      ok: true,
      value: "cloakbrowser",
    };
  }

  return {
    ok: false,
    message: "Unknown browser provider. Use playwright or cloakbrowser.",
  };
}

export function buildProvisioningBrowserProviderLaunchConfig(input: {
  readonly providerName: ProvisioningBrowserProviderName;
  readonly configuration: ProvisioningConfiguration;
}): ProvisioningBrowserProviderLaunchConfig {
  const { hardwareFingerprint, networkContext, profileId } = input.configuration;
  const firstLanguage = hardwareFingerprint.languages[0];
  const proxy = toProvisioningBrowserProviderProxySettings(
    networkContext.proxy,
  );

  return {
    providerName: input.providerName,
    profileId,
    headless: false,
    ...(proxy !== undefined ? { proxy } : {}),
    viewport: {
      width: Math.round(hardwareFingerprint.viewport.width),
      height: Math.round(hardwareFingerprint.viewport.height),
    },
    ...(hardwareFingerprint.viewport.deviceScaleFactor !== undefined
      ? {
          deviceScaleFactor: hardwareFingerprint.viewport.deviceScaleFactor,
        }
      : {}),
    userAgent: hardwareFingerprint.userAgent,
    ...(firstLanguage !== undefined
      ? {
          locale: firstLanguage,
          acceptLanguageHeader: hardwareFingerprint.languages.join(","),
        }
      : {}),
    ...(hardwareFingerprint.timezone !== undefined
      ? { timezoneId: hardwareFingerprint.timezone }
      : {}),
    fingerprint: {
      seed: profileId,
      source: "PROFILE_ID",
      profileOwnedConfig: hardwareFingerprint,
    },
  };
}

class ProvisioningBrowserProviderBackedSession
  implements ProvisioningBrowserSession {
  public constructor(
    private readonly providerSession: ProvisioningBrowserProviderSession,
  ) {}

  public async openLoginPage(): Promise<void> {
    const page = await this.providerSession.newPage();
    await page.goto(FACEBOOK_LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  }

  public async captureSessionState(): Promise<ProvisioningCapturedSessionState> {
    const cookies = (
      await this.providerSession.cookies([...FACEBOOK_LOCAL_STORAGE_ORIGINS])
    )
      .map(toProvisioningBrowserCookie)
      .filter(
        (cookie): cookie is ProvisioningBrowserCookie => cookie !== undefined,
      );
    const localStorage = await captureLocalStorageForOrigins(
      this.providerSession,
    );

    return {
      cookies,
      localStorage,
    };
  }

  public async close(): Promise<void> {
    await this.providerSession.close();
  }
}

class ProvisioningPlaywrightLikeSession
  implements ProvisioningBrowserProviderSession {
  public constructor(
    private readonly browser: ProvisioningPlaywrightLikeBrowser,
    private readonly context: ProvisioningPlaywrightLikeContext,
  ) {}

  public async newPage(): Promise<ProvisioningBrowserProviderPage> {
    return this.context.newPage();
  }

  public async cookies(
    urls: readonly string[],
  ): Promise<readonly ProvisioningCookieShape[]> {
    return this.context.cookies(urls);
  }

  public async close(): Promise<void> {
    let closeError: unknown;

    try {
      await this.context.close();
    } catch (error) {
      closeError = error;
    }

    try {
      await this.browser.close();
    } catch (error) {
      closeError ??= error;
    }

    if (closeError !== undefined) {
      throw closeError;
    }
  }
}

async function launchCloakBrowserForProvisioning(
  moduleValue: unknown,
  config: ProvisioningBrowserProviderLaunchConfig,
): Promise<CloakBrowserLaunchResult> {
  const moduleRecord = toRecord(moduleValue);
  const defaultExport = toRecord(moduleRecord?.default);
  const launch =
    readFunction(moduleRecord, "launch") ??
    readFunction(defaultExport, "launch");
  const chromium =
    toRecord(moduleRecord?.chromium) ?? toRecord(defaultExport?.chromium);
  const chromiumLaunch = readFunction(chromium, "launch");
  const launchOptions = toCloakBrowserProvisioningLaunchOptions(config);

  if (launch !== undefined) {
    return normalizeCloakBrowserLaunchResult(await launch(launchOptions));
  }

  if (chromiumLaunch !== undefined) {
    const browser = await chromiumLaunch({
      headless: config.headless,
      cloak: launchOptions,
    });

    if (!isProvisioningPlaywrightLikeBrowser(browser)) {
      throw unsupportedCloakBrowserProvisioningApiError();
    }

    try {
      const context = await browser.newContext(toPlaywrightContextOptions(config));

      if (!isProvisioningPlaywrightLikeContext(context)) {
        await closeIgnoringErrors(context);
        throw unsupportedCloakBrowserProvisioningApiError();
      }

      return {
        browser,
        context,
      };
    } catch (error) {
      await closeIgnoringErrors(browser);
      throw error;
    }
  }

  throw unsupportedCloakBrowserProvisioningApiError();
}

function toPlaywrightContextOptions(
  config: ProvisioningBrowserProviderLaunchConfig,
): Record<string, unknown> {
  return {
    ...(config.userAgent !== undefined ? { userAgent: config.userAgent } : {}),
    ...(config.viewport !== undefined ? { viewport: config.viewport } : {}),
    ...(config.deviceScaleFactor !== undefined
      ? { deviceScaleFactor: config.deviceScaleFactor }
      : {}),
    ...(config.locale !== undefined ? { locale: config.locale } : {}),
    ...(config.acceptLanguageHeader !== undefined
      ? {
          extraHTTPHeaders: {
            "Accept-Language": config.acceptLanguageHeader,
          },
        }
      : {}),
    ...(config.timezoneId !== undefined ? { timezoneId: config.timezoneId } : {}),
    ...(config.proxy !== undefined ? { proxy: config.proxy } : {}),
  };
}

function toCloakBrowserProvisioningLaunchOptions(
  config: ProvisioningBrowserProviderLaunchConfig,
): Record<string, unknown> {
  return {
    headless: config.headless,
    profileId: config.profileId,
    ...(config.proxy !== undefined ? { proxy: config.proxy } : {}),
    ...(config.viewport !== undefined ? { viewport: config.viewport } : {}),
    ...(config.deviceScaleFactor !== undefined
      ? { deviceScaleFactor: config.deviceScaleFactor }
      : {}),
    ...(config.userAgent !== undefined ? { userAgent: config.userAgent } : {}),
    ...(config.locale !== undefined ? { locale: config.locale } : {}),
    ...(config.acceptLanguageHeader !== undefined
      ? { acceptLanguageHeader: config.acceptLanguageHeader }
      : {}),
    ...(config.timezoneId !== undefined ? { timezoneId: config.timezoneId } : {}),
    ...(config.fingerprint !== undefined
      ? { fingerprint: config.fingerprint }
      : {}),
  };
}

function normalizeCloakBrowserLaunchResult(
  value: unknown,
): CloakBrowserLaunchResult {
  const record = toRecord(value);
  const browser = record?.browser;
  const context = record?.context;

  if (
    isProvisioningPlaywrightLikeBrowser(browser) &&
    isProvisioningPlaywrightLikeContext(context)
  ) {
    return {
      browser,
      context,
    };
  }

  throw unsupportedCloakBrowserProvisioningApiError();
}

async function captureLocalStorageForOrigins(
  session: ProvisioningBrowserProviderSession,
): Promise<readonly ProvisioningLocalStorageEntry[]> {
  const entries: ProvisioningLocalStorageEntry[] = [];

  for (const origin of FACEBOOK_LOCAL_STORAGE_ORIGINS) {
    entries.push(...(await captureLocalStorageForOrigin(session, origin)));
  }

  return entries;
}

async function captureLocalStorageForOrigin(
  session: ProvisioningBrowserProviderSession,
  origin: string,
): Promise<readonly ProvisioningLocalStorageEntry[]> {
  const page = await session.newPage();

  try {
    await page.goto(origin, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    const values = await page.evaluate<readonly CapturedLocalStorageValue[]>(
      `(() => {
        const entries = [];

        for (let index = 0; index < window.localStorage.length; index += 1) {
          const key = window.localStorage.key(index);

          if (key !== null && key.length > 0) {
            entries.push({
              key,
              value: window.localStorage.getItem(key) ?? "",
            });
          }
        }

        return entries;
      })()`,
    );

    return values.map((value) => ({
      origin,
      key: value.key,
      value: value.value,
    }));
  } finally {
    await page.close();
  }
}

function toProvisioningBrowserCookie(
  cookie: ProvisioningCookieShape,
): ProvisioningBrowserCookie | undefined {
  if (
    cookie.name.trim().length === 0 ||
    cookie.domain.trim().length === 0 ||
    cookie.path.trim().length === 0
  ) {
    return undefined;
  }

  const sameSite = toProvisioningSameSite(cookie.sameSite);

  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expiresAt:
      Number.isFinite(cookie.expires) && cookie.expires > 0
        ? new Date(cookie.expires * 1000).toISOString()
        : null,
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    ...(sameSite !== undefined ? { sameSite } : {}),
  };
}

function toProvisioningBrowserProviderProxySettings(
  proxy: ProvisioningProxyRouting | null,
): ProvisioningBrowserProviderProxySettings | undefined {
  if (proxy === null) {
    return undefined;
  }

  const credentials = proxy.credentials ?? undefined;

  return {
    server: `${toProxyScheme(proxy.protocol)}://${proxy.host}:${proxy.port}`,
    ...(credentials !== undefined
      ? {
          username: credentials.username,
          password: credentials.password,
        }
      : {}),
  };
}

function toProxyScheme(protocol: ProvisioningProxyRouting["protocol"]): string {
  if (protocol === "SOCKS5") {
    return "socks5";
  }

  return protocol.toLowerCase();
}

function toProvisioningSameSite(
  value: string | undefined,
): ProvisioningCookieSameSite | undefined {
  if (value === "Strict") {
    return "STRICT";
  }

  if (value === "Lax") {
    return "LAX";
  }

  if (value === "None") {
    return "NONE";
  }

  return undefined;
}

function assertProviderConfigMatches(
  config: ProvisioningBrowserProviderLaunchConfig,
  providerName: ProvisioningBrowserProviderName,
): void {
  if (config.providerName !== providerName) {
    throw new Error("Browser provider launch config does not match provider.");
  }
}

function toProviderLabel(
  providerName: ProvisioningBrowserProviderName,
): string {
  return providerName === "CLOAK_BROWSER" ? "CloakBrowser" : "Playwright";
}

function unsupportedCloakBrowserProvisioningApiError(): Error {
  return new Error(
    "CloakBrowser is available, but this adapter could not find a supported provisioning launch/context/page API. Use BROWSER_PROVIDER=playwright or update the CloakBrowser provisioning adapter.",
  );
}

function isProvisioningPlaywrightLikeBrowser(
  value: unknown,
): value is ProvisioningPlaywrightLikeBrowser {
  const record = toRecord(value);

  return (
    readFunction(record, "newContext") !== undefined &&
    readFunction(record, "close") !== undefined
  );
}

function isProvisioningPlaywrightLikeContext(
  value: unknown,
): value is ProvisioningPlaywrightLikeContext {
  const record = toRecord(value);

  return (
    readFunction(record, "newPage") !== undefined &&
    readFunction(record, "cookies") !== undefined &&
    readFunction(record, "close") !== undefined
  );
}

function readFunction(
  value: Record<string, unknown> | undefined,
  key: string,
): ((...args: readonly unknown[]) => Promise<unknown>) | undefined {
  const rawValue = value?.[key];

  return typeof rawValue === "function"
    ? (rawValue as (...args: readonly unknown[]) => Promise<unknown>)
    : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function closeIgnoringErrors(value: {
  close(): Promise<void>;
}): Promise<void> {
  try {
    await value.close();
  } catch {}
}

async function importUnknownModule(moduleName: string): Promise<unknown> {
  const importer = new Function(
    "moduleName",
    "return import(moduleName)",
  ) as (moduleName: string) => Promise<unknown>;

  return importer(moduleName);
}
