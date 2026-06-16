import vm from "node:vm";
import { describe, expect, it } from "vitest";
import type {
  BrowserProviderLaunchConfig,
  BrowserProviderPage,
  BrowserProviderPort,
  BrowserProviderResponse,
  BrowserProviderSession,
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
  RuntimeProfileConfigurationResult,
} from "../application";
import {
  PROFILE_SOURCE_ACCESS_OBSERVATION_SCRIPT,
  ProfileSourceAccessBrowserCheckAdapter,
} from "./profile-source-access-browser-check";
import { DeterministicProfileSourceAccessOutcomeClassifier } from "./profile-source-access-outcome-classifier";
import type { FacebookPageState } from "./facebook-page-state-observer";
import type {
  ProfileAssistedGroupAccessCheckoutResult,
} from "./profile-manager-http-client";

describe("profile-source access browser check adapter", () => {
  it("returns sanitized observations after browser close and lease release succeed", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
    ).check(checkInput());

    expect(result).toEqual({
      ok: true,
      observation: {
        pageKind: "FACEBOOK_GROUP",
        groupContentVisible: true,
        joinActionVisible: false,
        joinedIndicatorVisible: false,
        accessDeniedIndicatorVisible: false,
      },
    });
    expect(profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
      },
    ]);
  });

  it("maps a login modal over a group URL to a safe login observation", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    browserProvider.session.page.pageState = {
      pageLoaded: true,
      blockingState: "LOGIN_REQUIRED",
    };

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
    ).check(checkInput());

    expect(result).toEqual({
      ok: true,
      observation: {
        pageKind: "FACEBOOK_LOGIN",
        groupContentVisible: false,
        joinActionVisible: false,
        joinedIndicatorVisible: false,
        accessDeniedIndicatorVisible: false,
      },
    });
    if (result.ok) {
      await expect(
        new DeterministicProfileSourceAccessOutcomeClassifier().classify(
          result.observation,
        ),
      ).resolves.toBe("LOGIN_REQUIRED");
    }
    expect(profileManager.releaseCalls).toHaveLength(1);
  });

  it("attempts lease release and returns sanitized failure when browser cleanup fails", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    browserProvider.session.closeError = new Error("raw close failure");

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
    ).check(checkInput());

    expect(result).toEqual({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_CLEANUP_FAILED",
        message: "Profile-source access browser check failed.",
      },
    });
    expect(profileManager.releaseCalls).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("raw close failure");
  });

  it("attempts lease release after browser execution failure", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    browserProvider.session.page.evaluateError = new Error("raw page text");

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
    ).check(checkInput());

    expect(result).toMatchObject({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_BROWSER_FAILED",
      },
    });
    expect(profileManager.releaseCalls).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("raw page text");
  });

  it("does not treat accessible private group privacy text as access denied evidence", () => {
    const observation = runObservationScript({
      mainText: "Private group\nRecent posts",
      controls: [],
    });

    expect(observation).toMatchObject({
      pageKind: "FACEBOOK_GROUP",
      groupContentVisible: true,
      accessDeniedIndicatorVisible: false,
    });
  });

  it("detects joined accessible private group evidence without denied evidence", () => {
    const observation = runObservationScript({
      mainText: "Private group\nRecent posts",
      controls: ["Joined"],
    });

    expect(observation).toEqual({
      pageKind: "FACEBOOK_GROUP",
      groupContentVisible: true,
      joinActionVisible: false,
      joinedIndicatorVisible: true,
      accessDeniedIndicatorVisible: false,
    });
  });

  it("releases the actual leased profile when checkout returns a mismatched profile", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    profileManager.checkoutResult = {
      ok: true,
      profileId: "actual-profile",
      accountStage: "WARMING",
      leaseId: "actual-lease",
      leaseExpiresAt: "2026-05-01T10:10:00.000Z",
    };

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
    ).check(checkInput());

    expect(result).toMatchObject({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_PROFILE_ID_MISMATCH",
      },
    });
    expect(browserProvider.launchConfig).toBeUndefined();
    expect(profileManager.releaseCalls).toEqual([
      {
        profileId: "actual-profile",
        leaseId: "actual-lease",
      },
    ]);
  });

  it("releases the lease and prevents browser launch when runtime lease ID mismatches", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    profileManager.runtimeConfigurationResult = {
      ok: true,
      configuration: {
        profileId: "profile-1",
        leaseId: "different-lease",
        hardwareFingerprint: {
          viewport: {
            width: 1280,
            height: 720,
          },
          languages: ["en-US"],
        },
        networkContext: {},
        authenticationState: {
          cookies: [],
          localStorage: [],
        },
      },
    };

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
    ).check(checkInput());

    expect(result).toMatchObject({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_RUNTIME_LEASE_ID_MISMATCH",
      },
    });
    expect(browserProvider.launchConfig).toBeUndefined();
    expect(profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
      },
    ]);
  });

  it("prevents browser launch when the safe lease deadline is too close", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    profileManager.checkoutResult = {
      ok: true,
      profileId: "profile-1",
      accountStage: "WARMING",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-05-01T10:00:05.500Z",
    };

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
      {
        now: () => new Date("2026-05-01T10:00:00.000Z"),
      },
    ).check(checkInput());

    expect(result).toMatchObject({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_LEASE_EXPIRY_TOO_CLOSE",
      },
    });
    expect(browserProvider.launchConfig).toBeUndefined();
    expect(profileManager.releaseCalls).toHaveLength(1);
  });

  it("releases the actual lease and skips runtime config when lease expiry is missing", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    profileManager.checkoutResult = {
      ok: true,
      profileId: "actual-profile",
      accountStage: "WARMING",
      leaseId: "actual-lease",
    };

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
    ).check(checkInput());

    expect(result).toEqual({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_LEASE_EXPIRY_INVALID",
        message: "Profile-source access browser check failed.",
      },
    });
    expect(profileManager.runtimeConfigurationCalls).toBe(0);
    expect(browserProvider.launchConfig).toBeUndefined();
    expect(profileManager.releaseCalls).toEqual([
      {
        profileId: "actual-profile",
        leaseId: "actual-lease",
      },
    ]);
  });

  it("releases the actual lease and skips runtime config when lease expiry is malformed", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    profileManager.checkoutResult = {
      ok: true,
      profileId: "actual-profile",
      accountStage: "WARMING",
      leaseId: "actual-lease",
      leaseExpiresAt: "not-a-date",
    };

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
    ).check(checkInput());

    expect(result).toEqual({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_LEASE_EXPIRY_INVALID",
        message: "Profile-source access browser check failed.",
      },
    });
    expect(profileManager.runtimeConfigurationCalls).toBe(0);
    expect(browserProvider.launchConfig).toBeUndefined();
    expect(profileManager.releaseCalls).toEqual([
      {
        profileId: "actual-profile",
        leaseId: "actual-lease",
      },
    ]);
    expect(JSON.stringify(result)).not.toContain("not-a-date");
  });

  it("attempts browser close and lease release when aborted after browser work", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    const abortController = new AbortController();
    browserProvider.session.page.onEvaluate = () => {
      abortController.abort();
    };

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
    ).check({
      ...checkInput(),
      abortSignal: abortController.signal,
    });

    expect(result).toMatchObject({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_ABORTED",
      },
    });
    expect(browserProvider.session.closeCalls).toBeGreaterThanOrEqual(1);
    expect(profileManager.releaseCalls).toHaveLength(1);
  });

  it("catches rejected detached browser close triggered by abort", async () => {
    const unhandled = captureUnhandledRejections();
    try {
      const profileManager = new FakeProfileManager();
      const browserProvider = new FakeBrowserProvider();
      const abortController = new AbortController();
      browserProvider.session.closeError = new Error("raw abort close failure");
      browserProvider.session.page.onEvaluate = () => {
        abortController.abort();
      };

      const result = await new ProfileSourceAccessBrowserCheckAdapter(
        profileManager,
        browserProvider,
      ).check({
        ...checkInput(),
        abortSignal: abortController.signal,
      });

      await waitForUnhandledRejectionTurn();

      expect(result).toMatchObject({
        ok: false,
        failureReason: {
          code: "ACCESS_CHECK_ABORTED",
        },
      });
      expect(unhandled.rejections).toEqual([]);
      expect(JSON.stringify(result)).not.toContain("raw abort close failure");
    } finally {
      unhandled.dispose();
    }
  });

  it("attempts browser close and lease release when the safe deadline expires during execution", async () => {
    const profileManager = new FakeProfileManager();
    const browserProvider = new FakeBrowserProvider();
    let now = new Date("2026-05-01T10:00:00.000Z");
    profileManager.checkoutResult = {
      ok: true,
      profileId: "profile-1",
      accountStage: "WARMING",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-05-01T10:00:06.001Z",
    };
    browserProvider.session.page.onGoto = () => {
      now = new Date("2026-05-01T10:00:01.002Z");
    };

    const result = await new ProfileSourceAccessBrowserCheckAdapter(
      profileManager,
      browserProvider,
      {
        now: () => now,
      },
    ).check(checkInput());

    expect(result).toMatchObject({
      ok: false,
      failureReason: {
        code: "ACCESS_CHECK_TIMEOUT",
      },
    });
    expect(browserProvider.session.closeCalls).toBeGreaterThanOrEqual(1);
    expect(profileManager.releaseCalls).toHaveLength(1);
  });

  it("catches rejected detached browser close after late launch resolution", async () => {
    const unhandled = captureUnhandledRejections();
    try {
      const profileManager = new FakeProfileManager();
      const browserProvider = new FakeBrowserProvider();
      const baseNow = new Date("2026-05-01T10:00:00.000Z");
      let nowCalls = 0;
      profileManager.checkoutResult = {
        ok: true,
        profileId: "profile-1",
        accountStage: "WARMING",
        leaseId: "lease-1",
        leaseExpiresAt: "2026-05-01T10:00:01.000Z",
      };
      browserProvider.launchDelayMs = 5;
      browserProvider.session.closeError = new Error("raw late close failure");

      const result = await new ProfileSourceAccessBrowserCheckAdapter(
        profileManager,
        browserProvider,
        {
          leaseShutdownMarginMs: 0,
          now: () => {
            nowCalls += 1;
            return nowCalls >= 5
              ? new Date(baseNow.getTime() + 999)
              : baseNow;
          },
        },
      ).check(checkInput());

      await delay(20);
      await waitForUnhandledRejectionTurn();

      expect(result).toMatchObject({
        ok: false,
        failureReason: {
          code: "ACCESS_CHECK_TIMEOUT",
        },
      });
      expect(browserProvider.session.closeCalls).toBeGreaterThanOrEqual(1);
      expect(unhandled.rejections).toEqual([]);
      expect(JSON.stringify(result)).not.toContain("raw late close failure");
    } finally {
      unhandled.dispose();
    }
  });
});

