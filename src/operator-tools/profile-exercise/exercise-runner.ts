import {
  AttachAccountExerciseRunLeaseUseCase,
  MarkAccountExerciseRunFailedUseCase,
  MarkAccountExerciseRunRunningUseCase,
  MarkAccountExerciseRunSucceededUseCase,
  RequestAccountExerciseRunUseCase,
  type AttachAccountExerciseRunLeaseInput,
  type MarkAccountExerciseRunFailedInput,
  type MarkAccountExerciseRunRunningInput,
  type MarkAccountExerciseRunSucceededInput,
  type RequestAccountExerciseRunInput,
} from "../../collector-runtime/application";
import type {
  AccountExerciseRunRepository,
  BrowserProviderPage,
  BrowserProviderPort,
  BrowserProviderSession,
  Clock,
  IdGenerator,
  ProfileLeaseReleaseResult,
  RuntimeProfileConfigurationResult,
  SourceGroupLookupPort,
  SourceGroupLookupResult,
} from "../../collector-runtime/application";
import type {
  AccountExerciseRun,
  AccountExerciseRunFailureReason,
  AccountExerciseRunSafeSummary,
} from "../../collector-runtime/domain";
import {
  validateAccountExerciseRun,
} from "../../collector-runtime/domain";
import {
  ProfileManagerHttpClient,
  buildBrowserProviderLaunchConfig,
  observeFacebookPageState,
  resolveBrowserProvider,
  type FacebookPageState,
  type ProfileExerciseCheckoutResult,
  type SafeProfileAccountStageResult,
} from "../../collector-runtime/infrastructure";
import type {
  FetchLike,
  FetchLikeResponse,
} from "../../collector-runtime/infrastructure/content-manager-http-client";
import { CryptoIdGenerator, SystemClock } from "../../infrastructure/system";
import type { ProfileExerciseCliArgs } from "./cli-args";

export interface ProfileExerciseLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface ProfileExerciseProfileManagerPort {
  getSafeProfileAccountStage(
    profileId: string,
  ): Promise<SafeProfileAccountStageResult>;
  checkoutProfileForExercise(
    profileId: string,
  ): Promise<ProfileExerciseCheckoutResult>;
  getRuntimeProfileConfiguration(
    leaseId: string,
  ): Promise<RuntimeProfileConfigurationResult>;
  releaseProfileLease(input: {
    readonly profileId: string;
    readonly leaseId: string;
    readonly macroActionsPerformed?: number;
  }): Promise<ProfileLeaseReleaseResult>;
}

export interface ProfileExerciseDependencies {
  readonly runRecords?: ProfileExerciseRunRecordPort;
  readonly accountExerciseRuns?: AccountExerciseRunRepository;
  readonly profileManager?: ProfileExerciseProfileManagerPort;
  readonly browserProvider?: BrowserProviderPort;
  readonly clock?: Clock;
  readonly idGenerator?: IdGenerator;
  readonly close?: () => Promise<void>;
}

export interface RunProfileExerciseCommandInput {
  readonly args: ProfileExerciseCliArgs;
  readonly logger?: ProfileExerciseLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: ProfileExerciseDependencies;
  readonly now?: () => Date;
}

export interface ExecuteRunningProfileExerciseRunInput {
  readonly accountExerciseRun: AccountExerciseRun;
  readonly baseUrl: string;
  readonly browserProvider: ProfileExerciseCliArgs["browserProvider"];
  readonly logger?: ProfileExerciseLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: ProfileExerciseDependencies;
  readonly now?: () => Date;
}

export interface ProfileExerciseCommandResult {
  readonly ok: boolean;
  readonly profileId: string;
  readonly accountExerciseRunId?: string;
  readonly leaseId?: string;
  readonly status?: AccountExerciseRun["status"];
  readonly safeSummary?: AccountExerciseRunSafeSummary;
  readonly failureReason?: AccountExerciseRunFailureReason;
  readonly leaseReleased: boolean;
  readonly durationMs: number;
  readonly errors: readonly ProfileExerciseCommandError[];
}

export interface ProfileExerciseCommandError {
  readonly code: string;
  readonly message: string;
  readonly causeCode?: string;
  readonly statusCode?: number;
}

