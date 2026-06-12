import {
  BrowserProviderError,
  type BrowserProviderLaunchConfig,
  type BrowserProviderPort,
  type BrowserProviderSession,
} from "../../application";
import {
  createPlaywrightLikeBrowserProviderSession,
  type PlaywrightLikeBrowser,
  type PlaywrightLikeBrowserContext,
} from "./playwright-like-browser-session";

type UnknownModuleImporter = (moduleName: string) => Promise<unknown>;

interface CloakBrowserProviderOptions {
  readonly importModule?: UnknownModuleImporter;
}

interface CloakBrowserLaunchResult {
  readonly browser: PlaywrightLikeBrowser;
  readonly context: PlaywrightLikeBrowserContext;
}

export class CloakBrowserProvider implements BrowserProviderPort {
  public readonly providerName = "CLOAK_BROWSER" as const;
  private readonly importModule: UnknownModuleImporter;

  public constructor(options: CloakBrowserProviderOptions = {}) {
    this.importModule = options.importModule ?? importUnknownModule;
  }

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    if (config.providerName !== this.providerName) {
      throw new BrowserProviderError(
        "BROWSER_PROVIDER_CONFIGURATION_INVALID",
        "Browser provider launch config does not match CloakBrowser.",
      );
    }

    let moduleValue: unknown;

    try {
      moduleValue = await this.importModule("cloakbrowser");
    } catch {
      throw new BrowserProviderError(
        "CLOAK_BROWSER_UNAVAILABLE",
        "CloakBrowser provider is experimental and is not available locally. Install and configure CloakBrowser for this workspace, or use BROWSER_PROVIDER=playwright.",
      );
    }

    const launchResult = await launchCloakBrowser(moduleValue, config);

    return createPlaywrightLikeBrowserProviderSession(
      this.providerName,
      launchResult.browser,
      launchResult.context,
    );
  }
}

async function launchCloakBrowser(
  moduleValue: unknown,
  config: BrowserProviderLaunchConfig,
): Promise<CloakBrowserLaunchResult> {
  const moduleRecord = toRecord(moduleValue);
  const defaultExport = toRecord(moduleRecord?.default);
  const launch =
    readFunction(moduleRecord, "launch") ??
    readFunction(defaultExport, "launch");
  const chromium = toRecord(moduleRecord?.chromium) ?? toRecord(defaultExport?.chromium);
  const chromiumLaunch = readFunction(chromium, "launch");
  const launchOptions = toCloakBrowserLaunchOptions(config);

  if (launch !== undefined) {
    return normalizeLaunchResult(await launch(launchOptions));
  }

  if (chromiumLaunch !== undefined) {
    const browser = await chromiumLaunch({
      headless: config.headless,
      cloak: launchOptions,
    });
    const browserRecord = toRecord(browser);
    const newContext = readFunction(browserRecord, "newContext");

    if (newContext === undefined || !isPlaywrightLikeBrowser(browser)) {
      throw unsupportedCloakBrowserApiError();
    }

    const context = await newContext(toPlaywrightLikeContextOptions(config));

    if (!isPlaywrightLikeContext(context)) {
      throw unsupportedCloakBrowserApiError();
    }

    return {
      browser,
      context,
    };
  }

  throw unsupportedCloakBrowserApiError();
}

function toCloakBrowserLaunchOptions(
  config: BrowserProviderLaunchConfig,
): Record<string, unknown> {
  return {
    headless: config.headless,
    profileId: config.profileId,
    leaseId: config.leaseId,
    storageState: config.storageState,
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

function toPlaywrightLikeContextOptions(
  config: BrowserProviderLaunchConfig,
): Record<string, unknown> {
  return {
    storageState: config.storageState,
    ...(config.proxy !== undefined ? { proxy: config.proxy } : {}),
    ...(config.viewport !== undefined ? { viewport: config.viewport } : {}),
    ...(config.deviceScaleFactor !== undefined
      ? { deviceScaleFactor: config.deviceScaleFactor }
      : {}),
    ...(config.userAgent !== undefined ? { userAgent: config.userAgent } : {}),
    ...(config.locale !== undefined ? { locale: config.locale } : {}),
    ...(config.acceptLanguageHeader !== undefined
      ? {
          extraHTTPHeaders: {
            "Accept-Language": config.acceptLanguageHeader,
          },
        }
      : {}),
    ...(config.timezoneId !== undefined ? { timezoneId: config.timezoneId } : {}),
  };
}

function normalizeLaunchResult(value: unknown): CloakBrowserLaunchResult {
  const record = toRecord(value);
  const browser = record?.browser;
  const context = record?.context;

  if (
    isPlaywrightLikeBrowser(browser) &&
    isPlaywrightLikeContext(context)
  ) {
    return {
      browser,
      context,
    };
  }

  throw unsupportedCloakBrowserApiError();
}

function unsupportedCloakBrowserApiError(): BrowserProviderError {
  return new BrowserProviderError(
    "CLOAK_BROWSER_UNSUPPORTED_API",
    "CloakBrowser is available, but this adapter could not find a supported launch/context/page API. Use BROWSER_PROVIDER=playwright or update the CloakBrowser adapter.",
  );
}

function isPlaywrightLikeBrowser(
  value: unknown,
): value is PlaywrightLikeBrowser {
  return readFunction(toRecord(value), "close") !== undefined;
}

function isPlaywrightLikeContext(
  value: unknown,
): value is PlaywrightLikeBrowserContext {
  const record = toRecord(value);

  return (
    readFunction(record, "newPage") !== undefined &&
    readFunction(record, "close") !== undefined
  );
}

function readFunction(
  value: Record<string, unknown> | undefined,
  key: string,
): ((...args: unknown[]) => Promise<unknown>) | undefined {
  const rawValue = value?.[key];

  return typeof rawValue === "function"
    ? (rawValue as (...args: unknown[]) => Promise<unknown>)
    : undefined;
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

async function importUnknownModule(moduleName: string): Promise<unknown> {
  const importer = new Function(
    "moduleName",
    "return import(moduleName)",
  ) as (moduleName: string) => Promise<unknown>;

  return importer(moduleName);
}
