import process from "node:process";
import { buildStackServiceCommand } from "./build-command";
import {
  getStackServiceCliUsage,
  parseStackServiceCliArgs,
  StackServiceCliArgumentError,
  StackServiceCliHelpRequested,
} from "./cli-args";
import {
  launchStackServiceCommand,
  StackServiceSpawnError,
  stackServiceLaunchExitCode,
} from "./launch-process";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseStackServiceCliArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof StackServiceCliHelpRequested) {
      console.log(getStackServiceCliUsage());
      return;
    }

    if (error instanceof StackServiceCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getStackServiceCliUsage());
      return;
    }

    throw error;
  }

  const command = buildStackServiceCommand(parsedArgs);

  try {
    const result = await launchStackServiceCommand(command);
    process.exitCode = stackServiceLaunchExitCode(result);
  } catch (error) {
    process.exitCode = 1;
    if (error instanceof StackServiceSpawnError) {
      console.error(error.message);
      return;
    }

    throw error;
  }
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(
    error instanceof Error ? error.message : "Stack service command failed.",
  );
});
