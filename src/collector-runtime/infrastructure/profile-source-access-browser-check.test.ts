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
import { ProfileSourceAccessBrowserCheckAdapter } from "./profile-source-access-browser-check";
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

  public async checkoutProfileForAssistedGroupAccess(): Promise<ProfileAssistedGroupAccessCheckoutResult> {
    return {
      ok: true,
      profileId: "profile-1",
      accountStage: "WARMING",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-05-01T10:10:00.000Z",
    };
  }

  public async getRuntimeProfileConfiguration(): Promise<RuntimeProfileConfigurationResult> {
    return {
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

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    this.launchConfig = config;
    return this.session;
  }
}

class FakeBrowserSession implements BrowserProviderSession {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly page = new FakePage();
  public closeError: Error | undefined;

  public async newPage(): Promise<BrowserProviderPage> {
    return this.page;
  }

  public async close(): Promise<void> {
    if (this.closeError !== undefined) {
      throw this.closeError;
    }
  }
}

class FakePage implements BrowserProviderPage {
  public evaluateError: Error | undefined;

  public url(): string {
    return "https://www.facebook.com/groups/source-group-1";
  }

  public async goto(): Promise<{ readonly status: number }> {
    return { status: 200 };
  }

  public async evaluate<T = unknown>(): Promise<T> {
    if (this.evaluateError !== undefined) {
      throw this.evaluateError;
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
