import { readFileSync } from "node:fs";
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
  FacebookBrowserPayloadCaptureAdapter,
  parseFacebookJson,
  sanitizeFacebookDiagnosticUrl,
  shouldCaptureFacebookPayload,
  shouldCaptureFacebookGraphQLResponse,
} from "./facebook-browser-payload-capture";
import type { FacebookPageState } from "./facebook-page-state-observer";

describe("shouldCaptureFacebookPayload", () => {
  it("matches Facebook GraphQL, ajax, and JSON responses", () => {
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/api/graphql/",
        "text/html",
      ),
    ).toBe(true);
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/graphql/?doc_id=1",
        undefined,
      ),
    ).toBe(true);
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/ajax/pagelet/generic.php",
        undefined,
      ),
    ).toBe(true);
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/groups/group-1/",
        "application/json; charset=utf-8",
      ),
    ).toBe(true);
  });

  it("ignores non-matching non-JSON responses", () => {
    expect(
      shouldCaptureFacebookPayload(
        "https://www.facebook.com/groups/group-1/",
        "text/html; charset=utf-8",
      ),
    ).toBe(false);
  });

  it("keeps the response metadata wrapper behavior", () => {
    expect(
      shouldCaptureFacebookGraphQLResponse({
        url: "https://www.facebook.com/api/graphql/",
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      }),
    ).toBe(true);
    expect(
      shouldCaptureFacebookGraphQLResponse({
        url: "https://www.facebook.com/api/graphql/?doc_id=1",
      }),
    ).toBe(true);
  });
});

describe("parseFacebookJson", () => {
  it("parses normal JSON bodies", () => {
    expect(parseFacebookJson('{"data":{"post":"post-1"}}')).toEqual({
      bodies: [
        {
          data: {
            post: "post-1",
          },
        },
      ],
      parseFailed: false,
    });
  });

  it("strips Facebook for-prefixes before parsing", () => {
    expect(parseFacebookJson('for (;;);{"data":{"post":"post-1"}}')).toEqual({
      bodies: [
        {
          data: {
            post: "post-1",
          },
        },
      ],
      parseFailed: false,
    });
  });

  it("parses newline-separated JSON records and ignores bad records", () => {
    expect(
      parseFacebookJson(
        [
          'for (;;);{"data":{"post":"post-1"}}',
          "",
          "not-json",
          '{"data":{"post":"post-2"}}',
        ].join("\n"),
      ),
    ).toEqual({
      bodies: [
        {
          data: {
            post: "post-1",
          },
        },
        {
          data: {
            post: "post-2",
          },
        },
      ],
      parseFailed: false,
    });
  });

  it("reports parse failure without returning raw body text", () => {
    const result = parseFacebookJson("not-json-with-session-cookie-value");

    expect(result).toEqual({
      bodies: [],
      parseFailed: true,
    });
    expect(JSON.stringify(result)).not.toContain("session-cookie-value");
  });
});

describe("sanitizeFacebookDiagnosticUrl", () => {
  it("keeps only safe URL path diagnostics", () => {
    expect(
      sanitizeFacebookDiagnosticUrl(
        "https://www.facebook.com/groups/group-1?fbclid=session-token#feed",
      ),
    ).toBe("https://www.facebook.com/groups/group-1");
  });

  it("does not echo invalid URL diagnostics", () => {
    expect(
      sanitizeFacebookDiagnosticUrl("not a url with session-cookie-value"),
    ).toBeUndefined();
  });

  it("does not introduce raw payload persistence", () => {
    const source = readFileSync(
      new URL("./facebook-browser-payload-capture.ts", import.meta.url),
      "utf8",
    );

    expect(source).not.toMatch(/\bwriteFile|createWriteStream|appendFile\b/);
  });
});

describe("FacebookBrowserPayloadCaptureAdapter authentication walls", () => {
  it("fails safely before scrolling when the initial page has a login wall", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "LOGIN_REQUIRED",
    });

    const result = await new FacebookBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
      maxScrolls: 2,
      maxDurationMs: 1_000,
    }).captureGroupPayloads(captureInput());

    expect(result).toMatchObject({
      ok: false,
      errorCode: "LOGIN_REQUIRED",
      diagnostics: {
        totalPayloadsPassedToExtractor: 0,
        loginRedirectSuspected: true,
      },
    });
    expect(browserProvider.page.scrollCalls).toBe(0);
    expect(browserProvider.session.closeCalls).toBe(1);
    expect(JSON.stringify(result)).not.toContain("Email or phone number");
  });

  it("fails safely when an authentication wall appears after scrolling", async () => {
    const browserProvider = new FakeBrowserProvider({
      pageLoaded: true,
      blockingState: "NONE_DETECTED",
    });
    browserProvider.page.blockAfterScrollCount = 1;
    browserProvider.page.blockingStateAfterScroll = "CHECKPOINT_REQUIRED";

    const result = await new FacebookBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: new FakeRuntimeProfileConfigurationPort(),
      browserProvider,
      maxScrolls: 3,
      maxDurationMs: 2_000,
    }).captureGroupPayloads(captureInput());

    expect(result).toMatchObject({
      ok: false,
      errorCode: "CHECKPOINT_REQUIRED",
      diagnostics: {
        totalPayloadsPassedToExtractor: 0,
        loginRedirectSuspected: true,
      },
    });
    expect(browserProvider.page.scrollCalls).toBe(1);
    expect(browserProvider.session.closeCalls).toBe(1);
  });
});

function captureInput() {
  return {
    sourceGroupId: "source-group-1",
    sourceGroupUrl: "https://www.facebook.com/groups/source-group-1",
    profileId: "profile-1",
    leaseId: "lease-1",
  };
}

class FakeRuntimeProfileConfigurationPort
  implements RuntimeProfileConfigurationPort
{
  public async getRuntimeProfileConfiguration() {
    return {
      ok: true as const,
      configuration: {
        profileId: "profile-1",
        leaseId: "lease-1",
        hardwareFingerprint: {
          viewport: {
            width: 1280,
            height: 720,
          },
          languages: ["en-US"],
        },
        networkContext: {
          mode: "DIRECT",
          proxy: null,
          killswitch: { enabled: false, failClosed: false },
        },
        authenticationState: {
          cookies: [],
          localStorage: [],
        },
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
  public blockAfterScrollCount: number | undefined;
  public blockingStateAfterScroll: FacebookPageState["blockingState"] =
    "NONE_DETECTED";

  public constructor(private readonly pageState: FacebookPageState) {}

  public url(): string {
    return this.currentUrl;
  }

  public async goto(): Promise<{ readonly status: number }> {
    this.currentUrl = "https://www.facebook.com/groups/source-group-1";
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

  public onResponse(_listener: (response: BrowserProviderResponse) => void): void {}

  public oncePageError(_listener: (error: Error) => void): void {}

  public offPageError(_listener: (error: Error) => void): void {}

  public onceCrash(_listener: () => void): void {}

  public offCrash(_listener: () => void): void {}
}
