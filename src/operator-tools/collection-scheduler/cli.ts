import process from "node:process";
import { createCollectorRuntimeFromEnv } from "../../composition/collector-runtime/create-collector-runtime";
import type { CollectorRuntimeService } from "../../composition/collector-runtime/create-collector-runtime";
import {
  CollectionSchedulerCliArgumentError,
  CollectionSchedulerCliHelpRequested,
  getCollectionSchedulerCliUsage,
  parseCollectionSchedulerCliArgs,
} from "./cli-args";
import type { CollectionSchedulerCliOptions } from "./cli-args";
import {
  runCollectionSchedulerCommand,
} from "./scheduler-runner";
import type {
  CollectionSchedulerDependencies,
  CollectionSchedulerLogger,
  DispatchNextDueResult,
} from "./scheduler-runner";

export type { CollectionSchedulerCliOptions };

export interface RunCollectionSchedulerCliOverrides {
  readonly buildRuntime?: () => CollectorRuntimeService;
  readonly installSignalHandlers?: (abort: () => void) => () => void;
  readonly logger?: CollectionSchedulerLogger;
  readonly signalName?: string;
}

export interface CollectionSchedulerCliRunResult {
  readonly exitCode: number;
}

const DEFAULT_BUILD_RUNTIME = (): CollectorRuntimeService =>
  createCollectorRuntimeFromEnv();

export function buildCollectionSchedulerDependencies(
  runtime: CollectorRuntimeService,
): CollectionSchedulerDependencies {
  return {
    dispatch: runtime.dispatchNextDueCollectionSchedule.execute.bind(
      runtime.dispatchNextDueCollectionSchedule,
    ),
    close: () => runtime.close(),
  };
}

export function makeConsoleCollectionSchedulerLogger(): CollectionSchedulerLogger {
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

export function installDefaultCollectionSchedulerSignalHandlers(
  abort: () => void,
): () => void {
  const onInterrupt = (): void => {
    console.error("");
    console.error("Interrupt received. Stopping collection scheduler.");
    abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  return () => {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
  };
}

export async function runCollectionSchedulerCli(
  argv: readonly string[],
  overrides: RunCollectionSchedulerCliOverrides = {},
): Promise<CollectionSchedulerCliRunResult> {
  const buildRuntime = overrides.buildRuntime ?? DEFAULT_BUILD_RUNTIME;
  const installSignalHandlers =
    overrides.installSignalHandlers ??
    installDefaultCollectionSchedulerSignalHandlers;
  const logger = overrides.logger ?? makeConsoleCollectionSchedulerLogger();

  try {
    return await runParsedCollectionSchedulerCli(argv, {
      buildRuntime,
      installSignalHandlers,
      logger,
    });
  } catch (error) {
    if (error instanceof CollectionSchedulerCliHelpRequested) {
      console.log(getCollectionSchedulerCliUsage());
      return { exitCode: 0 };
    }

    if (error instanceof CollectionSchedulerCliArgumentError) {
      console.error(error.message);
      console.error("");
      console.error(getCollectionSchedulerCliUsage());
      return { exitCode: 2 };
    }

    throw error;
  }
}

async function runParsedCollectionSchedulerCli(
  argv: readonly string[],
  overrides: Required<Omit<RunCollectionSchedulerCliOverrides, "signalName">>,
): Promise<CollectionSchedulerCliRunResult> {
  const options = parseCollectionSchedulerCliArgs(argv);
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
    const result = await runCollectionSchedulerCommand({
      options,
      logger: overrides.logger,
      abortSignal: abortController.signal,
      dependencies: buildCollectionSchedulerDependencies(runtime),
    });

    overrides.logger.info(
      `Collection scheduler finished: ` +
        `${result.cyclesCompleted} cycle(s), ` +
        `${result.dispatchedRuns} dispatched.`,
    );

    return { exitCode: 0 };
  } finally {
    detachSignalHandlers();
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  let result: CollectionSchedulerCliRunResult;
  try {
    result = await runCollectionSchedulerCli(argv);
  } catch (error) {
    process.exitCode = 1;
    console.error(
      error instanceof Error
        ? error.message
        : "Collection scheduler failed.",
    );
    return;
  }

  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}

void main();

export type { CollectionSchedulerDependencies, DispatchNextDueResult };
