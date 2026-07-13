import { z } from "zod";

const NonNegativeIntegerSchema = z.number().int().min(0);

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

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
    failureCode: NonEmptyStringSchema.optional(),
  })
  .strict();

export const ProfileHomeFeedDiagnosticSummarySchema = z
  .object({
    schemaVersion: z.literal(1),
    capture: ProfileHomeFeedDiagnosticSummaryCaptureCountersSchema.optional(),
    captureStage:
      ProfileHomeFeedDiagnosticSummaryCaptureStageSchema.optional(),
    captureFinalPageUrl: NonEmptyStringSchema.optional(),
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
  readonly captureFinalPageUrl?: string | undefined;
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
        readonly failureCode?: string | undefined;
      }
    | undefined;
};

export const PROFILE_HOME_FEED_DIAGNOSTIC_SUMMARY_SCHEMA_VERSION = 1 as const;
