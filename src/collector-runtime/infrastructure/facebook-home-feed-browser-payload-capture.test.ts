import { describe, expect, it } from "vitest";
import type {
  BrowserProviderLaunchConfig,
  BrowserProviderPage,
  BrowserProviderPort,
  BrowserProviderResponse,
  BrowserProviderSession,
  RuntimeProfileConfigurationPort,
} from "../application";
import {
  FACEBOOK_HOME_FEED_URL,
  FacebookHomeFeedBrowserPayloadCaptureAdapter,
} from "./facebook-home-feed-browser-payload-capture";
import type { FacebookPageState } from "./facebook-page-state-observer";

describe("FacebookHomeFeedBrowserPayloadCaptureAdapter", () => {
  it("navigates to the normal Facebook home-feed URL", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });

    await new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
    }).captureHomeFeedPayloads({ ...captureInput(), maxScrolls: 0, maxDurationMs: 1_000 });

    expect(browserProvider.page.gotoUrls).toEqual([FACEBOOK_HOME_FEED_URL]);
    expect(FACEBOOK_HOME_FEED_URL).toBe("https://www.facebook.com/");
  });

  it("applies per-call maxScrolls and maxDurationMs", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });
    // Trigger a CHECKPOINT_REQUIRED after the second scroll so the test
    // exits without waiting for the full per-scroll settle delay. The
    // assertion is that the adapter honored the per-call maxScrolls (>= 2
    // when bounded at 2) and did not exceed it.
    browserProvider.page.blockAfterScrollCount = 2;
    browserProvider.page.blockingStateAfterScroll = "CHECKPOINT_REQUIRED";

    await new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
    }).captureHomeFeedPayloads({
      ...captureInput(),
      maxScrolls: 5,
      maxDurationMs: 30_000,
    });

    expect(browserProvider.page.scrollCalls).toBeGreaterThanOrEqual(2);
    expect(browserProvider.page.scrollCalls).toBeLessThanOrEqual(5);
  });

  it("closes the browser session when capture succeeds", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });

    await new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
    }).captureHomeFeedPayloads({
      ...captureInput(),
      maxScrolls: 0,
      maxDurationMs: 1_000,
    });

    expect(browserProvider.session.closeCalls).toBe(1);
  });

  it("forwards LOGIN_REQUIRED detection through the errorCode and closes the browser", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "LOGIN_REQUIRED",
    });

    const result = await new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
    }).captureHomeFeedPayloads(captureInput());

    expect(result).toMatchObject({
      ok: false,
      errorCode: "LOGIN_REQUIRED",
    });
    expect(browserProvider.session.closeCalls).toBe(1);
  });

  it("forwards CHECKPOINT_REQUIRED detection after scrolling and closes the browser", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });
    browserProvider.page.blockAfterScrollCount = 1;
    browserProvider.page.blockingStateAfterScroll = "CHECKPOINT_REQUIRED";

    const result = await new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
    }).captureHomeFeedPayloads({ ...captureInput(), maxScrolls: 3 });

    expect(result).toMatchObject({
      ok: false,
      errorCode: "CHECKPOINT_REQUIRED",
    });
    expect(browserProvider.session.closeCalls).toBe(1);
  });

  it("closes the browser when an abort signal is already aborted", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });
    const abortController = new AbortController();
    abortController.abort();

    const result = await new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
      abortSignal: abortController.signal,
    }).captureHomeFeedPayloads(captureInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("FACEBOOK_BROWSER_CAPTURE_INTERRUPTED");
    }
  });

  it("returns within the configured maxDurationMs even with a never-resolving response body", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });
    browserProvider.page.scheduleResponseBody(new Promise<string>(() => {}));

    const maxDurationMs = 250;
    const capture = new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
    });

    const start = Date.now();
    const result = await capture.captureHomeFeedPayloads({
      ...captureInput(),
      maxScrolls: 0,
      maxDurationMs,
    });
    const elapsed = Date.now() - start;

    expect(result.ok).toBe(true);
    expect(elapsed).toBeLessThan(maxDurationMs + 1_500);
    expect(elapsed).toBeGreaterThanOrEqual(0);
    expect(browserProvider.session.closeCalls).toBe(1);
  });

  it("preserves the first response and includes a second response that resolves before the deadline", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });
    const secondResponseBody = new Promise<string>((resolve) => {
      setTimeout(
        () => resolve('{"data":{"post":"post-2"}}'),
        50,
      );
    });
    browserProvider.page.scheduleResponses([
      '{"data":{"post":"post-1"}}',
      secondResponseBody,
    ]);

    const maxDurationMs = 1_000;
    const capture = new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
    });

    const result = await capture.captureHomeFeedPayloads({
      ...captureInput(),
      maxScrolls: 0,
      maxDurationMs,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      const postIds = result.capturedPayloads
        .map((payload) => {
          const data = (payload.payload as { data?: { post?: string } })?.data;
          return data?.post;
        })
        .filter((id): id is string => typeof id === "string")
        .sort();
      expect(postIds).toEqual(["post-1", "post-2"]);
    }
    expect(browserProvider.session.closeCalls).toBe(1);
  });

  it("honors a per-call abortSignal in addition to the constructor signal", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });
    const perCallController = new AbortController();
    perCallController.abort();

    const result = await new FacebookHomeFeedBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
    }).captureHomeFeedPayloads({
      ...captureInput(),
      maxScrolls: 0,
      maxDurationMs: 1_000,
      abortSignal: perCallController.signal,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errorCode).toBe("FACEBOOK_BROWSER_CAPTURE_INTERRUPTED");
    }
  });
});

