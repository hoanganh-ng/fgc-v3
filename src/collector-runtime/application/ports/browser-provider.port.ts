export type BrowserProviderName = "PLAYWRIGHT_CHROMIUM" | "CLOAK_BROWSER";

export type BrowserProviderFailureCode =
  | "BROWSER_PROVIDER_CONFIGURATION_INVALID"
  | "BROWSER_PROVIDER_LAUNCH_FAILED"
  | "CLOAK_BROWSER_UNAVAILABLE"
  | "CLOAK_BROWSER_UNSUPPORTED_API";

export interface BrowserProviderProxySettings {
  readonly server: string;
  readonly username?: string;
  readonly password?: string;
}

export interface BrowserProviderViewport {
  readonly width: number;
  readonly height: number;
}

export interface BrowserProviderStorageCookie {
  readonly name: string;
  readonly value: string;
  readonly domain: string;
  readonly path: string;
  readonly expires: number;
  readonly httpOnly: boolean;
  readonly secure: boolean;
  readonly sameSite: "Strict" | "Lax" | "None";
}

export interface BrowserProviderLocalStorageOrigin {
  readonly origin: string;
  readonly localStorage: readonly {
    readonly name: string;
    readonly value: string;
  }[];
}

export interface BrowserProviderStorageState {
  readonly cookies: readonly BrowserProviderStorageCookie[];
  readonly origins: readonly BrowserProviderLocalStorageOrigin[];
}

export interface BrowserProviderFingerprintConfig {
  readonly seed: string;
  readonly source: "PROFILE_ID" | "PROFILE_MANAGER";
  readonly profileOwnedConfig?: unknown;
}

export interface BrowserProviderLaunchConfig {
  readonly providerName: BrowserProviderName;
  readonly profileId: string;
  readonly leaseId: string;
  readonly headless: boolean;
  readonly storageState: BrowserProviderStorageState;
  readonly proxy?: BrowserProviderProxySettings;
  readonly viewport?: BrowserProviderViewport;
  readonly deviceScaleFactor?: number;
  readonly userAgent?: string;
  readonly locale?: string;
  readonly acceptLanguageHeader?: string;
  readonly timezoneId?: string;
  readonly fingerprint?: BrowserProviderFingerprintConfig;
}

export interface BrowserProviderNavigationInput {
  readonly url: string;
  readonly waitUntil: "domcontentloaded";
  readonly timeoutMs: number;
}

export interface BrowserProviderNavigationResult {
  readonly status: number;
}

export interface BrowserProviderResponse {
  url(): string;
  headers(): Record<string, string | undefined>;
  text(): Promise<string>;
}

export interface BrowserProviderPage {
  url(): string;
  goto(
    input: BrowserProviderNavigationInput,
  ): Promise<BrowserProviderNavigationResult | null>;
  evaluate<T = unknown>(script: string): Promise<T>;
  exposeBinding(
    name: string,
    callback: (message: unknown) => void,
  ): Promise<void>;
  addInitScript(input: { readonly content: string }): Promise<void>;
  onResponse(listener: (response: BrowserProviderResponse) => void): void;
  oncePageError(listener: (error: Error) => void): void;
  offPageError(listener: (error: Error) => void): void;
  onceCrash(listener: () => void): void;
  offCrash(listener: () => void): void;
}

export interface BrowserProviderSession {
  readonly providerName: BrowserProviderName;
  newPage(): Promise<BrowserProviderPage>;
  close(): Promise<void>;
}

export interface BrowserProviderPort {
  readonly providerName: BrowserProviderName;
  launch(config: BrowserProviderLaunchConfig): Promise<BrowserProviderSession>;
}

export class BrowserProviderError extends Error {
  public constructor(
    public readonly code: BrowserProviderFailureCode,
    message: string,
  ) {
    super(message);
    this.name = "BrowserProviderError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
