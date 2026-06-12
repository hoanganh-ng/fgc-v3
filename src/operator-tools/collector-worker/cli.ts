import process from "node:process";
import {
  CollectorWorkerCliArgumentError,
  CollectorWorkerCliHelpRequested,
  getCollectorWorkerCliUsage,
  parseCollectorWorkerCliArgs,
} from "./cli-args";
import { runCollectorWorkerCommand } from "./worker-runner";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseCollectorWorkerCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof CollectorWorkerCliHelpRequested) {
      console.log(getCollectorWorkerCliUsage());
      return;
    }

    if (error instanceof CollectorWorkerCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getCollectorWorkerCliUsage());
      return;
    }

    throw error;
  }

  const abortController = new AbortController();
  const onInterrupt = (): void => {
    console.error("");
    console.error("Interrupt received. Stopping collector worker.");
    abortController.abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  try {
    await runCollectorWorkerCommand({
      args: parsedArgs,
      logger: {
        info: (message) => console.log(message),
        warn: (message) => console.warn(message),
        error: (message) => console.error(message),
      },
      abortSignal: abortController.signal,
    });
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
  }
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(
    error instanceof Error ? error.message : "Collector worker failed.",
  );
});
