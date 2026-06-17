import type { CollectionRun, CollectionSchedule } from "../../collector-runtime/domain";
import type { CollectionSchedulerCliOptions } from "./cli-args";

export interface CollectionSchedulerLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface DispatchNextDueResult {
  readonly schedule: CollectionSchedule;
  readonly collectionRun: CollectionRun;
}

export type DispatchNextDueFn = () => Promise<DispatchNextDueResult | null>;

export interface CollectionSchedulerDependencies {
  readonly dispatch: DispatchNextDueFn;
  readonly close: () => Promise<void>;
}

export interface RunCollectionSchedulerCommandInput {
  readonly options: CollectionSchedulerCliOptions;
  readonly logger?: CollectionSchedulerLogger;
  readonly dependencies: CollectionSchedulerDependencies;
  readonly abortSignal?: AbortSignal;
}

export interface CollectionSchedulerCommandResult {
  readonly cyclesCompleted: number;
  readonly dispatchedRuns: number;
}

const NOOP_LOGGER: CollectionSchedulerLogger = {
  info() {},
};

export async function runCollectionSchedulerCommand(
  input: RunCollectionSchedulerCommandInput,
): Promise<CollectionSchedulerCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const result = {
    cyclesCompleted: 0,
    dispatchedRuns: 0,
  };

  logger.info("Collection scheduler started.");

  try {
    if (input.abortSignal?.aborted) {
      logger.info("Collection scheduler aborted before first cycle.");
      return result;
    }

    while (true) {
      if (input.abortSignal?.aborted) {
        break;
      }

      let cycleDispatched = 0;

      while (true) {
        if (input.abortSignal?.aborted) {
          break;
        }

        const dispatched = await input.dependencies.dispatch();

        if (dispatched === null) {
          break;
        }

        cycleDispatched += 1;
        result.dispatchedRuns += 1;
        logger.info(
          `Dispatched schedule ${dispatched.schedule.sourceGroupId} ` +
            `run ${dispatched.collectionRun.id}.`,
        );
      }

      result.cyclesCompleted += 1;
      logger.info(
        `Cycle ${result.cyclesCompleted} complete ` +
          `(dispatched ${result.dispatchedRuns} total).`,
      );

      if (input.options.once) {
        break;
      }

      if (input.abortSignal?.aborted) {
        break;
      }

      await delay(input.options.pollIntervalMs, input.abortSignal);
    }

    return result;
  } finally {
    await input.dependencies.close();
    logger.info("Collection scheduler stopped.");
  }
}

function delay(
  milliseconds: number,
  abortSignal: AbortSignal | undefined,
): Promise<void> {
  if (abortSignal?.aborted) {
    return Promise.resolve();
  }

  if (milliseconds <= 0) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let settled = false;
    const settle = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      if (abortSignal !== undefined) {
        abortSignal.removeEventListener("abort", onAbort);
      }
      resolve();
    };

    const timeout = setTimeout(settle, milliseconds);

    const onAbort = (): void => {
      clearTimeout(timeout);
      settle();
    };

    if (abortSignal !== undefined) {
      abortSignal.addEventListener("abort", onAbort, { once: true });
    }
  });
}