export type ProfileExerciseRunRecordResult =
  | {
      readonly ok: true;
      readonly accountExerciseRun: AccountExerciseRun;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

export interface ProfileExerciseRunRecordPort {
  requestRun(
    input: RequestAccountExerciseRunInput,
  ): Promise<ProfileExerciseRunRecordResult>;
  markRunRunning(
    input: MarkAccountExerciseRunRunningInput,
  ): Promise<ProfileExerciseRunRecordResult>;
  attachRunLease(
    input: AttachAccountExerciseRunLeaseInput,
  ): Promise<ProfileExerciseRunRecordResult>;
  markRunSucceeded(
    input: MarkAccountExerciseRunSucceededInput,
  ): Promise<ProfileExerciseRunRecordResult>;
  markRunFailed(
    input: MarkAccountExerciseRunFailedInput,
  ): Promise<ProfileExerciseRunRecordResult>;
}

interface BuiltDependencies {
  readonly runRecords: ProfileExerciseRunRecordPort;
  readonly profileManager: ProfileExerciseProfileManagerPort;
  readonly browserProvider: BrowserProviderPort;
  readonly clock: Clock;
  readonly idGenerator: IdGenerator;
  readonly close: () => Promise<void>;
}

interface BrowserExerciseOutcome {
  readonly safeSummary: Omit<AccountExerciseRunSafeSummary, "leaseReleased">;
  readonly failureReason?: AccountExerciseRunFailureReason;
}

const FACEBOOK_HOME_URL = "https://www.facebook.com/";
const ACCOUNT_EXERCISE_RUNS_PATH = "collector/account-exercise-runs";
const COLLECTOR_RUNTIME_HTTP_ERROR = "COLLECTOR_RUNTIME_HTTP_ERROR";
const COLLECTOR_RUNTIME_NETWORK_ERROR = "COLLECTOR_RUNTIME_NETWORK_ERROR";
const COLLECTOR_RUNTIME_RESPONSE_ERROR = "COLLECTOR_RUNTIME_RESPONSE_ERROR";
const FACEBOOK_PAGE_STATE_SETTLE_MS = 500;
const FACEBOOK_PAGE_STATE_POLL_INTERVAL_MS = 100;
const NOOP_LOGGER: ProfileExerciseLogger = {
  info() {},
};

export async function runProfileExerciseCommand(
  input: RunProfileExerciseCommandInput,
): Promise<ProfileExerciseCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const startedAt = (input.now ?? (() => new Date()))();
  const dependencies = buildDependencies(input);
  let run: AccountExerciseRun | undefined;
  let leaseReleased = false;

  logger.info("Starting ambient profile exercise run.");
  logger.info(`Using Collector Profile Manager profile id ${input.args.profileId}.`);

  try {
    const stageResult = await dependencies.profileManager.getSafeProfileAccountStage(
      input.args.profileId,
    );

    if (!stageResult.ok) {
      const result = createFailureCommandResult({
        profileId: input.args.profileId,
        durationMs: getDurationMs(startedAt),
        leaseReleased,
        error: toCommandError("PROFILE_STAGE_READ_FAILED", stageResult),
      });

      logSafeSummary(logger, result);

      return result;
    }

    const requestRunResult = await dependencies.runRecords.requestRun({
      profileId: input.args.profileId,
      stageAtStart: stageResult.accountStage,
      maxDurationMs: input.args.maxDurationMs,
      maxScrolls: input.args.maxScrolls,
      minDwellMs: input.args.minDwellMs,
    });

    if (!requestRunResult.ok) {
      const result = createFailureCommandResult({
        profileId: input.args.profileId,
        durationMs: getDurationMs(startedAt),
        leaseReleased,
        error: toCommandError(
          "ACCOUNT_EXERCISE_RUN_RECORD_FAILED",
          requestRunResult,
        ),
      });

      logSafeSummary(logger, result);

      return result;
    }

    run = requestRunResult.accountExerciseRun;

    logger.info(`Created ambient exercise run ${run.id}.`);

    const startedRunResult = await dependencies.runRecords.markRunRunning({
      accountExerciseRunId: run.id,
    });

    if (!startedRunResult.ok) {
      const result = toCommandResult({
        run,
        profileId: input.args.profileId,
        durationMs: getDurationMs(startedAt),
        leaseReleased,
        errors: [
          toCommandError(
            "ACCOUNT_EXERCISE_RUN_RECORD_FAILED",
            startedRunResult,
          ),
        ],
      });

      logSafeSummary(logger, result);

      return result;
    }

    return await executeRunningProfileExerciseRun({
      accountExerciseRun: startedRunResult.accountExerciseRun,
      baseUrl: input.args.baseUrl,
      browserProvider: input.args.browserProvider,
      logger,
      ...(input.abortSignal !== undefined
        ? { abortSignal: input.abortSignal }
        : {}),
      dependencies: {
        runRecords: dependencies.runRecords,
        profileManager: dependencies.profileManager,
        browserProvider: dependencies.browserProvider,
        clock: dependencies.clock,
        idGenerator: dependencies.idGenerator,
        close: async () => {},
      },
      now: () => startedAt,
    });

  } catch (error) {
    const commandError = toUnknownFailure(error);

    if (run !== undefined) {
      return await failRunAndReturn({
        run,
        dependencies,
        logger,
        profileId: input.args.profileId,
        startedAt,
        leaseReleased,
        safeSummary: createSafeSummary({
          pageLoaded: false,
          loginRequired: false,
          checkpointDetected: false,
          scrollsPerformed: 0,
          durationMs: getDurationMs(startedAt),
          leaseReleased,
        }),
        error: commandError,
      });
    }

    const result = createFailureCommandResult({
      profileId: input.args.profileId,
      durationMs: getDurationMs(startedAt),
      leaseReleased,
      error: commandError,
    });

    logSafeSummary(logger, result);

    return result;
  } finally {
    await dependencies.close();
  }
}

