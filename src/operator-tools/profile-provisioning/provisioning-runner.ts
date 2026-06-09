import type {
  ProvisioningCapturedSessionState,
  ProvisioningConfiguration,
  ProvisioningConfigurationResult,
  ProvisioningHttpFailure,
  ProvisioningSessionIngestionResult,
} from "./provisioning-http-client";

export interface ProfileProvisioningClient {
  getProvisioningConfiguration(
    provisioningToken: string,
  ): Promise<ProvisioningConfigurationResult>;
  ingestSessionState(
    provisioningToken: string,
    sessionState: ProvisioningCapturedSessionState,
  ): Promise<ProvisioningSessionIngestionResult>;
}

export interface ProvisioningBrowserSession {
  openLoginPage(): Promise<void>;
  captureSessionState(): Promise<ProvisioningCapturedSessionState>;
  close(): Promise<void>;
}

export interface ProvisioningBrowserLauncher {
  launch(
    configuration: ProvisioningConfiguration,
  ): Promise<ProvisioningBrowserSession>;
}

export interface ProfileProvisioningLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export type WaitForOperatorConfirmation = (
  signal?: AbortSignal,
) => Promise<void>;

export interface RunProfileProvisioningInput {
  readonly token: string;
  readonly client: ProfileProvisioningClient;
  readonly browserLauncher: ProvisioningBrowserLauncher;
  readonly waitForOperatorConfirmation: WaitForOperatorConfirmation;
  readonly logger?: ProfileProvisioningLogger;
  readonly abortSignal?: AbortSignal;
}

export type ProfileProvisioningRunResult =
  | {
      readonly ok: true;
      readonly profileId: string;
      readonly profileStatus: string;
    }
  | {
      readonly ok: false;
      readonly errorCode: string;
      readonly errorMessage: string;
      readonly statusCode?: number;
      readonly issues?: readonly {
        readonly path: string;
        readonly message: string;
      }[];
    };

const NOOP_LOGGER: ProfileProvisioningLogger = {
  info() {},
};

export async function runProfileProvisioning(
  input: RunProfileProvisioningInput,
): Promise<ProfileProvisioningRunResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  let browserSession: ProvisioningBrowserSession | undefined;
  let result: ProfileProvisioningRunResult | undefined;

  try {
    throwIfAborted(input.abortSignal);
    logger.info("Fetching provisioning configuration from Profile Manager.");

    const configurationResult = await input.client.getProvisioningConfiguration(
      input.token,
    );

    if (!configurationResult.ok) {
      result = toRunFailure(configurationResult);

      return result;
    }

    throwIfAborted(input.abortSignal);
    logger.info(
      `Provisioning configuration loaded for profile ${configurationResult.configuration.profileId}.`,
    );
    logger.info("Opening headed Chromium for manual Facebook login.");

    browserSession = await input.browserLauncher.launch(
      configurationResult.configuration,
    );
    await browserSession.openLoginPage();

    logger.info("Facebook login page is open in the browser.");
    logger.info("Complete login manually in the browser window.");
    logger.info("Return to this terminal and press Enter after login succeeds.");

    await input.waitForOperatorConfirmation(input.abortSignal);
    throwIfAborted(input.abortSignal);

    logger.info("Capturing browser session state.");
    const sessionState = await browserSession.captureSessionState();

    logger.info(
      `Captured ${sessionState.cookies.length} cookies and ${sessionState.localStorage.length} localStorage entries.`,
    );

    if (sessionState.cookies.length === 0) {
      logger.warn?.(
        "No cookies were captured. Profile Manager may accept the submission, but checkout eligibility can still fail without an authenticated session.",
      );
    }

    logger.info("Submitting captured session state to Profile Manager.");
    const ingestionResult = await input.client.ingestSessionState(
      input.token,
      sessionState,
    );

    if (!ingestionResult.ok) {
      result = toRunFailure(ingestionResult);

      return result;
    }

    logger.info(
      `Profile ${ingestionResult.profile.id} is ${ingestionResult.profile.status}.`,
    );
    logger.info("Provisioning token was consumed by Profile Manager.");

    result = {
      ok: true,
      profileId: ingestionResult.profile.id,
      profileStatus: ingestionResult.profile.status,
    };

    return result;
  } catch (error) {
    result = isAbortLikeError(error, input.abortSignal)
      ? {
          ok: false,
          errorCode: "PROFILE_PROVISIONING_INTERRUPTED",
          errorMessage:
            "Profile provisioning was interrupted before session submission completed.",
        }
      : {
          ok: false,
          errorCode: "PROFILE_PROVISIONING_BROWSER_FLOW_FAILED",
          errorMessage: errorToSafeMessage(error),
        };

    return result;
  } finally {
    if (browserSession !== undefined) {
      await closeBrowserSession(browserSession, logger);
    }
  }
}

function toRunFailure(
  failure: ProvisioningHttpFailure,
): Extract<ProfileProvisioningRunResult, { readonly ok: false }> {
  return {
    ok: false,
    errorCode: failure.errorCode,
    errorMessage: failure.errorMessage,
    ...(failure.statusCode !== undefined
      ? { statusCode: failure.statusCode }
      : {}),
    ...(failure.issues !== undefined ? { issues: failure.issues } : {}),
  };
}

async function closeBrowserSession(
  browserSession: ProvisioningBrowserSession,
  logger: ProfileProvisioningLogger,
): Promise<void> {
  try {
    await browserSession.close();
  } catch {
    logger.warn?.(
      "Browser close reported an error. Check for a leftover Chromium process before retrying.",
    );
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted === true) {
    throw new ProfileProvisioningInterruptedError();
  }
}

class ProfileProvisioningInterruptedError extends Error {
  public constructor() {
    super("Profile provisioning was interrupted.");
    this.name = "ProfileProvisioningInterruptedError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function isAbortLikeError(
  error: unknown,
  signal: AbortSignal | undefined,
): boolean {
  return (
    signal?.aborted === true ||
    error instanceof ProfileProvisioningInterruptedError ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function errorToSafeMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Profile provisioning failed for an unknown reason.";
}
