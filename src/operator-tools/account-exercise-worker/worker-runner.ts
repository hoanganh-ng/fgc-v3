import {
  ClaimNextAccountExerciseRunUseCase,
  type AccountExerciseRunRepository,
  type BrowserProviderPort,
  type Clock,
} from "../../collector-runtime/application";
import type {
  AccountExerciseRunFailureReason,
  AccountExerciseRunSafeSummary,
} from "../../collector-runtime/domain";
import {
  DrizzleAccountExerciseRunRepository,
  createDatabaseClient,
  type DatabaseClient,
} from "../../infrastructure/database";
import { SystemClock } from "../../infrastructure/system";
import {
  executeRunningProfileExerciseRun,
  type ProfileExerciseDependencies,
  type ProfileExerciseLogger,
  type ProfileExerciseProfileManagerPort,
  type ProfileExerciseRunRecordPort,
} from "../profile-exercise/exercise-runner";
import type { AccountExerciseWorkerCliArgs } from "./cli-args";

export interface AccountExerciseWorkerLogger extends ProfileExerciseLogger {}

export interface AccountExerciseWorkerDependencies {
  readonly accountExerciseRuns?: AccountExerciseRunRepository;
  readonly runRecords?: ProfileExerciseRunRecordPort;
  readonly profileManager?: ProfileExerciseProfileManagerPort;
  readonly browserProvider?: BrowserProviderPort;
  readonly clock?: Clock;
  readonly close?: () => Promise<void>;
}

export interface RunAccountExerciseWorkerCommandInput {
  readonly args: AccountExerciseWorkerCliArgs;
  readonly logger?: AccountExerciseWorkerLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: AccountExerciseWorkerDependencies;
}

export interface AccountExerciseWorkerCommandResult {
  claimedRuns: number;
  succeededRuns: number;
  failedRuns: number;
}

interface AccountExerciseWorkerBuiltDependencies {
  readonly accountExerciseRuns: AccountExerciseRunRepository;
  readonly profileExerciseDependencies: ProfileExerciseDependencies;
  readonly clock: Clock;
  readonly close: () => Promise<void>;
}

const NOOP_LOGGER: AccountExerciseWorkerLogger = {
  info() {},
};

export async function runAccountExerciseWorkerCommand(
  input: RunAccountExerciseWorkerCommandInput,
): Promise<AccountExerciseWorkerCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const dependencies = buildDependencies(input);
  const result: AccountExerciseWorkerCommandResult = {
    claimedRuns: 0,
    succeededRuns: 0,
    failedRuns: 0,
  };

  logger.info("Account exercise worker started.");

  try {
    if (input.args.once) {
      return await runOneWorkerIteration(input, dependencies, logger, result);
    }

    while (!input.abortSignal?.aborted) {
      await runOneWorkerIteration(input, dependencies, logger, result);
      await delay(input.args.pollIntervalMs, input.abortSignal);
    }

    return result;
  } finally {
    await dependencies.close();
    logger.info("Account exercise worker stopped.");
  }
}

