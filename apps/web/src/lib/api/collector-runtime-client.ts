import { z } from "zod";
import { env } from "@/lib/env";
import {
  createHttpClient,
  type ApiResult,
  type HttpClient,
} from "@/lib/api/http-client";

export const CollectionRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
]);

export const CollectionRunTriggerTypeSchema = z.enum([
  "MANUAL_API",
  "SCHEDULED",
]);

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

export const AccountExerciseRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
]);

export const AccountExerciseTypeSchema = z.enum([
  "AMBIENT_ACCOUNT",
  "CATEGORY_BROWSE",
]);

export type CollectionRunStatus = z.infer<typeof CollectionRunStatusSchema>;
export type CollectionRunTriggerType = z.infer<
  typeof CollectionRunTriggerTypeSchema
>;
export type ProfileHomeFeedCollectionRunStatus = z.infer<
  typeof ProfileHomeFeedCollectionRunStatusSchema
>;
export type ProfileHomeFeedCollectionRunTriggerType = z.infer<
  typeof ProfileHomeFeedCollectionRunTriggerTypeSchema
>;
export type AccountExerciseRunStatus = z.infer<
  typeof AccountExerciseRunStatusSchema
>;
export type AccountExerciseType = z.infer<typeof AccountExerciseTypeSchema>;

const NonEmptyStringSchema = z.string().min(1);

const PageSchema = z
  .object({
    limit: z.number(),
    offset: z.number(),
    total: z.number().optional(),
  })
  .strict();

const CollectionRunParametersSchema = z
  .object({
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
  })
  .strict();

const CollectionRunSummarySchema = z
  .object({
    capturedPayloads: z.number().int().min(0).optional(),
    extractorCandidates: z.number().int().min(0).optional(),
    contentItemsSubmitted: z.number().int().min(0).optional(),
    failedSubmissions: z.number().int().min(0).optional(),
    leaseReleased: z.boolean().optional(),
  })
  .strict();

const CollectionRunFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

const AccountExerciseRunActionBudgetSchema = z
  .object({
    maxDurationMs: z.number().int().min(1),
    maxScrolls: z.number().int().min(0),
    minDwellMs: z.number().int().min(0).optional(),
  })
  .strict();

const AccountExerciseRunSafeSummarySchema = z
  .object({
    pageLoaded: z.boolean(),
    loginRequired: z.boolean(),
    checkpointDetected: z.boolean(),
    scrollsPerformed: z.number().int().min(0),
    durationMs: z.number().int().min(0),
    leaseReleased: z.boolean(),
  })
  .strict();

const AccountExerciseRunFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

export const CategoryBrowseExerciseTargetSchema = z
  .object({
    categoryId: NonEmptyStringSchema,
    sourceGroupId: NonEmptyStringSchema,
    entryRouteId: NonEmptyStringSchema,
    entryRouteType: z.literal("CATEGORY_ENTRY_URL"),
    url: NonEmptyStringSchema,
    riskLevel: z.enum(["LOW", "MEDIUM"]),
  })
  .strict()
  .superRefine((target, context) => {
    let parsedUrl: URL | undefined;
    try {
      parsedUrl = new URL(target.url);
    } catch {
      parsedUrl = undefined;
    }

    if (
      parsedUrl === undefined ||
      parsedUrl.protocol !== "https:" ||
      !(
        parsedUrl.hostname.toLowerCase() === "facebook.com" ||
        parsedUrl.hostname.toLowerCase().endsWith(".facebook.com")
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Category Browse target URL must be an https Facebook URL.",
      });
      return;
    }

    if (parsedUrl.username || parsedUrl.password) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Category Browse target URL must not contain credentials.",
      });
    }
  });