export async function executeRunningProfileExerciseRun(
  input: ExecuteRunningProfileExerciseRunInput,
): Promise<ProfileExerciseCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const startedAt = (input.now ?? (() => new Date()))();
  const dependencies = buildDependencies(input);
  let run = input.accountExerciseRun;
  let leaseId: string | undefined = run.leaseId;
  let leaseReleased = false;
  let session: BrowserProviderSession | undefined;
  const args = toProfileExerciseArgsFromRun(input);

  logger.info(`Executing ambient exercise run ${run.id}.`);
  logger.info(`Using Collector Profile Manager profile id ${run.profileId}.`);

  try {
    if (run.status !== "RUNNING") {
      return await failRunAndReturn({
        run,
        dependencies,
        logger,
        profileId: run.profileId,
        startedAt,
        leaseReleased,
        safeSummary: createSafeSummary({
          pageLoaded: false,
          loginRequired: false,
          checkpointDetected: false,
          scrollsPerformed: 0,
          durationMs: getDurationMs(startedAt),
          leaseReleased,
        }),
        error: {
          code: "ACCOUNT_EXERCISE_RUN_RECORD_FAILED",
          message: getSafeFailureMessage(
            "ACCOUNT_EXERCISE_RUN_RECORD_FAILED",
          ),
        },
      });
    }

    const checkoutResult =
      await dependencies.profileManager.checkoutProfileForExercise(
        run.profileId,
      );

    if (!checkoutResult.ok) {
      return await failRunAndReturn({
        run,
        dependencies,
        logger,
        profileId: run.profileId,
        startedAt,
        leaseReleased,
        safeSummary: createSafeSummary({
          pageLoaded: false,
          loginRequired: false,
          checkpointDetected: false,
          scrollsPerformed: 0,
          durationMs: getDurationMs(startedAt),
          leaseReleased,
        }),
        error: toCommandError("PROFILE_EXERCISE_CHECKOUT_FAILED", checkoutResult),
      });
    }

    leaseId = checkoutResult.leaseId;
    const attachedRunResult = await dependencies.runRecords.attachRunLease({
      accountExerciseRunId: run.id,
      leaseId,
    });

    if (!attachedRunResult.ok) {
      const releaseResult = await releaseLease(
        dependencies.profileManager,
        run.profileId,
        leaseId,
      );
      leaseReleased = releaseResult.ok;

      return await failRunAndReturn({
        run,
        dependencies,
        logger,
        profileId: run.profileId,
        startedAt,
        leaseId,
        leaseReleased,
        safeSummary: createSafeSummary({
          pageLoaded: false,
          loginRequired: false,
          checkpointDetected: false,
          scrollsPerformed: 0,
          durationMs: getDurationMs(startedAt),
          leaseReleased,
        }),
        error: toCommandError(
          "ACCOUNT_EXERCISE_RUN_RECORD_FAILED",
          attachedRunResult,
        ),
      });
    }

    run = attachedRunResult.accountExerciseRun;

    logger.info(`Checked out profile ${run.profileId} for exercise.`);

    const runtimeConfigurationResult =
      await dependencies.profileManager.getRuntimeProfileConfiguration(leaseId);

    if (!runtimeConfigurationResult.ok) {
      const releaseResult = await releaseLease(
        dependencies.profileManager,
        run.profileId,
        leaseId,
      );
      leaseReleased = releaseResult.ok;

      return await failRunAndReturn({
        run,
        dependencies,
        logger,
        profileId: run.profileId,
        startedAt,
        leaseId,
        leaseReleased,
        safeSummary: createSafeSummary({
          pageLoaded: false,
          loginRequired: false,
          checkpointDetected: false,
          scrollsPerformed: 0,
          durationMs: getDurationMs(startedAt),
          leaseReleased,
        }),
        error: toCommandError(
          "RUNTIME_CONFIGURATION_FAILED",
          runtimeConfigurationResult,
        ),
      });
    }

    const launchConfig = buildBrowserProviderLaunchConfig({
      providerName: dependencies.browserProvider.providerName,
      configuration: runtimeConfigurationResult.configuration,
      headless: false,
    });

    session = await dependencies.browserProvider.launch(launchConfig);
    const page = await session.newPage();
    const navigationUrlResult = getExerciseNavigationUrl(run);

    if (!navigationUrlResult.ok) {
      throw new Error(navigationUrlResult.message);
    }

    const browserOutcome = await exerciseFacebookReadOnly({
      page,
      args,
      url: navigationUrlResult.url,
      startedAt,
      ...(input.abortSignal !== undefined
        ? { abortSignal: input.abortSignal }
        : {}),
    });

    await closeBrowserSession(session, logger);
    session = undefined;

    const releaseResult = await releaseLease(
      dependencies.profileManager,
      run.profileId,
      leaseId,
    );
    leaseReleased = releaseResult.ok;

    const safeSummary = createSafeSummary({
      ...browserOutcome.safeSummary,
      durationMs: getDurationMs(startedAt),
      leaseReleased,
    });
    const releaseFailure =
      releaseResult.ok ? undefined : toCommandError(
        "PROFILE_LEASE_RELEASE_FAILED",
        releaseResult,
      );
    const failureReason = browserOutcome.failureReason ?? releaseFailure;

    if (failureReason !== undefined) {
      return await failRunAndReturn({
        run,
        dependencies,
        logger,
        profileId: run.profileId,
        startedAt,
        leaseId,
        leaseReleased,
        safeSummary,
        error: failureReason,
      });
    }

    const completedRunResult = await dependencies.runRecords.markRunSucceeded({
      accountExerciseRunId: run.id,
      safeSummary,
    });

    if (!completedRunResult.ok) {
      const result = toCommandResult({
        run,
        profileId: run.profileId,
        durationMs: getDurationMs(startedAt),
        leaseReleased,
        leaseId,
        errors: [
          toCommandError(
            "ACCOUNT_EXERCISE_RUN_RECORD_FAILED",
            completedRunResult,
          ),
        ],
      });

      logSafeSummary(logger, result);

      return result;
    }

    const result = toCommandResult({
      run: completedRunResult.accountExerciseRun,
      profileId: run.profileId,
      durationMs: getDurationMs(startedAt),
      leaseReleased,
      errors: [],
    });

    logSafeSummary(logger, result);

    return result;
  } catch (error) {
    if (session !== undefined) {
      await closeBrowserSession(session, logger);
    }

    if (leaseId !== undefined && !leaseReleased) {
      const releaseResult = await releaseLease(
        dependencies.profileManager,
        run.profileId,
        leaseId,
      );
      leaseReleased = releaseResult.ok;
    }

    return await failRunAndReturn({
      run,
      dependencies,
      logger,
      profileId: run.profileId,
      startedAt,
      ...(leaseId !== undefined ? { leaseId } : {}),
      leaseReleased,
      safeSummary: createSafeSummary({
        pageLoaded: false,
        loginRequired: false,
        checkpointDetected: false,
        scrollsPerformed: 0,
        durationMs: getDurationMs(startedAt),
        leaseReleased,
      }),
      error: toUnknownFailure(error),
    });
  } finally {
    await dependencies.close();
  }
}