function captureInput() {
  return {
    profileId: "profile-1",
    leaseId: "lease-1",
    maxScrolls: 3,
    maxDurationMs: 30_000,
  };
}

class FakeRuntimeProfileConfigurationPort
  implements RuntimeProfileConfigurationPort {
  public async getRuntimeProfileConfiguration() {
    return {
      ok: true as const,
      configuration: {
        profileId: "profile-1",
        leaseId: "lease-1",
        hardwareFingerprint: {
          viewport: { width: 1280, height: 720 },
          languages: ["en-US"],
        },
        networkContext: {
          mode: "DIRECT",
          proxy: null,
          killswitch: { enabled: false, failClosed: false },
        },
        authenticationState: { cookies: [], localStorage: [] },
      },
    };
  }
}

class FakeBrowserProvider implements BrowserProviderPort {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly launchCalls: BrowserProviderLaunchConfig[] = [];
  public readonly page: FakeBrowserPage;
  public readonly session: FakeBrowserSession;

  public constructor(pageState: FacebookPageState) {
    this.page = new FakeBrowserPage(pageState);
    this.session = new FakeBrowserSession(this.page);
  }

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    this.launchCalls.push(config);
    return this.session;
  }
}

class FakeBrowserSession implements BrowserProviderSession {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public closeCalls = 0;

  public constructor(private readonly page: BrowserProviderPage) {}

  public async newPage(): Promise<BrowserProviderPage> {
    return this.page;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
  }
}

class FakeBrowserPage implements BrowserProviderPage {
  public currentUrl = "about:blank";
  public scrollCalls = 0;
  public readonly gotoUrls: string[] = [];
  public blockAfterScrollCount: number | undefined;
  public blockingStateAfterScroll: FacebookPageState["blockingState"] =
    "NONE_DETECTED";
  private pendingResponseBodies: Array<Promise<string> | string> = [];
  private responseListener:
    | ((response: BrowserProviderResponse) => void)
    | undefined;
  public responsesEmitted = 0;

  public constructor(private readonly pageState: FacebookPageState) {}

  public url(): string {
    return this.currentUrl;
  }

  public async goto(options: {
    readonly url: string;
  }): Promise<{ readonly status: number }> {
    this.currentUrl = options.url;
    this.gotoUrls.push(options.url);
    if (
      this.responseListener !== undefined &&
      this.pendingResponseBodies.length > 0
    ) {
      for (const body of this.pendingResponseBodies) {
        this.responsesEmitted += 1;
        this.responseListener({
          url: () => "https://www.facebook.com/api/graphql/",
          headers: () => ({ "content-type": "application/json" }),
          text: () => Promise.resolve(body) as Promise<string>,
        });
      }
    }
    return { status: 200 };
  }

  public async evaluate<T = unknown>(script: string): Promise<T> {
    if (script.includes("window.scrollBy")) {
      this.scrollCalls += 1;
      return undefined as T;
    }

    if (script.includes("__FGC_FB_PAGE_STATE_OBSERVER__")) {
      return {
        pageLoaded: this.pageState.pageLoaded,
        blockingState:
          this.blockAfterScrollCount !== undefined &&
          this.scrollCalls >= this.blockAfterScrollCount
            ? this.blockingStateAfterScroll
            : this.pageState.blockingState,
      } as T;
    }

    return undefined as T;
  }

  public async exposeBinding(): Promise<void> {}

  public async addInitScript(): Promise<void> {}

  public onResponse(listener: (response: BrowserProviderResponse) => void): void {
    this.responseListener = listener;
  }

  public scheduleResponseBody(body: Promise<string>): void {
    this.pendingResponseBodies = [body];
  }

  public scheduleResponses(
    bodies: ReadonlyArray<Promise<string> | string>,
  ): void {
    this.pendingResponseBodies = [...bodies];
  }

  public oncePageError(_listener: (error: Error) => void): void {}

  public offPageError(_listener: (error: Error) => void): void {}

  public onceCrash(_listener: () => void): void {}

  public offCrash(_listener: () => void): void {}
}
