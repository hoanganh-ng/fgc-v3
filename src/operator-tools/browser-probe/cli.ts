import process from "node:process";
import {
  BrowserProbeCliArgumentError,
  BrowserProbeCliHelpRequested,
  getBrowserProbeCliUsage,
  parseBrowserProbeCliArgs,
} from "./cli-args";
import { runBrowserProbeCommand } from "./browser-probe-runner";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseBrowserProbeCliArgs(
      process.argv.slice(2),
      process.env,
    );
  } catch (error) {
    if (error instanceof BrowserProbeCliHelpRequested) {
      console.log(getBrowserProbeCliUsage());
      return;
    }

    if (error instanceof BrowserProbeCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getBrowserProbeCliUsage());
      return;
    }

    throw error;
  }

  const result = await runBrowserProbeCommand({
    args: parsedArgs,
    logger: {
      info: (message) => console.log(message),
      warn: (message) => console.warn(message),
      error: (message) => console.error(message),
    },
  });

  if (!result.ok) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(
    error instanceof Error ? error.message : "Browser provider probe failed.",
  );
});