function checkInput() {
  return {
    checkRunId: "check-run-1",
    profileId: "profile-1",
    sourceGroupId: "source-group-1",
    target: {
      platform: "FACEBOOK" as const,
      routeType: "DIRECT_GROUP_URL" as const,
      url: "https://www.facebook.com/groups/source-group-1",
    },
  };
}

class FakeProfileManager {
  public readonly releaseCalls: ProfileLeaseReleaseInput[] = [];
  public runtimeConfigurationCalls = 0;
  public checkoutResult: ProfileAssistedGroupAccessCheckoutResult = {
    ok: true,
    profileId: "profile-1",
    accountStage: "WARMING",
    leaseId: "lease-1",
    leaseExpiresAt: "2030-05-01T10:10:00.000Z",
  };
  public runtimeConfigurationResult: RuntimeProfileConfigurationResult = {
    ok: true,
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
      networkContext: {},
      authenticationState: {
        cookies: [],
        localStorage: [],
      },
    },
  };

  public async checkoutProfileForAssistedGroupAccess(): Promise<ProfileAssistedGroupAccessCheckoutResult> {
    return this.checkoutResult;
  }

  public async getRuntimeProfileConfiguration(): Promise<RuntimeProfileConfigurationResult> {
    this.runtimeConfigurationCalls += 1;
    return this.runtimeConfigurationResult;
  }

  public async releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult> {
    this.releaseCalls.push(input);
    return { ok: true };
  }
}

