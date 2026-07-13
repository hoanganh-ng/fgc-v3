import { z } from "zod";

const NonNegativeIntegerSchema = z.number().int().min(0);

/**
 * Mirrors the allowlisted
 * `FacebookHomeFeedExtractionWarningCode` vocabulary in
 * `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-extractor.types.ts`.
 * Unknown warning codes are rejected at the domain boundary so a
 * misconfigured capture port cannot smuggle arbitrary keys into the
 * persisted diagnostic summary.
 */
export const PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES = [
  "DUPLICATE_POST_CANDIDATE",
  "EXCLUDED_PERSONAL_PROFILE_POST",
  "EXCLUDED_SPONSORED_POST",
  "MISSING_OPTIONAL_AUTHOR",
  "MISSING_POSTED_AT",
  "MISSING_SOURCE_URL",
  "MISSING_STABLE_PUBLISHER_ID",
  "SKIPPED_CANDIDATE_WITHOUT_BODY_TEXT",
  "SKIPPED_CANDIDATE_WITHOUT_POST_ID",
  "SKIPPED_COMMENT_WITHOUT_BODY_TEXT",
  "SKIPPED_COMMENT_WITHOUT_ID",
  "UNKNOWN_PUBLISHER_KIND",
  "UNSUPPORTED_PAYLOAD_SHAPE",
] as const;

export type ProfileHomeFeedDiagnosticWarningCode =
  (typeof PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES)[number];

export const ProfileHomeFeedDiagnosticSummaryWarningCodeSchema = z.enum(
  PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES,
);

export const PROFILE_HOME_FEED_COLLECTION_RUN_CAPTURE_STAGES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUCCEEDED",
  "CAPTURE_FAILED",
  "INTERRUPTED",
] as const;

export type ProfileHomeFeedDiagnosticSummaryCaptureStage =
  (typeof PROFILE_HOME_FEED_COLLECTION_RUN_CAPTURE_STAGES)[number];

export const ProfileHomeFeedDiagnosticSummaryCaptureStageSchema = z.enum(
  PROFILE_HOME_FEED_COLLECTION_RUN_CAPTURE_STAGES,
);

export const PROFILE_HOME_FEED_COLLECTION_RUN_FAILURE_STAGES = [
  "BOUNDS_EXCEEDED",
  "CHECKOUT",
  "CAPTURE",
  "PUBLISHER_OBSERVATION",
  "CONTENT_SUBMISSION",
  "LEASE_RELEASE",
  "PARTIAL",
  "INTERRUPTED",
  "EXECUTION",
] as const;

export type ProfileHomeFeedDiagnosticSummaryFailureStage =
  (typeof PROFILE_HOME_FEED_COLLECTION_RUN_FAILURE_STAGES)[number];

export const ProfileHomeFeedDiagnosticSummaryFailureStageSchema = z.enum(
  PROFILE_HOME_FEED_COLLECTION_RUN_FAILURE_STAGES,
);

/**
 * Allowlisted diagnostic failure codes. Every code persisted on
 * the diagnostic summary, returned in HTTP DTOs, surfaced in the
 * Web UI, and emitted by the operator runner MUST be one of these
 * values. Upstream capture-port error codes are mapped to a safe
 * value from this vocabulary at the application boundary and never
 * copied through unchanged.
 */
export const PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES = [
  "HOME_FEED_EXECUTION_BOUNDS_EXCEEDED",
  "HOME_FEED_CHECKOUT_FAILED",
  "PROFILE_HOME_FEED_CHECKOUT_PROFILE_MISMATCH",
  "HOME_FEED_CAPTURE_FAILED",
  "HOME_FEED_CAPTURE_AUTH_REQUIRED",
  "HOME_FEED_PUBLISHER_OBSERVATION_FAILED",
  "HOME_FEED_CONTENT_SUBMISSION_FAILED",
  "HOME_FEED_LEASE_RELEASE_FAILED",
  "HOME_FEED_EXECUTION_PARTIAL_FAILURE",
  "HOME_FEED_EXECUTION_INTERRUPTED",
  "HOME_FEED_EXECUTION_FAILED",
] as const;

export type ProfileHomeFeedDiagnosticFailureCode =
  (typeof PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES)[number];

export const ProfileHomeFeedDiagnosticFailureCodeSchema = z.enum(
  PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES,
);

/**
 * Allowlisted page-state classifications. The runner never persists
 * or surfaces a raw URL fragment or arbitrary Facebook field; if a
 * page-state detail is required, it MUST be one of these enum
 * values. The `OTHER` value is the safe default for any unclassified
 * state and is the only value upstream `FacebookPageBlockingState`
 * values that do not map to `LOGIN` or `CHECKPOINT` can reach.
 */
export const PROFILE_HOME_FEED_DIAGNOSTIC_PAGE_STATES = [
  "HOME_FEED",
  "LOGIN",
  "CHECKPOINT",
  "OTHER",
] as const;

export type ProfileHomeFeedDiagnosticPageState =
  (typeof PROFILE_HOME_FEED_DIAGNOSTIC_PAGE_STATES)[number];

