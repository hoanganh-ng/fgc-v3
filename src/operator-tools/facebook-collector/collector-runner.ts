import {
  ContentManagerHttpClient,
  FacebookBrowserPayloadCaptureAdapter,
  ProfileManagerHttpClient,
  resolveBrowserProvider,
} from "../../collector-runtime/infrastructure";
import type {
  ContentManagerSourceGroup,
  ContentManagerSourceGroupLookupResult,
  SafeProfileStatusCounts,
  SafeProfileStatusCountsResult,
} from "../../collector-runtime/infrastructure";
import {
  RunFacebookGroupCollectionUseCase,
  SubmitCapturedFacebookPayloadUseCase,
} from "../../collector-runtime/application";
import type {
  RunFacebookGroupCollectionResult,
  RunFacebookGroupCollectionUseCaseDependencies,
} from "../../collector-runtime/application";
import {
  normalizeFacebookGroupUrl,
  type FacebookCollectorCliArgs,
} from "./cli-args";

export interface FacebookCollectorLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface FacebookCollectorSourceGroupResolver {
  getSourceGroup(
    sourceGroupId: string,
  ): Promise<ContentManagerSourceGroupLookupResult>;
}

export interface FacebookCollectorCheckoutDiagnosticsPort {
  getSafeProfileStatusCounts(): Promise<SafeProfileStatusCountsResult>;
}

export interface FacebookCollectorCommandDependencies
  extends Partial<RunFacebookGroupCollectionUseCaseDependencies> {
  readonly sourceGroupResolver?: FacebookCollectorSourceGroupResolver;
  readonly checkoutDiagnosticsPort?: FacebookCollectorCheckoutDiagnosticsPort;
}

export interface RunFacebookCollectorCommandInput {
  readonly args: FacebookCollectorCliArgs;
  readonly logger?: FacebookCollectorLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: FacebookCollectorCommandDependencies;
  readonly now?: () => Date;
}

export interface FacebookCollectorCommandResult {
  readonly ok: boolean;
  readonly sourceGroupId: string;
  readonly leaseReleased: boolean;
  readonly capturedGraphQLResponseCount: number;
  readonly pageContextFetchCaptureCount: number;
  readonly pageContextXhrCaptureCount: number;
  readonly networkListenerCaptureCount: number;
  readonly captureParseFailureCount: number;
  readonly totalPayloadsPassedToExtractor: number;
  readonly finalPageUrl?: string;
  readonly loginRedirectSuspected: boolean;
  readonly extractedCandidateCount: number;
  readonly submittedContentItemCount: number;
  readonly failedSubmissionCount: number;
  readonly warningCount: number;
  readonly durationMs: number;
  readonly errors: readonly FacebookCollectorCommandError[];
}

export interface FacebookCollectorCommandError {
  readonly code: string;
  readonly message: string;
  readonly causeCode?: string;
  readonly statusCode?: number;
}

interface FacebookCollectorBuiltDependencies {
  readonly useCaseDependencies: RunFacebookGroupCollectionUseCaseDependencies;
  readonly sourceGroupResolver: FacebookCollectorSourceGroupResolver;
  readonly checkoutDiagnosticsPort: FacebookCollectorCheckoutDiagnosticsPort;
}

type SourceGroupPreflightResult =
  | {
      readonly ok: true;
      readonly sourceGroupUrl: string;
    }
  | {
      readonly ok: false;
      readonly error: FacebookCollectorCommandError;
    };

const CHECKOUT_DIAGNOSTIC_STATUSES = [
  "READY",
  "BUSY",
  "PENDING_LOGIN",
  "PENDING_CONFIG",
] as const;

const NO_ELIGIBLE_PROFILE_HINTS = [
  "No profile is READY in this API/database.",
  "The current time may be outside a profile temporal routine.",
  "Cooldown or safety thresholds may block checkout.",
  "A profile may already be leased or BUSY.",
  "The base URL may point to a different stack than the Web UI.",
];

const NOOP_LOGGER: FacebookCollectorLogger = {
  info() {},
};

