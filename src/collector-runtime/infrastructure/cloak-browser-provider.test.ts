import { describe, expect, it } from "vitest";
import {
  BrowserProviderError,
  type BrowserProviderPage,
  type BrowserProviderResponse,
  type BrowserProviderSession,
} from "../application";
import {
  CloakBrowserProvider,
  buildBrowserProviderLaunchConfig,
} from "./index";
import type { PlaywrightLikeBrowserContext, PlaywrightLikePage } from "./browser-providers/playwright-like-browser-session";

function createLaunchConfig(overrides?: Record<string, unknown>) {
  return buildBrowserProviderLaunchConfig({
    providerName: "CLOAK_BROWSER",
    configuration: {
      profileId: "probe-profile",
      leaseId: "probe-lease",
      hardwareFingerprint: {
        userAgent: "Mozilla/5.0 CloakBrowserTest",
        viewport: { width: 1280, height: 720, deviceScaleFactor: 2 },
        languages: ["en-US", "en"],
        timezone: "UTC",
        fingerprintSeed: "probe-seed",
      },
      networkContext: {
        mode: "PROXY",
        proxy: {
          protocol: "HTTPS",
          host: "proxy.example.test",
          port: 8080,
          credentials: { username: "u", password: "p" },
        },
        killswitch: { enabled: false, failClosed: false },
      },
      authenticationState: {
        cookies: [
          {
            name: "c_user",
            value: "12345",
            domain: ".facebook.com",
            path: "/",
            expiresAt: "2030-01-01T00:00:00.000Z",
            httpOnly: true,
            secure: true,
            sameSite: "LAX",
          },
        ],
        localStorage: [
          {
            origin: "https://www.facebook.com",
            key: "lsKey",
            value: "lsVal",
          },
        ],
        sessionCapturedAt: "2025-01-01T00:00:00.000Z",
        sessionExpiresAt: "2030-01-01T00:00:00.000Z",
      },
      temporalRoutine: { timezone: "UTC" },
      ...overrides,
    },
    headless: true,
  });
}

