import type {
  BrowserProviderName,
  BrowserProviderPort,
} from "../../application";
import { CloakBrowserProvider } from "./cloak-browser-provider";
import { PlaywrightChromiumBrowserProvider } from "./playwright-chromium-browser-provider";

export type BrowserProviderCliValue = "playwright" | "cloakbrowser";

export interface BrowserProviderEnvironment {
  readonly BROWSER_PROVIDER?: string;
}

export interface ResolveBrowserProviderInput {
  readonly browserProvider?: BrowserProviderCliValue;
  readonly environment?: BrowserProviderEnvironment;
}

export type BrowserProviderResolution =
  | {
      readonly ok: true;
      readonly providerName: BrowserProviderName;
      readonly provider: BrowserProviderPort;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

export function resolveBrowserProvider(
  input: ResolveBrowserProviderInput = {},
): BrowserProviderResolution {
  const normalizedValue = normalizeBrowserProviderValue(
    input.browserProvider ?? input.environment?.BROWSER_PROVIDER,
  );

  if (!normalizedValue.ok) {
    return normalizedValue;
  }

  if (normalizedValue.value === "cloakbrowser") {
    return {
      ok: true,
      providerName: "CLOAK_BROWSER",
      provider: new CloakBrowserProvider(),
    };
  }

  return {
    ok: true,
    providerName: "PLAYWRIGHT_CHROMIUM",
    provider: new PlaywrightChromiumBrowserProvider(),
  };
}

export function normalizeBrowserProviderValue(
  value: string | undefined,
):
  | { readonly ok: true; readonly value: BrowserProviderCliValue }
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
    message:
      "Unknown browser provider. Use playwright or cloakbrowser.",
  };
}
