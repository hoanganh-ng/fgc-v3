import { z } from "zod";
import type { ApiResult, HttpClient } from "@/lib/api/http-client";
import { NonEmptyStringSchema, PageSchema } from "./transport";

export const ProfileHomeFeedCollectionRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
]);

export const ProfileHomeFeedCollectionRunTriggerTypeSchema = z.enum([
  "MANUAL_API",
  "SCHEDULED",
]);

export type ProfileHomeFeedCollectionRunStatus = z.infer<
  typeof ProfileHomeFeedCollectionRunStatusSchema
>;
export type ProfileHomeFeedCollectionRunTriggerType = z.infer<
  typeof ProfileHomeFeedCollectionRunTriggerTypeSchema
>;

export const ProfileHomeFeedCollectionRunAccountStageSchema = z.enum([
  "NEW_ACCOUNT",
  "WARMING",
  "COLLECTION_READY",
  "LIMITED",
  "NEEDS_REVIEW",
  "RETIRED",
]);

export const ProfileHomeFeedCollectionRunTargetSchema = z
  .object({
    platform: z.literal("FACEBOOK"),
    surface: z.literal("PROFILE_HOME_FEED"),
  })
  .strict();

export const ProfileHomeFeedCollectionRunParametersSchema = z
  .object({
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
    maxPosts: z.number().int().min(1).optional(),
  })
  .strict();

export const ProfileHomeFeedCollectionRunSummarySchema = z
  .object({
    capturedPayloads: z.number().int().min(0).optional(),
    extractorCandidates: z.number().int().min(0).optional(),
    sourcePublishersObserved: z.number().int().min(0).optional(),
    contentItemsSubmitted: z.number().int().min(0).optional(),
    failedPublisherObservations: z.number().int().min(0).optional(),
    failedContentSubmissions: z.number().int().min(0).optional(),
    leaseReleased: z.boolean().optional(),
  })
  .strict();

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

export const PROFILE_HOME_FEED_DIAGNOSTIC_CAPTURE_STAGES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUCCEEDED",
  "CAPTURE_FAILED",
  "INTERRUPTED",
] as const;

