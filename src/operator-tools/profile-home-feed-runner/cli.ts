import process from "node:process";
import {
  ProfileHomeFeedRunNextCliArgumentError,
  ProfileHomeFeedRunNextCliHelpRequested,
  getProfileHomeFeedRunNextCliUsage,
  parseProfileHomeFeedRunNextCliArgs,
} from "./cli-args";
import {
  runProfileHomeFeedRunNextCommand,
  type ProfileHomeFeedRunNextCommandResult,
} from "./runner";
import { reportUnexpectedCliFailure } from "./cli-error-reporter";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseProfileHomeFeedRunNextCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof ProfileHomeFeedRunNextCliHelpRequested) {
      console.log(getProfileHomeFeedRunNextCliUsage());
      return;
    }

    if (error instanceof ProfileHomeFeedRunNextCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getProfileHomeFeedRunNextCliUsage());
      return;
    }

    throw error;
  }

  const abortController = new AbortController();
  let interrupted = false;
  const onInterrupt = (): void => {
    interrupted = true;
    console.error("");
    console.error("Interrupt received. Closing resources before exiting.");
    abortController.abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  try {
    const result = await runProfileHomeFeedRunNextCommand({
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
  result: ProfileHomeFeedRunNextCommandResult,
  interrupted: boolean,
): void {
  if (result.ok) {
    return;
  }

  process.exitCode = interrupted ? 130 : 1;
}

void main().catch(reportUnexpectedCliFailure);
