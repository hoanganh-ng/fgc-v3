import process from "node:process";
import { createCollectorRuntimeFromEnv } from "../../composition/collector-runtime/create-collector-runtime";
import {
  CollectionSchedulerCliArgumentError,
  CollectionSchedulerCliHelpRequested,
  getCollectionSchedulerCliUsage,
  parseCollectionSchedulerCliArgs,
} from "./cli-args";
import { runCollectionSchedulerCommand } from "./scheduler-runner";

async function main(): Promise<void> {
  let options;

  try {
    options = parseCollectionSchedulerCliArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof CollectionSchedulerCliHelpRequested) {
      console.log(getCollectionSchedulerCliUsage());
      return;
    }

    if (error instanceof CollectionSchedulerCliArgumentError) {
      process.exitCode = 2;
      console.error(error.message);
      console.error("");
      console.error(getCollectionSchedulerCliUsage());
      return;
    }

    throw error;
  }

  const abortController = new AbortController();
  const onInterrupt = (): void => {
    console.error("");
    console.error("Interrupt received. Stopping collection scheduler.");
    abortController.abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  const container = createCollectorRuntimeFromEnv();

  try {
    const result = await runCollectionSchedulerCommand({
      options,
      logger: {
        info: (message) => console.log(message),
        warn: (message) => console.warn(message),
        error: (message) => console.error(message),
      },
      abortSignal: abortController.signal,
      dependencies: {
        dispatch: container.dispatchNextDueCollectionSchedule.execute.bind(
          container.dispatchNextDueCollectionSchedule,
        ),
        close: () => container.close(),
      },
    });

    console.log(
      `Collection scheduler finished: ` +
        `${result.cyclesCompleted} cycle(s), ` +
        `${result.dispatchedRuns} dispatched.`,
    );
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
  }
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(
    error instanceof Error ? error.message : "Collection scheduler failed.",
  );
});