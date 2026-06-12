import {
  buildBrowserProviderLaunchConfig,
  resolveBrowserProvider,
} from "../../collector-runtime/infrastructure";
import type {
  BrowserProviderSession,
  RuntimeProfileConfiguration,
} from "../../collector-runtime/application";
import type { BrowserProbeCliArgs } from "./cli-args";

const PROBE_BINDING_NAME = "__fgcBrowserProbeCaptured";

export interface BrowserProbeLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface RunBrowserProbeCommandInput {
  readonly args: BrowserProbeCliArgs;
  readonly logger?: BrowserProbeLogger;
}

export type BrowserProbeCommandResult =
  | {
      readonly ok: true;
      readonly providerName: string;
    }
  | {
      readonly ok: false;
      readonly providerName?: string;
      readonly errorMessage: string;
    };

const NOOP_LOGGER: BrowserProbeLogger = {
  info() {},
};

export async function runBrowserProbeCommand(
  input: RunBrowserProbeCommandInput,
): Promise<BrowserProbeCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const providerResolution = resolveBrowserProvider({
    browserProvider: input.args.browserProvider,
  });

  if (!providerResolution.ok) {
    return {
      ok: false,
      errorMessage: providerResolution.message,
    };
  }

  logger.info(
    `Starting browser provider probe for ${providerResolution.providerName}.`,
  );

  let session: BrowserProviderSession | undefined;

  try {
    const launchConfig = buildBrowserProviderLaunchConfig({
      providerName: providerResolution.providerName,
      configuration: createProbeRuntimeProfileConfiguration(),
      headless: true,
    });

    session = await providerResolution.provider.launch(launchConfig);
    const page = await session.newPage();
    let capturedMessage: unknown;

    await page.exposeBinding(PROBE_BINDING_NAME, (message) => {
      capturedMessage = message;
    });
    await page.addInitScript({
      content: "window.__fgcBrowserProbeInit = true;",
    });
    await page.goto({
      url: "data:text/html,<html><body>browser-provider-probe</body></html>",
      waitUntil: "domcontentloaded",
      timeoutMs: input.args.timeoutMs,
    });

    const initScriptRan = await page.evaluate<boolean>(
      "Boolean(window.__fgcBrowserProbeInit)",
    );

    if (!initScriptRan) {
      throw new Error("Browser provider init script did not run.");
    }

    await page.evaluate(
      `${PROBE_BINDING_NAME}({ ok: true, source: "browser-provider-probe" })`,
    );

    if (!isProbeSuccessMessage(capturedMessage)) {
      throw new Error("Browser provider binding instrumentation did not run.");
    }

    logger.info(
      `Browser provider probe succeeded for ${providerResolution.providerName}.`,
    );

    return {
      ok: true,
      providerName: providerResolution.providerName,
    };
  } catch (error) {
    const errorMessage = sanitizeProbeErrorMessage(error);

    logError(
      logger,
      `Browser provider probe failed for ${providerResolution.providerName}: ${errorMessage}`,
    );

    return {
      ok: false,
      providerName: providerResolution.providerName,
      errorMessage,
    };
  } finally {
    await session?.close().catch(() => {
      logger.warn?.("Browser provider close failed after probe.");
    });
  }
}

function createProbeRuntimeProfileConfiguration(): RuntimeProfileConfiguration {
  return {
    profileId: "browser-probe-profile",
    leaseId: "browser-probe-lease",
    hardwareFingerprint: {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) FGCProbe/1.0 Safari/537.36",
      viewport: {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
      },
      languages: ["en-US", "en"],
      timezone: "UTC",
      fingerprintSeed: "browser-probe-profile",
    },
    networkContext: {
      proxy: null,
      killswitch: {
        enabled: false,
        failClosed: false,
      },
    },
    authenticationState: {
      cookies: [],
      localStorage: [],
      sessionCapturedAt: null,
      sessionExpiresAt: null,
    },
    temporalRoutine: {
      timezone: "UTC",
    },
  };
}

function isProbeSuccessMessage(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    value.ok === true
  );
}

function sanitizeProbeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Browser provider probe failed.";

  return message
    .replace(/browser-probe-profile/g, "[profile-id]")
    .replace(/browser-probe-lease/g, "[lease-id]");
}

function logError(logger: BrowserProbeLogger, message: string): void {
  if (logger.error !== undefined) {
    logger.error(message);
    return;
  }

  logger.info(message);
}
