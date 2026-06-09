import {
  createCollectorRuntimeError,
  errorToMessage,
} from "./collector-runtime.errors";
import type {
  CollectorRuntimeError,
} from "./collector-runtime.errors";
import type {
  CapturedFacebookPayload,
  CapturedFacebookPayloadSubmissionUseCase,
  CollectorRuntimeWarning,
  FacebookGroupPayloadCapturePort,
  FacebookPayloadCaptureResult,
  ProfileCheckoutResult,
  ProfileLeasePort,
  ProfileLeaseReleaseResult,
} from "./collector-runtime.ports";
import type {
  CollectorRuntimeIsoDateTime,
  SubmitCapturedFacebookPayloadResult,
  SubmitCapturedFacebookPayloadSubmission,
} from "./collector-runtime.types";
import type {
  FacebookExtractionIssue,
  FacebookExtractionWarning,
} from "../platform-extractors/facebook";

const DEFAULT_CHECKOUT_PURPOSE = "FACEBOOK_GROUP_COLLECTION";

export interface RunFacebookGroupCollectionInput {
  readonly sourceGroupId: string;
  readonly sourceGroupUrl: string;
  readonly checkoutPurpose?: string;
}

export interface RunFacebookGroupCollectionWarning {
  readonly source: "PAYLOAD_CAPTURE" | "PAYLOAD_EXTRACTION";
  readonly code: string;
  readonly message: string;
  readonly payloadIndex?: number;
  readonly path?: string;
}

export interface RunFacebookGroupCollectionPayloadResult {
  readonly payloadIndex: number;
  readonly ok: boolean;
  readonly capturedAt: CollectorRuntimeIsoDateTime;
  readonly sourceUrlHint?: string;
  readonly extractedCandidateCount: number;
  readonly submittedCount: number;
  readonly failedSubmissionCount: number;
  readonly warnings: readonly RunFacebookGroupCollectionWarning[];
  readonly issues: readonly FacebookExtractionIssue[];
  readonly submissions: readonly SubmitCapturedFacebookPayloadSubmission[];
}

export interface RunFacebookGroupCollectionResult {
  readonly ok: boolean;
  readonly profileId?: string;
  readonly leaseId?: string;
  readonly capturedPayloadCount: number;
  readonly extractedCandidateCount: number;
  readonly submittedCount: number;
  readonly failedSubmissionCount: number;
  readonly warnings: readonly RunFacebookGroupCollectionWarning[];
  readonly errors: readonly CollectorRuntimeError[];
  readonly payloadResults: readonly RunFacebookGroupCollectionPayloadResult[];
  readonly leaseReleased: boolean;
  readonly leaseReleaseError?: CollectorRuntimeError;
}

export interface RunFacebookGroupCollectionUseCaseDependencies {
  readonly profileLeasePort: ProfileLeasePort;
  readonly payloadCapturePort: FacebookGroupPayloadCapturePort;
  readonly submitCapturedPayloadUseCase: CapturedFacebookPayloadSubmissionUseCase;
}

interface CollectionAccumulator {
  readonly profileId: string;
  readonly leaseId: string;
  capturedPayloadCount: number;
  extractedCandidateCount: number;
  submittedCount: number;
  failedSubmissionCount: number;
  leaseReleased: boolean;
  leaseReleaseError?: CollectorRuntimeError;
  readonly warnings: RunFacebookGroupCollectionWarning[];
  readonly errors: CollectorRuntimeError[];
  readonly payloadResults: RunFacebookGroupCollectionPayloadResult[];
}

interface PayloadProcessingResult {
  readonly payloadResult: RunFacebookGroupCollectionPayloadResult;
  readonly errors: readonly CollectorRuntimeError[];
}

export class RunFacebookGroupCollectionUseCase {
  private readonly profileLeasePort: ProfileLeasePort;
  private readonly payloadCapturePort: FacebookGroupPayloadCapturePort;
  private readonly submitCapturedPayloadUseCase: CapturedFacebookPayloadSubmissionUseCase;

