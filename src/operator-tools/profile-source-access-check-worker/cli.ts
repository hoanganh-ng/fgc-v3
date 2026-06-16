import process from "node:process";
import {
  ProfileSourceAccessCheckWorkerCliArgumentError,
  ProfileSourceAccessCheckWorkerCliHelpRequested,
  getProfileSourceAccessCheckWorkerCliUsage,
  parseProfileSourceAccessCheckWorkerCliArgs,
} from "./cli-args";
import { runProfileSourceAccessCheckWorkerCommand } from "./worker-runner";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseProfileSourceAccessCheckWorkerCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof ProfileSourceAccessCheckWorkerCliHelpRequested) {
      console.log(getProfileSourceAccessCheckWorkerCliUsage());
      return;
    }

    if (error instanceof ProfileSourceAccessCheckWorkerCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getProfileSourceAccessCheckWorkerCliUsage());
      return;
    }

    throw error;
  }

  const abortController = new AbortController();
  const onInterrupt = (): void => {
    console.error("");
    console.error("Interrupt received. Stopping profile-source access check worker.");
    abortController.abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  try {
    await runProfileSourceAccessCheckWorkerCommand({
      args: parsedArgs,
      logger: {
        info: (message) => console.log(message),
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
    error instanceof Error
      ? error.message
      : "Profile-source access check worker failed.",
  );
});
