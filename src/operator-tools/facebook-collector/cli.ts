import process from "node:process";
import {
  FacebookCollectorCliArgumentError,
  FacebookCollectorCliHelpRequested,
  getFacebookCollectorCliUsage,
  parseFacebookCollectorCliArgs,
} from "./cli-args";
import {
  runFacebookCollectorCommand,
  type FacebookCollectorCommandResult,
} from "./collector-runner";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseFacebookCollectorCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof FacebookCollectorCliHelpRequested) {
      console.log(getFacebookCollectorCliUsage());
      return;
    }

    if (error instanceof FacebookCollectorCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getFacebookCollectorCliUsage());
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
    const result = await runFacebookCollectorCommand({
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
  result: FacebookCollectorCommandResult,
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
    error instanceof Error ? error.message : "Facebook collection run failed.",
  );
});