export const CollectionRunSchema = z
  .object({
    id: NonEmptyStringSchema,
    sourceGroupId: NonEmptyStringSchema,
    status: CollectionRunStatusSchema,
    triggerType: CollectionRunTriggerTypeSchema,
    parameters: CollectionRunParametersSchema,
    summary: CollectionRunSummarySchema.optional(),
    failureReason: CollectionRunFailureReasonSchema.optional(),
    requestedAt: z.string().datetime({ offset: true }),
    startedAt: z.string().datetime({ offset: true }).optional(),
    finishedAt: z.string().datetime({ offset: true }).optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const CollectionRunsListResponseSchema = z
  .object({
    items: z.array(CollectionRunSchema),
    page: PageSchema,
  })
  .strict();

export const CollectionRunResponseSchema = z
  .object({
    collectionRun: CollectionRunSchema,
  })
  .strict();

export const AccountExerciseRunSchema = z
  .object({
    id: NonEmptyStringSchema,
    profileId: NonEmptyStringSchema,
    leaseId: NonEmptyStringSchema.optional(),
    exerciseType: AccountExerciseTypeSchema,
    status: AccountExerciseRunStatusSchema,
    stageAtStart: NonEmptyStringSchema,
    actionBudget: AccountExerciseRunActionBudgetSchema,
    target: CategoryBrowseExerciseTargetSchema.optional(),
    safeSummary: AccountExerciseRunSafeSummarySchema.optional(),
    failureReason: AccountExerciseRunFailureReasonSchema.optional(),
    requestedAt: z.string().datetime({ offset: true }),
    startedAt: z.string().datetime({ offset: true }).optional(),
    finishedAt: z.string().datetime({ offset: true }).optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.exerciseType === "AMBIENT_ACCOUNT" && run.target !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: "Ambient account exercise runs must not include a target.",
      });
    }

    if (run.exerciseType === "CATEGORY_BROWSE" && run.target === undefined) {
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: "Category Browse exercise runs require a target.",
      });
    }
  });

export const AccountExerciseRunsListResponseSchema = z
  .object({
    items: z.array(AccountExerciseRunSchema),
    page: PageSchema,
  })
  .strict();

export const AccountExerciseRunResponseSchema = z
  .object({
    accountExerciseRun: AccountExerciseRunSchema,
  })
  .strict();

export const RequestCollectionRunRequestSchema = z
  .object({
    sourceGroupId: NonEmptyStringSchema,
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
  })
  .strict();

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

const BaseRequestSchema = z.object({
  profileId: NonEmptyStringSchema,
  stageAtStart: NonEmptyStringSchema,
  maxDurationMs: z.number().int().min(1),
  maxScrolls: z.number().int().min(0),
  minDwellMs: z.number().int().min(0).optional(),
});

const AmbientRequestSchema = BaseRequestSchema.extend({
  exerciseType: z.literal("AMBIENT_ACCOUNT").optional(),
}).strict();

const CategoryBrowseRequestSchema = BaseRequestSchema.extend({
  exerciseType: z.literal("CATEGORY_BROWSE"),
  sourceGroupId: NonEmptyStringSchema,
  entryRouteId: NonEmptyStringSchema.optional(),
}).strict();

export const RequestAccountExerciseRunRequestSchema = z.union([
  AmbientRequestSchema,
  CategoryBrowseRequestSchema,
]);

export type CollectionRun = z.infer<typeof CollectionRunSchema>;
export type CollectionRunParameters = z.infer<
  typeof CollectionRunParametersSchema
>;
export type CollectionRunSummary = z.infer<typeof CollectionRunSummarySchema>;
export type CollectionRunFailureReason = z.infer<
  typeof CollectionRunFailureReasonSchema
>;
export type CollectionRunsListResponse = z.infer<
  typeof CollectionRunsListResponseSchema
>;
export type CollectionRunResponse = z.infer<typeof CollectionRunResponseSchema>;
export type RequestCollectionRunRequest = z.infer<
  typeof RequestCollectionRunRequestSchema
>;
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
export type AccountExerciseRun = z.infer<typeof AccountExerciseRunSchema>;
export type AccountExerciseRunActionBudget = z.infer<
  typeof AccountExerciseRunActionBudgetSchema
