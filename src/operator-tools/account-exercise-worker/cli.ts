import process from "node:process";
import {
  AccountExerciseWorkerCliArgumentError,
  AccountExerciseWorkerCliHelpRequested,
  getAccountExerciseWorkerCliUsage,
  parseAccountExerciseWorkerCliArgs,
} from "./cli-args";
import { runAccountExerciseWorkerCommand } from "./worker-runner";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseAccountExerciseWorkerCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof AccountExerciseWorkerCliHelpRequested) {
      console.log(getAccountExerciseWorkerCliUsage());
      return;
    }

    if (error instanceof AccountExerciseWorkerCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getAccountExerciseWorkerCliUsage());
      return;
    }

    throw error;
  }

  const abortController = new AbortController();
  const onInterrupt = (): void => {
    console.error("");
    console.error("Interrupt received. Stopping account exercise worker.");
    abortController.abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  try {
    await runAccountExerciseWorkerCommand({
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
    error instanceof Error ? error.message : "Account exercise worker failed.",
  );
});
