import process from "node:process";
import {
  ProfileExerciseCliArgumentError,
  ProfileExerciseCliHelpRequested,
  getProfileExerciseCliUsage,
  parseProfileExerciseCliArgs,
} from "./cli-args";
import {
  runProfileExerciseCommand,
  type ProfileExerciseCommandResult,
} from "./exercise-runner";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseProfileExerciseCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof ProfileExerciseCliHelpRequested) {
      console.log(getProfileExerciseCliUsage());
      return;
    }

    if (error instanceof ProfileExerciseCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getProfileExerciseCliUsage());
      return;
    }

    throw error;
  }

  const abortController = new AbortController();
  let interrupted = false;
  const onInterrupt = (): void => {
    interrupted = true;
    console.error("");
    console.error("Interrupt received. Closing browser before exiting.");
    abortController.abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  try {
    const result = await runProfileExerciseCommand({
      args: parsedArgs,
      logger: {
        info: (message) => console.log(message),
        warn: (message) => console.warn(message),
        error: (message) => console.error(message),
      },
      abortSignal: abortController.signal,
    });

    applyProcessExitCode(result, interrupted);
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
  }
}

function applyProcessExitCode(
  result: ProfileExerciseCommandResult,
  interrupted: boolean,
): void {
  if (result.ok) {
    return;
  }

  process.exitCode = interrupted ? 130 : 1;
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(
    error instanceof Error ? error.message : "Profile exercise failed.",
  );
});