>;
export type AccountExerciseRunSafeSummary = z.infer<
  typeof AccountExerciseRunSafeSummarySchema
>;
export type AccountExerciseRunFailureReason = z.infer<
  typeof AccountExerciseRunFailureReasonSchema
>;
export type AccountExerciseRunsListResponse = z.infer<
  typeof AccountExerciseRunsListResponseSchema
>;
export type AccountExerciseRunResponse = z.infer<
  typeof AccountExerciseRunResponseSchema
>;
export type RequestAccountExerciseRunRequest = z.infer<
  typeof RequestAccountExerciseRunRequestSchema
>;

export const ProfileSourceAccessCheckRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
]);

export const ProfileSourceAccessCheckRunTriggerTypeSchema = z.enum([
  "MANUAL",
]);

export const ProfileSourceAccessCheckRunOutcomeSchema = z.enum([
  "PUBLIC_ACCESSIBLE",
  "JOIN_REQUIRED",
  "JOINED_ACCESSIBLE",
  "ACCESS_DENIED",
  "LOGIN_REQUIRED",
  "CHECKPOINT_REQUIRED",
  "NEEDS_MANUAL_REVIEW",
]);

export const ProfileSourceAccessCheckRunAccountStageSchema = z.enum([
  "NEW_ACCOUNT",
  "WARMING",
  "COLLECTION_READY",
  "LIMITED",
  "NEEDS_REVIEW",
  "RETIRED",
]);

export type ProfileSourceAccessCheckRunStatus = z.infer<
  typeof ProfileSourceAccessCheckRunStatusSchema
>;
export type ProfileSourceAccessCheckRunTriggerType = z.infer<
  typeof ProfileSourceAccessCheckRunTriggerTypeSchema
>;
export type ProfileSourceAccessCheckRunOutcome = z.infer<
  typeof ProfileSourceAccessCheckRunOutcomeSchema
>;
export type ProfileSourceAccessCheckRunAccountStage = z.infer<
  typeof ProfileSourceAccessCheckRunAccountStageSchema
>;

const ProfileSourceAccessCheckRunTargetSchema = z
  .object({
    platform: z.literal("FACEBOOK"),
    routeType: z.literal("DIRECT_GROUP_URL"),
    url: NonEmptyStringSchema,
  })
  .strict()
  .superRefine((target, context) => {
    let parsedUrl: URL | undefined;
    try {
      parsedUrl = new URL(target.url);
    } catch {
      parsedUrl = undefined;
    }

    if (
      parsedUrl === undefined ||
      parsedUrl.protocol !== "https:" ||
      !(
        parsedUrl.hostname.toLowerCase() === "facebook.com" ||
        parsedUrl.hostname.toLowerCase().endsWith(".facebook.com")
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Check run target URL must be an https Facebook URL.",
      });
      return;
    }

    if (parsedUrl.username || parsedUrl.password) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Check run target URL must not contain credentials.",
      });
    }
  });

const ProfileSourceAccessCheckRunFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

export const ProfileSourceAccessCheckRunSchema = z
  .object({
    id: NonEmptyStringSchema,
    profileId: NonEmptyStringSchema,
    sourceGroupId: NonEmptyStringSchema,
    triggerType: ProfileSourceAccessCheckRunTriggerTypeSchema,
    status: ProfileSourceAccessCheckRunStatusSchema,
    accountStageAtRequest: ProfileSourceAccessCheckRunAccountStageSchema,
    target: ProfileSourceAccessCheckRunTargetSchema,
    outcome: ProfileSourceAccessCheckRunOutcomeSchema.optional(),
    failureReason: ProfileSourceAccessCheckRunFailureReasonSchema.optional(),
    requestedAt: z.string().datetime({ offset: true }),
    startedAt: z.string().datetime({ offset: true }).optional(),
    finishedAt: z.string().datetime({ offset: true }).optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((run, context) => {
    if (run.status === "SUCCEEDED") {
      if (run.outcome === undefined) {
        context.addIssue({
          code: "custom",
          path: ["outcome"],
          message: "Succeeded check runs require an outcome.",
        });
      }

      if (run.failureReason !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["failureReason"],
          message: "Succeeded check runs must not contain a failure reason.",
        });
      }

      return;
    }

    if (run.status === "FAILED") {
      if (run.failureReason === undefined) {
        context.addIssue({
          code: "custom",
          path: ["failureReason"],
          message: "Failed check runs require a failure reason.",
        });
      }

      if (run.outcome !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["outcome"],
          message: "Failed check runs must not contain an outcome.",
        });
      }

      return;
    }

    if (run.outcome !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["outcome"],
        message:
          "Queued, running, and canceled check runs must not contain an outcome.",
      });
    }

    if (run.failureReason !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["failureReason"],
        message:
          "Queued, running, and canceled check runs must not contain a failure reason.",
      });
    }
  });