  public constructor(
    dependencies: RunFacebookGroupCollectionUseCaseDependencies,
  ) {
    this.profileLeasePort = dependencies.profileLeasePort;
    this.payloadCapturePort = dependencies.payloadCapturePort;
    this.submitCapturedPayloadUseCase =
      dependencies.submitCapturedPayloadUseCase;
  }

  public async execute(
    input: RunFacebookGroupCollectionInput,
  ): Promise<RunFacebookGroupCollectionResult> {
    const checkoutResult = await this.checkoutProfile(input);

    if (!checkoutResult.ok) {
      return createCheckoutFailureResult(checkoutResult);
    }

    const accumulator: CollectionAccumulator = {
      profileId: checkoutResult.profileId,
      leaseId: checkoutResult.leaseId,
      capturedPayloadCount: 0,
      extractedCandidateCount: 0,
      submittedCount: 0,
      failedSubmissionCount: 0,
      leaseReleased: false,
      warnings: [],
      errors: [],
      payloadResults: [],
    };

    const captureResult = await this.capturePayloads(input, checkoutResult);

    if (!captureResult.ok) {
      accumulator.warnings.push(
        ...captureResult.warnings.map((warning) =>
          toCollectionWarning("PAYLOAD_CAPTURE", warning),
        ),
      );
      accumulator.errors.push(
        createCollectorRuntimeError(
          "FACEBOOK_PAYLOAD_CAPTURE_FAILED",
          captureResult.errorMessage,
          { causeCode: captureResult.errorCode },
        ),
      );

      await this.releaseLease(accumulator);

      return toCollectionResult(accumulator);
    }

    accumulator.capturedPayloadCount = captureResult.capturedPayloads.length;
    accumulator.warnings.push(
      ...captureResult.warnings.map((warning) =>
        toCollectionWarning("PAYLOAD_CAPTURE", warning),
      ),
    );

    for (const [payloadIndex, capturedPayload] of captureResult.capturedPayloads.entries()) {
      const payloadProcessingResult = await this.submitCapturedPayload(
        input.sourceGroupId,
        payloadIndex,
        capturedPayload,
      );
      const payloadResult = payloadProcessingResult.payloadResult;

      accumulator.payloadResults.push(payloadResult);
      accumulator.extractedCandidateCount += payloadResult.extractedCandidateCount;
      accumulator.submittedCount += payloadResult.submittedCount;
      accumulator.failedSubmissionCount += payloadResult.failedSubmissionCount;
      accumulator.warnings.push(...payloadResult.warnings);
      accumulator.errors.push(...payloadProcessingResult.errors);
    }

    await this.releaseLease(accumulator);

    return toCollectionResult(accumulator);
  }

  private async checkoutProfile(
    input: RunFacebookGroupCollectionInput,
  ): Promise<ProfileCheckoutResult> {
    try {
      return await this.profileLeasePort.checkoutProfile({
        sourceGroupId: input.sourceGroupId,
        purpose: input.checkoutPurpose ?? DEFAULT_CHECKOUT_PURPOSE,
      });
    } catch (error) {
      return {
        ok: false,
        errorCode: "PROFILE_CHECKOUT_PORT_ERROR",
        errorMessage: errorToMessage(error),
      };
    }
  }

  private async capturePayloads(
    input: RunFacebookGroupCollectionInput,
    checkoutResult: Extract<ProfileCheckoutResult, { readonly ok: true }>,
  ): Promise<FacebookPayloadCaptureResult> {
    try {
      return await this.payloadCapturePort.captureGroupPayloads({
        sourceGroupId: input.sourceGroupId,
        sourceGroupUrl: input.sourceGroupUrl,
        profileId: checkoutResult.profileId,
        leaseId: checkoutResult.leaseId,
      });
    } catch (error) {
      return {
        ok: false,
        errorCode: "FACEBOOK_PAYLOAD_CAPTURE_PORT_ERROR",
        errorMessage: errorToMessage(error),
        warnings: [],
      };
    }
  }