function buildDependencies(
  input: RunProfileExerciseCommandInput | ExecuteRunningProfileExerciseRunInput,
): BuiltDependencies {
  const clock = input.dependencies?.clock ?? new SystemClock();
  const idGenerator = input.dependencies?.idGenerator ?? new CryptoIdGenerator();
  const runRecords =
    input.dependencies?.runRecords ??
    (input.dependencies?.accountExerciseRuns !== undefined
      ? new RepositoryProfileExerciseRunRecordPort(
          input.dependencies.accountExerciseRuns,
          idGenerator,
          clock,
        )
      : new HttpProfileExerciseRunRecordClient({
          baseUrl: "args" in input ? input.args.baseUrl : input.baseUrl,
        }));
  const browserProvider =
    input.dependencies?.browserProvider ??
    resolveBrowserProviderForCommand(
      "args" in input ? input.args.browserProvider : input.browserProvider,
    );

  return {
    runRecords,
    profileManager:
      input.dependencies?.profileManager ??
      new ProfileManagerHttpClient({
        baseUrl: "args" in input ? input.args.baseUrl : input.baseUrl,
      }),
    browserProvider,
    clock,
    idGenerator,
    close:
      input.dependencies?.close ??
      (async () => {}),
  };
}

function toProfileExerciseArgsFromRun(
  input: ExecuteRunningProfileExerciseRunInput,
): ProfileExerciseCliArgs {
  return {
    profileId: input.accountExerciseRun.profileId,
    baseUrl: input.baseUrl,
    maxDurationMs: input.accountExerciseRun.actionBudget.maxDurationMs,
    maxScrolls: input.accountExerciseRun.actionBudget.maxScrolls,
    minDwellMs: input.accountExerciseRun.actionBudget.minDwellMs ?? 0,
    browserProvider: input.browserProvider,
  };
}

class AmbientOnlySourceGroupLookupPort implements SourceGroupLookupPort {
  public async getSourceGroup(
    sourceGroupId: string,
  ): Promise<SourceGroupLookupResult> {
    return {
      ok: false,
      errorCode: "AMBIENT_ONLY_SOURCE_GROUP_LOOKUP_FAILED",
      errorMessage: `Source group lookup is not supported for ambient exercises (tried to look up group ${sourceGroupId}).`,
    };
  }
}

class RepositoryProfileExerciseRunRecordPort
  implements ProfileExerciseRunRecordPort
{
  public constructor(
    private readonly accountExerciseRuns: AccountExerciseRunRepository,
    private readonly idGenerator: IdGenerator,
    private readonly clock: Clock,
  ) {}

  public async requestRun(
    input: RequestAccountExerciseRunInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.executeRepositoryOperation(async () =>
      new RequestAccountExerciseRunUseCase(
        this.accountExerciseRuns,
        new AmbientOnlySourceGroupLookupPort(),
        this.idGenerator,
        this.clock,
      ).execute(input),
    );
  }

  public async markRunRunning(
    input: MarkAccountExerciseRunRunningInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.executeRepositoryOperation(async () =>
      new MarkAccountExerciseRunRunningUseCase(
        this.accountExerciseRuns,
        this.clock,
      ).execute(input),
    );
  }

  public async attachRunLease(
    input: AttachAccountExerciseRunLeaseInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.executeRepositoryOperation(async () =>
      new AttachAccountExerciseRunLeaseUseCase(
        this.accountExerciseRuns,
        this.clock,
      ).execute(input),
    );
  }

  public async markRunSucceeded(
    input: MarkAccountExerciseRunSucceededInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.executeRepositoryOperation(async () =>
      new MarkAccountExerciseRunSucceededUseCase(
        this.accountExerciseRuns,
        this.clock,
      ).execute(input),
    );
  }

  public async markRunFailed(
    input: MarkAccountExerciseRunFailedInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.executeRepositoryOperation(async () =>
      new MarkAccountExerciseRunFailedUseCase(
        this.accountExerciseRuns,
        this.clock,
      ).execute(input),
    );
  }

  private async executeRepositoryOperation(
    operation: () => Promise<AccountExerciseRun>,
  ): Promise<ProfileExerciseRunRecordResult> {
    try {
      return {
        ok: true,
        accountExerciseRun: await operation(),
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: "ACCOUNT_EXERCISE_RUN_REPOSITORY_ERROR",
        errorMessage: errorToMessage(error),
      };
    }
  }
}

