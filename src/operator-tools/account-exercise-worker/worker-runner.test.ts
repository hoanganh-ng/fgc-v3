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
  ProfileLeaseReleaseInput,
  ProfileLeaseReleaseResult,
  RuntimeProfileConfigurationResult,
} from "../../collector-runtime/application";
import { InMemoryAccountExerciseRunRepository } from "../../collector-runtime/application/test-support/in-memory-account-exercise-run-repository";
import type { AccountExerciseRun } from "../../collector-runtime/domain";
import type {
  ProfileExerciseCheckoutResult,
  SafeProfileAccountStageResult,
} from "../../collector-runtime/infrastructure";
import type {
  ProfileExerciseProfileManagerPort,
  ProfileExerciseRunRecordPort,
} from "../profile-exercise/exercise-runner";
import {
  runAccountExerciseWorkerCommand,
  type AccountExerciseWorkerDependencies,
  type AccountExerciseWorkerLogger,
} from "./worker-runner";

const createdAt = "2026-05-01T10:00:00.000Z";
const finishedAt = "2026-05-01T10:10:00.000Z";

describe("account exercise worker runner", () => {
  it("one-shot mode exits cleanly when no queued run exists", async () => {
    const context = createTestContext();

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    expect(result).toEqual({
      claimedRuns: 0,
      succeededRuns: 0,
      failedRuns: 0,
    });
    expect(context.browserProvider.launchCalls).toEqual([]);
    expect(context.closed).toBe(true);
    expect(context.logger.messages).toContain("Account exercise worker started.");
    expect(context.logger.messages).toContain(
      "No queued account exercise run found.",
    );
    expect(context.logger.messages).toContain("Account exercise worker stopped.");
  });

  it("claims one queued run and marks it succeeded with persisted action budget", async () => {
    const context = createTestContext();

    await context.accountExerciseRuns.save(
      createAccountExerciseRun({
        actionBudget: {
          maxDurationMs: 900,
          maxScrolls: 3,
          minDwellMs: 0,
        },
      }),
    );

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    await expect(
      context.accountExerciseRuns.findById("exercise-run-1"),
    ).resolves.toMatchObject({
      status: "SUCCEEDED",
      startedAt: expect.any(String),
      finishedAt: expect.any(String),
      leaseId: "lease-1",
      safeSummary: {
        scrollsPerformed: 3,
        leaseReleased: true,
      },
    });
    expect(result).toEqual({
      claimedRuns: 1,
      succeededRuns: 1,
      failedRuns: 0,
    });
    expect(context.profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
        macroActionsPerformed: 0,
      },
    ]);
    expect(context.browserProvider.launchCalls).toHaveLength(1);
    expect(context.logger.messages.join("\n")).toContain(
      "Claimed account exercise run exercise-run-1.",
    );
    expect(context.logger.messages.join("\n")).toContain("succeeded");
    expect(context.logger.messages.join("\n")).toContain("lease released: yes");
  });

  it("marks checkout failures with sanitized data and continues polling", async () => {
    const context = createTestContext({
      checkoutResult: {
        ok: false,
        statusCode: 409,
        errorCode: "NO_ELIGIBLE_PROFILE_AVAILABLE",
        errorMessage: "No eligible profile.",
      },
    });
    const abortController = new AbortController();

    await context.accountExerciseRuns.save(createAccountExerciseRun());
    context.logger.onMessage = (message) => {
      if (message === "No queued account exercise run found.") {
        abortController.abort();
      }
    };

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: false, pollIntervalMs: 1 }),
      logger: context.logger,
      abortSignal: abortController.signal,
      dependencies: context.dependencies,
    });

    await expect(
      context.accountExerciseRuns.findById("exercise-run-1"),
    ).resolves.toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "PROFILE_EXERCISE_CHECKOUT_FAILED",
      },
      safeSummary: {
        leaseReleased: false,
      },
    });
    expect(result).toEqual({
      claimedRuns: 1,
      succeededRuns: 0,
      failedRuns: 1,
    });
    expect(context.logger.messages.join("\n")).not.toContain("cookie");
    expect(context.logger.messages.join("\n")).not.toContain("localStorage");
    expect(context.logger.messages.join("\n")).not.toContain("proxy-password");
  });

  it("closes browser and releases lease after browser failure", async () => {
    const context = createTestContext({
      launchError: new Error("playwright browser failed with cookie detail"),
    });

    await context.accountExerciseRuns.save(createAccountExerciseRun());

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    await expect(
      context.accountExerciseRuns.findById("exercise-run-1"),
    ).resolves.toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "BROWSER_PROVIDER_FAILED",
        message: "Browser provider failed during ambient exercise.",
      },
      safeSummary: {
        leaseReleased: true,
      },
    });
    expect(result.failedRuns).toBe(1);
    expect(context.profileManager.releaseCalls).toHaveLength(1);
    expect(context.logger.messages.join("\n")).not.toContain("cookie detail");
  });

  it("marks lease attachment failures failed and releases the checked-out lease", async () => {
    const context = createTestContext({
      runRecords: "fail-attach",
    });

    await context.accountExerciseRuns.save(createAccountExerciseRun());

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    await expect(
      context.accountExerciseRuns.findById("exercise-run-1"),
    ).resolves.toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "ACCOUNT_EXERCISE_RUN_RECORD_FAILED",
        message: "Ambient exercise run record could not be updated.",
      },
      safeSummary: {
        pageLoaded: false,
        scrollsPerformed: 0,
        leaseReleased: true,
      },
    });
    expect(result).toEqual({
      claimedRuns: 1,
      succeededRuns: 0,
      failedRuns: 1,
    });
    expect(context.profileManager.releaseCalls).toEqual([
      {
        profileId: "profile-1",
        leaseId: "lease-1",
        macroActionsPerformed: 0,
      },
    ]);
    expect(context.browserProvider.launchCalls).toEqual([]);
  });

  it("marks runtime configuration failures failed and releases the lease", async () => {
    const context = createTestContext({
      runtimeConfigurationResult: {
        ok: false,
        statusCode: 502,
        errorCode: "RUNTIME_CONFIGURATION_UNAVAILABLE",
        errorMessage: "Runtime config unavailable with proxy-password detail.",
      },
    });

    await context.accountExerciseRuns.save(createAccountExerciseRun());

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    await expect(
      context.accountExerciseRuns.findById("exercise-run-1"),
    ).resolves.toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "RUNTIME_CONFIGURATION_FAILED",
        message: "Runtime profile configuration could not be read.",
      },
      safeSummary: {
        leaseReleased: true,
      },
    });
    expect(result.failedRuns).toBe(1);
    expect(context.profileManager.releaseCalls).toHaveLength(1);
    expect(context.browserProvider.launchCalls).toEqual([]);
    expect(context.logger.messages.join("\n")).not.toContain("proxy-password");
  });

  it("closes the browser and releases the lease after navigation failure", async () => {
    const context = createTestContext({
      navigationError: new Error("navigation failed with localStorage detail"),
    });

    await context.accountExerciseRuns.save(createAccountExerciseRun());

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    await expect(
      context.accountExerciseRuns.findById("exercise-run-1"),
    ).resolves.toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "UNKNOWN_FAILURE",
        message: "Ambient account exercise failed.",
      },
      safeSummary: {
        leaseReleased: true,
      },
    });
    expect(result.failedRuns).toBe(1);
    expect(context.browserProvider.closeCalls).toBe(1);
    expect(context.profileManager.releaseCalls).toHaveLength(1);
    expect(context.logger.messages.join("\n")).not.toContain("localStorage detail");
  });

  it("marks the run failed when lease release fails after browser success", async () => {
    const context = createTestContext({
      releaseResult: {
        ok: false,
        statusCode: 502,
        errorCode: "LEASE_RELEASE_FAILED",
        errorMessage: "Release failed.",
      },
    });

    await context.accountExerciseRuns.save(createAccountExerciseRun());

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    await expect(
      context.accountExerciseRuns.findById("exercise-run-1"),
    ).resolves.toMatchObject({
      status: "FAILED",
      failureReason: {
        code: "PROFILE_LEASE_RELEASE_FAILED",
        message: "Profile lease release failed after ambient exercise.",
      },
      safeSummary: {
        pageLoaded: true,
        leaseReleased: false,
      },
    });
    expect(result).toEqual({
      claimedRuns: 1,
      succeededRuns: 0,
      failedRuns: 1,
    });
    expect(context.profileManager.releaseCalls).toHaveLength(1);
  });

  it("CATEGORY_BROWSE navigates exactly to run.target.url", async () => {
    const context = createTestContext();
    const target = {
      categoryId: "category-1",
      sourceGroupId: "group-1",
      entryRouteId: "route-1",
      entryRouteType: "CATEGORY_ENTRY_URL" as const,
      url: "https://www.facebook.com/groups/group-1/categories",
      riskLevel: "LOW" as const,
    };

    await context.accountExerciseRuns.save(
      createAccountExerciseRun({
        exerciseType: "CATEGORY_BROWSE",
        target,
      }),
    );

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    expect(result.succeededRuns).toBe(1);
    expect(context.browserProvider.lastSession?.page.navigatedUrls).toEqual([
      "https://www.facebook.com/groups/group-1/categories",
    ]);
  });

  it("AMBIENT_ACCOUNT still navigates to the existing Facebook home URL", async () => {
    const context = createTestContext();

    await context.accountExerciseRuns.save(
      createAccountExerciseRun({
        exerciseType: "AMBIENT_ACCOUNT",
      }),
    );

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: true }),
      logger: context.logger,
      dependencies: context.dependencies,
    });

    expect(result.succeededRuns).toBe(1);
    expect(context.browserProvider.lastSession?.page.navigatedUrls).toEqual([
      "https://www.facebook.com/",
    ]);
  });

  it("polling continues after a Category Browse failure", async () => {
    const context = createTestContext({
      releaseResult: {
        ok: false,
        statusCode: 502,
        errorCode: "LEASE_RELEASE_FAILED",
        errorMessage: "Release failed.",
      },
    });

    const target = {
      categoryId: "category-1",
      sourceGroupId: "group-1",
      entryRouteId: "route-1",
      entryRouteType: "CATEGORY_ENTRY_URL" as const,
      url: "https://www.facebook.com/groups/group-1/categories",
      riskLevel: "LOW" as const,
    };

    await context.accountExerciseRuns.save(
      createAccountExerciseRun({
        id: "failed-run",
        exerciseType: "CATEGORY_BROWSE",
        target,
        requestedAt: "2026-05-01T09:00:00.000Z",
      }),
    );

    await context.accountExerciseRuns.save(
      createAccountExerciseRun({
        id: "succeeding-run",
        exerciseType: "CATEGORY_BROWSE",
        target,
        requestedAt: "2026-05-01T09:05:00.000Z",
      }),
    );

    const abortController = new AbortController();
    context.logger.onMessage = (message) => {
      if (message.includes("Claimed account exercise run succeeding-run.")) {
        abortController.abort();
      }
    };

    const result = await runAccountExerciseWorkerCommand({
      args: createArgs({ once: false, pollIntervalMs: 1 }),
      logger: context.logger,
      abortSignal: abortController.signal,
      dependencies: context.dependencies,
    });

    expect(result.claimedRuns).toBe(2);
    expect(result.failedRuns).toBe(2);
    expect(context.logger.messages.join("\n")).toContain("Claimed account exercise run failed-run.");
    expect(context.logger.messages.join("\n")).toContain("Claimed account exercise run succeeding-run.");
  });
});

