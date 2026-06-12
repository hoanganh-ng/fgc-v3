import type {
  CollectionRunExecutorInput,
  CollectionRunExecutorPort,
  CollectionRunExecutorResult,
} from "../../collector-runtime/application";
import {
  DEFAULT_FACEBOOK_COLLECTOR_MAX_DURATION_MS,
  DEFAULT_FACEBOOK_COLLECTOR_MAX_SCROLLS,
} from "../facebook-collector/cli-args";
import {
  runFacebookCollectorCommand,
  type FacebookCollectorCommandError,
  type FacebookCollectorCommandResult,
  type FacebookCollectorLogger,
  type RunFacebookCollectorCommandInput,
} from "../facebook-collector/collector-runner";

export interface FacebookCollectionRunExecutorOptions {
  readonly baseUrl: string;
  readonly logger?: FacebookCollectorLogger;
  readonly abortSignal?: AbortSignal;
  readonly runCommand?: (
    input: RunFacebookCollectorCommandInput,
  ) => Promise<FacebookCollectorCommandResult>;
}

export class FacebookCollectionRunExecutor implements CollectionRunExecutorPort {
  public constructor(
    private readonly options: FacebookCollectionRunExecutorOptions,
  ) {}

  public async execute(
    input: CollectionRunExecutorInput,
  ): Promise<CollectionRunExecutorResult> {
    const runCommand =
      this.options.runCommand ?? runFacebookCollectorCommand;
    const result = await runCommand({
      args: {
        sourceGroupId: input.sourceGroupId,
        baseUrl: this.options.baseUrl,
        maxScrolls:
          input.parameters.maxScrolls ?? DEFAULT_FACEBOOK_COLLECTOR_MAX_SCROLLS,
        maxDurationMs:
          input.parameters.maxDurationMs ??
          DEFAULT_FACEBOOK_COLLECTOR_MAX_DURATION_MS,
        diagnoseCheckout: false,
      },
      ...(this.options.logger !== undefined
        ? { logger: this.options.logger }
        : {}),
      ...(this.options.abortSignal !== undefined
        ? { abortSignal: this.options.abortSignal }
        : {}),
    });
    const summary = {
      capturedPayloads: result.capturedGraphQLResponseCount,
      extractorCandidates: result.extractedCandidateCount,
      contentItemsSubmitted: result.submittedContentItemCount,
      failedSubmissions: result.failedSubmissionCount,
      leaseReleased: result.leaseReleased,
    };

    if (result.ok) {
      return {
        ok: true,
        summary,
      };
    }

    return {
      ok: false,
      summary,
      failureReason: toSanitizedFailureReason(result.errors[0]),
    };
  }
}

function toSanitizedFailureReason(
  error: FacebookCollectorCommandError | undefined,
): {
  readonly code: string;
  readonly message: string;
} {
  const code = sanitizeFailureCode(error?.code);

  return {
    code,
    message: getSafeFailureMessage(code),
  };
}

function sanitizeFailureCode(code: string | undefined): string {
  const normalizedCode = code?.trim().toUpperCase();

  if (
    normalizedCode !== undefined &&
    /^[A-Z0-9_]+$/.test(normalizedCode) &&
    normalizedCode.length <= 80
  ) {
    return normalizedCode;
  }

  return "COLLECTION_RUN_FAILED";
}

function getSafeFailureMessage(code: string): string {
  switch (code) {
    case "SOURCE_GROUP_NOT_FOUND":
      return "Source group was not found.";
    case "SOURCE_GROUP_NOT_ACTIVE":
      return "Source group must be ACTIVE before collection.";
    case "SOURCE_GROUP_PLATFORM_UNSUPPORTED":
      return "Source group platform is not supported for collection.";
    case "SOURCE_GROUP_URL_MISSING":
      return "Source group does not have a source URL.";
    case "SOURCE_GROUP_URL_INVALID":
      return "Source group has an invalid Facebook group URL.";
    case "SOURCE_GROUP_RESOLUTION_FAILED":
      return "Source group could not be resolved.";
    case "PROFILE_CHECKOUT_FAILED":
      return "Profile checkout failed.";
    case "FACEBOOK_PAYLOAD_CAPTURE_FAILED":
      return "Facebook payload capture failed.";
    case "CONTENT_SUBMISSION_FAILED":
      return "Content submission failed.";
    case "PROFILE_LEASE_RELEASE_FAILED":
      return "Profile lease release failed.";
    default:
      return "Collection run failed.";
  }
}
