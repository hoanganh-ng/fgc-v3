import { describe, expect, it } from "vitest";
import type { ProvisioningConfiguration } from "./provisioning-http-client";
import {
  CloakBrowserProvisioningProvider,
  PlaywrightProvisioningBrowserProvider,
  ResolvedProvisioningBrowserLauncher,
  buildProvisioningBrowserProviderLaunchConfig,
  resolveProvisioningBrowserProvider,
  type ProvisioningBrowserProviderPage,
  type ProvisioningCookieShape,
} from "./provisioning-browser-provider";

describe("provisioning browser provider boundary", () => {
  it("resolves the default and explicit provisioning providers", () => {
    expect(resolveProvisioningBrowserProvider()).toMatchObject({
      ok: true,
      providerName: "PLAYWRIGHT_CHROMIUM",
    });
    expect(
      resolveProvisioningBrowserProvider({
        browserProvider: "playwright",
      }),
    ).toMatchObject({
      ok: true,
      providerName: "PLAYWRIGHT_CHROMIUM",
    });
    expect(
      resolveProvisioningBrowserProvider({
        browserProvider: "cloakbrowser",
      }),
    ).toMatchObject({
      ok: true,
      providerName: "CLOAK_BROWSER",
    });
    expect(
      resolveProvisioningBrowserProvider({
        environment: {
          BROWSER_PROVIDER: "unknown",
        },
      }),
    ).toEqual({
      ok: false,
      message: "Unknown browser provider. Use playwright or cloakbrowser.",
    });
  });

  it("builds headed launch config with exact profile-owned proxy and fingerprint settings", () => {
    const configuration = createConfiguration();

    expect(
      buildProvisioningBrowserProviderLaunchConfig({
        providerName: "CLOAK_BROWSER",
        configuration,
      }),
    ).toMatchObject({
      providerName: "CLOAK_BROWSER",
      profileId: "profile-1",
      headless: false,
      proxy: {
        server: "https://proxy.example.test:443",
        username: "REDACTED_PROXY_USERNAME",
        password: "REDACTED_PROXY_PASSWORD",
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
        seed: "profile-1",
        source: "PROFILE_ID",
      },
    });

    expect(
      buildProvisioningBrowserProviderLaunchConfig({
        providerName: "PLAYWRIGHT_CHROMIUM",
        configuration: {
          ...configuration,
          networkContext: {
            ...configuration.networkContext,
            proxy: {
              protocol: "SOCKS5",
              host: "proxy.example.test",
              port: 1080,
              credentials: null,
            },
          },
        },
      }).proxy,
    ).toEqual({
      server: "socks5://proxy.example.test:1080",
    });
  });

  it("launches Playwright headed and forwards context options without fallback", async () => {
    const browser = new FakeBrowser();
    const launchCalls: Array<{ readonly headless: boolean }> = [];
    const provider = new PlaywrightProvisioningBrowserProvider({
      launchChromium: async (options) => {
        launchCalls.push(options);

        return browser;
      },
    });

    await provider.launch(
      buildProvisioningBrowserProviderLaunchConfig({
        providerName: "PLAYWRIGHT_CHROMIUM",
        configuration: createConfiguration(),
      }),
    );

    expect(launchCalls).toEqual([
      {
        headless: false,
      },
    ]);
    expect(browser.newContextCalls).toEqual([
      {
        userAgent: "Synthetic Browser",
        viewport: {
          width: 1440,
          height: 900,
        },
        deviceScaleFactor: 2,
        locale: "en-US",
        extraHTTPHeaders: {
          "Accept-Language": "en-US,en",
        },
        timezoneId: "America/Los_Angeles",
        proxy: {
          server: "https://proxy.example.test:443",
          username: "REDACTED_PROXY_USERNAME",
          password: "REDACTED_PROXY_PASSWORD",
        },
      },
    ]);
  });

  it("launches CloakBrowser headed and does not fall back when unavailable", async () => {
    const browser = new FakeBrowser();
    const cloakLaunchCalls: unknown[] = [];
    const provider = new CloakBrowserProvisioningProvider({
      importModule: async () => ({
        launch: async (options: unknown) => {
          cloakLaunchCalls.push(options);

          return {
            browser,
            context: browser.context,
          };
        },
      }),
    });

    await provider.launch(
      buildProvisioningBrowserProviderLaunchConfig({
        providerName: "CLOAK_BROWSER",
        configuration: createConfiguration(),
      }),
    );

    expect(cloakLaunchCalls).toEqual([
      {
        headless: false,
        profileId: "profile-1",
        proxy: {
          server: "https://proxy.example.test:443",
          username: "REDACTED_PROXY_USERNAME",
          password: "REDACTED_PROXY_PASSWORD",
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
          seed: "profile-1",
          source: "PROFILE_ID",
          profileOwnedConfig: createConfiguration().hardwareFingerprint,
        },
      },
    ]);

    const unavailableProvider = new CloakBrowserProvisioningProvider({
      importModule: async () => {
        throw new Error("module unavailable");
      },
    });

    await expect(
      unavailableProvider.launch(
        buildProvisioningBrowserProviderLaunchConfig({
          providerName: "CLOAK_BROWSER",
          configuration: createConfiguration(),
        }),
      ),
    ).rejects.toThrow(
      "CloakBrowser provider is experimental and is not available locally.",
    );
  });

  it("normalizes Playwright and CloakBrowser sessions into the provisioning auth payload", async () => {
    for (const provider of [
      new PlaywrightProvisioningBrowserProvider({
        launchChromium: async () => new FakeBrowser(),
      }),
      new CloakBrowserProvisioningProvider({
        importModule: async () => ({
          launch: async () => {
            const browser = new FakeBrowser();

            return {
              browser,
              context: browser.context,
            };
          },
        }),
      }),
    ]) {
      const launcher = new ResolvedProvisioningBrowserLauncher(provider);
      const session = await launcher.launch(createConfiguration());

      await session.openLoginPage();
      const capturedState = await session.captureSessionState();
      await session.close();

      expect(capturedState).toEqual({
        cookies: [
          {
            name: "c_user",
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
            key: "session-key",
            value: "local-storage-value",
          },
          {
            origin: "https://m.facebook.com",
            key: "session-key",
            value: "local-storage-value",
          },
          {
            origin: "https://fb.com",
            key: "session-key",
            value: "local-storage-value",
          },
        ],
      });
    }
  });
});