interface TestContext {
  readonly accountExerciseRuns: InMemoryAccountExerciseRunRepository;
  readonly profileManager: FakeProfileExerciseProfileManager;
  readonly browserProvider: FakeBrowserProvider;
  readonly logger: MemoryLogger;
  readonly dependencies: AccountExerciseWorkerDependencies;
  readonly closed: boolean;
}

function createTestContext(
  options: {
    readonly checkoutResult?: ProfileExerciseCheckoutResult;
    readonly runtimeConfigurationResult?: RuntimeProfileConfigurationResult;
    readonly releaseResult?: ProfileLeaseReleaseResult;
    readonly launchError?: Error;
    readonly navigationError?: Error;
    readonly runRecords?: "fail-attach";
  } = {},
): TestContext {
  const accountExerciseRuns = new InMemoryAccountExerciseRunRepository();
  const profileManager = new FakeProfileExerciseProfileManager(
    options.checkoutResult,
    options.runtimeConfigurationResult,
    options.releaseResult,
  );
  const browserProvider = new FakeBrowserProvider({
    ...(options.launchError !== undefined
      ? { launchError: options.launchError }
      : {}),
    ...(options.navigationError !== undefined
      ? { navigationError: options.navigationError }
      : {}),
  });
  const logger = new MemoryLogger();
  const context = {
    accountExerciseRuns,
    profileManager,
    browserProvider,
    logger,
    dependencies: undefined,
    closed: false,
  };

  return {
    accountExerciseRuns,
    profileManager,
    browserProvider,
    logger,
    dependencies: {
      accountExerciseRuns,
      ...(options.runRecords === "fail-attach"
        ? { runRecords: new FailingAttachRunRecordPort(accountExerciseRuns) }
        : {}),
      profileManager,
      browserProvider,
      clock: new FixedClock(),
      close: async () => {
        context.closed = true;
      },
    },
    get closed() {
      return context.closed;
    },
  };
}

