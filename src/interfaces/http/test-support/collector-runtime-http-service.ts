import type {
  AccountExerciseRun,
  CollectionRun,
  CollectionSchedule,
  ProfileHomeFeedCollectionRun,
  ProfileSourceAccessCheckRun,
} from "../../../collector-runtime/domain";
import type {
  CollectorRuntimeHttpService,
} from "../routes/collector-runtime.routes";

export const collectorRuntimeHttpTestNow = "2026-04-01T10:00:00.000Z";

export class StubUseCase<Input, Output> {
  public readonly calls: Input[] = [];
  private error: unknown;

  public constructor(private output: Output) {}

  public setOutput(output: Output): void {
    this.output = output;
  }

  public setError(error: unknown): void {
    this.error = error;
  }

  public async execute(input: Input): Promise<Output> {
    this.calls.push(input);

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.output;
  }
}

export interface FakeCollectorRuntimeHttpService
  extends CollectorRuntimeHttpService {
  readonly requestCollectionRun: StubUseCase<unknown, CollectionRun>;
  readonly requestAccountExerciseRun: StubUseCase<unknown, AccountExerciseRun>;
  readonly getAccountExerciseRun: StubUseCase<unknown, AccountExerciseRun>;
  readonly listAccountExerciseRuns: StubUseCase<
    unknown,
    {
      readonly items: readonly AccountExerciseRun[];
      readonly page: {
        readonly limit: number;
        readonly offset: number;
        readonly total: number;
      };
    }
  >;
  readonly markAccountExerciseRunRunning: StubUseCase<
    unknown,
    AccountExerciseRun
  >;
  readonly markAccountExerciseRunSucceeded: StubUseCase<
    unknown,
    AccountExerciseRun
  >;
  readonly markAccountExerciseRunFailed: StubUseCase<
    unknown,
    AccountExerciseRun
  >;
  readonly attachAccountExerciseRunLease: StubUseCase<
    unknown,
    AccountExerciseRun
  >;
  readonly cancelAccountExerciseRun: StubUseCase<unknown, AccountExerciseRun>;
  readonly getCollectionRun: StubUseCase<unknown, CollectionRun>;
  readonly listCollectionRuns: StubUseCase<
    unknown,
    {
      readonly items: readonly CollectionRun[];
      readonly page: {
        readonly limit: number;
        readonly offset: number;
        readonly total: number;
      };
    }
  >;
  readonly cancelCollectionRun: StubUseCase<unknown, CollectionRun>;
  readonly requestProfileHomeFeedCollectionRun: StubUseCase<
    unknown,
    ProfileHomeFeedCollectionRun
  >;
  readonly getProfileHomeFeedCollectionRun: StubUseCase<
    unknown,
    ProfileHomeFeedCollectionRun
  >;
  readonly listProfileHomeFeedCollectionRuns: StubUseCase<
    unknown,
    {
      readonly items: readonly ProfileHomeFeedCollectionRun[];
      readonly page: {
        readonly limit: number;
        readonly offset: number;
        readonly total: number;
      };
    }
  >;
  readonly cancelProfileHomeFeedCollectionRun: StubUseCase<
    unknown,
    ProfileHomeFeedCollectionRun
  >;
  readonly requestProfileSourceAccessCheckRun: StubUseCase<unknown, ProfileSourceAccessCheckRun>;
  readonly getProfileSourceAccessCheckRun: StubUseCase<unknown, ProfileSourceAccessCheckRun>;
  readonly listProfileSourceAccessCheckRuns: StubUseCase<
    unknown,
    {
      readonly items: readonly ProfileSourceAccessCheckRun[];
      readonly page: {
        readonly limit: number;
        readonly offset: number;
        readonly total: number;
      };
    }
  >;
  readonly cancelProfileSourceAccessCheckRun: StubUseCase<unknown, ProfileSourceAccessCheckRun>;
  readonly upsertCollectionSchedule: StubUseCase<unknown, CollectionSchedule>;
  readonly getCollectionSchedule: StubUseCase<unknown, CollectionSchedule>;
  readonly listCollectionSchedules: StubUseCase<
    unknown,
    {
      readonly items: readonly CollectionSchedule[];
      readonly page: {
        readonly limit: number;
        readonly offset: number;
        readonly total: number;
      };
    }
  >;
}