class FakeBrowser {
  public readonly context = new FakeContext();
  public readonly newContextCalls: Record<string, unknown>[] = [];
  public closeCalls = 0;

  public async newContext(
    options: Record<string, unknown>,
  ): Promise<FakeContext> {
    this.newContextCalls.push(options);

    return this.context;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class FakeContext {
  public readonly cookiesCalls: readonly string[][] = [];
  public closeCalls = 0;

  public async newPage(): Promise<ProvisioningBrowserProviderPage> {
    return new FakePage();
  }

  public async cookies(
    urls: readonly string[],
  ): Promise<readonly ProvisioningCookieShape[]> {
    this.cookiesCalls.concat([[...urls]]);

    return [
      {
        name: "c_user",
        value: "session-cookie-value",
        domain: ".facebook.com",
        path: "/",
        expires: 1_767_225_600,
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
      },
    ];
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class FakePage implements ProvisioningBrowserProviderPage {
  public currentUrl = "about:blank";
  public closeCalls = 0;

  public async goto(
    url: string,
    _options: {
      readonly waitUntil: "domcontentloaded";
      readonly timeout: number;
    },
  ): Promise<unknown> {
    this.currentUrl = url;

    return null;
  }

  public async evaluate<T = unknown>(_script: string): Promise<T> {
    if (
      this.currentUrl === "https://www.facebook.com" ||
      this.currentUrl === "https://m.facebook.com" ||
      this.currentUrl === "https://fb.com"
    ) {
      return [
        {
          key: "session-key",
          value: "local-storage-value",
        },
      ] as T;
    }

    return [] as T;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

function createConfiguration(): ProvisioningConfiguration {
  return {
    profileId: "profile-1",
    networkContext: {
      proxy: {
        protocol: "HTTPS",
        host: "proxy.example.test",
        port: 443,
        credentials: {
          username: "REDACTED_PROXY_USERNAME",
          password: "REDACTED_PROXY_PASSWORD",
        },
      },
      killswitch: {
        enabled: true,
        failClosed: true,
      },
    },
    hardwareFingerprint: {
      userAgent: "Synthetic Browser",
      viewport: {
        width: 1440,
        height: 900,
        deviceScaleFactor: 2,
      },
      languages: ["en-US", "en"],
      hardwareConcurrency: 8,
      platform: "Linux x86_64",
      deviceMemoryGb: 8,
      timezone: "America/Los_Angeles",
    },
  };
}
