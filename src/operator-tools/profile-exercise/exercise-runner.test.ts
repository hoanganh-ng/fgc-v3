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
        scrollsPerformed: 0,
        leaseReleased: true,
      },
    });
    expect(storedRun).toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "LOGIN_REQUIRED",
      },
    });
    expect(context.browserProvider.lastSession?.page.scrollCalls).toBe(0);
  });

  it("stops scrolling when a login wall appears mid-run", async () => {
    const context = createTestContext({
      blockAfterScrollCount: 1,
      blockingStateAfterScroll: "LOGIN_REQUIRED",
    });

    const result = await runProfileExerciseCommand({
      args: {
        ...createArgs(),
        maxScrolls: 3,
      },
      dependencies: context.dependencies,
      now: () => new Date(),
    });

    expect(result).toMatchObject({
      ok: false,
      status: "FAILED",
      failureReason: {
        code: "LOGIN_REQUIRED",
      },
      safeSummary: {
        pageLoaded: true,
        loginRequired: true,
        checkpointDetected: false,
        scrollsPerformed: 1,
        leaseReleased: true,
      },
    });
    expect(context.browserProvider.lastSession?.page.scrollCalls).toBe(1);
    expect(context.profileManager.releaseCalls).toHaveLength(1);
  });

  it("propagates LOGIN_REQUIRED observation to release when initial page state is login wall", async () => {
    const context = createTestContext({
      pageState: {
        pageLoaded: true,
        loginRequired: true,
        checkpointDetected: false,
      },
    });

    await runProfileExerciseCommand({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(),
    });

    expect(context.profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
        macroActionsPerformed: 0,
        authenticationObservation: "LOGIN_REQUIRED",
      },
    ]);
  });

  it("propagates CHECKPOINT_REQUIRED observation to release when initial page state is checkpoint wall", async () => {
    const context = createTestContext({
      pageState: {
        pageLoaded: true,
        loginRequired: false,
        checkpointDetected: true,
      },
    });

    await runProfileExerciseCommand({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(),
    });

    expect(context.profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
        macroActionsPerformed: 0,
        authenticationObservation: "CHECKPOINT_REQUIRED",
      },
    ]);
  });

  it("preserves checkpoint precedence over login when both are observed", async () => {
    const context = createTestContext({
      pageState: {
        pageLoaded: true,
        loginRequired: true,
        checkpointDetected: true,
      },
    });

    await runProfileExerciseCommand({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(),
    });

    expect(context.profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
        macroActionsPerformed: 0,
        authenticationObservation: "CHECKPOINT_REQUIRED",
      },
    ]);
  });

  it("does not include authenticationObservation on healthy release", async () => {
    const context = createTestContext({
      pageState: {
        pageLoaded: true,
        loginRequired: false,
        checkpointDetected: false,
      },
    });

    await runProfileExerciseCommand({
      args: createArgs(),
      dependencies: context.dependencies,
      now: () => new Date(),
    });

    expect(context.profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
        macroActionsPerformed: 0,
      },
    ]);
    const releaseCall = context.profileManager.releaseCalls[0];
    expect(releaseCall).not.toHaveProperty("authenticationObservation");
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
    readonly blockAfterScrollCount?: number;
    readonly blockingStateAfterScroll?: FakeBlockingState;
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
    {
      ...(options.blockAfterScrollCount !== undefined
        ? { blockAfterScrollCount: options.blockAfterScrollCount }
        : {}),
      ...(options.blockingStateAfterScroll !== undefined
        ? { blockingStateAfterScroll: options.blockingStateAfterScroll }
        : {}),
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
          mode: "DIRECT",
          proxy: null,
          killswitch: {
            enabled: false,
            failClosed: false,
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

type FakeBlockingState =
  | "NONE_DETECTED"
  | "LOGIN_REQUIRED"
  | "CHECKPOINT_REQUIRED";

class FakeBrowserProvider implements BrowserProviderPort {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly launchCalls: BrowserProviderLaunchConfig[] = [];
  public lastSession?: FakeBrowserSession;

  public constructor(
    private readonly pageState: FakePageState,
    private readonly options: {
      readonly blockAfterScrollCount?: number;
      readonly blockingStateAfterScroll?: FakeBlockingState;
    } = {},
  ) {}

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    this.launchCalls.push(config);
    const session = new FakeBrowserSession(this.pageState, this.options);
    this.lastSession = session;
    return session;
  }
}

class FakeBrowserSession implements BrowserProviderSession {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly page: FakeBrowserPage;
  public closed = false;

  public constructor(
    pageState: FakePageState,
    options: {
      readonly blockAfterScrollCount?: number;
      readonly blockingStateAfterScroll?: FakeBlockingState;
    },
  ) {
    this.page = new FakeBrowserPage(pageState, options);
  }

  public async newPage(): Promise<BrowserProviderPage> {
    return this.page;
  }

  public async close(): Promise<void> {
    this.closed = true;
  }
}

class FakeBrowserPage implements BrowserProviderPage {
  private currentUrl = "about:blank";
  public readonly navigatedUrls: string[] = [];
  public scrollCalls = 0;

  public constructor(
    private readonly pageState: FakePageState,
    private readonly options: {
      readonly blockAfterScrollCount?: number;
      readonly blockingStateAfterScroll?: FakeBlockingState;
    },
  ) {}

  public url(): string {
    return this.currentUrl;
  }

  public async goto(
    input: BrowserProviderNavigationInput,
  ): Promise<BrowserProviderNavigationResult | null> {
    this.currentUrl = input.url;
    this.navigatedUrls.push(input.url);

    return {
      status: 200,
    };
  }

  public async evaluate<T = unknown>(script: string): Promise<T> {
    if (script.includes("window.scrollBy")) {
      this.scrollCalls += 1;
      return undefined as T;
    }

    const blockingState =
      this.options.blockAfterScrollCount !== undefined &&
      this.scrollCalls >= this.options.blockAfterScrollCount
        ? this.options.blockingStateAfterScroll ?? "LOGIN_REQUIRED"
        : this.pageState.checkpointDetected
          ? "CHECKPOINT_REQUIRED"
          : this.pageState.loginRequired
            ? "LOGIN_REQUIRED"
            : "NONE_DETECTED";

    return {
      pageLoaded: this.pageState.pageLoaded,
      blockingState,
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