class FakeBrowserProvider implements BrowserProviderPort {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly session = new FakeBrowserSession();
  public launchConfig: BrowserProviderLaunchConfig | undefined;
  public launchDelayMs = 0;

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    this.launchConfig = config;
    if (this.launchDelayMs > 0) {
      await delay(this.launchDelayMs);
    }
    return this.session;
  }
}

class FakeBrowserSession implements BrowserProviderSession {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly page = new FakePage();
  public closeError: Error | undefined;
  public closeCalls = 0;

  public async newPage(): Promise<BrowserProviderPage> {
    return this.page;
  }

  public async close(): Promise<void> {
    this.closeCalls += 1;
    if (this.closeError !== undefined) {
      throw this.closeError;
    }
  }
}

class FakePage implements BrowserProviderPage {
  public evaluateError: Error | undefined;
  public onEvaluate: (() => void) | undefined;
  public onGoto: (() => void) | undefined;
  public pageState: FacebookPageState = {
    pageLoaded: true,
    blockingState: "NONE_DETECTED",
  };

  public url(): string {
    return "https://www.facebook.com/groups/source-group-1";
  }

  public async goto(): Promise<{ readonly status: number }> {
    this.onGoto?.();
    return { status: 200 };
  }

  public async evaluate<T = unknown>(script?: string): Promise<T> {
    this.onEvaluate?.();
    if (this.evaluateError !== undefined) {
      throw this.evaluateError;
    }

    if (script?.includes("__FGC_FB_PAGE_STATE_OBSERVER__") === true) {
      return this.pageState as T;
    }

    return {
      pageKind: "FACEBOOK_GROUP",
      groupContentVisible: true,
      joinActionVisible: false,
      joinedIndicatorVisible: false,
      accessDeniedIndicatorVisible: false,
    } as T;
  }

