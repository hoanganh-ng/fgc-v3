import process from "node:process";
import { createCollectorRuntimeFromEnv } from "../../composition/collector-runtime/create-collector-runtime";
import type { CollectorRuntimeService } from "../../composition/collector-runtime/create-collector-runtime";
import {
  ProfileHomeFeedSchedulerCliArgumentError,
  ProfileHomeFeedSchedulerCliHelpRequested,
  getProfileHomeFeedSchedulerCliUsage,
  parseProfileHomeFeedSchedulerCliArgs,
} from "./cli-args";
import type { ProfileHomeFeedSchedulerCliOptions } from "./cli-args";
import {
  runProfileHomeFeedSchedulerCommand,
} from "./scheduler-runner";
import type {
  ProfileHomeFeedSchedulerDependencies,
  ProfileHomeFeedSchedulerLogger,
  DispatchNextDueProfileHomeFeedFn,
} from "./scheduler-runner";

export type { ProfileHomeFeedSchedulerCliOptions };

export interface RunProfileHomeFeedSchedulerCliOverrides {
  readonly buildRuntime?: () => CollectorRuntimeService;
  readonly installSignalHandlers?: (abort: () => void) => () => void;
  readonly logger?: ProfileHomeFeedSchedulerLogger;
}

export interface ProfileHomeFeedSchedulerCliRunResult {
  readonly exitCode: number;
}

const DEFAULT_BUILD_RUNTIME = (): CollectorRuntimeService =>
  createCollectorRuntimeFromEnv();

export function buildProfileHomeFeedSchedulerDependencies(
  runtime: CollectorRuntimeService,
): ProfileHomeFeedSchedulerDependencies {
  const useCase = runtime.dispatchNextDueProfileHomeFeedCollectionSchedule;
  const dispatch: DispatchNextDueProfileHomeFeedFn = () =>
    useCase.execute().then((result) => {
      if (result.outcome === "DISPATCHED") {
        return {
          outcome: "DISPATCHED",
          schedule: result.schedule,
          run: result.run,
        };
      }
      if (result.outcome === "NO_DUE_SCHEDULE") {
        return { outcome: "NO_DUE_SCHEDULE" };
      }
      if (result.outcome === "RACE_LOST") {
        return { outcome: "RACE_LOST" };
      }
      return {
        outcome: result.outcome,
        schedule: result.schedule,
      };
    });

  return {
    dispatch,
    close: () => runtime.close(),
  };
}

export function makeConsoleProfileHomeFeedSchedulerLogger(): ProfileHomeFeedSchedulerLogger {
  return {
    info: (message: string): void => {
      console.log(message);
    },
    warn: (message: string): void => {
      console.warn(message);
    },
    error: (message: string): void => {
      console.error(message);
    },
  };
}

export function installDefaultProfileHomeFeedSchedulerSignalHandlers(
  abort: () => void,
): () => void {
  const onInterrupt = (): void => {
    console.error("");
    console.error(
      "Interrupt received. Stopping profile home-feed scheduler.",
    );
    abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  return () => {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
  };
}

export async function runProfileHomeFeedSchedulerCli(
  argv: readonly string[],
  overrides: RunProfileHomeFeedSchedulerCliOverrides = {},
): Promise<ProfileHomeFeedSchedulerCliRunResult> {
  const buildRuntime = overrides.buildRuntime ?? DEFAULT_BUILD_RUNTIME;
  const installSignalHandlers =
    overrides.installSignalHandlers ??
    installDefaultProfileHomeFeedSchedulerSignalHandlers;
  const logger = overrides.logger ?? makeConsoleProfileHomeFeedSchedulerLogger();

  try {
    return await runParsedProfileHomeFeedSchedulerCli(argv, {
      buildRuntime,
      installSignalHandlers,
      logger,
    });
  } catch (error) {
    if (error instanceof ProfileHomeFeedSchedulerCliHelpRequested) {
      console.log(getProfileHomeFeedSchedulerCliUsage());
      return { exitCode: 0 };
    }

    if (error instanceof ProfileHomeFeedSchedulerCliArgumentError) {
      console.error(error.message);
      console.error("");
      console.error(getProfileHomeFeedSchedulerCliUsage());
      return { exitCode: 2 };
    }

    throw error;
  }
}

async function runParsedProfileHomeFeedSchedulerCli(
  argv: readonly string[],
  overrides: Required<RunProfileHomeFeedSchedulerCliOverrides>,
): Promise<ProfileHomeFeedSchedulerCliRunResult> {
  const options = parseProfileHomeFeedSchedulerCliArgs(argv);
  const abortController = new AbortController();
  const detachSignalHandlers = overrides.installSignalHandlers(() =>
    abortController.abort(),
  );

  let runtime: CollectorRuntimeService | undefined;
  try {
    runtime = overrides.buildRuntime();
  } catch (error) {
    detachSignalHandlers();
    throw error;
  }

  try {
    const result = await runProfileHomeFeedSchedulerCommand({
      options,
      logger: overrides.logger,
      abortSignal: abortController.signal,
      dependencies: buildProfileHomeFeedSchedulerDependencies(runtime),
    });

    overrides.logger.info(
      `Profile home-feed scheduler finished: ` +
        `${result.cyclesCompleted} cycle(s), ` +
        `${result.dispatchedRuns} dispatched.`,
    );

    return { exitCode: 0 };
  } finally {
    detachSignalHandlers();
  }
}

export type { ProfileHomeFeedSchedulerDependencies };