  private async submitCapturedPayload(
    sourceGroupId: string,
    payloadIndex: number,
    capturedPayload: CapturedFacebookPayload,
  ): Promise<PayloadProcessingResult> {
    try {
      const result = await this.submitCapturedPayloadUseCase.execute({
        sourceGroupId,
        capturedAt: capturedPayload.capturedAt,
        payload: capturedPayload.payload,
        ...(capturedPayload.sourceUrlHint !== undefined
          ? { sourceUrlHint: capturedPayload.sourceUrlHint }
          : {}),
      });
      const payloadResult = toPayloadResult(payloadIndex, capturedPayload, result);

      return {
        payloadResult,
        errors: toPayloadErrors(payloadResult),
      };
    } catch (error) {
      const payloadResult: RunFacebookGroupCollectionPayloadResult = {
        payloadIndex,
        ok: false,
        capturedAt: toCapturedAtSummary(capturedPayload.capturedAt),
        ...(capturedPayload.sourceUrlHint !== undefined
          ? { sourceUrlHint: capturedPayload.sourceUrlHint }
          : {}),
        extractedCandidateCount: 0,
        submittedCount: 0,
        failedSubmissionCount: 0,
        warnings: [],
        issues: [],
        submissions: [],
      };

      return {
        payloadResult,
        errors: [
          createCollectorRuntimeError(
            "CONTENT_SUBMISSION_FAILED",
            errorToMessage(error),
            {
              causeCode: "SUBMISSION_USE_CASE_ERROR",
              payloadIndex,
            },
          ),
        ],
      };
    }
  }

  private async releaseLease(
    accumulator: CollectionAccumulator,
  ): Promise<void> {
    const releaseResult = await this.releaseProfileLease(
      accumulator.profileId,
      accumulator.leaseId,
    );

    if (releaseResult.ok) {
      accumulator.leaseReleased = true;
      return;
    }

    const leaseReleaseError = createCollectorRuntimeError(
      "PROFILE_LEASE_RELEASE_FAILED",
      releaseResult.errorMessage,
      {
        causeCode: releaseResult.errorCode,
        ...(releaseResult.statusCode !== undefined
          ? { statusCode: releaseResult.statusCode }
          : {}),
      },
    );

    accumulator.leaseReleaseError = leaseReleaseError;
    accumulator.errors.push(leaseReleaseError);
  }

  private async releaseProfileLease(
    profileId: string,
    leaseId: string,
  ): Promise<ProfileLeaseReleaseResult> {
    try {
      return await this.profileLeasePort.releaseProfileLease({
        profileId,
        leaseId,
      });
    } catch (error) {
      return {
        ok: false,
        errorCode: "PROFILE_LEASE_RELEASE_PORT_ERROR",
        errorMessage: errorToMessage(error),
      };
    }
  }
}

function createCheckoutFailureResult(
  checkoutResult: Extract<ProfileCheckoutResult, { readonly ok: false }>,
): RunFacebookGroupCollectionResult {
  return {
    ok: false,
    capturedPayloadCount: 0,
    extractedCandidateCount: 0,
    submittedCount: 0,
    failedSubmissionCount: 0,
    warnings: [],
    errors: [
      createCollectorRuntimeError(
        "PROFILE_CHECKOUT_FAILED",
        checkoutResult.errorMessage,
        {
          causeCode: checkoutResult.errorCode,
          ...(checkoutResult.statusCode !== undefined
            ? { statusCode: checkoutResult.statusCode }
            : {}),
        },
      ),
    ],
    payloadResults: [],
    leaseReleased: false,
  };
}