export const ProfileSourceAccessCheckRunsListResponseSchema = z
  .object({
    items: z.array(ProfileSourceAccessCheckRunSchema),
    page: PageSchema,
  })
  .strict();

export const ProfileSourceAccessCheckRunResponseSchema = z
  .object({
    profileSourceAccessCheckRun: ProfileSourceAccessCheckRunSchema,
  })
  .strict();

export const RequestProfileSourceAccessCheckRunRequestSchema = z
  .object({
    profileId: NonEmptyStringSchema,
    sourceGroupId: NonEmptyStringSchema,
  })
  .strict();

export type ProfileSourceAccessCheckRun = z.infer<
  typeof ProfileSourceAccessCheckRunSchema
>;
export type ProfileSourceAccessCheckRunFailureReason = z.infer<
  typeof ProfileSourceAccessCheckRunFailureReasonSchema
>;
export type ProfileSourceAccessCheckRunsListResponse = z.infer<
  typeof ProfileSourceAccessCheckRunsListResponseSchema
>;
export type ProfileSourceAccessCheckRunResponse = z.infer<
  typeof ProfileSourceAccessCheckRunResponseSchema
>;
export type RequestProfileSourceAccessCheckRunRequest = z.infer<
  typeof RequestProfileSourceAccessCheckRunRequestSchema
>;

export const DEFAULT_COLLECTION_RUN_LIST_LIMIT = 50;
export const MAX_COLLECTION_RUN_LIST_LIMIT = 100;
export const DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT = 50;
export const MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT = 100;
export const DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT = 50;
export const MAX_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT = 100;
export const DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT = 50;
export const MAX_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT = 100;
export const DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT = 50;
export const MAX_COLLECTION_SCHEDULE_LIST_LIMIT = 100;
export const DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT = 50;
export const MAX_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT = 100;

export const CollectionScheduleParametersSchema = z
  .object({
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
  })
  .strict();

