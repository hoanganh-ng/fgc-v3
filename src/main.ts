import { createCollectorProfileManagerFromEnv } from "./composition/collector-profile-manager";
import { createContentManagerFromEnv } from "./composition/content-manager";
import { createHttpServer } from "./interfaces/http";

interface HttpRuntimeConfig {
  readonly host: string;
  readonly port: number;
}

function loadHttpRuntimeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): HttpRuntimeConfig {
  const host = environment.HTTP_HOST?.trim() || "0.0.0.0";
  const rawPort = environment.HTTP_PORT?.trim() || "3000";
  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("HTTP_PORT must be an integer between 1 and 65535.");
  }

  return {
    host,
    port,
  };
}

async function main(): Promise<void> {
  const config = loadHttpRuntimeConfig();
  const collectorProfileManager = createCollectorProfileManagerFromEnv();
  const contentManager = createContentManagerFromEnv();
  const server = createHttpServer({
    collectorProfileManager,
    contentManager,
  });
  let shutdownStarted = false;

  async function shutdown(): Promise<void> {
    if (shutdownStarted) {
      return;
    }

    shutdownStarted = true;
    await server.close();
    await collectorProfileManager.close();
    await contentManager.close();
  }

  process.once("SIGINT", () => {
    void shutdown().catch((error: unknown) => {
      process.exitCode = 1;
      console.error(error);
    });
  });
  process.once("SIGTERM", () => {
    void shutdown().catch((error: unknown) => {
      process.exitCode = 1;
      console.error(error);
    });
  });

  try {
    await server.listen({
      host: config.host,
      port: config.port,
    });
    console.log(`HTTP server listening on ${config.host}:${config.port}`);
  } catch (error) {
    await shutdown();
    throw error;
  }
}

void main().catch((error: unknown) => {
  process.exitCode = 1;
  console.error(error);
});
