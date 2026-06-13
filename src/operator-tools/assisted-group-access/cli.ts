import { createInterface } from "node:readline/promises";
import process from "node:process";
import {
  AssistedGroupAccessCliArgumentError,
  AssistedGroupAccessCliHelpRequested,
  getAssistedGroupAccessCliUsage,
  parseAssistedGroupAccessCliArgs,
} from "./cli-args";
import {
  type AssistedAccessCommandResult,
  type AssistedAccessSessionControlPort,
} from "./assisted-access-runner";
import {
  promptForAssistedAccessOutcome,
  runAssistedAccessWorkflow,
  type AssistedAccessOutcomePromptPort,
  type AssistedAccessWorkflowResult,
} from "./access-outcome-workflow";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseAssistedGroupAccessCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof AssistedGroupAccessCliHelpRequested) {
      console.log(getAssistedGroupAccessCliUsage());
      return;
    }

    if (error instanceof AssistedGroupAccessCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getAssistedGroupAccessCliUsage());
      return;
    }

    throw error;
  }

  const abortController = new AbortController();
  let interrupted = false;
  const onInterrupt = (): void => {
    interrupted = true;
    console.error("");
    console.error("Interrupt received. Closing browser and releasing lease.");
    abortController.abort();
  };

  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  try {
    const result = await runAssistedAccessWorkflow({
      args: parsedArgs,
      logger: {
        info: (message) => console.log(message),
        warn: (message) => console.warn(message),
        error: (message) => console.error(message),
      },
      abortSignal: abortController.signal,
      dependencies: {
        assistedAccess: {
          sessionControl: new StdinAssistedAccessSessionControl(),
        },
        outcomePrompt: new StdinAssistedAccessOutcomePrompt(),
      },
    });

    applyProcessExitCode(result, interrupted);
  } finally {
    process.off("SIGINT", onInterrupt);
    process.off("SIGTERM", onInterrupt);
  }
}

class StdinAssistedAccessSessionControl
  implements AssistedAccessSessionControlPort
{
  public async waitForCompletion(input: {
    readonly maxDurationMs: number;
    readonly abortSignal?: AbortSignal;
  }): Promise<"OPERATOR_COMPLETED" | "TIMEOUT" | "ABORTED"> {
    console.log("Inspect the group access manually in the browser.");
    console.log("Press Enter here to finish and release the lease.");

    if (input.abortSignal?.aborted) {
      return "ABORTED";
    }

    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      return await new Promise((resolve) => {
        let settled = false;
        const finish = (reason: "OPERATOR_COMPLETED" | "TIMEOUT" | "ABORTED") => {
          if (settled) {
            return;
          }

          settled = true;
          clearTimeout(timeout);
          input.abortSignal?.removeEventListener("abort", onAbort);
          resolve(reason);
        };
        const onAbort = () => finish("ABORTED");
        const timeout = setTimeout(() => finish("TIMEOUT"), input.maxDurationMs);

        input.abortSignal?.addEventListener("abort", onAbort, { once: true });
        void readline.question("").then(
          () => finish("OPERATOR_COMPLETED"),
          () => finish("ABORTED"),
        );
      });
    } finally {
      readline.close();
    }
  }
}

class StdinAssistedAccessOutcomePrompt
  implements AssistedAccessOutcomePromptPort
{
  public async promptOutcome(): Promise<
    | "PUBLIC_ACCESSIBLE"
    | "JOIN_REQUIRED"
    | "JOINED_ACCESSIBLE"
    | "ACCESS_DENIED"
    | "LOGIN_REQUIRED"
    | "CHECKPOINT_REQUIRED"
    | "SKIP"
  > {
    const readline = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      return await promptForAssistedAccessOutcome({
        writeLine: (message) => console.log(message),
        readLine: async () => {
          try {
            return await readline.question("> ");
          } catch {
            return undefined;
          }
        },
      });
    } finally {
      readline.close();
    }
  }
}

function applyProcessExitCode(
  result: AssistedAccessCommandResult | AssistedAccessWorkflowResult,
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
    error instanceof Error ? error.message : "Assisted group access failed.",
  );
});
