import process from "node:process";
import {
  CloakBrowserProvisioningProbeCliArgumentError,
  CloakBrowserProvisioningProbeCliHelpRequested,
  getCloakBrowserProvisioningProbeCliUsage,
  parseCloakBrowserProvisioningProbeCliArgs,
} from "./cloakbrowser-probe-cli-args";
import { runCloakBrowserProvisioningProbe } from "./cloakbrowser-probe";

async function main(): Promise<void> {
  let parsedArgs;

  try {
    parsedArgs = parseCloakBrowserProvisioningProbeCliArgs(
      process.argv.slice(2),
    );
  } catch (error) {
    if (error instanceof CloakBrowserProvisioningProbeCliHelpRequested) {
      console.log(getCloakBrowserProvisioningProbeCliUsage());
      return;
    }

    if (error instanceof CloakBrowserProvisioningProbeCliArgumentError) {
      process.exitCode = 1;
      console.error(error.message);
      console.error("");
      console.error(getCloakBrowserProvisioningProbeCliUsage());
      return;
    }

    throw error;
  }

  const result = await runCloakBrowserProvisioningProbe({
    launchHeaded: parsedArgs.launchHeaded,
    timeoutMs: parsedArgs.timeoutMs,
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
    error instanceof Error
      ? error.message
      : "CloakBrowser provisioning probe failed.",
  );
});