function createArgs(
  options: {
    readonly once?: boolean;
    readonly pollIntervalMs?: number;
  } = {},
) {
  return {
    baseUrl: "http://localhost:8081",
    once: options.once ?? true,
    pollIntervalMs: options.pollIntervalMs ?? 5_000,
    browserProvider: "playwright" as const,
  };
}

class FixedClock implements Clock {
  public now(): Date {
    return new Date();
  }
}

class MemoryLogger implements AccountExerciseWorkerLogger {
  public readonly messages: string[] = [];
  public onMessage: ((message: string) => void) | undefined;

  public info(message: string): void {
    this.messages.push(message);
    this.onMessage?.(message);
  }

  public warn(message: string): void {
    this.info(message);
  }

  public error(message: string): void {
    this.info(message);
  }
}

class FakeProfileExerciseProfileManager
  implements ProfileExerciseProfileManagerPort
{
  public readonly releaseCalls: ProfileLeaseReleaseInput[] = [];

  public constructor(
    private readonly checkoutResult: ProfileExerciseCheckoutResult | undefined,
    private readonly runtimeConfigurationResult:
      | RuntimeProfileConfigurationResult
      | undefined,
    private readonly releaseResult: ProfileLeaseReleaseResult | undefined,
  ) {}

  public async getSafeProfileAccountStage(): Promise<SafeProfileAccountStageResult> {
    return {
      ok: true,
      profileId: "profile-1",
      accountStage: "NEW_ACCOUNT",
    };
  }

  public async checkoutProfileForExercise(): Promise<ProfileExerciseCheckoutResult> {
    return (
      this.checkoutResult ?? {
        ok: true,
        profileId: "profile-1",
        accountStage: "NEW_ACCOUNT",
        leaseId: "lease-1",
        leaseExpiresAt: "2026-05-01T10:45:00.000Z",
      }
    );
  }

  public async getRuntimeProfileConfiguration(): Promise<RuntimeProfileConfigurationResult> {
    return this.runtimeConfigurationResult ?? {
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
          sessionCapturedAt: createdAt,
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

    return this.releaseResult ?? {
      ok: true,
      releasedAt: "2026-05-01T10:05:00.000Z",
    };
  }
}

class FailingAttachRunRecordPort implements ProfileExerciseRunRecordPort {
  public constructor(
    private readonly accountExerciseRuns: InMemoryAccountExerciseRunRepository,
  ) {}

  public async requestRun(): Promise<never> {
    throw new Error("requestRun was not expected.");
  }

  public async markRunRunning(): Promise<never> {
    throw new Error("markRunRunning was not expected.");
  }

  public async attachRunLease(): Promise<{
    readonly ok: false;
    readonly errorCode: string;
    readonly errorMessage: string;
  }> {
    return {
      ok: false,
      errorCode: "LEASE_ATTACH_FAILED",
      errorMessage: "Lease attachment failed.",
    };
  }

  public async markRunSucceeded(): Promise<never> {
    throw new Error("markRunSucceeded was not expected.");
  }

  public async markRunFailed(input: {
    readonly accountExerciseRunId: string;
    readonly failureReason: AccountExerciseRun["failureReason"];
    readonly safeSummary?: AccountExerciseRun["safeSummary"];
  }): Promise<{
    readonly ok: true;
    readonly accountExerciseRun: AccountExerciseRun;
  }> {
    const run = await this.accountExerciseRuns.findById(
      input.accountExerciseRunId,
    );

    if (run === null || input.failureReason === undefined) {
      throw new Error("Expected running account exercise run.");
    }

    const failedRun: AccountExerciseRun = {
      ...run,
      status: "FAILED",
      failureReason: input.failureReason,
      ...(input.safeSummary !== undefined
        ? { safeSummary: input.safeSummary }
        : {}),
      finishedAt,
      updatedAt: finishedAt,
    };

    await this.accountExerciseRuns.save(failedRun);

    return {
      ok: true,
      accountExerciseRun: failedRun,
    };
  }
}

class FakeBrowserProvider implements BrowserProviderPort {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly launchCalls: BrowserProviderLaunchConfig[] = [];
  public closeCalls = 0;
  public lastSession?: FakeBrowserSession;

  public constructor(
    private readonly options: {
      readonly launchError?: Error;
      readonly navigationError?: Error;
    },
  ) {}

  public async launch(
    config: BrowserProviderLaunchConfig,
  ): Promise<BrowserProviderSession> {
    this.launchCalls.push(config);

    if (this.options.launchError !== undefined) {
      throw this.options.launchError;
    }

    const session = new FakeBrowserSession(this.options.navigationError, () => {
      this.closeCalls += 1;
    });
    this.lastSession = session;
    return session;
  }
}

class FakeBrowserSession implements BrowserProviderSession {
  public readonly providerName = "PLAYWRIGHT_CHROMIUM" as const;
  public readonly page: FakeBrowserPage;
  public closed = false;

  public constructor(
    navigationError: Error | undefined,
    private readonly onClose: () => void,
  ) {
    this.page = new FakeBrowserPage(navigationError);
  }

  public async newPage(): Promise<BrowserProviderPage> {
    return this.page;
  }

  public async close(): Promise<void> {
    this.closed = true;
    this.onClose();
  }
}

class FakeBrowserPage implements BrowserProviderPage {
  private currentUrl = "about:blank";
  public readonly navigatedUrls: string[] = [];

  public constructor(private readonly navigationError: Error | undefined) {}

  public url(): string {
    return this.currentUrl;
  }

  public async goto(
    input: BrowserProviderNavigationInput,
  ): Promise<BrowserProviderNavigationResult | null> {
    this.currentUrl = input.url;
    this.navigatedUrls.push(input.url);

    if (this.navigationError !== undefined) {
      throw this.navigationError;
    }

    return {
      status: 200,
    };
  }

  public async evaluate<T = unknown>(script: string): Promise<T> {
    if (script.includes("window.scrollBy")) {
      return undefined as T;
    }

    return {
      pageLoaded: true,
      loginRequired: false,
      checkpointDetected: false,
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

function createAccountExerciseRun(
  options: Partial<AccountExerciseRun> = {},
): AccountExerciseRun {
  return {
    id: options.id ?? "exercise-run-1",
    profileId: options.profileId ?? "profile-1",
    ...(options.leaseId !== undefined ? { leaseId: options.leaseId } : {}),
    exerciseType: options.exerciseType ?? "AMBIENT_ACCOUNT",
    status: options.status ?? "QUEUED",
    stageAtStart: options.stageAtStart ?? "NEW_ACCOUNT",
    actionBudget: options.actionBudget ?? {
      maxDurationMs: 120_000,
      maxScrolls: 2,
      minDwellMs: 0,
    },
    ...(options.target !== undefined ? { target: options.target } : {}),
    ...(options.safeSummary !== undefined
      ? { safeSummary: options.safeSummary }
      : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? createdAt,
    createdAt: options.createdAt ?? createdAt,
    updatedAt: options.updatedAt ?? createdAt,
  };
}
