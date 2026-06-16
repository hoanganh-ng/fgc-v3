import {
  BrowserProviderError,
  type BrowserProviderLaunchConfig,
  type BrowserProviderPort,
  type BrowserProviderSession,
} from "../../application";
import {
  createPlaywrightLikeContextOnlySession,
  type PlaywrightLikeBrowserContext,
} from "./playwright-like-browser-session";

type UnknownModuleImporter = (moduleName: string) => Promise<unknown>;

interface CloakBrowserProviderOptions {
  readonly importModule?: UnknownModuleImporter;
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

    return launchCloakBrowserSession(moduleValue, config, this.providerName);
  }
}

async function launchCloakBrowserSession(
  moduleValue: unknown,
  config: BrowserProviderLaunchConfig,
  providerName: "CLOAK_BROWSER",
): Promise<BrowserProviderSession> {
  const moduleRecord = toRecord(moduleValue);
  const defaultExport = toRecord(moduleRecord?.default);
  const launchContext =
    readFunction(moduleRecord, "launchContext") ??
    readFunction(defaultExport, "launchContext");
  const launchOptions = toCloakBrowserLaunchOptions(config);

  if (launchContext !== undefined) {
    const context = await launchContext(launchOptions);

    if (!isPlaywrightLikeContext(context)) {
      await closeIfPossibleIgnoringErrors(context);
      throw unsupportedCloakBrowserApiError();
    }

    return createPlaywrightLikeContextOnlySession(providerName, context);
  }

  // Legacy speculative paths removed. Only the documented launchContext API is supported.
  throw unsupportedCloakBrowserApiError();
}

function toCloakBrowserLaunchOptions(
  config: BrowserProviderLaunchConfig,
): Record<string, unknown> {
  return {
    headless: config.headless,
    ...(config.proxy !== undefined ? { proxy: config.proxy } : {}),
    ...(config.viewport !== undefined ? { viewport: config.viewport } : {}),
    ...(config.userAgent !== undefined ? { userAgent: config.userAgent } : {}),
    ...(config.locale !== undefined ? { locale: config.locale } : {}),
    ...(config.timezoneId !== undefined ? { timezone: config.timezoneId } : {}),
    contextOptions: {
      storageState: config.storageState,
      ...(config.deviceScaleFactor !== undefined
        ? { deviceScaleFactor: config.deviceScaleFactor }
        : {}),
      ...(config.acceptLanguageHeader !== undefined
        ? {
            extraHTTPHeaders: {
              "Accept-Language": config.acceptLanguageHeader,
            },
          }
        : {}),
    },
  };
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

async function closeIfPossibleIgnoringErrors(value: unknown): Promise<void> {
  const close = readFunction(toRecord(value), "close");

  if (close === undefined) {
    return;
  }

  try {
    await close();
  } catch {}
}

function unsupportedCloakBrowserApiError(): BrowserProviderError {
  return new BrowserProviderError(
    "CLOAK_BROWSER_UNSUPPORTED_API",
    "CloakBrowser is available, but this adapter could not find a supported launchContext API. Use BROWSER_PROVIDER=playwright or update the CloakBrowser adapter.",
  );
}

async function importUnknownModule(moduleName: string): Promise<unknown> {
  const importer = new Function(
    "moduleName",
    "return import(moduleName)",
  ) as (moduleName: string) => Promise<unknown>;

  return importer(moduleName);
}
