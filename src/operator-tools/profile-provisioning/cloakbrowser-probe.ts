import {
  CloakBrowserProvisioningProvider,
  buildProvisioningBrowserProviderLaunchConfig,
  probeCloakBrowserProvisioningAvailability,
  type CloakBrowserProvisioningAvailabilityResult,
  type ProvisioningBrowserProviderPort,
  type ProvisioningBrowserProviderSession,
} from "./provisioning-browser-provider";
import type { ProvisioningConfiguration } from "./provisioning-http-client";

export interface CloakBrowserProvisioningProbeLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface RunCloakBrowserProvisioningProbeInput {
  readonly launchHeaded: boolean;
  readonly timeoutMs: number;
  readonly logger?: CloakBrowserProvisioningProbeLogger;
  readonly provider?: ProvisioningBrowserProviderPort;
  readonly probeAvailability?: () => Promise<CloakBrowserProvisioningAvailabilityResult>;
}

export type CloakBrowserProvisioningProbeResult =
  | {
      readonly ok: true;
      readonly availabilityReasonCode: string;
      readonly launched: boolean;
    }
  | {
      readonly ok: false;
      readonly availabilityReasonCode?: string;
      readonly errorCode: string;
      readonly errorMessage: string;
    };

const NOOP_LOGGER: CloakBrowserProvisioningProbeLogger = {
  info() {},
};

export async function runCloakBrowserProvisioningProbe(
  input: RunCloakBrowserProvisioningProbeInput,
): Promise<CloakBrowserProvisioningProbeResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const availability = await (input.probeAvailability ??
    probeCloakBrowserProvisioningAvailability)();

  logger.info(
    `CloakBrowser provisioning availability: ${availability.reasonCode}.`,
  );

  if (!availability.ok) {
    const failure = {
      ok: false as const,
      availabilityReasonCode: availability.reasonCode,
      errorCode: availability.reasonCode,
      errorMessage: availability.message,
    };
    logError(logger, `CloakBrowser provisioning probe failed: ${failure.errorMessage}`);

    return failure;
  }

  if (!input.launchHeaded) {
    return {
      ok: true,
      availabilityReasonCode: availability.reasonCode,
      launched: false,
    };
  }

  const provider = input.provider ?? new CloakBrowserProvisioningProvider();
  let session: ProvisioningBrowserProviderSession | undefined;

  try {
    logger.info("Launching headed CloakBrowser provisioning smoke page.");
    session = await provider.launch(
      buildProvisioningBrowserProviderLaunchConfig({
        providerName: "CLOAK_BROWSER",
        configuration: createProbeProvisioningConfiguration(),
      }),
    );

    const page = await session.newPage();

    try {
      await page.goto("data:text/html,<html><body>cloakbrowser-provisioning-probe</body></html>", {
        waitUntil: "domcontentloaded",
        timeout: input.timeoutMs,
      });
    } finally {
      await page.close();
    }

    logger.info("Headed CloakBrowser provisioning smoke launch succeeded.");

    return {
      ok: true,
      availabilityReasonCode: availability.reasonCode,
      launched: true,
    };
  } catch (error) {
    const errorMessage = sanitizeProbeErrorMessage(error);
    logError(logger, `CloakBrowser provisioning probe failed: ${errorMessage}`);

    return {
      ok: false,
      availabilityReasonCode: availability.reasonCode,
      errorCode: "CLOAK_BROWSER_PROVISIONING_LAUNCH_FAILED",
      errorMessage,
    };
  } finally {
    await session?.close().catch(() => {
      logger.warn?.("CloakBrowser provisioning probe close failed.");
    });
  }
}

function createProbeProvisioningConfiguration(): ProvisioningConfiguration {
  return {
    profileId: "cloakbrowser-provisioning-probe-profile",
    networkContext: {
      mode: "DIRECT",
      proxy: null,
      killswitch: {
        enabled: false,
        failClosed: false,
      },
    },
    hardwareFingerprint: {
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) FGCProvisioningProbe/1.0 Safari/537.36",
      viewport: {
        width: 1280,
        height: 720,
        deviceScaleFactor: 1,
      },
      languages: ["en-US", "en"],
      hardwareConcurrency: 8,
      platform: "Linux x86_64",
      deviceMemoryGb: 8,
      timezone: "UTC",
    },
  };
}

function sanitizeProbeErrorMessage(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : "CloakBrowser provisioning probe failed.";

  return message
    .replace(/cloakbrowser-provisioning-probe-profile/g, "[profile-id]")
    .replace(/data:text\/html,[^\s)]+/g, "[probe-page]");
}

function logError(
  logger: CloakBrowserProvisioningProbeLogger,
  message: string,
): void {
  if (logger.error !== undefined) {
    logger.error(message);
    return;
  }

  logger.info(message);
}