function toPayloadResult(
  payloadIndex: number,
  capturedPayload: CapturedFacebookPayload,
  result: SubmitCapturedFacebookPayloadResult,
): RunFacebookGroupCollectionPayloadResult {
  if (!result.ok) {
    return {
      payloadIndex,
      ok: false,
      capturedAt: toCapturedAtSummary(capturedPayload.capturedAt),
      ...(capturedPayload.sourceUrlHint !== undefined
        ? { sourceUrlHint: capturedPayload.sourceUrlHint }
        : {}),
      extractedCandidateCount: 0,
      submittedCount: 0,
      failedSubmissionCount: 0,
      warnings: [],
      issues: result.issues,
      submissions: [],
    };
  }

  const warnings = result.warnings.map((warning) =>
    toCollectionWarning("PAYLOAD_EXTRACTION", warning, payloadIndex),
  );

  return {
    payloadIndex,
    ok: result.failedSubmissionCount === 0,
    capturedAt: toCapturedAtSummary(capturedPayload.capturedAt),
    ...(capturedPayload.sourceUrlHint !== undefined
      ? { sourceUrlHint: capturedPayload.sourceUrlHint }
      : {}),
    extractedCandidateCount: result.extractedCandidateCount,
    submittedCount: result.submittedCount,
    failedSubmissionCount: result.failedSubmissionCount,
    warnings,
    issues: [],
    submissions: result.submissions,
  };
}

function toPayloadErrors(
  payloadResult: RunFacebookGroupCollectionPayloadResult,
): readonly CollectorRuntimeError[] {
  const extractionErrors = payloadResult.issues.map((issue) =>
    createCollectorRuntimeError(
      "FACEBOOK_PAYLOAD_EXTRACTION_FAILED",
      issue.message,
      {
        causeCode: issue.code,
        payloadIndex: payloadResult.payloadIndex,
        ...(issue.path !== undefined ? { path: issue.path } : {}),
      },
    ),
  );
  const submissionErrors = payloadResult.submissions.flatMap((submission) => {
    if (submission.ok) {
      return [];
    }

    return [
      createCollectorRuntimeError(
        "CONTENT_SUBMISSION_FAILED",
        submission.errorMessage,
        {
          causeCode: submission.errorCode,
          payloadIndex: payloadResult.payloadIndex,
          externalPostId: submission.externalPostId,
          ...(submission.statusCode !== undefined
            ? { statusCode: submission.statusCode }
            : {}),
        },
      ),
    ];
  });

  return [...extractionErrors, ...submissionErrors];
}

function toCapturedAtSummary(capturedAt: Date): CollectorRuntimeIsoDateTime {
  if (Number.isNaN(capturedAt.getTime())) {
    return "Invalid Date";
  }

  return capturedAt.toISOString();
}

function toCollectionWarning(
  source: RunFacebookGroupCollectionWarning["source"],
  warning: CollectorRuntimeWarning | FacebookExtractionWarning,
  payloadIndex?: number,
): RunFacebookGroupCollectionWarning {
  return {
    source,
    code: warning.code,
    message: warning.message,
    ...(payloadIndex !== undefined ? { payloadIndex } : {}),
    ...(warning.path !== undefined ? { path: warning.path } : {}),
  };
}

function toCollectionResult(
  accumulator: CollectionAccumulator,
): RunFacebookGroupCollectionResult {
  return {
    ok: accumulator.errors.length === 0,
    profileId: accumulator.profileId,
    leaseId: accumulator.leaseId,
    capturedPayloadCount: accumulator.capturedPayloadCount,
    extractedCandidateCount: accumulator.extractedCandidateCount,
    submittedCount: accumulator.submittedCount,
    failedSubmissionCount: accumulator.failedSubmissionCount,
    warnings: accumulator.warnings,
    errors: accumulator.errors,
    payloadResults: accumulator.payloadResults,
    leaseReleased: accumulator.leaseReleased,
    ...(accumulator.leaseReleaseError !== undefined
      ? { leaseReleaseError: accumulator.leaseReleaseError }
      : {}),
  };
}
