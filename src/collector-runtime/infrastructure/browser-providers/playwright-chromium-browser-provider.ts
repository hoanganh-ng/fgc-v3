import { chromium } from "playwright";
import type { BrowserContextOptions } from "playwright";
import {
  BrowserProviderError,
  type BrowserProviderLaunchConfig,
  type BrowserProviderPort,
  type BrowserProviderSession,
} from "../../application";
import { createPlaywrightLikeBrowserProviderSession } from "./playwright-like-browser-session";

export class PlaywrightChromiumBrowserProvider implements BrowserProviderPort {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    if (config.providerName !== this.providerName) {
      throw new BrowserProviderError(
        "BROWSER_PROVIDER_CONFIGURATION_INVALID",
        "Browser provider launch config does not match Playwright Chromium.",
      );
    }

    try {
      const browser = await chromium.launch({
        headless: config.headless,
      });
      const context = await browser.newContext(toBrowserContextOptions(config));

      return createPlaywrightLikeBrowserProviderSession(
        this.providerName,
        browser,
        context,
      );
    } catch (error) {
      throw toBrowserProviderLaunchError(error);
    }
  }
}

function toBrowserContextOptions(
  config: BrowserProviderLaunchConfig,
): BrowserContextOptions {
  return {
    storageState: {
      cookies: [...config.storageState.cookies],
      origins: config.storageState.origins.map((origin) => ({
        origin: origin.origin,
        localStorage: [...origin.localStorage],
      })),
    },
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

function toBrowserProviderLaunchError(error: unknown): BrowserProviderError {
  if (error instanceof BrowserProviderError) {
    return error;
  }

  return new BrowserProviderError(
    "BROWSER_PROVIDER_LAUNCH_FAILED",
    error instanceof Error ? error.message : "Browser launch failed.",
  );
}