describe("CloakBrowserProvider (Collector Runtime)", () => {
  it("throws CLOAK_BROWSER_UNAVAILABLE when module import fails", async () => {
    const provider = new CloakBrowserProvider({
      importModule: async () => {
        throw new Error("MODULE_NOT_FOUND");
      },
    });

    await expect(provider.launch(createLaunchConfig())).rejects.toMatchObject({
      code: "CLOAK_BROWSER_UNAVAILABLE",
    });
  });

  it("throws CLOAK_BROWSER_UNSUPPORTED_API when module has no launchContext", async () => {
    const provider = new CloakBrowserProvider({
      importModule: async () => ({ someOtherExport: () => {} }),
    });

    await expect(provider.launch(createLaunchConfig())).rejects.toMatchObject({
      code: "CLOAK_BROWSER_UNSUPPORTED_API",
    });
  });

  it("throws CLOAK_BROWSER_UNSUPPORTED_API when module has only legacy launch API", async () => {
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launch: async () => ({ browser: {}, context: {} }),
        chromium: { launch: async () => ({}) },
      }),
    });

    await expect(provider.launch(createLaunchConfig())).rejects.toMatchObject({
      code: "CLOAK_BROWSER_UNSUPPORTED_API",
    });
  });

  it("uses named launchContext export", async () => {
    const fakeContext = new FakeContext();
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async () => fakeContext,
      }),
    });

    const session = await provider.launch(createLaunchConfig());
    expect(session.providerName).toBe("CLOAK_BROWSER");
    await session.close();
    expect(fakeContext.closeCalls).toBe(1);
  });

  it("uses default export launchContext when named export is absent", async () => {
    const fakeContext = new FakeContext();
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        default: {
          launchContext: async () => fakeContext,
        },
      }),
    });

    const session = await provider.launch(createLaunchConfig());
    expect(session.providerName).toBe("CLOAK_BROWSER");
    await session.close();
    expect(fakeContext.closeCalls).toBe(1);
  });

  it("passes proxy and launch options to launchContext", async () => {
    const fakeContext = new FakeContext();
    const receivedOptions: unknown[] = [];
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async (options: unknown) => {
          receivedOptions.push(options);
          return fakeContext;
        },
      }),
    });

    await provider.launch(createLaunchConfig());

    expect(receivedOptions).toHaveLength(1);
    const opts = receivedOptions[0] as Record<string, unknown>;
    expect(opts.headless).toBe(true);
    expect(opts.proxy).toMatchObject({
      server: "https://proxy.example.test:8080",
      username: "u",
      password: "p",
    });
    expect(opts.userAgent).toBe("Mozilla/5.0 CloakBrowserTest");
    expect(opts.locale).toBe("en-US");
    expect(opts.timezone).toBe("UTC");
    const contextOpts = opts.contextOptions as Record<string, unknown>;
    expect(contextOpts.deviceScaleFactor).toBe(2);
    expect((contextOpts.extraHTTPHeaders as Record<string, string>)["Accept-Language"]).toBe("en-US,en");
    expect(opts.storageState).toBeUndefined();
  });

  it("omits proxy options for DIRECT network mode", async () => {
    const fakeContext = new FakeContext();
    const receivedOptions: unknown[] = [];
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async (options: unknown) => {
          receivedOptions.push(options);
          return fakeContext;
        },
      }),
    });

    await provider.launch(
      createLaunchConfig({
        networkContext: {
          mode: "DIRECT",
          proxy: null,
          killswitch: { enabled: false, failClosed: false },
        },
      }),
    );

    expect(receivedOptions).toHaveLength(1);
    const opts = receivedOptions[0] as Record<string, unknown>;
    expect(opts.proxy).toBeUndefined();
  });

  it("fails closed for UNCONFIGURED network mode before launch", () => {
    expect(() =>
      createLaunchConfig({
        networkContext: {
          mode: "UNCONFIGURED",
          proxy: null,
          killswitch: { enabled: true, failClosed: true },
        },
      }),
    ).toThrow("Runtime profile network mode is missing or unsupported.");
  });

  it("passes storageState inside contextOptions", async () => {
    const fakeContext = new FakeContext();
    const receivedOptions: unknown[] = [];
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async (options: unknown) => {
          receivedOptions.push(options);
          return fakeContext;
        },
      }),
    });

    await provider.launch(createLaunchConfig());

    const opts = receivedOptions[0] as Record<string, unknown>;
    const contextOpts = opts.contextOptions as Record<string, unknown>;
    const storageState = contextOpts.storageState as {
      cookies: unknown[];
      origins: unknown[];
    };
    expect(storageState.cookies).toHaveLength(1);
    expect(storageState.origins).toHaveLength(1);
  });

  it("returned context supports newPage and close", async () => {
    const fakeContext = new FakeContext();
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async () => fakeContext,
      }),
    });

    const session = await provider.launch(createLaunchConfig());
    const page = await session.newPage();
    expect(typeof page.goto).toBe("function");
    expect(typeof page.evaluate).toBe("function");
    expect(typeof page.exposeBinding).toBe("function");
    expect(typeof page.addInitScript).toBe("function");
    expect(typeof page.onResponse).toBe("function");
    expect(typeof page.oncePageError).toBe("function");
    expect(typeof page.offPageError).toBe("function");
    expect(typeof page.onceCrash).toBe("function");
    expect(typeof page.offCrash).toBe("function");
  });

  it("closes context exactly once and not twice", async () => {
    const fakeContext = new FakeContext();
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async () => fakeContext,
      }),
    });

    const session = await provider.launch(createLaunchConfig());
    await session.close();
    await session.close();
    expect(fakeContext.closeCalls).toBe(1);
  });

  it("does not require a separate browser object", async () => {
    const fakeContext = new FakeContext();
    let launchContextCallCount = 0;
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async () => {
          launchContextCallCount += 1;
          return fakeContext;
        },
      }),
    });

    const session = await provider.launch(createLaunchConfig());
    await session.close();
    expect(launchContextCallCount).toBe(1);
    // No browser.close call needed — only context.close
    expect(fakeContext.closeCalls).toBe(1);
  });

  it("throws CLOAK_BROWSER_UNSUPPORTED_API when launchContext returns non-context shape", async () => {
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async () => ({ notAContext: true }),
      }),
    });

    await expect(provider.launch(createLaunchConfig())).rejects.toMatchObject({
      code: "CLOAK_BROWSER_UNSUPPORTED_API",
    });
  });

  it("no Playwright or direct fallback when launchContext is absent", async () => {
    let launchContextCalled = false;
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async () => {
          launchContextCalled = true;
          throw new Error("network error");
        },
      }),
    });

    await expect(provider.launch(createLaunchConfig())).rejects.toBeInstanceOf(Error);
    expect(launchContextCalled).toBe(true);
  });

  it("page supports response listeners, bindings, init scripts, evaluation, navigation, page errors, and crash handling", async () => {
    const fakePage = new FakePage();
    const fakeContext = new FakeContext(fakePage);
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async () => fakeContext,
      }),
    });

    const session = await provider.launch(createLaunchConfig());
    const page = await session.newPage();

    // response listener
    const responseListener = (_r: BrowserProviderResponse) => {};
    page.onResponse(responseListener);
    expect(fakePage.responseListeners).toContain(responseListener);

    // binding
    const bindingCallback = (_msg: unknown) => {};
    await page.exposeBinding("testBinding", bindingCallback);
    expect(fakePage.exposedBindings).toContain("testBinding");

    // init script
    await page.addInitScript({ content: "window.__test = 1;" });
    expect(fakePage.initScripts).toContain("window.__test = 1;");

    // evaluate
    const evalResult = await page.evaluate("1+1");
    expect(evalResult).toBe(2);

    // navigation
    const navResult = await page.goto({
      url: "https://example.com",
      waitUntil: "domcontentloaded",
      timeoutMs: 5000,
    });
    expect(navResult?.status).toBe(200);

    // page error handler
    const errorHandler = (_e: Error) => {};
    page.oncePageError(errorHandler);
    page.offPageError(errorHandler);

    // crash handler
    const crashHandler = () => {};
    page.onceCrash(crashHandler);
    page.offCrash(crashHandler);

    await session.close();
  });

  it("throws BROWSER_PROVIDER_CONFIGURATION_INVALID for wrong providerName in config", async () => {
    const provider = new CloakBrowserProvider({
      importModule: async () => ({
        launchContext: async () => new FakeContext(),
      }),
    });
    const config = buildBrowserProviderLaunchConfig({
      providerName: "PLAYWRIGHT_CHROMIUM",
      configuration: {
        profileId: "p",
        leaseId: "l",
        hardwareFingerprint: {
          userAgent: "UA",
          viewport: { width: 1280, height: 720 },
          languages: ["en"],
          timezone: "UTC",
        },
        networkContext: {
          mode: "DIRECT",
          proxy: null,
          killswitch: { enabled: false, failClosed: false },
        },
        authenticationState: {
          cookies: [],
          localStorage: [],
          sessionCapturedAt: null,
          sessionExpiresAt: null,
        },
        temporalRoutine: { timezone: "UTC" },
      },
      headless: true,
    });

    await expect(provider.launch(config)).rejects.toMatchObject({
      code: "BROWSER_PROVIDER_CONFIGURATION_INVALID",
    });
  });
});

