import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import {
  adminApiKey,
  baseUrl,
  composeProjectName,
  postgresHostPort,
  webHostPort
} from "./config.js";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const healthUrl = `${baseUrl}/api/health`;

const composeEnv: NodeJS.ProcessEnv = {
  ...process.env,
  ADMIN_API_KEY: adminApiKey,
  POSTGRES_HOST_PORT: postgresHostPort,
  WEB_ADMIN_API_KEY: adminApiKey,
  WEB_HOST_PORT: webHostPort
};

export function composeDown(): void {
  dockerCompose(["down", "-v", "--remove-orphans"]);
}

export function composeUp(): void {
  dockerCompose(["up", "--build", "-d"]);
}

export async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + 120_000;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl, {
        signal: AbortSignal.timeout(5_000)
      });

      if (response.ok) {
        return;
      }

      lastError = new Error(`Health check returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await delay(1_000);
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Timed out waiting for ${healthUrl}: ${detail}`);
}

function dockerCompose(args: readonly string[]): void {
  execFileSync("docker", ["compose", "-p", composeProjectName, ...args], {
    cwd: repoRoot,
    env: composeEnv,
    stdio: "inherit"
  });
}
