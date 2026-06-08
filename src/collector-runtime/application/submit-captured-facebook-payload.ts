import {
  FacebookGraphQLPayloadExtractor,
} from "../platform-extractors/facebook";
import type {
  FacebookExtractedContentCandidate,
  FacebookExtractedTopComment,
  FacebookGraphQLPayloadExtractorOptions,
} from "../platform-extractors/facebook";
import { createSubmissionPortErrorResult } from "./collector-runtime.errors";
import type {
  CollectedContentSubmissionInput,
  CollectedContentTopCommentSubmissionInput,
  ContentManagerContentSubmissionPort,
  ContentSubmissionResult,
  SubmitCapturedFacebookPayloadInput,
  SubmitCapturedFacebookPayloadResult,
  SubmitCapturedFacebookPayloadSubmission,
} from "./collector-runtime.types";

interface FacebookPayloadExtractor {
  extract(
    input: SubmitCapturedFacebookPayloadInput,
    options?: FacebookGraphQLPayloadExtractorOptions,
  ): ReturnType<FacebookGraphQLPayloadExtractor["extract"]>;
}

export interface SubmitCapturedFacebookPayloadUseCaseDependencies {
  readonly contentSubmissionPort: ContentManagerContentSubmissionPort;
  readonly extractor?: FacebookPayloadExtractor;
  readonly extractorOptions?: FacebookGraphQLPayloadExtractorOptions;
}

export class SubmitCapturedFacebookPayloadUseCase {
  private readonly contentSubmissionPort: ContentManagerContentSubmissionPort;
  private readonly extractor: FacebookPayloadExtractor;
  private readonly extractorOptions: FacebookGraphQLPayloadExtractorOptions;

  public constructor(
    dependencies: SubmitCapturedFacebookPayloadUseCaseDependencies,
  ) {
    this.contentSubmissionPort = dependencies.contentSubmissionPort;
    this.extractor =
      dependencies.extractor ?? new FacebookGraphQLPayloadExtractor();
    this.extractorOptions = dependencies.extractorOptions ?? {};
  }

  public async execute(
    input: SubmitCapturedFacebookPayloadInput,
  ): Promise<SubmitCapturedFacebookPayloadResult> {
    const extractionResult = this.extractor.extract(input, this.extractorOptions);

    if (!extractionResult.valid) {
      return {
        ok: false,
        extractedCandidateCount: 0,
        submittedCount: 0,
        failedSubmissionCount: 0,
        issues: extractionResult.issues,
      };
    }

    const submissions: SubmitCapturedFacebookPayloadSubmission[] = [];

    for (const candidate of extractionResult.candidates) {
      const submissionInput = toCollectedContentSubmissionInput(candidate);
      const submissionResult = await this.submitCandidate(submissionInput);

      submissions.push(toSubmissionSummary(candidate, submissionResult));
    }

    const submittedCount = submissions.filter((submission) => submission.ok).length;
    const failedSubmissionCount = submissions.length - submittedCount;

    return {
      ok: true,
      extractedCandidateCount: extractionResult.candidates.length,
      submittedCount,
      failedSubmissionCount,
      warnings: extractionResult.warnings,
      submissions,
    };
  }

  private async submitCandidate(
    input: CollectedContentSubmissionInput,
  ): Promise<ContentSubmissionResult> {
    try {
      return await this.contentSubmissionPort.submitCollectedContent(input);
    } catch (error) {
      return createSubmissionPortErrorResult(error);
    }
  }
}

function toCollectedContentSubmissionInput(
  candidate: FacebookExtractedContentCandidate,
): CollectedContentSubmissionInput {
  return {
    platform: candidate.platform,
    sourceGroupId: candidate.sourceGroupId,
    externalPostId: candidate.externalPostId,
    sourceUrl: candidate.sourceUrl,
    ...(candidate.title !== undefined ? { title: candidate.title } : {}),
    bodyText: candidate.bodyText,
    ...(candidate.authorDisplayName !== undefined
      ? { authorDisplayName: candidate.authorDisplayName }
      : {}),
    ...(candidate.authorExternalId !== undefined
      ? { authorExternalId: candidate.authorExternalId }
      : {}),
    ...(candidate.postedAt !== undefined ? { postedAt: candidate.postedAt } : {}),
    collectedAt: candidate.collectedAt,
    reactionCount: candidate.reactionCount,
    commentCount: candidate.commentCount,
    ...(candidate.shareCount !== undefined
      ? { shareCount: candidate.shareCount }
      : {}),
    topComments: candidate.topComments.map(toTopCommentSubmissionInput),
    ...(candidate.rawPayloadRef !== undefined
      ? { rawPayloadRef: candidate.rawPayloadRef }
      : {}),
  };
}

function toTopCommentSubmissionInput(
  comment: FacebookExtractedTopComment,
): CollectedContentTopCommentSubmissionInput {
  return {
    externalCommentId: comment.externalCommentId,
    bodyText: comment.bodyText,
    ...(comment.authorDisplayName !== undefined
      ? { authorDisplayName: comment.authorDisplayName }
      : {}),
    ...(comment.authorExternalId !== undefined
      ? { authorExternalId: comment.authorExternalId }
      : {}),
    reactionCount: comment.reactionCount,
    ...(comment.replyCount !== undefined ? { replyCount: comment.replyCount } : {}),
    ...(comment.postedAt !== undefined ? { postedAt: comment.postedAt } : {}),
    collectedAt: comment.collectedAt,
  };
}

function toSubmissionSummary(
  candidate: FacebookExtractedContentCandidate,
  result: ContentSubmissionResult,
): SubmitCapturedFacebookPayloadSubmission {
  if (result.ok) {
    return {
      externalPostId: candidate.externalPostId,
      ok: true,
      ...(result.statusCode !== undefined ? { statusCode: result.statusCode } : {}),
      ...(result.contentItemId !== undefined
        ? { contentItemId: result.contentItemId }
        : {}),
    };
  }

  return {
    externalPostId: candidate.externalPostId,
    ok: false,
    ...(result.statusCode !== undefined ? { statusCode: result.statusCode } : {}),
    errorCode: result.errorCode,
    errorMessage: result.errorMessage,
  };
}