export const PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_STAGES = [
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

export const PROFILE_HOME_FEED_DIAGNOSTIC_PAGE_STATES = [
  "HOME_FEED",
  "LOGIN",
  "CHECKPOINT",
  "OTHER",
] as const;

export type ProfileHomeFeedDiagnosticWarningCode =
  (typeof PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES)[number];
export type ProfileHomeFeedDiagnosticCaptureStage =
  (typeof PROFILE_HOME_FEED_DIAGNOSTIC_CAPTURE_STAGES)[number];
export type ProfileHomeFeedDiagnosticFailureStage =
  (typeof PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_STAGES)[number];
export type ProfileHomeFeedDiagnosticFailureCode =
  (typeof PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES)[number];
export type ProfileHomeFeedDiagnosticPageState =
  (typeof PROFILE_HOME_FEED_DIAGNOSTIC_PAGE_STATES)[number];

export const ProfileHomeFeedDiagnosticSummaryCaptureCountersSchema = z
  .object({
    pageContextFetchCaptureCount: z.number().int().min(0).optional(),
    pageContextXhrCaptureCount: z.number().int().min(0).optional(),
    networkListenerCaptureCount: z.number().int().min(0).optional(),
    parseFailureCount: z.number().int().min(0).optional(),
    totalPayloadsPassedToExtractor: z.number().int().min(0).optional(),
  })
  .strict();

export const ProfileHomeFeedDiagnosticSummaryExtractorCountersSchema = z
  .object({
    extractedCandidateCount: z.number().int().min(0).optional(),
    deduplicatedCandidateCount: z.number().int().min(0).optional(),
  })
  .strict();

export const ProfileHomeFeedDiagnosticSummaryWarningCountsSchema = z
  .object(
    Object.fromEntries(
      PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES.map((code) => [
        code,
        z.number().int().min(0).optional(),
      ]),
    ) as Record<
      (typeof PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES)[number],
      z.ZodOptional<z.ZodNumber>
    >,
  )
  .strict()
  .optional();

export const ProfileHomeFeedDiagnosticSummaryRunOutcomeSchema = z
  .object({
    failureStage: z
      .enum(PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_STAGES)
      .optional(),
    failureCode: z
      .enum(PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES)
      .optional(),
  })
  .strict()
  .optional();

export const ProfileHomeFeedDiagnosticSummarySchema = z
  .object({
    schemaVersion: z.literal(1),
    capture:
      ProfileHomeFeedDiagnosticSummaryCaptureCountersSchema.optional(),
    captureStage: z
      .enum(PROFILE_HOME_FEED_DIAGNOSTIC_CAPTURE_STAGES)
      .optional(),
    capturePageState: z
      .enum(PROFILE_HOME_FEED_DIAGNOSTIC_PAGE_STATES)
      .optional(),
    captureLoginRedirectSuspected: z.boolean().optional(),
    extractor:
      ProfileHomeFeedDiagnosticSummaryExtractorCountersSchema.optional(),
    warningCounts: ProfileHomeFeedDiagnosticSummaryWarningCountsSchema,
    unsupportedPayloadCount: z.number().int().min(0).optional(),
    runOutcome: ProfileHomeFeedDiagnosticSummaryRunOutcomeSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionRunFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionRunSchema = z
  .object({
    id: NonEmptyStringSchema,
    profileId: NonEmptyStringSchema,
    triggerType: ProfileHomeFeedCollectionRunTriggerTypeSchema,
    status: ProfileHomeFeedCollectionRunStatusSchema,
    accountStageAtRequest: ProfileHomeFeedCollectionRunAccountStageSchema,
    target: ProfileHomeFeedCollectionRunTargetSchema,
    parameters: ProfileHomeFeedCollectionRunParametersSchema,
    summary: ProfileHomeFeedCollectionRunSummarySchema.optional(),
    diagnostics: ProfileHomeFeedDiagnosticSummarySchema.optional(),
    failureReason: ProfileHomeFeedCollectionRunFailureReasonSchema.optional(),
    requestedAt: z.string().datetime({ offset: true }),
    startedAt: z.string().datetime({ offset: true }).optional(),
    finishedAt: z.string().datetime({ offset: true }).optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const ProfileHomeFeedCollectionRunsListResponseSchema = z
  .object({
    items: z.array(ProfileHomeFeedCollectionRunSchema),
    page: PageSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionRunResponseSchema = z
  .object({
    profileHomeFeedCollectionRun: ProfileHomeFeedCollectionRunSchema,
  })
  .strict();

export const RequestProfileHomeFeedCollectionRunRequestSchema = z
  .object({
    profileId: NonEmptyStringSchema,
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
    maxPosts: z.number().int().min(1).optional(),
  })
  .strict();

export type ProfileHomeFeedCollectionRunAccountStage = z.infer<
  typeof ProfileHomeFeedCollectionRunAccountStageSchema
>;
export type ProfileHomeFeedCollectionRunTarget = z.infer<
  typeof ProfileHomeFeedCollectionRunTargetSchema
>;
export type ProfileHomeFeedCollectionRunParameters = z.infer<
  typeof ProfileHomeFeedCollectionRunParametersSchema
>;
export type ProfileHomeFeedCollectionRunSummary = z.infer<
  typeof ProfileHomeFeedCollectionRunSummarySchema
>;
export type ProfileHomeFeedDiagnosticSummary = z.infer<
  typeof ProfileHomeFeedDiagnosticSummarySchema
>;
export type ProfileHomeFeedDiagnosticSummaryCaptureCounters = z.infer<
  typeof ProfileHomeFeedDiagnosticSummaryCaptureCountersSchema
>;
export type ProfileHomeFeedDiagnosticSummaryExtractorCounters = z.infer<
  typeof ProfileHomeFeedDiagnosticSummaryExtractorCountersSchema
>;
export type ProfileHomeFeedDiagnosticSummaryRunOutcome = z.infer<
  typeof ProfileHomeFeedDiagnosticSummaryRunOutcomeSchema
>;
export type ProfileHomeFeedCollectionRunFailureReason = z.infer<
  typeof ProfileHomeFeedCollectionRunFailureReasonSchema
>;
export type ProfileHomeFeedCollectionRun = z.infer<
  typeof ProfileHomeFeedCollectionRunSchema
>;
export type ProfileHomeFeedCollectionRunsListResponse = z.infer<
  typeof ProfileHomeFeedCollectionRunsListResponseSchema
>;
export type ProfileHomeFeedCollectionRunResponse = z.infer<
  typeof ProfileHomeFeedCollectionRunResponseSchema
>;
export type RequestProfileHomeFeedCollectionRunRequest = z.infer<
  typeof RequestProfileHomeFeedCollectionRunRequestSchema
>;

export const DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT = 50;
export const MAX_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT = 100;

export interface ListProfileHomeFeedCollectionRunsQuery {
  readonly status?: ProfileHomeFeedCollectionRunStatus;
  readonly profileId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export function toListProfileHomeFeedCollectionRunsQueryParams(
  query: ListProfileHomeFeedCollectionRunsQuery | undefined,
): Readonly<Record<string, string | number>> | undefined {
  if (query === undefined) {
    return undefined;
  }

  return {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.profileId !== undefined ? { profileId: query.profileId } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
    ...(query.offset !== undefined ? { offset: query.offset } : {}),
  };
}

export function createProfileHomeFeedCollectionRunsOperations(
  httpClient: HttpClient,
) {
  return {
    listProfileHomeFeedCollectionRuns(
      query?: ListProfileHomeFeedCollectionRunsQuery,
    ) {
      return httpClient.request({
        path: "/collector/profile-home-feed-collection-runs",
        query: toListProfileHomeFeedCollectionRunsQueryParams(query),
        responseSchema: ProfileHomeFeedCollectionRunsListResponseSchema,
      });
    },
    getProfileHomeFeedCollectionRun(profileHomeFeedCollectionRunId: string) {
      return httpClient.request({
        path: `/collector/profile-home-feed-collection-runs/${encodeURIComponent(profileHomeFeedCollectionRunId)}`,
        responseSchema: ProfileHomeFeedCollectionRunResponseSchema,
      });
    },
    requestProfileHomeFeedCollectionRun(
      request: RequestProfileHomeFeedCollectionRunRequest,
    ) {
      return httpClient.request({
        path: "/collector/profile-home-feed-collection-runs",
        method: "POST",
        body: request,
        responseSchema: ProfileHomeFeedCollectionRunResponseSchema,
      });
    },
    cancelProfileHomeFeedCollectionRun(profileHomeFeedCollectionRunId: string) {
      return httpClient.request({
        path: `/collector/profile-home-feed-collection-runs/${encodeURIComponent(profileHomeFeedCollectionRunId)}/cancel`,
        method: "POST",
        responseSchema: ProfileHomeFeedCollectionRunResponseSchema,
      });
    },
  } satisfies {
    listProfileHomeFeedCollectionRuns: (
      query?: ListProfileHomeFeedCollectionRunsQuery,
    ) => Promise<ApiResult<ProfileHomeFeedCollectionRunsListResponse>>;
    getProfileHomeFeedCollectionRun: (
      profileHomeFeedCollectionRunId: string,
    ) => Promise<ApiResult<ProfileHomeFeedCollectionRunResponse>>;
    requestProfileHomeFeedCollectionRun: (
      request: RequestProfileHomeFeedCollectionRunRequest,
    ) => Promise<ApiResult<ProfileHomeFeedCollectionRunResponse>>;
    cancelProfileHomeFeedCollectionRun: (
      profileHomeFeedCollectionRunId: string,
    ) => Promise<ApiResult<ProfileHomeFeedCollectionRunResponse>>;
  };
}