export async function runFacebookCollectorCommand(
  input: RunFacebookCollectorCommandInput,
): Promise<FacebookCollectorCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const startedAt = (input.now ?? (() => new Date()))();
  const dependencies = buildDependencies(input);
  const useCase = new RunFacebookGroupCollectionUseCase(
    dependencies.useCaseDependencies,
  );

  logger.info("Starting manual Facebook group collection run.");
  logger.info(`Using Content Manager source group id ${input.args.sourceGroupId}.`);

  const sourceGroupPreflight = await resolveSourceGroupForRun(
    input.args,
    dependencies.sourceGroupResolver,
  );

  if (!sourceGroupPreflight.ok) {
    const commandResult = createFailureCommandResult(
      input.args.sourceGroupId,
      getDurationMs(startedAt),
      sourceGroupPreflight.error,
    );

    logSafeSummary(logger, commandResult);

    return commandResult;
  }

  logger.info("Resolved source group from Content Manager.");

  if (input.args.groupUrl !== undefined) {
    logWarning(
      logger,
      "Warning: --group-url is a development override and will replace the stored source group URL for this run.",
    );
  }

  if (input.args.diagnoseCheckout) {
    await logCheckoutDiagnostics(logger, dependencies.checkoutDiagnosticsPort);
  }

  const result = await useCase.execute({
    sourceGroupId: input.args.sourceGroupId,
    sourceGroupUrl: sourceGroupPreflight.sourceGroupUrl,
  });
  const durationMs = getDurationMs(startedAt);
  const commandResult = toCommandResult(input.args.sourceGroupId, result, durationMs);

  logSafeSummary(logger, commandResult);
  logNoEligibleProfileHints(logger, commandResult);

  return commandResult;
}

function buildDependencies(
  input: RunFacebookCollectorCommandInput,
): FacebookCollectorBuiltDependencies {
  const defaultProfileManagerClient = new ProfileManagerHttpClient({
    baseUrl: input.args.baseUrl,
  });
  const defaultContentManagerClient = new ContentManagerHttpClient({
    baseUrl: input.args.baseUrl,
  });
  const profileManagerClient =
    input.dependencies?.profileLeasePort ?? defaultProfileManagerClient;
  const contentManagerClient =
    input.dependencies?.submitCapturedPayloadUseCase ??
    new SubmitCapturedFacebookPayloadUseCase({
      contentSubmissionPort: defaultContentManagerClient,
    });
  const browserProviderResolution = resolveBrowserProvider({
    browserProvider: input.args.browserProvider,
  });

  if (!browserProviderResolution.ok) {
    throw new Error(browserProviderResolution.message);
  }

  const payloadCapturePort =
    input.dependencies?.payloadCapturePort ??
    new FacebookBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: defaultProfileManagerClient,
      browserProvider: browserProviderResolution.provider,
      maxScrolls: input.args.maxScrolls,
      maxDurationMs: input.args.maxDurationMs,
      ...(input.abortSignal !== undefined
        ? { abortSignal: input.abortSignal }
        : {}),
    });

  return {
    useCaseDependencies: {
      profileLeasePort: profileManagerClient,
      payloadCapturePort,
      submitCapturedPayloadUseCase: contentManagerClient,
    },
    sourceGroupResolver:
      input.dependencies?.sourceGroupResolver ?? defaultContentManagerClient,
    checkoutDiagnosticsPort:
      input.dependencies?.checkoutDiagnosticsPort ?? defaultProfileManagerClient,
  };
}

async function resolveSourceGroupForRun(
  args: FacebookCollectorCliArgs,
  resolver: FacebookCollectorSourceGroupResolver,
): Promise<SourceGroupPreflightResult> {
  let lookupResult: ContentManagerSourceGroupLookupResult;

  try {
    lookupResult = await resolver.getSourceGroup(args.sourceGroupId);
  } catch {
    return {
      ok: false,
      error: {
        code: "SOURCE_GROUP_RESOLUTION_FAILED",
        message: "Could not resolve the source group from Content Manager.",
      },
    };
  }

  if (!lookupResult.ok) {
    return {
      ok: false,
      error: toSourceGroupLookupError(args.sourceGroupId, lookupResult),
    };
  }

  const validationError = validateResolvedSourceGroup(
    args.sourceGroupId,
    lookupResult.sourceGroup,
  );

  if (validationError !== undefined) {
    return {
      ok: false,
      error: validationError,
    };
  }

  const storedSourceGroupUrl = normalizeFacebookGroupUrl(
    lookupResult.sourceGroup.url,
    "source group URL",
  );

  return {
    ok: true,
    sourceGroupUrl: args.groupUrl ?? storedSourceGroupUrl,
  };
}

