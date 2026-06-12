import { describe, expect, it } from "vitest";
import {
  BrowserProviderError,
  type BrowserProviderLaunchConfig,
  type BrowserProviderName,
  type BrowserProviderPage,
  type BrowserProviderPort,
  type BrowserProviderResponse,
  type BrowserProviderSession,
  type RuntimeProfileConfiguration,
  type RuntimeProfileConfigurationPort,
} from "../application";
import {
  CloakBrowserProvider,
  FacebookBrowserPayloadCaptureAdapter,
  buildBrowserProviderLaunchConfig,
  resolveBrowserProvider,
} from "./index";

describe("browser provider boundary", () => {
  it("resolves the default and explicit providers", () => {
    expect(resolveBrowserProvider()).toMatchObject({
      ok: true,
      providerName: "PLAYWRIGHT_CHROMIUM",
    });
    expect(resolveBrowserProvider({ browserProvider: "playwright" })).toMatchObject(
      {
        ok: true,
        providerName: "PLAYWRIGHT_CHROMIUM",
      },
    );
    expect(
      resolveBrowserProvider({ browserProvider: "cloakbrowser" }),
    ).toMatchObject({
      ok: true,
      providerName: "CLOAK_BROWSER",
    });
    expect(
      resolveBrowserProvider({
        environment: {
          BROWSER_PROVIDER: "unknown",
        },
      }),
    ).toEqual({
      ok: false,
      message: "Unknown browser provider. Use playwright or cloakbrowser.",
    });
  });

  it("builds provider launch config from trusted runtime profile config", () => {
    const launchConfig = buildBrowserProviderLaunchConfig({
      providerName: "PLAYWRIGHT_CHROMIUM",
      configuration: createRuntimeProfileConfiguration(),
      headless: false,
    });

    expect(launchConfig).toMatchObject({
      providerName: "PLAYWRIGHT_CHROMIUM",
      profileId: "profile-1",
      leaseId: "lease-1",
      headless: false,
      proxy: {
        server: "https://proxy.example.test:443",
        username: "proxy-user",
        password: "proxy-password",
      },
      viewport: {
        width: 1440,
        height: 900,
      },
      deviceScaleFactor: 2,
      userAgent: "Synthetic Browser",
      locale: "en-US",
      acceptLanguageHeader: "en-US,en",
      timezoneId: "America/Los_Angeles",
      fingerprint: {
        seed: "profile-owned-seed",
        source: "PROFILE_MANAGER",
      },
    });
    expect(launchConfig.storageState.cookies).toEqual([
      {
        name: "session",
        value: "session-cookie-value",
        domain: ".facebook.com",
        path: "/",
        expires: 1_767_225_600,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ]);
    expect(launchConfig.storageState.origins).toEqual([
      {
        origin: "https://www.facebook.com",
        localStorage: [
          {
            name: "session",
            value: "local-storage-value",
          },
        ],
      },
    ]);
  });

  it("fails fast for missing or incomplete profile-owned runtime config", () => {
    expect(() =>
      buildBrowserProviderLaunchConfig({
        providerName: "PLAYWRIGHT_CHROMIUM",
        configuration: {
          ...createRuntimeProfileConfiguration(),
          authenticationState: undefined,
        },
        headless: false,
      }),
    ).toThrow("Runtime profile authenticationState configuration is missing.");

    expect(() =>
      buildBrowserProviderLaunchConfig({
        providerName: "PLAYWRIGHT_CHROMIUM",
        configuration: {
          ...createRuntimeProfileConfiguration(),
          networkContext: {
            proxy: {
              protocol: "HTTPS",
              host: "proxy.example.test",
            },
          },
        },
        headless: false,
      }),
    ).toThrow("Runtime profile proxy configuration is incomplete.");
  });

  it("attaches page instrumentation through the provider abstraction", async () => {
    const provider = new FakeBrowserProvider("PLAYWRIGHT_CHROMIUM");
    const runtimeProfileConfigurationPort =
      new FakeRuntimeProfileConfigurationPort();
    const adapter = new FacebookBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort,
      browserProvider: provider,
      maxScrolls: 0,
      maxDurationMs: 1,
    });

    const result = await adapter.captureGroupPayloads({
      sourceGroupId: "source-group-1",
      sourceGroupUrl: "https://www.facebook.com/groups/group-1",
      profileId: "profile-1",
      leaseId: "lease-1",
    });

    expect(result.ok).toBe(true);
    expect(provider.launchCalls[0]).toMatchObject({
      profileId: "profile-1",
      leaseId: "lease-1",
      userAgent: "Synthetic Browser",
      proxy: {
        server: "https://proxy.example.test:443",
      },
    });
    expect(provider.page?.exposedBindings).toEqual([
      "__fgcFacebookPayloadCaptured",
      "__fgcFacebookPayloadParseFailed",
    ]);
    expect(provider.page?.initScripts.join("\n")).toContain(
      "XMLHttpRequest.prototype.send",
    );
  });

  it("redacts provider launch errors before returning capture failures", async () => {
    const provider = new FakeBrowserProvider("PLAYWRIGHT_CHROMIUM");
    provider.launchError = new Error(
      "Failed through proxy-password with session-cookie-value and local-storage-value.",
    );
    const adapter = new FacebookBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider: provider,
      maxScrolls: 0,
      maxDurationMs: 1,
    });

    const result = await adapter.captureGroupPayloads({
      sourceGroupId: "source-group-1",
      sourceGroupUrl: "https://www.facebook.com/groups/group-1",
      profileId: "profile-1",
      leaseId: "lease-1",
    });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "FACEBOOK_BROWSER_CAPTURE_FAILED",
    });
    expect(JSON.stringify(result)).not.toContain("proxy-password");
    expect(JSON.stringify(result)).not.toContain("session-cookie-value");
    expect(JSON.stringify(result)).not.toContain("local-storage-value");
  });

  it("fails CloakBrowser setup gracefully when the package is unavailable", async () => {
    const provider = new CloakBrowserProvider({
      importModule: async () => {
        throw new Error("missing package");
      },
    });

    await expect(
      provider.launch(
        buildBrowserProviderLaunchConfig({
          providerName: "CLOAK_BROWSER",
          configuration: createRuntimeProfileConfiguration(),
          headless: true,
        }),
      ),
    ).rejects.toMatchObject({
      code: "CLOAK_BROWSER_UNAVAILABLE",
      message:
        "CloakBrowser provider is experimental and is not available locally. Install and configure CloakBrowser for this workspace, or use BROWSER_PROVIDER=playwright.",
    });
  });
});