export const ProfileHomeFeedDiagnosticPageStateSchema = z.enum(
  PROFILE_HOME_FEED_DIAGNOSTIC_PAGE_STATES,
);

/**
 * Aggregated capture counters. Each field is optional so partial
 * facts collected before a later failure can still be persisted.
 */
const ProfileHomeFeedDiagnosticSummaryCaptureCountersSchema = z
  .object({
    pageContextFetchCaptureCount: NonNegativeIntegerSchema.optional(),
    pageContextXhrCaptureCount: NonNegativeIntegerSchema.optional(),
    networkListenerCaptureCount: NonNegativeIntegerSchema.optional(),
    parseFailureCount: NonNegativeIntegerSchema.optional(),
    totalPayloadsPassedToExtractor: NonNegativeIntegerSchema.optional(),
  })
  .strict();

/**
 * Aggregated extractor warning histogram. Keys are restricted to
 * the allowlisted warning-code vocabulary; values are non-negative
 * integers. The schema accepts an arbitrary subset of the codes
 * (operators see only the codes that fired). Unknown keys are
 * rejected.
 */
const ProfileHomeFeedDiagnosticSummaryWarningCountsSchema = z
  .object(
    Object.fromEntries(
      PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES.map((code) => [
        code,
        NonNegativeIntegerSchema.optional(),
      ]),
    ) as Record<ProfileHomeFeedDiagnosticWarningCode, z.ZodOptional<typeof NonNegativeIntegerSchema>>,
  )
  .strict();

export type ProfileHomeFeedDiagnosticSummaryWarningCounts = Partial<
  Record<ProfileHomeFeedDiagnosticWarningCode, number | undefined>
>;

/**
 * Aggregated extractor stage counts. The accepted-candidate count
 * is independent from the post-deduplication candidate set that the
 * executor submits; both are kept so operators can see how many
 * candidates the extractor found versus how many survived
 * deduplication and downstream gating.
 */
const ProfileHomeFeedDiagnosticSummaryExtractorCountersSchema = z
  .object({
    extractedCandidateCount: NonNegativeIntegerSchema.optional(),
    deduplicatedCandidateCount: NonNegativeIntegerSchema.optional(),
  })
  .strict();

/**
 * Aggregated run-stage outcome. The failure stage/code mirror
 * the existing `failureReason` allowlist at the run-record level,
 * but are recorded on the diagnostic summary so legacy summary-only
 * reads do not lose the stage classification.
 */
const ProfileHomeFeedDiagnosticSummaryRunOutcomeSchema = z
  .object({
    failureStage: ProfileHomeFeedDiagnosticSummaryFailureStageSchema.optional(),
    failureCode: ProfileHomeFeedDiagnosticFailureCodeSchema.optional(),
  })
  .strict();

export const ProfileHomeFeedDiagnosticSummarySchema = z
  .object({
    schemaVersion: z.literal(1),
    capture: ProfileHomeFeedDiagnosticSummaryCaptureCountersSchema.optional(),
    captureStage:
      ProfileHomeFeedDiagnosticSummaryCaptureStageSchema.optional(),
    capturePageState: ProfileHomeFeedDiagnosticPageStateSchema.optional(),
    captureLoginRedirectSuspected: z.boolean().optional(),
    extractor:
      ProfileHomeFeedDiagnosticSummaryExtractorCountersSchema.optional(),
    warningCounts:
      ProfileHomeFeedDiagnosticSummaryWarningCountsSchema.optional(),
    unsupportedPayloadCount: NonNegativeIntegerSchema.optional(),
    runOutcome: ProfileHomeFeedDiagnosticSummaryRunOutcomeSchema.optional(),
  })
  .strict();

export type ProfileHomeFeedDiagnosticSummary = {
  readonly schemaVersion: 1;
  readonly capture?:
    | {
        readonly pageContextFetchCaptureCount?: number | undefined;
        readonly pageContextXhrCaptureCount?: number | undefined;
        readonly networkListenerCaptureCount?: number | undefined;
        readonly parseFailureCount?: number | undefined;
        readonly totalPayloadsPassedToExtractor?: number | undefined;
      }
    | undefined;
  readonly captureStage?:
    | ProfileHomeFeedDiagnosticSummaryCaptureStage
    | undefined;
  readonly capturePageState?:
    | ProfileHomeFeedDiagnosticPageState
    | undefined;
  readonly captureLoginRedirectSuspected?: boolean | undefined;
  readonly extractor?:
    | {
        readonly extractedCandidateCount?: number | undefined;
        readonly deduplicatedCandidateCount?: number | undefined;
      }
    | undefined;
  readonly warningCounts?:
    | ProfileHomeFeedDiagnosticSummaryWarningCounts
    | undefined;
  readonly unsupportedPayloadCount?: number | undefined;
  readonly runOutcome?:
    | {
        readonly failureStage?:
          | ProfileHomeFeedDiagnosticSummaryFailureStage
          | undefined;
        readonly failureCode?:
          | ProfileHomeFeedDiagnosticFailureCode
          | undefined;
      }
    | undefined;
};

export const PROFILE_HOME_FEED_DIAGNOSTIC_SUMMARY_SCHEMA_VERSION = 1 as const;