interface HttpProfileExerciseRunRecordClientConfig {
  readonly baseUrl: string;
}

interface HttpProfileExerciseRunRecordClientOptions {
  readonly fetchImplementation?: FetchLike;
}

class HttpProfileExerciseRunRecordClient
  implements ProfileExerciseRunRecordPort
{
  private readonly baseUrl: string;
  private readonly fetchImplementation: FetchLike;

  public constructor(
    config: HttpProfileExerciseRunRecordClientConfig,
    options: HttpProfileExerciseRunRecordClientOptions = {},
  ) {
    this.baseUrl = config.baseUrl.trim();
    this.fetchImplementation =
      options.fetchImplementation ?? createGlobalFetchAdapter();
  }

  public async requestRun(
    input: RequestAccountExerciseRunInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.sendJsonRequest(ACCOUNT_EXERCISE_RUNS_PATH, {
      profileId: input.profileId,
      stageAtStart: input.stageAtStart,
      maxDurationMs: input.maxDurationMs,
      maxScrolls: input.maxScrolls,
      ...(input.minDwellMs !== undefined
        ? { minDwellMs: input.minDwellMs }
        : {}),
    });
  }

  public async markRunRunning(
    input: MarkAccountExerciseRunRunningInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.sendJsonRequest(
      `${ACCOUNT_EXERCISE_RUNS_PATH}/${encodeURIComponent(
        input.accountExerciseRunId,
      )}/start`,
      {
        ...(input.leaseId !== undefined ? { leaseId: input.leaseId } : {}),
      },
    );
  }

  public async attachRunLease(
    input: AttachAccountExerciseRunLeaseInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.sendJsonRequest(
      `${ACCOUNT_EXERCISE_RUNS_PATH}/${encodeURIComponent(
        input.accountExerciseRunId,
      )}/lease`,
      {
        leaseId: input.leaseId,
      },
    );
  }

  public async markRunSucceeded(
    input: MarkAccountExerciseRunSucceededInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.sendJsonRequest(
      `${ACCOUNT_EXERCISE_RUNS_PATH}/${encodeURIComponent(
        input.accountExerciseRunId,
      )}/succeed`,
      {
        safeSummary: input.safeSummary,
      },
    );
  }

  public async markRunFailed(
    input: MarkAccountExerciseRunFailedInput,
  ): Promise<ProfileExerciseRunRecordResult> {
    return this.sendJsonRequest(
      `${ACCOUNT_EXERCISE_RUNS_PATH}/${encodeURIComponent(
        input.accountExerciseRunId,
      )}/fail`,
      {
        failureReason: input.failureReason,
        ...(input.safeSummary !== undefined
          ? { safeSummary: input.safeSummary }
          : {}),
      },
    );
  }

  private async sendJsonRequest(
    path: string,
    body: unknown,
  ): Promise<ProfileExerciseRunRecordResult> {
    try {
      const response = await this.fetchImplementation(
        buildRunRecordUrl(this.baseUrl, path),
        {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify(body),
        },
      );

      if (!isSuccessStatusCode(response.status)) {
        return toRunRecordFailure(await readRunRecordHttpFailure(response));
      }

      const accountExerciseRun = toAccountExerciseRunFromBody(
        await readJsonBody(response),
      );

      if (accountExerciseRun !== undefined) {
        return {
          ok: true,
          accountExerciseRun,
        };
      }

      return {
        ok: false,
        statusCode: response.status,
        errorCode: COLLECTOR_RUNTIME_RESPONSE_ERROR,
        errorMessage: "Collector Runtime account exercise response is invalid.",
      };
    } catch (error) {
      return {
        ok: false,
        errorCode: COLLECTOR_RUNTIME_NETWORK_ERROR,
        errorMessage: errorToMessage(error),
      };
    }
  }
}

function resolveBrowserProviderForCommand(
  browserProvider: ProfileExerciseCliArgs["browserProvider"],
): BrowserProviderPort {
  const resolution = resolveBrowserProvider({ browserProvider });

  if (!resolution.ok) {
    throw new Error(resolution.message);
  }

  return resolution.provider;
}

async function markRunRunningWithoutLease(
  run: AccountExerciseRun,
  dependencies: BuiltDependencies,
): Promise<ProfileExerciseRunRecordResult> {
  return dependencies.runRecords.markRunRunning({
    accountExerciseRunId: run.id,
  });
}

