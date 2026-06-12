import { describe, expect, it } from "vitest";
import type {
  BrowserProviderLaunchConfig,
  BrowserProviderNavigationInput,
  BrowserProviderNavigationResult,
  BrowserProviderPage,
  BrowserProviderPort,
  BrowserProviderResponse,
  BrowserProviderSession,
  Clock,
  IdGenerator,
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
  RuntimeProfileConfigurationResult,
} from "../../collector-runtime/application";
import { InMemoryAccountExerciseRunRepository } from "../../collector-runtime/application/test-support/in-memory-account-exercise-run-repository";
import type {
  ProfileExerciseCheckoutResult,
  SafeProfileAccountStageResult,
} from "../../collector-runtime/infrastructure";
import { runProfileExerciseCommand } from "./exercise-runner";
import type {
  ProfileExerciseDependencies,
  ProfileExerciseProfileManagerPort,
} from "./exercise-runner";
import type { ProfileExerciseCliArgs } from "./cli-args";

const now = "2026-05-01T10:00:00.000Z";

describe("profile exercise runner", () => {
  it("records a successful safe ambient exercise run", async () => {
    const context = createTestContext();

    const result = await runProfileExerciseCommand({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(),
    });
    const storedRun = await context.accountExerciseRuns.findById(
      "exercise-run-1",
    );
    const serializedRun = JSON.stringify(storedRun);

    expect(result).toMatchObject({
      ok: true,
      profileId: "profile-1",
      accountExerciseRunId: "exercise-run-1",
      leaseId: "lease-1",
      status: "SUCCEEDED",
      leaseReleased: true,
      safeSummary: {
        pageLoaded: true,
        loginRequired: false,
        checkpointDetected: false,
        scrollsPerformed: 2,
        leaseReleased: true,
      },
    });
    expect(storedRun).toMatchObject({
      status: "SUCCEEDED",
      stageAtStart: "NEW_ACCOUNT",
      leaseId: "lease-1",
      actionBudget: {
        maxDurationMs: 1_000,
        maxScrolls: 2,
        minDwellMs: 0,
      },
    });
    expect(context.profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
        macroActionsPerformed: 0,
      },
    ]);
    expect(context.browserProvider.launchCalls).toHaveLength(1);
    expect(serializedRun).not.toContain("cookie");
    expect(serializedRun).not.toContain("localStorage");
    expect(serializedRun).not.toContain("proxy-password");
    expect(serializedRun).not.toContain("rawFacebookGraphqlPayload");
  });

  it("records login required as sanitized failure data", async () => {
    const context = createTestContext({
      pageState: {
        pageLoaded: true,
        loginRequired: true,
        checkpointDetected: false,
      },
    });

    const result = await runProfileExerciseCommand({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(),
    });
    const storedRun = await context.accountExerciseRuns.findById(
      "exercise-run-1",
    );

    expect(result).toMatchObject({
      ok: false,
      status: "FAILED",
      failureReason: {
        code: "LOGIN_REQUIRED",
        message: "Login is required before ambient exercise can continue.",
      },
      safeSummary: {
        pageLoaded: true,
        loginRequired: true,
        leaseReleased: true,
      },
    });
    expect(storedRun).toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "LOGIN_REQUIRED",
      },
    });
  });
});

interface TestContext {
  readonly accountExerciseRuns: InMemoryAccountExerciseRunRepository;
  readonly profileManager: FakeProfileExerciseProfileManager;
  readonly browserProvider: FakeBrowserProvider;
  readonly dependencies: ProfileExerciseDependencies;
}

function createTestContext(
  options: {
    readonly pageState?: FakePageState;
  } = {},
): TestContext {
  const accountExerciseRuns = new InMemoryAccountExerciseRunRepository();
  const profileManager = new FakeProfileExerciseProfileManager();
  const browserProvider = new FakeBrowserProvider(
    options.pageState ?? {
      pageLoaded: true,
      loginRequired: false,
      checkpointDetected: false,
    },
  );

  return {
    accountExerciseRuns,
    profileManager,
    browserProvider,
    dependencies: {
      accountExerciseRuns,
      profileManager,
      browserProvider,
      clock: new FixedClock(),
      idGenerator: new FakeIdGenerator(),
      close: async () => {},
    },
  };
}

