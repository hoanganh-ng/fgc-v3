import {
  ClaimNextCollectionRunUseCase,
  ExecuteCollectionRunUseCase,
  type Clock,
  type CollectionRunExecutorPort,
  type CollectionRunRepository,
} from "../../collector-runtime/application";
import {
  DrizzleCollectionRunRepository,
  createDatabaseClient,
  type DatabaseClient,
} from "../../infrastructure/database";
import type {
  CollectionRunFailureReason,
  CollectionRunSummary,
} from "../../collector-runtime/domain";
import { SystemClock } from "../../infrastructure/system";
import type { CollectorWorkerCliArgs } from "./cli-args";
import { FacebookCollectionRunExecutor } from "./facebook-collection-run-executor";

export interface CollectorWorkerLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface CollectorWorkerDependencies {
  readonly collectionRuns?: CollectionRunRepository;
  readonly executor?: CollectionRunExecutorPort;
  readonly clock?: Clock;
  readonly close?: () => Promise<void>;
}

export interface RunCollectorWorkerCommandInput {
  readonly args: CollectorWorkerCliArgs;
  readonly logger?: CollectorWorkerLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: CollectorWorkerDependencies;
}

export interface CollectorWorkerCommandResult {
  claimedRuns: number;
  succeededRuns: number;
  failedRuns: number;
}

interface CollectorWorkerBuiltDependencies {
  readonly collectionRuns: CollectionRunRepository;
  readonly executor: CollectionRunExecutorPort;
  readonly clock: Clock;
  readonly close: () => Promise<void>;
}

const NOOP_LOGGER: CollectorWorkerLogger = {
  info() {},
};

export async function runCollectorWorkerCommand(
  input: RunCollectorWorkerCommandInput,
): Promise<CollectorWorkerCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const dependencies = buildDependencies(input);
  const result: CollectorWorkerCommandResult = {
    claimedRuns: 0,
    succeededRuns: 0,
    failedRuns: 0,
  };

  logger.info("Collector worker started.");

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
    logger.info("Collector worker stopped.");
  }
}

async function runOneWorkerIteration(
  _input: RunCollectorWorkerCommandInput,
  dependencies: CollectorWorkerBuiltDependencies,
  logger: CollectorWorkerLogger,
  totals: CollectorWorkerCommandResult,
): Promise<CollectorWorkerCommandResult> {
  const claimNextCollectionRun = new ClaimNextCollectionRunUseCase(
    dependencies.collectionRuns,
    dependencies.clock,
  );
  const executeCollectionRun = new ExecuteCollectionRunUseCase(
    dependencies.collectionRuns,
    dependencies.executor,
    dependencies.clock,
  );
  const claimedCollectionRun = await claimNextCollectionRun.execute();

  if (claimedCollectionRun === null) {
    logger.info("No queued collection run found.");
    return totals;
  }

  totals.claimedRuns += 1;
  logger.info(`Claimed collection run ${claimedCollectionRun.id}.`);

  const completedCollectionRun = await executeCollectionRun.execute({
    collectionRunId: claimedCollectionRun.id,
  });

  if (completedCollectionRun.status === "SUCCEEDED") {
    totals.succeededRuns += 1;
    logger.info(
      `Collection run ${completedCollectionRun.id} succeeded: ` +
        formatSummary(completedCollectionRun.summary),
    );
  } else if (completedCollectionRun.status === "FAILED") {
    totals.failedRuns += 1;
    logError(
      logger,
      `Collection run ${completedCollectionRun.id} failed: ` +
        formatFailureReason(completedCollectionRun.failureReason),
    );
    logger.info(
      `Collection run ${completedCollectionRun.id} failure summary: ` +
        formatSummary(completedCollectionRun.summary),
    );
  }

  if (completedCollectionRun.summary?.leaseReleased !== undefined) {
    logger.info(
      `Collection run ${completedCollectionRun.id} lease released: ` +
        `${completedCollectionRun.summary.leaseReleased ? "yes" : "no"}.`,
    );
  }

  return totals;
}

function buildDependencies(
  input: RunCollectorWorkerCommandInput,
): CollectorWorkerBuiltDependencies {
  const clock = input.dependencies?.clock ?? new SystemClock();
  let databaseClient: DatabaseClient | undefined;
  const collectionRuns =
    input.dependencies?.collectionRuns ??
    (() => {
      databaseClient = createDatabaseClient();
      return new DrizzleCollectionRunRepository(databaseClient.db);
    })();

  return {
    collectionRuns,
    executor:
      input.dependencies?.executor ??
      new FacebookCollectionRunExecutor({
        baseUrl: input.args.baseUrl,
        browserProvider: input.args.browserProvider,
        ...(input.logger !== undefined ? { logger: input.logger } : {}),
        ...(input.abortSignal !== undefined
          ? { abortSignal: input.abortSignal }
          : {}),
      }),
    clock,
    close:
      input.dependencies?.close ??
      (async () => {
        await databaseClient?.close();
      }),
  };
}

function formatSummary(summary: CollectionRunSummary | undefined): string {
  return [
    `capturedPayloads=${summary?.capturedPayloads ?? 0}`,
    `extractorCandidates=${summary?.extractorCandidates ?? 0}`,
    `contentItemsSubmitted=${summary?.contentItemsSubmitted ?? 0}`,
    `failedSubmissions=${summary?.failedSubmissions ?? 0}`,
    `leaseReleased=${summary?.leaseReleased === true ? "yes" : "no"}`,
  ].join(" ");
}

function formatFailureReason(
  failureReason: CollectionRunFailureReason | undefined,
): string {
  if (failureReason === undefined) {
    return "code=COLLECTION_RUN_FAILED message=\"Collection run failed.\"";
  }

  return `code=${failureReason.code} message="${failureReason.message}"`;
}

function logError(logger: CollectorWorkerLogger, message: string): void {
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