async function failRunAndReturn(input: {
  readonly run: AccountExerciseRun;
  readonly dependencies: BuiltDependencies;
  readonly logger: ProfileExerciseLogger;
  readonly profileId: string;
  readonly startedAt: Date;
  readonly leaseId?: string;
  readonly leaseReleased: boolean;
  readonly safeSummary: AccountExerciseRunSafeSummary;
  readonly error: ProfileExerciseCommandError;
}): Promise<ProfileExerciseCommandResult> {
  const failureReason = toFailureReason(input.error);
  const failedRunResult = await input.dependencies.runRecords.markRunFailed({
    accountExerciseRunId: input.run.id,
    failureReason,
    safeSummary: input.safeSummary,
  });

  if (!failedRunResult.ok) {
    const result = toCommandResult({
      run: input.run,
      profileId: input.profileId,
      durationMs: getDurationMs(input.startedAt),
      leaseReleased: input.leaseReleased,
      ...(input.leaseId !== undefined ? { leaseId: input.leaseId } : {}),
      errors: [
        input.error,
        toCommandError(
          "ACCOUNT_EXERCISE_RUN_RECORD_FAILED",
          failedRunResult,
        ),
      ],
    });

    logSafeSummary(input.logger, result);

    return result;
  }

  const failedRun = failedRunResult.accountExerciseRun;
  const result = toCommandResult({
    run: failedRun,
    profileId: input.profileId,
    durationMs: getDurationMs(input.startedAt),
    leaseReleased: input.leaseReleased,
    ...(input.leaseId !== undefined ? { leaseId: input.leaseId } : {}),
    errors: [input.error],
  });

  logSafeSummary(input.logger, result);

  return result;
}

async function exerciseFacebookReadOnly(input: {
  readonly page: BrowserProviderPage;
  readonly args: ProfileExerciseCliArgs;
  readonly url: string;
  readonly startedAt: Date;
  readonly abortSignal?: AbortSignal;
}): Promise<BrowserExerciseOutcome> {
  const navigationTimeoutMs = Math.max(
    1,
    Math.min(input.args.maxDurationMs, 30_000),
  );

  await input.page.goto({
    url: input.url,
    waitUntil: "domcontentloaded",
    timeoutMs: navigationTimeoutMs,
  });
  let scrollsPerformed = 0;

  let pageState = await observeExerciseFacebookPageState(input);
  let blockedOutcome = toBlockedExerciseOutcome(input, pageState, scrollsPerformed);
  if (blockedOutcome !== undefined) {
    return blockedOutcome;
  }

  await delay(
    Math.min(input.args.minDwellMs, getRemainingBudgetMs(input.startedAt, input.args)),
    input.abortSignal,
  );

  pageState = await observeExerciseFacebookPageState(input, 0);
  blockedOutcome = toBlockedExerciseOutcome(input, pageState, scrollsPerformed);
  if (blockedOutcome !== undefined) {
    return blockedOutcome;
  }

  while (
    scrollsPerformed < input.args.maxScrolls &&
    getRemainingBudgetMs(input.startedAt, input.args) > 0 &&
    !input.abortSignal?.aborted
  ) {
    await input.page.evaluate(
      "window.scrollBy({ top: Math.min(window.innerHeight * 0.5, 600), left: 0, behavior: 'smooth' });",
    );
    scrollsPerformed += 1;
    await delay(
      Math.min(
        input.args.minDwellMs,
        getRemainingBudgetMs(input.startedAt, input.args),
      ),
      input.abortSignal,
    );
    pageState = await observeExerciseFacebookPageState(input, 0);
    blockedOutcome = toBlockedExerciseOutcome(input, pageState, scrollsPerformed);
    if (blockedOutcome !== undefined) {
      return blockedOutcome;
    }
  }

  pageState = await observeExerciseFacebookPageState(input, 0);

  return {
    safeSummary: {
      pageLoaded: pageState.pageLoaded,
      loginRequired: pageState.blockingState === "LOGIN_REQUIRED",
      checkpointDetected: pageState.blockingState === "CHECKPOINT_REQUIRED",
      scrollsPerformed,
      durationMs: getDurationMs(input.startedAt),
    },
  };
}

async function observeExerciseFacebookPageState(
  input: {
    readonly page: BrowserProviderPage;
    readonly args: ProfileExerciseCliArgs;
    readonly startedAt: Date;
    readonly abortSignal?: AbortSignal;
  },
  settleMs = FACEBOOK_PAGE_STATE_SETTLE_MS,
): Promise<FacebookPageState> {
  return observeFacebookPageState(input.page, {
    settleMs,
    pollIntervalMs: FACEBOOK_PAGE_STATE_POLL_INTERVAL_MS,
    deadlineAt: input.startedAt.getTime() + input.args.maxDurationMs,
    ...(input.abortSignal !== undefined
      ? { abortSignal: input.abortSignal }
      : {}),
  });
}

function toBlockedExerciseOutcome(
  input: {
    readonly startedAt: Date;
  },
  pageState: FacebookPageState,
  scrollsPerformed: number,
): BrowserExerciseOutcome | undefined {
  const safeSummary = {
    pageLoaded: pageState.pageLoaded,
    loginRequired: pageState.blockingState === "LOGIN_REQUIRED",
    checkpointDetected: pageState.blockingState === "CHECKPOINT_REQUIRED",
    scrollsPerformed,
    durationMs: getDurationMs(input.startedAt),
  };

  if (pageState.blockingState === "LOGIN_REQUIRED") {
    return {
      safeSummary,
      failureReason: {
        code: "LOGIN_REQUIRED",
        message: "Login is required before ambient exercise can continue.",
      },
    };
  }

  if (pageState.blockingState === "CHECKPOINT_REQUIRED") {
    return {
      safeSummary,
      failureReason: {
        code: "CHECKPOINT_REQUIRED",
        message: "Checkpoint review is required before ambient exercise can continue.",
      },
    };
  }

  return undefined;
}