class FakeRuntimeProfileConfigurationPort
  implements RuntimeProfileConfigurationPort {
  public async getRuntimeProfileConfiguration() {
    return {
      ok: true as const,
      configuration: createRuntimeProfileConfiguration(),
    };
  }
}

class FakeBrowserProvider implements BrowserProviderPort {
  public readonly launchCalls: BrowserProviderLaunchConfig[] = [];
  public readonly page = new FakeBrowserPage();
  public launchError: unknown;

  public constructor(public readonly providerName: BrowserProviderName) {}

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    this.launchCalls.push(config);

    if (this.launchError !== undefined) {
      throw this.launchError;
    }

    return new FakeBrowserProviderSession(this.providerName, this.page);
  }
}

class FakeBrowserProviderSession implements BrowserProviderSession {
  public closeCalls = 0;

  public constructor(
    public readonly providerName: BrowserProviderName,
    private readonly page: BrowserProviderPage,
  ) {}

  public async newPage(): Promise<BrowserProviderPage> {
    return this.page;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class FakeBrowserPage implements BrowserProviderPage {
  public readonly exposedBindings: string[] = [];
  public readonly initScripts: string[] = [];
  private currentUrl = "about:blank";

  public url(): string {
    return this.currentUrl;
  }

  public async goto(input: {
    readonly url: string;
    readonly waitUntil: "domcontentloaded";
    readonly timeoutMs: number;
  }): Promise<{ readonly status: number } | null> {
    this.currentUrl = input.url;

    return {
      status: 200,
    };
  }

  public async evaluate<T = unknown>(): Promise<T> {
    return undefined as T;
  }

  public async exposeBinding(
    name: string,
    _callback: (message: unknown) => void,
  ): Promise<void> {
    this.exposedBindings.push(name);
  }

  public async addInitScript(input: { readonly content: string }): Promise<void> {
    this.initScripts.push(input.content);
  }

  public onResponse(_listener: (response: BrowserProviderResponse) => void): void {}

  public oncePageError(_listener: (error: Error) => void): void {}

  public offPageError(_listener: (error: Error) => void): void {}

  public onceCrash(_listener: () => void): void {}

  public offCrash(_listener: () => void): void {}
}

function createRuntimeProfileConfiguration(): RuntimeProfileConfiguration {
  return {
    profileId: "profile-1",
    leaseId: "lease-1",
    hardwareFingerprint: {
      userAgent: "Synthetic Browser",
      viewport: {
        width: 1440,
        height: 900,
        deviceScaleFactor: 2,
      },
      languages: ["en-US", "en"],
      timezone: "America/Los_Angeles",
      fingerprintSeed: "profile-owned-seed",
    },
    networkContext: {
      proxy: {
        protocol: "HTTPS",
        host: "proxy.example.test",
        port: 443,
        credentials: {
          username: "proxy-user",
          password: "proxy-password",
        },
      },
      killswitch: {
        enabled: true,
        failClosed: true,
      },
    },
    authenticationState: {
      cookies: [
        {
          name: "session",
          value: "session-cookie-value",
          domain: ".facebook.com",
          path: "/",
          expiresAt: "2026-01-01T00:00:00.000Z",
          httpOnly: true,
          secure: true,
          sameSite: "LAX",
        },
      ],
      localStorage: [
        {
          origin: "https://www.facebook.com",
          key: "session",
          value: "local-storage-value",
        },
      ],
      sessionCapturedAt: "2025-12-01T00:00:00.000Z",
      sessionExpiresAt: "2026-01-01T00:00:00.000Z",
    },
    temporalRoutine: {
      timezone: "America/Los_Angeles",
    },
  };
}