async function runOneWorkerIteration(
  input: RunAccountExerciseWorkerCommandInput,
  dependencies: AccountExerciseWorkerBuiltDependencies,
  logger: AccountExerciseWorkerLogger,
  totals: AccountExerciseWorkerCommandResult,
): Promise<AccountExerciseWorkerCommandResult> {
  const claimNextAccountExerciseRun = new ClaimNextAccountExerciseRunUseCase(
    dependencies.accountExerciseRuns,
    dependencies.clock,
  );
  const claimedAccountExerciseRun = await claimNextAccountExerciseRun.execute();

  if (claimedAccountExerciseRun === null) {
    logger.info("No queued account exercise run found.");
    return totals;
  }

  totals.claimedRuns += 1;
  logger.info(`Claimed account exercise run ${claimedAccountExerciseRun.id}.`);

  const completedRun = await executeRunningProfileExerciseRun({
    accountExerciseRun: claimedAccountExerciseRun,
    baseUrl: input.args.baseUrl,
    browserProvider: input.args.browserProvider,
    logger,
    ...(input.abortSignal !== undefined
      ? { abortSignal: input.abortSignal }
      : {}),
    dependencies: dependencies.profileExerciseDependencies,
    now: () => dependencies.clock.now(),
  });

  if (completedRun.status === "SUCCEEDED") {
    totals.succeededRuns += 1;
    logger.info(
      `Account exercise run ${completedRun.accountExerciseRunId ?? claimedAccountExerciseRun.id} succeeded: ` +
        formatSummary(completedRun.safeSummary),
    );
  } else {
    totals.failedRuns += 1;
    logError(
      logger,
      `Account exercise run ${completedRun.accountExerciseRunId ?? claimedAccountExerciseRun.id} failed: ` +
        formatFailureReason(completedRun.failureReason),
    );
    logger.info(
      `Account exercise run ${completedRun.accountExerciseRunId ?? claimedAccountExerciseRun.id} failure summary: ` +
        formatSummary(completedRun.safeSummary),
    );
  }

  if (completedRun.safeSummary?.leaseReleased !== undefined) {
    logger.info(
      `Account exercise run ${completedRun.accountExerciseRunId ?? claimedAccountExerciseRun.id} lease released: ` +
        `${completedRun.safeSummary.leaseReleased ? "yes" : "no"}.`,
    );
  }

  return totals;
}

function buildDependencies(
  input: RunAccountExerciseWorkerCommandInput,
): AccountExerciseWorkerBuiltDependencies {
  const clock = input.dependencies?.clock ?? new SystemClock();
  let databaseClient: DatabaseClient | undefined;
  const accountExerciseRuns =
    input.dependencies?.accountExerciseRuns ??
    (() => {
      databaseClient = createDatabaseClient();
      return new DrizzleAccountExerciseRunRepository(databaseClient.db);
    })();
  const profileExerciseDependencies: ProfileExerciseDependencies = {
    accountExerciseRuns,
    ...(input.dependencies?.runRecords !== undefined
      ? { runRecords: input.dependencies.runRecords }
      : {}),
    ...(input.dependencies?.profileManager !== undefined
      ? { profileManager: input.dependencies.profileManager }
      : {}),
    ...(input.dependencies?.browserProvider !== undefined
      ? { browserProvider: input.dependencies.browserProvider }
      : {}),
    clock,
    close: async () => {},
  };

  return {
    accountExerciseRuns,
    profileExerciseDependencies,
    clock,
    close:
      input.dependencies?.close ??
      (async () => {
        await databaseClient?.close();
      }),
  };
}

function formatSummary(
  summary: AccountExerciseRunSafeSummary | undefined,
): string {
  return [
    `pageLoaded=${summary?.pageLoaded === true ? "yes" : "no"}`,
    `loginRequired=${summary?.loginRequired === true ? "yes" : "no"}`,
    `checkpointDetected=${summary?.checkpointDetected === true ? "yes" : "no"}`,
    `scrollsPerformed=${summary?.scrollsPerformed ?? 0}`,
    `durationMs=${summary?.durationMs ?? 0}`,
    `leaseReleased=${summary?.leaseReleased === true ? "yes" : "no"}`,
  ].join(" ");
}

function formatFailureReason(
  failureReason: AccountExerciseRunFailureReason | undefined,
): string {
  if (failureReason === undefined) {
    return "code=ACCOUNT_EXERCISE_FAILED message=\"Ambient account exercise failed.\"";
  }

  return `code=${failureReason.code} message="${failureReason.message}"`;
}

function logError(
  logger: AccountExerciseWorkerLogger,
  message: string,
): void {
  if (logger.error !== undefined) {
    logger.error(message);
    return;
  }

  logger.info(message);
}

function delay(
  milliseconds: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> {
  if (abortSignal?.aborted) {
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