class FakePage implements PlaywrightLikePage {
  public readonly responseListeners: Array<(r: PlaywrightLikeResponse) => void> = [];
  public readonly exposedBindings: string[] = [];
  public readonly initScripts: string[] = [];
  public currentUrl = "about:blank";

  public url(): string {
    return this.currentUrl;
  }

  public async goto(
    url: string,
    _options: { readonly waitUntil: "domcontentloaded"; readonly timeout: number },
  ) {
    this.currentUrl = url;
    return { status: () => 200 };
  }

  public async evaluate<T = unknown>(script: string): Promise<T> {
    if (script === "1+1") return 2 as T;
    return undefined as T;
  }

  public async exposeBinding(name: string, _cb: (source: unknown, message: unknown) => void) {
    this.exposedBindings.push(name);
  }

  public async addInitScript(input: { readonly content: string }) {
    this.initScripts.push(input.content);
  }

  public on(event: "response", listener: (r: PlaywrightLikeResponse) => void): void {
    if (event === "response") {
      this.responseListeners.push(listener);
    }
  }

  public once(_event: "pageerror" | "crash", _listener: ((error: Error) => void) | (() => void)): void {}
  public off(_event: "pageerror" | "crash", _listener: ((error: Error) => void) | (() => void)): void {}
}

interface PlaywrightLikeResponse {
  url(): string;
  headers(): Record<string, string | undefined>;
  text(): Promise<string>;
}

class FakeContext implements PlaywrightLikeBrowserContext {
  public closeCalls = 0;
  private readonly page: FakePage;

  public constructor(page?: FakePage) {
    this.page = page ?? new FakePage();
  }

  public async newPage(): Promise<FakePage> {
    return this.page;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}
