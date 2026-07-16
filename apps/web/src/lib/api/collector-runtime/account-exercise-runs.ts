import { z } from "zod";
import type { ApiResult, HttpClient } from "@/lib/api/http-client";
import { NonEmptyStringSchema, PageSchema } from "./transport";

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

export type AccountExerciseRunStatus = z.infer<
  typeof AccountExerciseRunStatusSchema
>;
export type AccountExerciseType = z.infer<typeof AccountExerciseTypeSchema>;

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

export const DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT = 50;
export const MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT = 100;

export interface ListAccountExerciseRunsQuery {
  readonly status?: AccountExerciseRunStatus;
  readonly profileId?: string;
  readonly limit?: number;
  readonly offset?: number;
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

export function createAccountExerciseRunsOperations(httpClient: HttpClient) {
  return {
    listAccountExerciseRuns(query?: ListAccountExerciseRunsQuery) {
      return httpClient.request({
        path: "/collector/account-exercise-runs",
        query: toListAccountExerciseRunsQueryParams(query),
        responseSchema: AccountExerciseRunsListResponseSchema,
      });
    },
    getAccountExerciseRun(accountExerciseRunId: string) {
      return httpClient.request({
        path: `/collector/account-exercise-runs/${encodeURIComponent(accountExerciseRunId)}`,
        responseSchema: AccountExerciseRunResponseSchema,
      });
    },
    requestAccountExerciseRun(request: RequestAccountExerciseRunRequest) {
      return httpClient.request({
        path: "/collector/account-exercise-runs",
        method: "POST",
        body: request,
        responseSchema: AccountExerciseRunResponseSchema,
      });
    },
    cancelAccountExerciseRun(accountExerciseRunId: string) {
      return httpClient.request({
        path: `/collector/account-exercise-runs/${encodeURIComponent(accountExerciseRunId)}/cancel`,
        method: "POST",
        responseSchema: AccountExerciseRunResponseSchema,
      });
    },
  } satisfies {
    listAccountExerciseRuns: (
      query?: ListAccountExerciseRunsQuery,
    ) => Promise<ApiResult<AccountExerciseRunsListResponse>>;
    getAccountExerciseRun: (
      accountExerciseRunId: string,
    ) => Promise<ApiResult<AccountExerciseRunResponse>>;
    requestAccountExerciseRun: (
      request: RequestAccountExerciseRunRequest,
    ) => Promise<ApiResult<AccountExerciseRunResponse>>;
    cancelAccountExerciseRun: (
      accountExerciseRunId: string,
    ) => Promise<ApiResult<AccountExerciseRunResponse>>;
  };
}