function getExerciseNavigationUrl(
  run: AccountExerciseRun,
):
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly message: string } {
  if (run.exerciseType === "AMBIENT_ACCOUNT") {
    return {
      ok: true,
      url: FACEBOOK_HOME_URL,
    };
  }

  if (run.exerciseType === "CATEGORY_BROWSE") {
    if (run.target === undefined) {
      return {
        ok: false,
        message: "Category Browse exercise target is missing.",
      };
    }

    return {
      ok: true,
      url: run.target.url,
    };
  }

  return {
    ok: false,
    message: "Unsupported account exercise type.",
  };
}

async function releaseLease(
  profileManager: ProfileExerciseProfileManagerPort,
  profileId: string,
  leaseId: string,
): Promise<ProfileLeaseReleaseResult> {
  try {
    return await profileManager.releaseProfileLease({
      profileId,
      leaseId,
      macroActionsPerformed: 0,
    });
  } catch (error) {
    return {
      ok: false,
      errorCode: "PROFILE_LEASE_RELEASE_PORT_ERROR",
      errorMessage: errorToMessage(error),
    };
  }
}

async function closeBrowserSession(
  session: BrowserProviderSession,
  logger: ProfileExerciseLogger,
): Promise<void> {
  try {
    await session.close();
  } catch {
    logWarning(logger, "Browser session close failed after exercise.");
  }
}

function toCommandResult(input: {
  readonly run: AccountExerciseRun;
  readonly profileId: string;
  readonly durationMs: number;
  readonly leaseReleased: boolean;
  readonly leaseId?: string;
  readonly errors: readonly ProfileExerciseCommandError[];
}): ProfileExerciseCommandResult {
  const resolvedLeaseId = input.leaseId ?? input.run.leaseId;

  return {
    ok: input.run.status === "SUCCEEDED" && input.errors.length === 0,
    profileId: input.profileId,
    accountExerciseRunId: input.run.id,
    ...(resolvedLeaseId !== undefined ? { leaseId: resolvedLeaseId } : {}),
    status: input.run.status,
    ...(input.run.safeSummary !== undefined
      ? { safeSummary: input.run.safeSummary }
      : {}),
    ...(input.run.failureReason !== undefined
      ? { failureReason: input.run.failureReason }
      : {}),
    leaseReleased: input.leaseReleased,
    durationMs: input.durationMs,
    errors: input.errors,
  };
}

function createFailureCommandResult(input: {
  readonly profileId: string;
  readonly durationMs: number;
  readonly leaseReleased: boolean;
  readonly leaseId?: string;
  readonly error: ProfileExerciseCommandError;
}): ProfileExerciseCommandResult {
  return {
    ok: false,
    profileId: input.profileId,
    ...(input.leaseId !== undefined ? { leaseId: input.leaseId } : {}),
    leaseReleased: input.leaseReleased,
    durationMs: input.durationMs,
    errors: [input.error],
  };
}

function createSafeSummary(
  input: AccountExerciseRunSafeSummary,
): AccountExerciseRunSafeSummary {
  return input;
}

function toCommandError(
  code: string,
  result: {
    readonly statusCode?: number;
    readonly errorCode: string;
    readonly errorMessage: string;
  },
): ProfileExerciseCommandError {
  return {
    code: sanitizeFailureCode(code),
    message: getSafeFailureMessage(code),
    causeCode: sanitizeFailureCode(result.errorCode),
    ...(result.statusCode !== undefined ? { statusCode: result.statusCode } : {}),
  };
}

function toUnknownFailure(error: unknown): ProfileExerciseCommandError {
  const message = errorToMessage(error);
  const code =
    message.toLowerCase().includes("browser") ||
    message.toLowerCase().includes("playwright")
      ? "BROWSER_PROVIDER_FAILED"
      : "UNKNOWN_FAILURE";

  return {
    code,
    message: getSafeFailureMessage(code),
  };
}

function toFailureReason(
  error: ProfileExerciseCommandError,
): AccountExerciseRunFailureReason {
  return {
    code: sanitizeFailureCode(error.code),
    message: getSafeFailureMessage(error.code),
  };
}

function sanitizeFailureCode(code: string | undefined): string {
  const normalizedCode = code?.trim().toUpperCase();

  if (
    normalizedCode !== undefined &&
    /^[A-Z0-9_]+$/.test(normalizedCode) &&
    normalizedCode.length <= 80
  ) {
    return normalizedCode;
  }

  return "UNKNOWN_FAILURE";
}

function getSafeFailureMessage(code: string): string {
  switch (sanitizeFailureCode(code)) {
    case "LOGIN_REQUIRED":
      return "Login is required before ambient exercise can continue.";
    case "CHECKPOINT_REQUIRED":
      return "Checkpoint review is required before ambient exercise can continue.";
    case "SESSION_EXPIRED":
      return "The profile session appears to be expired.";
    case "BROWSER_PROVIDER_FAILED":
      return "Browser provider failed during ambient exercise.";
    case "PROFILE_STAGE_READ_FAILED":
      return "Profile account stage could not be read.";
    case "PROFILE_EXERCISE_CHECKOUT_FAILED":
      return "Profile exercise checkout failed.";
    case "RUNTIME_CONFIGURATION_FAILED":
      return "Runtime profile configuration could not be read.";
    case "PROFILE_LEASE_RELEASE_FAILED":
      return "Profile lease release failed after ambient exercise.";
    case "ACCOUNT_EXERCISE_RUN_RECORD_FAILED":
      return "Ambient exercise run record could not be updated.";
    default:
      return "Ambient account exercise failed.";
  }
}

