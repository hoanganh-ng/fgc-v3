import process from "node:process";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import {
  ProfileProvisioningCliArgumentError,
  ProfileProvisioningCliHelpRequested,
  getProfileProvisioningCliUsage,
  parseProfileProvisioningCliArgs,
} from "./cli-args";
import { PlaywrightProvisioningBrowserLauncher } from "./playwright-provisioning-browser";
import { ProfileProvisioningHttpClient } from "./provisioning-http-client";
import {
  runProfileProvisioning,
  type ProfileProvisioningRunResult,
  type WaitForOperatorConfirmation,
} from "./provisioning-runner";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseProfileProvisioningCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof ProfileProvisioningCliHelpRequested) {
      console.log(getProfileProvisioningCliUsage());
      return;
    }

    if (error instanceof ProfileProvisioningCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getProfileProvisioningCliUsage());
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
    const result = await runProfileProvisioning({
      token: parsedArgs.token,
      client: new ProfileProvisioningHttpClient({
        baseUrl: parsedArgs.baseUrl,
      }),
      browserLauncher: new PlaywrightProvisioningBrowserLauncher(),
      waitForOperatorConfirmation: createReadlineOperatorConfirmation(
        process.stdin,
        process.stdout,
      ),
      logger: {
        info: (message) => console.log(message),
        warn: (message) => console.warn(message),
        error: (message) => console.error(message),
      },
      abortSignal: abortController.signal,
    });

    applyProcessExitCode(result, interrupted);
    printRunResult(result);
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
  }
}

export function createReadlineOperatorConfirmation(
  input: Readable,
  output: Writable,
): WaitForOperatorConfirmation {
  return async (signal) => {
    const readline = createInterface({
      input,
      output,
    });

    try {
      await readline.question("Press Enter to capture and submit session state.", {
        signal,
      });
    } finally {
      readline.close();
    }
  };
}

function printRunResult(result: ProfileProvisioningRunResult): void {
  if (result.ok) {
    console.log(
      `Provisioning complete. Profile ${result.profileId} is ${result.profileStatus}.`,
    );
    return;
  }

  console.error(
    `Provisioning failed (${result.errorCode}): ${result.errorMessage}`,
  );

  if (result.statusCode !== undefined) {
    console.error(`Profile Manager HTTP status: ${result.statusCode}`);
  }

  if (result.issues !== undefined) {
    for (const issue of result.issues) {
      console.error(`- ${issue.path}: ${issue.message}`);
    }
  }
}

function applyProcessExitCode(
  result: ProfileProvisioningRunResult,
  interrupted: boolean,
): void {
  if (result.ok) {
    return;
  }

  process.exitCode =
    interrupted || result.errorCode === "PROFILE_PROVISIONING_INTERRUPTED"
      ? 130
      : 1;
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(error instanceof Error ? error.message : "Provisioning failed.");
});
