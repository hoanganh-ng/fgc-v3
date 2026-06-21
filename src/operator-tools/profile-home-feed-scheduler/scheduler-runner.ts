import type { ProfileHomeFeedCollectionRun, ProfileHomeFeedCollectionSchedule } from "../../collector-runtime/domain";
import type { ProfileHomeFeedSchedulerCliOptions } from "./cli-args";

export interface ProfileHomeFeedSchedulerLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface DispatchNextDueProfileHomeFeedResult {
  readonly outcome: "DISPATCHED";
  readonly schedule: ProfileHomeFeedCollectionSchedule;
  readonly run: ProfileHomeFeedCollectionRun;
}

export type DispatchNextDueProfileHomeFeedOutcome =
  | "NO_DUE_SCHEDULE"
  | "DISPATCHED"
  | "SKIPPED_ACTIVE_RUN"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_LOOKUP_FAILED"
  | "RACE_LOST";

export type DispatchNextDueProfileHomeFeedFn = () => Promise<{
  readonly outcome: DispatchNextDueProfileHomeFeedOutcome;
  readonly schedule?: ProfileHomeFeedCollectionSchedule;
  readonly run?: ProfileHomeFeedCollectionRun;
} | null>;

export interface ProfileHomeFeedSchedulerDependencies {
  readonly dispatch: DispatchNextDueProfileHomeFeedFn;
  readonly close: () => Promise<void>;
}

export interface RunProfileHomeFeedSchedulerCommandInput {
  readonly options: ProfileHomeFeedSchedulerCliOptions;
  readonly logger?: ProfileHomeFeedSchedulerLogger;
  readonly dependencies: ProfileHomeFeedSchedulerDependencies;
  readonly abortSignal?: AbortSignal;
}

export interface ProfileHomeFeedSchedulerCommandResult {
  readonly cyclesCompleted: number;
  readonly dispatchedRuns: number;
}

const NOOP_LOGGER: ProfileHomeFeedSchedulerLogger = {
  info() {},
};

const CONTINUE_OUTCOMES: readonly DispatchNextDueProfileHomeFeedOutcome[] = [
  "DISPATCHED",
  "SKIPPED_ACTIVE_RUN",
  "PROFILE_NOT_FOUND",
  "PROFILE_LOOKUP_FAILED",
  "RACE_LOST",
];

export async function runProfileHomeFeedSchedulerCommand(
  input: RunProfileHomeFeedSchedulerCommandInput,
): Promise<ProfileHomeFeedSchedulerCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const result = {
    cyclesCompleted: 0,
    dispatchedRuns: 0,
  };

  logger.info("Profile home-feed scheduler started.");

  try {
    if (input.abortSignal?.aborted) {
      logger.info("Profile home-feed scheduler aborted before first cycle.");
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

        if (dispatched.outcome === "NO_DUE_SCHEDULE") {
          break;
        }

        if (!CONTINUE_OUTCOMES.includes(dispatched.outcome)) {
          // Defensive: unknown outcome stops the cycle.
          break;
        }

        if (dispatched.outcome === "DISPATCHED") {
          cycleDispatched += 1;
          result.dispatchedRuns += 1;
          if (dispatched.schedule !== undefined && dispatched.run !== undefined) {
            logger.info(
              `Dispatched profile home-feed schedule ${dispatched.schedule.profileId} ` +
                `run ${dispatched.run.id}.`,
            );
          }
        } else {
          const profileId = dispatched.schedule?.profileId ?? "unknown";
          logger.info(
            `Profile home-feed schedule ${profileId} outcome ${dispatched.outcome}.`,
          );
        }
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
    logger.info("Profile home-feed scheduler stopped.");
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
