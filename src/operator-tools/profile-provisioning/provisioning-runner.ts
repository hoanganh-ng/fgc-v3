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
  const sensitiveValues = new Set<string>([input.token]);
  let browserSession: ProvisioningBrowserSession | undefined;
  let result: ProfileProvisioningRunResult | undefined;

  try {
    throwIfAborted(input.abortSignal);
    logger.info("Fetching provisioning configuration from Profile Manager.");

    const configurationResult = await input.client.getProvisioningConfiguration(
      input.token,
    );

    if (!configurationResult.ok) {
      result = toRunFailure(configurationResult, sensitiveValues);

      return result;
    }

    addConfigurationSensitiveValues(
      sensitiveValues,
      configurationResult.configuration,
    );
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
    addSessionSensitiveValues(sensitiveValues, sessionState);

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
      result = toRunFailure(ingestionResult, sensitiveValues);

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
          errorMessage: errorToSafeMessage(error, sensitiveValues),
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
  sensitiveValues: ReadonlySet<string>,
): Extract<ProfileProvisioningRunResult, { readonly ok: false }> {
  return {
    ok: false,
    errorCode: failure.errorCode,
    errorMessage: redactSensitiveText(failure.errorMessage, sensitiveValues),
    ...(failure.statusCode !== undefined
      ? { statusCode: failure.statusCode }
      : {}),
    ...(failure.issues !== undefined
      ? {
          issues: failure.issues.map((issue) => ({
            path: redactSensitiveText(issue.path, sensitiveValues),
            message: redactSensitiveText(issue.message, sensitiveValues),
          })),
        }
      : {}),
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

function errorToSafeMessage(
  error: unknown,
  sensitiveValues: ReadonlySet<string>,
): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return redactSensitiveText(error.message, sensitiveValues);
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return redactSensitiveText(error, sensitiveValues);
  }

  return "Profile provisioning failed for an unknown reason.";
}

function addConfigurationSensitiveValues(
  sensitiveValues: Set<string>,
  configuration: ProvisioningConfiguration,
): void {
  const credentials = configuration.networkContext.proxy?.credentials;

  if (credentials === undefined || credentials === null) {
    return;
  }

  addSensitiveValue(sensitiveValues, credentials.username);
  addSensitiveValue(sensitiveValues, credentials.password);
}

function addSessionSensitiveValues(
  sensitiveValues: Set<string>,
  sessionState: ProvisioningCapturedSessionState,
): void {
  for (const cookie of sessionState.cookies) {
    addSensitiveValue(sensitiveValues, cookie.name);
    addSensitiveValue(sensitiveValues, cookie.value);
  }

  for (const localStorageEntry of sessionState.localStorage) {
    addSensitiveValue(sensitiveValues, localStorageEntry.key);
    addSensitiveValue(sensitiveValues, localStorageEntry.value);
  }
}

function addSensitiveValue(
  sensitiveValues: Set<string>,
  value: string,
): void {
  const normalizedValue = value.trim();

  if (normalizedValue.length >= 3) {
    sensitiveValues.add(normalizedValue);
  }
}

function redactSensitiveText(
  text: string,
  sensitiveValues: ReadonlySet<string>,
): string {
  let redactedText = text;

  for (const sensitiveValue of sensitiveValues) {
    redactedText = redactedText.split(sensitiveValue).join("[redacted]");
  }

  return redactedText;
}