function toSourceGroupLookupError(
  sourceGroupId: string,
  lookupResult: Extract<ContentManagerSourceGroupLookupResult, { ok: false }>,
): FacebookCollectorCommandError {
  const context = {
    ...(lookupResult.errorCode !== undefined
      ? { causeCode: lookupResult.errorCode }
      : {}),
    ...(lookupResult.statusCode !== undefined
      ? { statusCode: lookupResult.statusCode }
      : {}),
  };

  if (
    lookupResult.errorCode === "SOURCE_GROUP_NOT_FOUND" ||
    lookupResult.statusCode === 404
  ) {
    return {
      code: "SOURCE_GROUP_NOT_FOUND",
      message: `Source group not found for sourceGroupId ${sourceGroupId}.`,
      ...context,
    };
  }

  return {
    code: "SOURCE_GROUP_RESOLUTION_FAILED",
    message: "Could not resolve the source group from Content Manager.",
    ...context,
  };
}

function validateResolvedSourceGroup(
  sourceGroupId: string,
  sourceGroup: ContentManagerSourceGroup,
): FacebookCollectorCommandError | undefined {
  if (sourceGroup.id !== sourceGroupId) {
    return {
      code: "SOURCE_GROUP_RESOLUTION_FAILED",
      message: "Content Manager returned a different source group id.",
    };
  }

  if (sourceGroup.platform !== "FACEBOOK") {
    return {
      code: "SOURCE_GROUP_PLATFORM_UNSUPPORTED",
      message: `Source group ${sourceGroupId} must use platform FACEBOOK.`,
    };
  }

  if (sourceGroup.status !== "ACTIVE") {
    return {
      code: "SOURCE_GROUP_NOT_ACTIVE",
      message: `Source group ${sourceGroupId} must be ACTIVE before collection.`,
    };
  }

  if (sourceGroup.url.trim().length === 0) {
    return {
      code: "SOURCE_GROUP_URL_MISSING",
      message: `Source group ${sourceGroupId} does not have a source URL.`,
    };
  }

  try {
    normalizeFacebookGroupUrl(sourceGroup.url, "source group URL");
  } catch (error) {
    return {
      code: "SOURCE_GROUP_URL_INVALID",
      message:
        error instanceof Error
          ? error.message
          : `Source group ${sourceGroupId} has an invalid source URL.`,
    };
  }

  return undefined;
}

function toCommandResult(
  sourceGroupId: string,
  result: RunFacebookGroupCollectionResult,
  durationMs: number,
): FacebookCollectorCommandResult {
  const captureDiagnostics = result.captureDiagnostics;

  return {
    ok: result.ok,
    sourceGroupId,
    leaseReleased: result.leaseReleased,
    capturedGraphQLResponseCount: result.capturedPayloadCount,
    pageContextFetchCaptureCount:
      captureDiagnostics?.pageContextFetchCaptureCount ?? 0,
    pageContextXhrCaptureCount:
      captureDiagnostics?.pageContextXhrCaptureCount ?? 0,
    networkListenerCaptureCount:
      captureDiagnostics?.networkListenerCaptureCount ?? 0,
    captureParseFailureCount: captureDiagnostics?.parseFailureCount ?? 0,
    totalPayloadsPassedToExtractor:
      captureDiagnostics?.totalPayloadsPassedToExtractor ??
      result.capturedPayloadCount,
    ...(captureDiagnostics?.finalPageUrl !== undefined
      ? { finalPageUrl: captureDiagnostics.finalPageUrl }
      : {}),
    loginRedirectSuspected: captureDiagnostics?.loginRedirectSuspected ?? false,
    extractedCandidateCount: result.extractedCandidateCount,
    submittedContentItemCount: result.submittedCount,
    failedSubmissionCount: result.failedSubmissionCount,
    warningCount: result.warnings.length,
    durationMs,
    errors: result.errors.map((error) => ({
      code: error.code,
      message: error.message,
      ...(error.causeCode !== undefined ? { causeCode: error.causeCode } : {}),
      ...(error.statusCode !== undefined ? { statusCode: error.statusCode } : {}),
    })),
  };
}

function createFailureCommandResult(
  sourceGroupId: string,
  durationMs: number,
  error: FacebookCollectorCommandError,
): FacebookCollectorCommandResult {
  return {
    ok: false,
    sourceGroupId,
    leaseReleased: false,
    capturedGraphQLResponseCount: 0,
    pageContextFetchCaptureCount: 0,
    pageContextXhrCaptureCount: 0,
    networkListenerCaptureCount: 0,
    captureParseFailureCount: 0,
    totalPayloadsPassedToExtractor: 0,
    loginRedirectSuspected: false,
    extractedCandidateCount: 0,
    submittedContentItemCount: 0,
    failedSubmissionCount: 0,
    warningCount: 0,
    durationMs,
    errors: [error],
  };
}

