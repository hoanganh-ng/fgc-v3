import type {
  FacebookIsoDateTime,
  FacebookPlatform,
} from "./facebook-extractor.types";

export type FacebookHomeFeedPublisherKind = "GROUP" | "PAGE";

export interface FacebookHomeFeedGraphQLPayloadExtractionInput {
  readonly capturedAt: Date;
  readonly payload: unknown;
  readonly sourceUrlHint?: string;
}

export interface FacebookHomeFeedGraphQLPayloadExtractorOptions {
  readonly topCommentLimit?: number;
}

export interface FacebookHomeFeedPublisherObservation {
  readonly platform: FacebookPlatform;
  readonly kind: FacebookHomeFeedPublisherKind;
  readonly externalPublisherId: string;
  readonly observedAt: FacebookIsoDateTime;
  readonly displayName?: string;
  readonly canonicalUrl?: string;
}

export interface FacebookHomeFeedExtractedTopComment {
  readonly externalCommentId: string;
  readonly bodyText: string;
  readonly authorDisplayName?: string;
  readonly authorExternalId?: string;
  readonly reactionCount: number;
  readonly replyCount?: number;
  readonly postedAt?: FacebookIsoDateTime;
  readonly collectedAt: FacebookIsoDateTime;
}

export interface FacebookHomeFeedExtractedContentCandidate {
  readonly platform: FacebookPlatform;
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
  readonly topComments: readonly FacebookHomeFeedExtractedTopComment[];
  readonly publisherObservation: FacebookHomeFeedPublisherObservation;
}

export type FacebookHomeFeedExtractionWarningCode =
  | "DUPLICATE_POST_CANDIDATE"
  | "EXCLUDED_PERSONAL_PROFILE_POST"
  | "EXCLUDED_SPONSORED_POST"
  | "MISSING_OPTIONAL_AUTHOR"
  | "MISSING_POSTED_AT"
  | "MISSING_SOURCE_URL"
  | "MISSING_STABLE_PUBLISHER_ID"
  | "SKIPPED_CANDIDATE_WITHOUT_BODY_TEXT"
  | "SKIPPED_CANDIDATE_WITHOUT_POST_ID"
  | "SKIPPED_COMMENT_WITHOUT_BODY_TEXT"
  | "SKIPPED_COMMENT_WITHOUT_ID"
  | "UNKNOWN_PUBLISHER_KIND"
  | "UNSUPPORTED_PAYLOAD_SHAPE";

export interface FacebookHomeFeedExtractionWarning {
  readonly code: FacebookHomeFeedExtractionWarningCode;
  readonly message: string;
  readonly path?: string;
  readonly externalPostId?: string;
  readonly publisherKind?: string;
}

export type FacebookHomeFeedExtractionIssueCode =
  | "INVALID_CAPTURED_AT"
  | "INVALID_TOP_COMMENT_LIMIT";

export interface FacebookHomeFeedExtractionIssue {
  readonly code: FacebookHomeFeedExtractionIssueCode;
  readonly message: string;
  readonly path?: string;
}

export type FacebookHomeFeedGraphQLExtractionResult =
  | {
      readonly valid: true;
      readonly candidates: readonly FacebookHomeFeedExtractedContentCandidate[];
      readonly warnings: readonly FacebookHomeFeedExtractionWarning[];
    }
  | {
      readonly valid: false;
      readonly issues: readonly FacebookHomeFeedExtractionIssue[];
    };