export function createFakeCollectorRuntimeHttpService(): FakeCollectorRuntimeHttpService {
  const collectionRun = createCollectionRun();
  const accountExerciseRun = createAccountExerciseRun();
  const profileHomeFeedCollectionRun = createProfileHomeFeedCollectionRun();

  return {
    requestAccountExerciseRun: new StubUseCase(accountExerciseRun),
    getAccountExerciseRun: new StubUseCase(accountExerciseRun),
    listAccountExerciseRuns: new StubUseCase({
      items: [accountExerciseRun],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
    markAccountExerciseRunRunning: new StubUseCase(
      createAccountExerciseRun({
        status: "RUNNING",
        leaseId: "lease-1",
        startedAt: collectorRuntimeHttpTestNow,
        updatedAt: collectorRuntimeHttpTestNow,
      }),
    ),
    markAccountExerciseRunSucceeded: new StubUseCase(
      createAccountExerciseRun({
        status: "SUCCEEDED",
        leaseId: "lease-1",
        startedAt: collectorRuntimeHttpTestNow,
        finishedAt: collectorRuntimeHttpTestNow,
        updatedAt: collectorRuntimeHttpTestNow,
        safeSummary: createAccountExerciseRunSafeSummary(),
      }),
    ),
    markAccountExerciseRunFailed: new StubUseCase(
      createAccountExerciseRun({
        status: "FAILED",
        leaseId: "lease-1",
        startedAt: collectorRuntimeHttpTestNow,
        finishedAt: collectorRuntimeHttpTestNow,
        updatedAt: collectorRuntimeHttpTestNow,
        safeSummary: createAccountExerciseRunSafeSummary({
          loginRequired: true,
        }),
        failureReason: {
          code: "LOGIN_REQUIRED",
          message: "Login is required before ambient exercise can continue.",
        },
      }),
    ),
    attachAccountExerciseRunLease: new StubUseCase(
      createAccountExerciseRun({
        status: "RUNNING",
        leaseId: "lease-1",
        startedAt: collectorRuntimeHttpTestNow,
        updatedAt: collectorRuntimeHttpTestNow,
      }),
    ),
    cancelAccountExerciseRun: new StubUseCase(
      createAccountExerciseRun({
        status: "CANCELED",
        finishedAt: collectorRuntimeHttpTestNow,
        updatedAt: collectorRuntimeHttpTestNow,
      }),
    ),
    requestCollectionRun: new StubUseCase(collectionRun),
    getCollectionRun: new StubUseCase(collectionRun),
    listCollectionRuns: new StubUseCase({
      items: [collectionRun],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
    cancelCollectionRun: new StubUseCase(
      createCollectionRun({
        status: "CANCELED",
        finishedAt: collectorRuntimeHttpTestNow,
        updatedAt: collectorRuntimeHttpTestNow,
      }),
    ),
    requestProfileHomeFeedCollectionRun: new StubUseCase(
      profileHomeFeedCollectionRun,
    ),
    getProfileHomeFeedCollectionRun: new StubUseCase(
      profileHomeFeedCollectionRun,
    ),
    listProfileHomeFeedCollectionRuns: new StubUseCase({
      items: [profileHomeFeedCollectionRun],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
    cancelProfileHomeFeedCollectionRun: new StubUseCase(
      createProfileHomeFeedCollectionRun({
        status: "CANCELED",
        finishedAt: collectorRuntimeHttpTestNow,
        updatedAt: collectorRuntimeHttpTestNow,
      }),
    ),
    requestProfileSourceAccessCheckRun: new StubUseCase(createProfileSourceAccessCheckRun()),
    getProfileSourceAccessCheckRun: new StubUseCase(createProfileSourceAccessCheckRun()),
    listProfileSourceAccessCheckRuns: new StubUseCase({
      items: [createProfileSourceAccessCheckRun()],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
    cancelProfileSourceAccessCheckRun: new StubUseCase(createProfileSourceAccessCheckRun()),
    upsertCollectionSchedule: new StubUseCase(createCollectionSchedule()),
    getCollectionSchedule: new StubUseCase(createCollectionSchedule()),
    listCollectionSchedules: new StubUseCase({
      items: [createCollectionSchedule()],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    }),
  } as unknown as FakeCollectorRuntimeHttpService;
}

export function createUnusedCollectorRuntimeHttpService(): CollectorRuntimeHttpService {
  const useCase = {
    async execute(_input: unknown): Promise<unknown> {
      throw new Error("Collector Runtime service was not expected.");
    },
  };

  return {
    requestAccountExerciseRun: useCase,
    getAccountExerciseRun: useCase,
    listAccountExerciseRuns: useCase,
    markAccountExerciseRunRunning: useCase,
    markAccountExerciseRunSucceeded: useCase,
    markAccountExerciseRunFailed: useCase,
    attachAccountExerciseRunLease: useCase,
    cancelAccountExerciseRun: useCase,
    requestCollectionRun: useCase,
    getCollectionRun: useCase,
    listCollectionRuns: useCase,
    cancelCollectionRun: useCase,
    requestProfileHomeFeedCollectionRun: useCase,
    getProfileHomeFeedCollectionRun: useCase,
    listProfileHomeFeedCollectionRuns: useCase,
    cancelProfileHomeFeedCollectionRun: useCase,
    requestProfileSourceAccessCheckRun: useCase,
    getProfileSourceAccessCheckRun: useCase,
    listProfileSourceAccessCheckRuns: useCase,
    cancelProfileSourceAccessCheckRun: useCase,
    upsertCollectionSchedule: useCase,
    getCollectionSchedule: useCase,
    listCollectionSchedules: useCase,
  } as unknown as CollectorRuntimeHttpService;
}

export function createAccountExerciseRun(
  options: Partial<AccountExerciseRun> = {},
): AccountExerciseRun {
  return {
    id: options.id ?? "account-exercise-run-1",
    profileId: options.profileId ?? "profile-1",
    ...(options.leaseId !== undefined ? { leaseId: options.leaseId } : {}),
    exerciseType: options.exerciseType ?? "AMBIENT_ACCOUNT",
    status: options.status ?? "QUEUED",
    stageAtStart: options.stageAtStart ?? "NEW_ACCOUNT",
    actionBudget: options.actionBudget ?? {
      maxDurationMs: 120_000,
      maxScrolls: 2,
      minDwellMs: 2_000,
    },
    ...(options.target !== undefined ? { target: options.target } : {}),
    ...(options.safeSummary !== undefined
      ? { safeSummary: options.safeSummary }
      : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? collectorRuntimeHttpTestNow,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? collectorRuntimeHttpTestNow,
    updatedAt: options.updatedAt ?? collectorRuntimeHttpTestNow,
  };
}

function createAccountExerciseRunSafeSummary(
  options: Partial<NonNullable<AccountExerciseRun["safeSummary"]>> = {},
): NonNullable<AccountExerciseRun["safeSummary"]> {
  return {
    pageLoaded: options.pageLoaded ?? true,
    loginRequired: options.loginRequired ?? false,
    checkpointDetected: options.checkpointDetected ?? false,
    scrollsPerformed: options.scrollsPerformed ?? 2,
    durationMs: options.durationMs ?? 10_000,
    leaseReleased: options.leaseReleased ?? true,
  };
}

export function createCollectionRun(
  options: Partial<CollectionRun> = {},
): CollectionRun {
  return {
    id: options.id ?? "collection-run-1",
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    status: options.status ?? "QUEUED",
    triggerType: options.triggerType ?? "MANUAL_API",
    parameters: options.parameters ?? {
      maxScrolls: 3,
      maxDurationMs: 30_000,
    },
    ...(options.summary !== undefined ? { summary: options.summary } : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? collectorRuntimeHttpTestNow,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined
      ? { finishedAt: options.finishedAt }
      : {}),
    createdAt: options.createdAt ?? collectorRuntimeHttpTestNow,
    updatedAt: options.updatedAt ?? collectorRuntimeHttpTestNow,
  };
}

export function createProfileSourceAccessCheckRun(
  options: Partial<ProfileSourceAccessCheckRun> = {},
): ProfileSourceAccessCheckRun {
  return {
    id: options.id ?? "check-run-1",
    profileId: options.profileId ?? "profile-1",
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    triggerType: options.triggerType ?? "MANUAL",
    status: options.status ?? "QUEUED",
    accountStageAtRequest: options.accountStageAtRequest ?? "WARMING",
    target: options.target ?? {
      platform: "FACEBOOK",
      routeType: "DIRECT_GROUP_URL",
      url: "https://www.facebook.com/groups/source-group-1",
    },
    ...(options.outcome !== undefined ? { outcome: options.outcome } : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? collectorRuntimeHttpTestNow,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined ? { finishedAt: options.finishedAt } : {}),
    createdAt: options.createdAt ?? collectorRuntimeHttpTestNow,
    updatedAt: options.updatedAt ?? collectorRuntimeHttpTestNow,
  };
}

export function createProfileHomeFeedCollectionRun(
  options: Partial<ProfileHomeFeedCollectionRun> = {},
): ProfileHomeFeedCollectionRun {
  return {
    id: options.id ?? "profile-home-feed-run-1",
    profileId: options.profileId ?? "profile-1",
    triggerType: options.triggerType ?? "MANUAL_API",
    status: options.status ?? "QUEUED",
    accountStageAtRequest: options.accountStageAtRequest ?? "WARMING",
    target: options.target ?? {
      platform: "FACEBOOK",
      surface: "PROFILE_HOME_FEED",
    },
    parameters: options.parameters ?? {
      maxScrolls: 3,
      maxDurationMs: 30_000,
      maxPosts: 10,
    },
    ...(options.summary !== undefined ? { summary: options.summary } : {}),
    ...(options.failureReason !== undefined
      ? { failureReason: options.failureReason }
      : {}),
    requestedAt: options.requestedAt ?? collectorRuntimeHttpTestNow,
    ...(options.startedAt !== undefined ? { startedAt: options.startedAt } : {}),
    ...(options.finishedAt !== undefined ? { finishedAt: options.finishedAt } : {}),
    createdAt: options.createdAt ?? collectorRuntimeHttpTestNow,
    updatedAt: options.updatedAt ?? collectorRuntimeHttpTestNow,
  };
}

export function createCollectionSchedule(
  options: Partial<CollectionSchedule> = {},
): CollectionSchedule {
  return {
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    enabled: options.enabled ?? true,
    intervalMinutes: options.intervalMinutes ?? 60,
    nextRunAt: options.nextRunAt ?? collectorRuntimeHttpTestNow,
    parameters: options.parameters ?? {},
    createdAt: options.createdAt ?? collectorRuntimeHttpTestNow,
    updatedAt: options.updatedAt ?? collectorRuntimeHttpTestNow,
  };
}