export const CollectionScheduleSchema = z
  .object({
    sourceGroupId: NonEmptyStringSchema,
    enabled: z.boolean(),
    intervalMinutes: z.number().int().min(1).max(10080),
    nextRunAt: z.string().datetime({ offset: true }),
    parameters: CollectionScheduleParametersSchema,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const CollectionScheduleListResponseSchema = z
  .object({
    items: z.array(CollectionScheduleSchema),
    page: PageSchema,
  })
  .strict();

export const CollectionScheduleResponseSchema = z
  .object({
    collectionSchedule: CollectionScheduleSchema,
  })
  .strict();

export const UpsertCollectionScheduleRequestSchema = z
  .object({
    enabled: z.boolean(),
    intervalMinutes: z.number().int().min(1).max(10080),
    nextRunAt: z.string().datetime({ offset: true }),
    parameters: CollectionScheduleParametersSchema,
  })
  .strict();

export type CollectionScheduleParameters = z.infer<
  typeof CollectionScheduleParametersSchema
>;
export type CollectionSchedule = z.infer<typeof CollectionScheduleSchema>;
export type CollectionScheduleListResponse = z.infer<
  typeof CollectionScheduleListResponseSchema
>;
export type CollectionScheduleResponse = z.infer<
  typeof CollectionScheduleResponseSchema
>;
export type UpsertCollectionScheduleRequest = z.infer<
  typeof UpsertCollectionScheduleRequestSchema
>;

export const PROFILE_HOME_FEED_COLLECTION_SCHEDULE_DISPATCH_STATUSES = [
  "DISPATCHED",
  "SKIPPED_ACTIVE_RUN",
  "PROFILE_NOT_FOUND",
  "PROFILE_LOOKUP_FAILED",
] as const;

export const ProfileHomeFeedCollectionScheduleDispatchStatusSchema = z.enum(
  PROFILE_HOME_FEED_COLLECTION_SCHEDULE_DISPATCH_STATUSES,
);

export const ProfileHomeFeedCollectionScheduleFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionScheduleParametersSchema = z
  .object({
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
    maxPosts: z.number().int().min(1).optional(),
  })
  .strict();

export const ProfileHomeFeedCollectionScheduleSchema = z
  .object({
    profileId: NonEmptyStringSchema,
    enabled: z.boolean(),
    intervalMinutes: z.number().int().min(1).max(10080),
    nextRunAt: z.string().datetime({ offset: true }),
    parameters: ProfileHomeFeedCollectionScheduleParametersSchema,
    lastAttemptedAt: z.string().datetime({ offset: true }).optional(),
    lastDispatchStatus:
      ProfileHomeFeedCollectionScheduleDispatchStatusSchema.optional(),
    lastFailureReason:
      ProfileHomeFeedCollectionScheduleFailureReasonSchema.optional(),
    consecutiveFailures: z.number().int().min(0),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const ProfileHomeFeedCollectionScheduleListResponseSchema = z
  .object({
    items: z.array(ProfileHomeFeedCollectionScheduleSchema),
    page: PageSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionScheduleResponseSchema = z
  .object({
    schedule: ProfileHomeFeedCollectionScheduleSchema,
  })
  .strict();

export const UpsertProfileHomeFeedCollectionScheduleRequestSchema = z
  .object({
    enabled: z.boolean(),
    intervalMinutes: z.number().int().min(1).max(10080),
    nextRunAt: z.string().datetime({ offset: true }),
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
    maxPosts: z.number().int().min(1).optional(),
  })
  .strict();

export type ProfileHomeFeedCollectionScheduleDispatchStatus = z.infer<
  typeof ProfileHomeFeedCollectionScheduleDispatchStatusSchema
>;
export type ProfileHomeFeedCollectionScheduleFailureReason = z.infer<
  typeof ProfileHomeFeedCollectionScheduleFailureReasonSchema
>;
export type ProfileHomeFeedCollectionScheduleParameters = z.infer<
  typeof ProfileHomeFeedCollectionScheduleParametersSchema
>;
export type ProfileHomeFeedCollectionSchedule = z.infer<
  typeof ProfileHomeFeedCollectionScheduleSchema
>;
export type ProfileHomeFeedCollectionScheduleListResponse = z.infer<
  typeof ProfileHomeFeedCollectionScheduleListResponseSchema
>;
export type ProfileHomeFeedCollectionScheduleResponse = z.infer<
  typeof ProfileHomeFeedCollectionScheduleResponseSchema
>;
export type UpsertProfileHomeFeedCollectionScheduleRequest = z.infer<
  typeof UpsertProfileHomeFeedCollectionScheduleRequestSchema
>;

export interface ListCollectionRunsQuery {
  readonly status?: CollectionRunStatus;
  readonly sourceGroupId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListAccountExerciseRunsQuery {
  readonly status?: AccountExerciseRunStatus;
  readonly profileId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListProfileSourceAccessCheckRunsQuery {
  readonly status?: ProfileSourceAccessCheckRunStatus;
  readonly profileId?: string;
  readonly sourceGroupId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListProfileHomeFeedCollectionRunsQuery {
  readonly status?: ProfileHomeFeedCollectionRunStatus;
  readonly profileId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListCollectionSchedulesQuery {
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListProfileHomeFeedCollectionSchedulesQuery {
  readonly enabled?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

export interface CollectorRuntimeClient {
  readonly listCollectionRuns: (
    query?: ListCollectionRunsQuery,
  ) => Promise<ApiResult<CollectionRunsListResponse>>;
  readonly requestCollectionRun: (
    request: RequestCollectionRunRequest,
  ) => Promise<ApiResult<CollectionRunResponse>>;
  readonly cancelCollectionRun: (
    collectionRunId: string,
  ) => Promise<ApiResult<CollectionRunResponse>>;
  readonly listAccountExerciseRuns: (
    query?: ListAccountExerciseRunsQuery,
  ) => Promise<ApiResult<AccountExerciseRunsListResponse>>;
  readonly getAccountExerciseRun: (
    accountExerciseRunId: string,
  ) => Promise<ApiResult<AccountExerciseRunResponse>>;
  readonly requestAccountExerciseRun: (
    request: RequestAccountExerciseRunRequest,
  ) => Promise<ApiResult<AccountExerciseRunResponse>>;
  readonly cancelAccountExerciseRun: (
    accountExerciseRunId: string,
  ) => Promise<ApiResult<AccountExerciseRunResponse>>;
  readonly listProfileSourceAccessCheckRuns: (
    query?: ListProfileSourceAccessCheckRunsQuery,
  ) => Promise<ApiResult<ProfileSourceAccessCheckRunsListResponse>>;
  readonly getProfileSourceAccessCheckRun: (
    checkRunId: string,
  ) => Promise<ApiResult<ProfileSourceAccessCheckRunResponse>>;
  readonly requestProfileSourceAccessCheckRun: (
    request: RequestProfileSourceAccessCheckRunRequest,
  ) => Promise<ApiResult<ProfileSourceAccessCheckRunResponse>>;
  readonly cancelProfileSourceAccessCheckRun: (
    checkRunId: string,
  ) => Promise<ApiResult<ProfileSourceAccessCheckRunResponse>>;
  readonly listProfileHomeFeedCollectionRuns: (
    query?: ListProfileHomeFeedCollectionRunsQuery,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionRunsListResponse>>;
  readonly getProfileHomeFeedCollectionRun: (
    profileHomeFeedCollectionRunId: string,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionRunResponse>>;
  readonly requestProfileHomeFeedCollectionRun: (
    request: RequestProfileHomeFeedCollectionRunRequest,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionRunResponse>>;
  readonly cancelProfileHomeFeedCollectionRun: (
    profileHomeFeedCollectionRunId: string,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionRunResponse>>;
  readonly listCollectionSchedules: (
    query?: ListCollectionSchedulesQuery,
  ) => Promise<ApiResult<CollectionScheduleListResponse>>;
  readonly getCollectionSchedule: (
    sourceGroupId: string,
  ) => Promise<ApiResult<CollectionScheduleResponse>>;
  readonly upsertCollectionSchedule: (
    sourceGroupId: string,
    request: UpsertCollectionScheduleRequest,
  ) => Promise<ApiResult<CollectionScheduleResponse>>;
  readonly listProfileHomeFeedCollectionSchedules: (
    query?: ListProfileHomeFeedCollectionSchedulesQuery,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionScheduleListResponse>>;
  readonly getProfileHomeFeedCollectionSchedule: (
    profileId: string,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionScheduleResponse>>;
  readonly upsertProfileHomeFeedCollectionSchedule: (
    profileId: string,
    request: UpsertProfileHomeFeedCollectionScheduleRequest,
  ) => Promise<ApiResult<ProfileHomeFeedCollectionScheduleResponse>>;
}

export function createCollectorRuntimeClient(
  httpClient: HttpClient = createHttpClient({
    baseUrl: env.VITE_API_BASE_URL,
  }),
): CollectorRuntimeClient {
  return {
    listCollectionRuns(query) {
      return httpClient.request({
        path: "/collector/collection-runs",
        query: toListCollectionRunsQueryParams(query),
        responseSchema: CollectionRunsListResponseSchema,
      });
    },
    requestCollectionRun(request) {
      return httpClient.request({
        path: "/collector/collection-runs",
        method: "POST",
        body: request,
        responseSchema: CollectionRunResponseSchema,
      });
    },
    cancelCollectionRun(collectionRunId) {
      return httpClient.request({
        path: `/collector/collection-runs/${encodeURIComponent(collectionRunId)}/cancel`,
        method: "POST",
        responseSchema: CollectionRunResponseSchema,
      });
    },
    listAccountExerciseRuns(query) {
      return httpClient.request({
        path: "/collector/account-exercise-runs",
        query: toListAccountExerciseRunsQueryParams(query),
        responseSchema: AccountExerciseRunsListResponseSchema,
      });
    },
    getAccountExerciseRun(accountExerciseRunId) {
      return httpClient.request({
        path: `/collector/account-exercise-runs/${encodeURIComponent(accountExerciseRunId)}`,
        responseSchema: AccountExerciseRunResponseSchema,
      });
    },
    requestAccountExerciseRun(request) {
      return httpClient.request({
        path: "/collector/account-exercise-runs",
        method: "POST",
        body: request,
        responseSchema: AccountExerciseRunResponseSchema,
      });
    },
    cancelAccountExerciseRun(accountExerciseRunId) {
      return httpClient.request({
        path: `/collector/account-exercise-runs/${encodeURIComponent(accountExerciseRunId)}/cancel`,
        method: "POST",
        responseSchema: AccountExerciseRunResponseSchema,
      });
    },
    listProfileSourceAccessCheckRuns(query) {
      return httpClient.request({
        path: "/collector/profile-source-access-check-runs",
        query: toListProfileSourceAccessCheckRunsQueryParams(query),
        responseSchema: ProfileSourceAccessCheckRunsListResponseSchema,
      });
    },
    getProfileSourceAccessCheckRun(checkRunId) {
      return httpClient.request({
        path: `/collector/profile-source-access-check-runs/${encodeURIComponent(checkRunId)}`,
        responseSchema: ProfileSourceAccessCheckRunResponseSchema,
      });
    },
    requestProfileSourceAccessCheckRun(request) {
      return httpClient.request({
        path: "/collector/profile-source-access-check-runs",
        method: "POST",
        body: request,
        responseSchema: ProfileSourceAccessCheckRunResponseSchema,
      });
    },
    cancelProfileSourceAccessCheckRun(checkRunId) {
      return httpClient.request({
        path: `/collector/profile-source-access-check-runs/${encodeURIComponent(checkRunId)}/cancel`,
        method: "POST",
        responseSchema: ProfileSourceAccessCheckRunResponseSchema,
      });
    },
    listProfileHomeFeedCollectionRuns(query) {
      return httpClient.request({
        path: "/collector/profile-home-feed-collection-runs",
        query: toListProfileHomeFeedCollectionRunsQueryParams(query),
        responseSchema: ProfileHomeFeedCollectionRunsListResponseSchema,
      });
    },
    getProfileHomeFeedCollectionRun(profileHomeFeedCollectionRunId) {
      return httpClient.request({
        path: `/collector/profile-home-feed-collection-runs/${encodeURIComponent(profileHomeFeedCollectionRunId)}`,
        responseSchema: ProfileHomeFeedCollectionRunResponseSchema,
      });
    },
    requestProfileHomeFeedCollectionRun(request) {
      return httpClient.request({
        path: "/collector/profile-home-feed-collection-runs",
        method: "POST",
        body: request,
        responseSchema: ProfileHomeFeedCollectionRunResponseSchema,
      });
    },
    cancelProfileHomeFeedCollectionRun(profileHomeFeedCollectionRunId) {
      return httpClient.request({
        path: `/collector/profile-home-feed-collection-runs/${encodeURIComponent(profileHomeFeedCollectionRunId)}/cancel`,
        method: "POST",
        responseSchema: ProfileHomeFeedCollectionRunResponseSchema,
      });
    },
    listCollectionSchedules(query) {
      return httpClient.request({
        path: "/collector/collection-schedules",
        query: toListCollectionSchedulesQueryParams(query),
        responseSchema: CollectionScheduleListResponseSchema,
      });
    },
    getCollectionSchedule(sourceGroupId) {
      return httpClient.request({
        path: `/collector/collection-schedules/${encodeURIComponent(sourceGroupId)}`,
        responseSchema: CollectionScheduleResponseSchema,
      });
    },
    upsertCollectionSchedule(sourceGroupId, request) {
      return httpClient.request({
        path: `/collector/collection-schedules/${encodeURIComponent(sourceGroupId)}`,
        method: "PUT",
        body: request,
        responseSchema: CollectionScheduleResponseSchema,
      });
    },
    listProfileHomeFeedCollectionSchedules(query) {
      return httpClient.request({
        path: "/collector/profile-home-feed-collection-schedules",
        query: toListProfileHomeFeedCollectionSchedulesQueryParams(query),
        responseSchema:
          ProfileHomeFeedCollectionScheduleListResponseSchema,
      });
    },
    getProfileHomeFeedCollectionSchedule(profileId) {
      return httpClient.request({
        path: `/collector/profile-home-feed-collection-schedules/${encodeURIComponent(profileId)}`,
        responseSchema: ProfileHomeFeedCollectionScheduleResponseSchema,
      });
    },
    upsertProfileHomeFeedCollectionSchedule(profileId, request) {
      return httpClient.request({
        path: `/collector/profile-home-feed-collection-schedules/${encodeURIComponent(profileId)}`,
        method: "PUT",
        body: request,
        responseSchema: ProfileHomeFeedCollectionScheduleResponseSchema,
      });
    },
  };
}

export const collectorRuntimeClient = createCollectorRuntimeClient();

export function toListCollectionRunsQueryParams(
  query: ListCollectionRunsQuery | undefined,
): Readonly<Record<string, string | number>> | undefined {
  if (query === undefined) {
    return undefined;
  }

  return {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.sourceGroupId !== undefined
      ? { sourceGroupId: query.sourceGroupId }
      : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
    ...(query.offset !== undefined ? { offset: query.offset } : {}),
  };
}

export function toListAccountExerciseRunsQueryParams(
  query: ListAccountExerciseRunsQuery | undefined,
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

export function toListProfileSourceAccessCheckRunsQueryParams(
  query: ListProfileSourceAccessCheckRunsQuery | undefined,
): Readonly<Record<string, string | number>> | undefined {
  if (query === undefined) {
    return undefined;
  }

  return {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.profileId !== undefined ? { profileId: query.profileId } : {}),
    ...(query.sourceGroupId !== undefined
      ? { sourceGroupId: query.sourceGroupId }
      : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
    ...(query.offset !== undefined ? { offset: query.offset } : {}),
  };
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

export function toListCollectionSchedulesQueryParams(
  query: ListCollectionSchedulesQuery | undefined,
): Readonly<Record<string, string | number>> | undefined {
  if (query === undefined) {
    return undefined;
  }

  return {
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
    ...(query.offset !== undefined ? { offset: query.offset } : {}),
  };
}

export function toListProfileHomeFeedCollectionSchedulesQueryParams(
  query: ListProfileHomeFeedCollectionSchedulesQuery | undefined,
): Readonly<Record<string, string | number | boolean>> | undefined {
  if (query === undefined) {
    return undefined;
  }

  return {
    ...(query.enabled !== undefined ? { enabled: query.enabled } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
    ...(query.offset !== undefined ? { offset: query.offset } : {}),
  };
}
