import process from "node:process";
import {
  ProfileHomeFeedWorkerCliArgumentError,
  ProfileHomeFeedWorkerCliHelpRequested,
  getProfileHomeFeedWorkerCliUsage,
  parseProfileHomeFeedWorkerCliArgs,
} from "./cli-args";
import {
  runProfileHomeFeedWorkerCommand,
  type ProfileHomeFeedWorkerCommandResult,
} from "./worker-runner";

const UNEXPECTED_PROFILE_HOME_FEED_WORKER_FAILURE_MESSAGE =
  "Profile home-feed worker failed unexpectedly.";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseProfileHomeFeedWorkerCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof ProfileHomeFeedWorkerCliHelpRequested) {
      console.log(getProfileHomeFeedWorkerCliUsage());
      return;
    }

    if (error instanceof ProfileHomeFeedWorkerCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getProfileHomeFeedWorkerCliUsage());
      return;
    }

    throw error;
  }

  const abortController = new AbortController();
  let interrupted = false;
  const onInterrupt = (): void => {
    interrupted = true;
    console.error("");
    console.error("Interrupt received. Stopping profile home-feed worker.");
    abortController.abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  try {
    const result = await runProfileHomeFeedWorkerCommand({
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
  result: ProfileHomeFeedWorkerCommandResult,
  interrupted: boolean,
): void {
  if (interrupted) {
    process.exitCode = 130;
    return;
  }

  if (!result.ok) {
    process.exitCode = 1;
  }
}

void main().catch(() => {
  process.exitCode = 1;
  console.error(UNEXPECTED_PROFILE_HOME_FEED_WORKER_FAILURE_MESSAGE);
});
