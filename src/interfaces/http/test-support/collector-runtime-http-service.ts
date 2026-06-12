import type {
  AccountExerciseRun,
  CollectionRun,
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
        readonly total?: number;
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
  readonly cancelAccountExerciseRun: StubUseCase<unknown, AccountExerciseRun>;
  readonly getCollectionRun: StubUseCase<unknown, CollectionRun>;
  readonly listCollectionRuns: StubUseCase<
    unknown,
    {
      readonly items: readonly CollectionRun[];
      readonly page: {
        readonly limit: number;
        readonly offset: number;
        readonly total?: number;
      };
    }
  >;
  readonly cancelCollectionRun: StubUseCase<unknown, CollectionRun>;
}

export function createFakeCollectorRuntimeHttpService(): FakeCollectorRuntimeHttpService {
  const collectionRun = createCollectionRun();
  const accountExerciseRun = createAccountExerciseRun();

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
  } as FakeCollectorRuntimeHttpService;
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
    cancelAccountExerciseRun: useCase,
    requestCollectionRun: useCase,
    getCollectionRun: useCase,
    listCollectionRuns: useCase,
    cancelCollectionRun: useCase,
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