function createArgs(): ProfileExerciseCliArgs {
  return {
    profileId: "profile-1",
    baseUrl: "http://localhost:8081",
    maxDurationMs: 1_000,
    maxScrolls: 2,
    minDwellMs: 0,
    browserProvider: "playwright",
  };
}

class FixedClock implements Clock {
  public now(): Date {
    return new Date(now);
  }
}

class FakeIdGenerator implements IdGenerator {
  public async generateId(): Promise<string> {
    return "exercise-run-1";
  }
}

class FakeProfileExerciseProfileManager
  implements ProfileExerciseProfileManagerPort
{
  public readonly releaseCalls: ProfileLeaseReleaseInput[] = [];

  public async getSafeProfileAccountStage(): Promise<SafeProfileAccountStageResult> {
    return {
      ok: true,
      profileId: "profile-1",
      accountStage: "NEW_ACCOUNT",
    };
  }

  public async checkoutProfileForExercise(): Promise<ProfileExerciseCheckoutResult> {
    return {
      ok: true,
      profileId: "profile-1",
      accountStage: "NEW_ACCOUNT",
      leaseId: "lease-1",
      leaseExpiresAt: "2026-05-01T10:45:00.000Z",
    };
  }

  public async getRuntimeProfileConfiguration(): Promise<RuntimeProfileConfigurationResult> {
    return {
      ok: true,
      configuration: {
        profileId: "profile-1",
        leaseId: "lease-1",
        leaseExpiresAt: "2026-05-01T10:45:00.000Z",
        hardwareFingerprint: {
          userAgent: "Mozilla/5.0 Test",
          viewport: {
            width: 1280,
            height: 720,
          },
          languages: ["en-US", "en"],
          hardwareConcurrency: 8,
          timezone: "America/Los_Angeles",
        },
        networkContext: {
          proxy: null,
          killswitch: {
            enabled: true,
            failClosed: true,
          },
        },
        authenticationState: {
          cookies: [],
          localStorage: [],
          sessionCapturedAt: now,
          sessionExpiresAt: "2026-05-02T10:00:00.000Z",
        },
        temporalRoutine: {
          timezone: "America/Los_Angeles",
        },
      },
    };
  }

  public async releaseProfileLease(
    input: ProfileLeaseReleaseInput,
  ): Promise<ProfileLeaseReleaseResult> {
    this.releaseCalls.push(input);

    return {
      ok: true,
      releasedAt: "2026-05-01T10:05:00.000Z",
    };
  }
}

interface FakePageState {
  readonly pageLoaded: boolean;
  readonly loginRequired: boolean;
  readonly checkpointDetected: boolean;
}

class FakeBrowserProvider implements BrowserProviderPort {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly launchCalls: BrowserProviderLaunchConfig[] = [];

  public constructor(private readonly pageState: FakePageState) {}

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    this.launchCalls.push(config);

    return new FakeBrowserSession(this.pageState);
  }
}

class FakeBrowserSession implements BrowserProviderSession {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  private readonly page: FakeBrowserPage;

  public constructor(pageState: FakePageState) {
    this.page = new FakeBrowserPage(pageState);
  }

  public async newPage(): Promise<BrowserProviderPage> {
    return this.page;
  }

  public async close(): Promise<void> {}
}

class FakeBrowserPage implements BrowserProviderPage {
  private currentUrl = "about:blank";

  public constructor(private readonly pageState: FakePageState) {}

  public url(): string {
    return this.currentUrl;
  }

  public async goto(
    input: BrowserProviderNavigationInput,
  ): Promise<BrowserProviderNavigationResult | null> {
    this.currentUrl = input.url;

    return {
      status: 200,
    };
  }

  public async evaluate<T = unknown>(script: string): Promise<T> {
    if (script.includes("window.scrollBy")) {
      return undefined as T;
    }

    return this.pageState as T;
  }

  public async exposeBinding(): Promise<void> {}

  public async addInitScript(): Promise<void> {}

  public onResponse(_listener: (response: BrowserProviderResponse) => void): void {}

  public oncePageError(_listener: (error: Error) => void): void {}

  public offPageError(_listener: (error: Error) => void): void {}

  public onceCrash(_listener: () => void): void {}

  public offCrash(_listener: () => void): void {}
}
