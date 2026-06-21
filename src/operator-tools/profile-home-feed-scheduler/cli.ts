import process from "node:process";
import { runProfileHomeFeedSchedulerCli } from "./cli-command";
import type { ProfileHomeFeedSchedulerCliRunResult } from "./cli-command";

async function main(): Promise<void> {
  let result: ProfileHomeFeedSchedulerCliRunResult;
  try {
    result = await runProfileHomeFeedSchedulerCli(process.argv.slice(2));
  } catch (error) {
    process.exitCode = 1;
    console.error(
      error instanceof Error
        ? error.message
        : "Profile home-feed scheduler failed.",
    );
    return;
  }

  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}

void main();
