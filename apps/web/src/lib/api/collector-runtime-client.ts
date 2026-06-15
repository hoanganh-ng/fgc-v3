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

export const CollectionRunTriggerTypeSchema = z.enum(["MANUAL_API"]);

export const AccountExerciseRunStatusSchema = z.enum([
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
]);

export const AccountExerciseTypeSchema = z.enum(["AMBIENT_ACCOUNT"]);

export type CollectionRunStatus = z.infer<typeof CollectionRunStatusSchema>;
export type CollectionRunTriggerType = z.infer<
  typeof CollectionRunTriggerTypeSchema
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
    safeSummary: AccountExerciseRunSafeSummarySchema.optional(),
    failureReason: AccountExerciseRunFailureReasonSchema.optional(),
    requestedAt: z.string().datetime({ offset: true }),
    startedAt: z.string().datetime({ offset: true }).optional(),
    finishedAt: z.string().datetime({ offset: true }).optional(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

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

export const RequestAccountExerciseRunRequestSchema = z
  .object({
    profileId: NonEmptyStringSchema,
    stageAtStart: NonEmptyStringSchema,
    maxDurationMs: z.number().int().min(1),
    maxScrolls: z.number().int().min(0),
    minDwellMs: z.number().int().min(0).optional(),
  })
  .strict();

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

export const DEFAULT_COLLECTION_RUN_LIST_LIMIT = 50;
export const MAX_COLLECTION_RUN_LIST_LIMIT = 100;
export const DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT = 50;
export const MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT = 100;

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
