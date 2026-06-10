import {
  ContentManagerHttpClient,
  PlaywrightFacebookBrowserPayloadCaptureAdapter,
  ProfileManagerHttpClient,
} from "../../collector-runtime/infrastructure";
import {
  RunFacebookGroupCollectionUseCase,
  SubmitCapturedFacebookPayloadUseCase,
} from "../../collector-runtime/application";
import type {
  RunFacebookGroupCollectionResult,
  RunFacebookGroupCollectionUseCaseDependencies,
} from "../../collector-runtime/application";
import type { FacebookCollectorCliArgs } from "./cli-args";

export interface FacebookCollectorLogger {
  info(message: string): void;
  warn?(message: string): void;
  error?(message: string): void;
}

export interface RunFacebookCollectorCommandInput {
  readonly args: FacebookCollectorCliArgs;
  readonly logger?: FacebookCollectorLogger;
  readonly abortSignal?: AbortSignal;
  readonly dependencies?: Partial<RunFacebookGroupCollectionUseCaseDependencies>;
  readonly now?: () => Date;
}

export interface FacebookCollectorCommandResult {
  readonly ok: boolean;
  readonly sourceGroupId: string;
  readonly leaseReleased: boolean;
  readonly capturedGraphQLResponseCount: number;
  readonly extractedCandidateCount: number;
  readonly submittedContentItemCount: number;
  readonly failedSubmissionCount: number;
  readonly warningCount: number;
  readonly durationMs: number;
  readonly errors: readonly {
    readonly code: string;
    readonly message: string;
    readonly causeCode?: string;
    readonly statusCode?: number;
  }[];
}

const NOOP_LOGGER: FacebookCollectorLogger = {
  info() {},
};

export async function runFacebookCollectorCommand(
  input: RunFacebookCollectorCommandInput,
): Promise<FacebookCollectorCommandResult> {
  const logger = input.logger ?? NOOP_LOGGER;
  const startedAt = (input.now ?? (() => new Date()))();
  const useCase = new RunFacebookGroupCollectionUseCase(
    buildDependencies(input),
  );

  logger.info("Starting manual Facebook group collection run.");
  logger.info(`Using Content Manager source group id ${input.args.sourceGroupId}.`);

  const result = await useCase.execute({
    sourceGroupId: input.args.sourceGroupId,
    sourceGroupUrl: input.args.groupUrl,
  });
  const durationMs = Math.max(0, Date.now() - startedAt.getTime());
  const commandResult = toCommandResult(input.args.sourceGroupId, result, durationMs);

  logSafeSummary(logger, commandResult);

  return commandResult;
}

function buildDependencies(
  input: RunFacebookCollectorCommandInput,
): RunFacebookGroupCollectionUseCaseDependencies {
  const defaultProfileManagerClient = new ProfileManagerHttpClient({
    baseUrl: input.args.baseUrl,
  });
  const profileManagerClient =
    input.dependencies?.profileLeasePort ?? defaultProfileManagerClient;
  const contentManagerClient =
    input.dependencies?.submitCapturedPayloadUseCase ??
    new SubmitCapturedFacebookPayloadUseCase({
      contentSubmissionPort: new ContentManagerHttpClient({
        baseUrl: input.args.baseUrl,
      }),
    });
  const payloadCapturePort =
    input.dependencies?.payloadCapturePort ??
    new PlaywrightFacebookBrowserPayloadCaptureAdapter({
      runtimeProfileConfigurationPort: defaultProfileManagerClient,
      maxScrolls: input.args.maxScrolls,
      maxDurationMs: input.args.maxDurationMs,
      ...(input.abortSignal !== undefined
        ? { abortSignal: input.abortSignal }
        : {}),
    });

  return {
    profileLeasePort: profileManagerClient,
    payloadCapturePort,
    submitCapturedPayloadUseCase: contentManagerClient,
  };
}

function toCommandResult(
  sourceGroupId: string,
  result: RunFacebookGroupCollectionResult,
  durationMs: number,
): FacebookCollectorCommandResult {
  return {
    ok: result.ok,
    sourceGroupId,
    leaseReleased: result.leaseReleased,
    capturedGraphQLResponseCount: result.capturedPayloadCount,
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
