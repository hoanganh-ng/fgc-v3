import process from "node:process";
import { runCollectionSchedulerCli } from "./cli-command";
import type { CollectionSchedulerCliRunResult } from "./cli-command";

async function main(): Promise<void> {
  let result: CollectionSchedulerCliRunResult;
  try {
    result = await runCollectionSchedulerCli(process.argv.slice(2));
  } catch (error) {
    process.exitCode = 1;
    console.error(
      error instanceof Error
        ? error.message
        : "Collection scheduler failed.",
    );
    return;
  }

  if (result.exitCode !== 0) {
    process.exitCode = result.exitCode;
  }
}

void main();