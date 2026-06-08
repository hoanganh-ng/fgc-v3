export const FACEBOOK_EXTRACTOR_PLATFORM = "FACEBOOK" as const;
export const DEFAULT_FACEBOOK_TOP_COMMENT_LIMIT = 10;

export type FacebookPlatform = typeof FACEBOOK_EXTRACTOR_PLATFORM;
export type FacebookIsoDateTime = string;

export interface FacebookGraphQLPayloadExtractionInput {
  readonly sourceGroupId: string;
  readonly capturedAt: Date;
  readonly payload: unknown;
  readonly sourceUrlHint?: string;
}

export interface FacebookGraphQLPayloadExtractorOptions {
  readonly topCommentLimit?: number;
}

export interface FacebookExtractedTopComment {
  readonly externalCommentId: string;
  readonly bodyText: string;
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
  readonly reactionCount: number;
  readonly replyCount?: number;
  readonly postedAt?: FacebookIsoDateTime;
  readonly collectedAt: FacebookIsoDateTime;
}

export interface FacebookExtractedContentCandidate {
  readonly platform: FacebookPlatform;
  readonly sourceGroupId: string;
  readonly externalPostId: string;
  readonly sourceUrl: string;
  readonly title?: string;
  readonly bodyText: string;
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
  readonly postedAt?: FacebookIsoDateTime;
  readonly collectedAt: FacebookIsoDateTime;
  readonly reactionCount: number;
  readonly commentCount: number;
  readonly shareCount?: number;
  readonly topComments: readonly FacebookExtractedTopComment[];
  readonly rawPayloadRef?: string;
}

export type FacebookExtractionWarningCode =
  | "DUPLICATE_POST_CANDIDATE"
  | "MISSING_OPTIONAL_AUTHOR"
  | "MISSING_POSTED_AT"
  | "MISSING_SOURCE_URL"
  | "SKIPPED_CANDIDATE_WITHOUT_BODY_TEXT"
  | "SKIPPED_CANDIDATE_WITHOUT_POST_ID"
  | "SKIPPED_COMMENT_WITHOUT_BODY_TEXT"
  | "SKIPPED_COMMENT_WITHOUT_ID"
  | "UNSUPPORTED_PAYLOAD_SHAPE";

export interface FacebookExtractionWarning {
  readonly code: FacebookExtractionWarningCode;
  readonly message: string;
  readonly path?: string;
}

export type FacebookExtractionIssueCode =
  | "INVALID_CAPTURED_AT"
  | "INVALID_SOURCE_GROUP_ID"
  | "INVALID_TOP_COMMENT_LIMIT";

export interface FacebookExtractionIssue {
  readonly code: FacebookExtractionIssueCode;
  readonly message: string;
  readonly path?: string;
}

export type FacebookGraphQLExtractionResult =
  | {
      readonly valid: true;
      readonly candidates: readonly FacebookExtractedContentCandidate[];
      readonly warnings: readonly FacebookExtractionWarning[];
    }
  | {
      readonly valid: false;
      readonly issues: readonly FacebookExtractionIssue[];
    };