  public async exposeBinding(): Promise<void> {}

  public async addInitScript(): Promise<void> {}

  public onResponse(_listener: (response: BrowserProviderResponse) => void): void {}

  public oncePageError(_listener: (error: Error) => void): void {}

  public offPageError(_listener: (error: Error) => void): void {}

  public onceCrash(_listener: () => void): void {}

  public offCrash(_listener: () => void): void {}
}

function runObservationScript(input: {
  readonly mainText: string;
  readonly controls: readonly string[];
}) {
  const mainElement = createElement(input.mainText);
  const sandbox = {
    window: {
      location: {
        hostname: "www.facebook.com",
        pathname: "/groups/source-group-1",
      },
    },
    document: {
      body: mainElement,
      querySelector: (selector: string) => {
        if (selector.includes("[role='main']")) {
          return mainElement;
        }

        return null;
      },
      querySelectorAll: () => input.controls.map(createElement),
    },
  };

  return vm.runInNewContext(PROFILE_SOURCE_ACCESS_OBSERVATION_SCRIPT, sandbox);
}

function createElement(text: string) {
  return {
    innerText: text,
    textContent: text,
    getAttribute: (name: string) => (name === "aria-label" ? text : null),
  };
}

function captureUnhandledRejections(): {
  readonly rejections: unknown[];
  dispose(): void;
} {
  const rejections: unknown[] = [];
  const listener = (reason: unknown): void => {
    rejections.push(reason);
  };
  process.on("unhandledRejection", listener);

  return {
    rejections,
    dispose: () => {
      process.off("unhandledRejection", listener);
    },
  };
}

async function waitForUnhandledRejectionTurn(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