async function logCheckoutDiagnostics(
  logger: FacebookCollectorLogger,
  diagnosticsPort: FacebookCollectorCheckoutDiagnosticsPort,
): Promise<void> {
  const result = await diagnosticsPort.getSafeProfileStatusCounts();

  if (!result.ok) {
    const details = [
      result.errorCode !== undefined ? `code ${result.errorCode}` : undefined,
      result.statusCode !== undefined ? `status ${result.statusCode}` : undefined,
    ].filter((detail): detail is string => detail !== undefined);
    const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";

    logWarning(logger, `Checkout diagnostics unavailable${suffix}.`);
    return;
  }

  logProfileStatusCounts(logger, result.counts);
}

function logProfileStatusCounts(
  logger: FacebookCollectorLogger,
  counts: SafeProfileStatusCounts,
): void {
  logger.info("Checkout diagnostics:");
  logger.info(`- Total profiles: ${counts.total}`);

  for (const status of CHECKOUT_DIAGNOSTIC_STATUSES) {
    logger.info(`- ${status}: ${counts[status]}`);
  }
}

function logNoEligibleProfileHints(
  logger: FacebookCollectorLogger,
  result: FacebookCollectorCommandResult,
): void {
  if (!hasNoEligibleProfileError(result)) {
    return;
  }

  logWarning(
    logger,
    "Checkout troubleshooting hints for NO_ELIGIBLE_PROFILE_AVAILABLE:",
  );

  for (const hint of NO_ELIGIBLE_PROFILE_HINTS) {
    logWarning(logger, `- ${hint}`);
  }
}

function hasNoEligibleProfileError(
  result: FacebookCollectorCommandResult,
): boolean {
  return result.errors.some(
    (error) =>
      error.code === "PROFILE_CHECKOUT_FAILED" &&
      error.causeCode === "NO_ELIGIBLE_PROFILE_AVAILABLE",
  );
}

function logWarning(logger: FacebookCollectorLogger, message: string): void {
  if (logger.warn !== undefined) {
    logger.warn(message);
    return;
  }

  logger.info(message);
}

function getDurationMs(startedAt: Date): number {
  return Math.max(0, Date.now() - startedAt.getTime());
}

function logSafeSummary(
  logger: FacebookCollectorLogger,
  result: FacebookCollectorCommandResult,
): void {
  logger.info("Facebook collection summary:");
  logger.info(`- Source group id: ${result.sourceGroupId}`);
  logger.info(`- Lease released: ${result.leaseReleased ? "yes" : "no"}`);
  logger.info(
    `- GraphQL responses captured: ${result.capturedGraphQLResponseCount}`,
  );
  logger.info(
    `- Page-context fetch captures: ${result.pageContextFetchCaptureCount}`,
  );
  logger.info(`- Page-context XHR captures: ${result.pageContextXhrCaptureCount}`);
  logger.info(`- Network listener captures: ${result.networkListenerCaptureCount}`);
  logger.info(`- Capture parse failures: ${result.captureParseFailureCount}`);
  logger.info(
    `- Payloads passed to extractor: ${result.totalPayloadsPassedToExtractor}`,
  );
  logger.info(`- Final page URL: ${result.finalPageUrl ?? "unavailable"}`);
  logger.info(
    `- Login redirect suspected: ${
      result.loginRedirectSuspected ? "yes" : "no"
    }`,
  );
  logger.info(`- Extractor candidates produced: ${result.extractedCandidateCount}`);
  logger.info(`- Content items submitted: ${result.submittedContentItemCount}`);
  logger.info(`- Failed submissions: ${result.failedSubmissionCount}`);
  logger.info(`- Warnings: ${result.warningCount}`);
  logger.info(`- Duration ms: ${result.durationMs}`);

  if (!result.ok) {
    for (const error of result.errors) {
      const details = [
        error.causeCode !== undefined ? `cause ${error.causeCode}` : undefined,
        error.statusCode !== undefined ? `status ${error.statusCode}` : undefined,
      ].filter((detail): detail is string => detail !== undefined);
      const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";

      logger.error?.(`- Error ${error.code}${suffix}.`);
    }
  }
}
