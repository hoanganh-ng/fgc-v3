import type {
  FacebookExtractionIssue,
  FacebookExtractionWarning,
} from "../platform-extractors/facebook";

export type CollectorRuntimeContentPlatform = "FACEBOOK";
export type CollectorRuntimeIsoDateTime = string;

export interface CollectedContentTopCommentSubmissionInput {
  readonly externalCommentId: string;
  readonly bodyText: string;
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
  readonly reactionCount: number;
  readonly replyCount?: number;
  readonly postedAt?: CollectorRuntimeIsoDateTime;
  readonly collectedAt: CollectorRuntimeIsoDateTime;
}

export interface CollectedContentSubmissionInput {
  readonly platform: CollectorRuntimeContentPlatform;
  readonly sourceGroupId: string;
  readonly externalPostId: string;
  readonly sourceUrl: string;
  readonly title?: string;
  readonly bodyText: string;
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
  readonly postedAt?: CollectorRuntimeIsoDateTime;
  readonly collectedAt: CollectorRuntimeIsoDateTime;
  readonly reactionCount: number;
  readonly commentCount: number;
  readonly shareCount?: number;
  readonly topComments: readonly CollectedContentTopCommentSubmissionInput[];
  readonly rawPayloadRef?: string;
}

export type ContentSubmissionFailureCode =
  | "CONTENT_MANAGER_HTTP_ERROR"
  | "CONTENT_MANAGER_NETWORK_ERROR"
  | "SUBMISSION_PORT_ERROR";

export type ContentSubmissionResult =
  | {
      readonly ok: true;
      readonly statusCode?: number;
      readonly contentItemId?: string;
    }
  | {
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: ContentSubmissionFailureCode;
      readonly errorMessage: string;
    };

export interface ContentManagerContentSubmissionPort {
  submitCollectedContent(
    input: CollectedContentSubmissionInput,
  ): Promise<ContentSubmissionResult>;
}

export interface SubmitCapturedFacebookPayloadInput {
  readonly sourceGroupId: string;
  readonly capturedAt: Date;
  readonly payload: unknown;
  readonly sourceUrlHint?: string;
}

export type SubmitCapturedFacebookPayloadSubmission =
  | {
      readonly externalPostId: string;
      readonly ok: true;
      readonly statusCode?: number;
      readonly contentItemId?: string;
    }
  | {
      readonly externalPostId: string;
      readonly ok: false;
      readonly statusCode?: number;
      readonly errorCode: ContentSubmissionFailureCode;
      readonly errorMessage: string;
    };

export type SubmitCapturedFacebookPayloadResult =
  | {
      readonly ok: true;
      readonly extractedCandidateCount: number;
      readonly submittedCount: number;
      readonly failedSubmissionCount: number;
      readonly warnings: readonly FacebookExtractionWarning[];
      readonly submissions: readonly SubmitCapturedFacebookPayloadSubmission[];
    }
  | {
      readonly ok: false;
      readonly extractedCandidateCount: 0;
      readonly submittedCount: 0;
      readonly failedSubmissionCount: 0;
      readonly issues: readonly FacebookExtractionIssue[];
    };