function getDurationMs(startedAt: Date): number {
  return Math.max(0, Date.now() - startedAt.getTime());
}

function getRemainingBudgetMs(
  startedAt: Date,
  args: ProfileExerciseCliArgs,
): number {
  return Math.max(0, args.maxDurationMs - getDurationMs(startedAt));
}

function logSafeSummary(
  logger: ProfileExerciseLogger,
  result: ProfileExerciseCommandResult,
): void {
  logger.info("Profile exercise summary:");
  logger.info(`- Profile id: ${result.profileId}`);
  logger.info(`- Exercise run id: ${result.accountExerciseRunId ?? "unavailable"}`);
  logger.info(`- Lease id: ${result.leaseId ?? "unavailable"}`);
  logger.info(`- Status: ${result.status ?? "FAILED"}`);
  logger.info(`- Page loaded: ${result.safeSummary?.pageLoaded === true ? "yes" : "no"}`);
  logger.info(
    `- Login required: ${result.safeSummary?.loginRequired === true ? "yes" : "no"}`,
  );
  logger.info(
    `- Checkpoint detected: ${
      result.safeSummary?.checkpointDetected === true ? "yes" : "no"
    }`,
  );
  logger.info(`- Scrolls performed: ${result.safeSummary?.scrollsPerformed ?? 0}`);
  logger.info(`- Lease released: ${result.leaseReleased ? "yes" : "no"}`);
  logger.info(`- Duration ms: ${result.durationMs}`);

  if (!result.ok) {
    for (const error of result.errors) {
      const details = [
        error.causeCode !== undefined ? `cause ${error.causeCode}` : undefined,
        error.statusCode !== undefined ? `status ${error.statusCode}` : undefined,
      ].filter((detail): detail is string => detail !== undefined);
      const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";

      logger.error?.(`- Error ${error.code}${suffix}.`);
    }
  }
}

function logWarning(logger: ProfileExerciseLogger, message: string): void {
  if (logger.warn !== undefined) {
    logger.warn(message);
    return;
  }

  logger.info(message);
}

function createGlobalFetchAdapter(): FetchLike {
  return async (input, init) => {
    const globalFetch = (globalThis as { readonly fetch?: FetchLike }).fetch;

    if (globalFetch === undefined) {
      throw new Error("A fetch implementation is required.");
    }

    return globalFetch(input, init);
  };
}

function jsonHeaders(): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
  };
}

function buildRunRecordUrl(baseUrl: string, path: string): string {
  const normalizedBaseUrl = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;

  return new URL(path, normalizedBaseUrl).toString();
}

function isSuccessStatusCode(statusCode: number): boolean {
  return statusCode >= 200 && statusCode <= 299;
}

function toAccountExerciseRunFromBody(
  body: unknown,
): AccountExerciseRun | undefined {
  if (!isRecord(body)) {
    return undefined;
  }

  const result = validateAccountExerciseRun(body.accountExerciseRun);

  if (!result.valid) {
    return undefined;
  }

  return result.value;
}

function toRunRecordFailure(
  failure: {
    readonly statusCode: number;
    readonly errorCode: string;
    readonly errorMessage: string;
  },
): Extract<ProfileExerciseRunRecordResult, { readonly ok: false }> {
  return {
    ok: false,
    statusCode: failure.statusCode,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
  };
}

async function readRunRecordHttpFailure(
  response: FetchLikeResponse,
): Promise<{
  readonly statusCode: number;
  readonly errorCode: string;
  readonly errorMessage: string;
}> {
  const fallbackMessage = `Collector Runtime responded with HTTP ${response.status}.`;

  try {
    const responseText = (await response.text()).trim();

    if (responseText.length === 0) {
      return {
        statusCode: response.status,
        errorCode: COLLECTOR_RUNTIME_HTTP_ERROR,
        errorMessage: fallbackMessage,
      };
    }

    const parsedBody: unknown = JSON.parse(responseText);

    if (isRecord(parsedBody) && isRecord(parsedBody.error)) {
      const errorCode = parsedBody.error.code;
      const errorMessage = parsedBody.error.message;

      return {
        statusCode: response.status,
        errorCode:
          typeof errorCode === "string" && errorCode.trim().length > 0
            ? errorCode
            : COLLECTOR_RUNTIME_HTTP_ERROR,
        errorMessage:
          typeof errorMessage === "string" && errorMessage.trim().length > 0
            ? errorMessage
            : fallbackMessage,
      };
    }

    return {
      statusCode: response.status,
      errorCode: COLLECTOR_RUNTIME_HTTP_ERROR,
      errorMessage: responseText,
    };
  } catch {
    return {
      statusCode: response.status,
      errorCode: COLLECTOR_RUNTIME_HTTP_ERROR,
      errorMessage: fallbackMessage,
    };
  }
}

async function readJsonBody(response: FetchLikeResponse): Promise<unknown> {
  if (response.json !== undefined) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  try {
    return JSON.parse(await response.text());
  } catch {
    return undefined;
  }
}

function delay(
  milliseconds: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> {
  if (milliseconds <= 0 || abortSignal?.aborted) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, milliseconds);

    if (abortSignal !== undefined) {
      abortSignal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    }
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorToMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Unknown failure.";
}
