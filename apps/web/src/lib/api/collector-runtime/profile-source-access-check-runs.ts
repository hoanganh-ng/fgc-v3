import { z } from "zod";
import type { ApiResult, HttpClient } from "@/lib/api/http-client";
import { NonEmptyStringSchema, PageSchema } from "./transport";

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

export const DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT = 50;
export const MAX_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT = 100;

export interface ListProfileSourceAccessCheckRunsQuery {
  readonly status?: ProfileSourceAccessCheckRunStatus;
  readonly profileId?: string;
  readonly sourceGroupId?: string;
  readonly limit?: number;
  readonly offset?: number;
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

export function createProfileSourceAccessCheckRunsOperations(
  httpClient: HttpClient,
) {
  return {
    listProfileSourceAccessCheckRuns(
      query?: ListProfileSourceAccessCheckRunsQuery,
    ) {
      return httpClient.request({
        path: "/collector/profile-source-access-check-runs",
        query: toListProfileSourceAccessCheckRunsQueryParams(query),
        responseSchema: ProfileSourceAccessCheckRunsListResponseSchema,
      });
    },
    getProfileSourceAccessCheckRun(checkRunId: string) {
      return httpClient.request({
        path: `/collector/profile-source-access-check-runs/${encodeURIComponent(checkRunId)}`,
        responseSchema: ProfileSourceAccessCheckRunResponseSchema,
      });
    },
    requestProfileSourceAccessCheckRun(
      request: RequestProfileSourceAccessCheckRunRequest,
    ) {
      return httpClient.request({
        path: "/collector/profile-source-access-check-runs",
        method: "POST",
        body: request,
        responseSchema: ProfileSourceAccessCheckRunResponseSchema,
      });
    },
    cancelProfileSourceAccessCheckRun(checkRunId: string) {
      return httpClient.request({
        path: `/collector/profile-source-access-check-runs/${encodeURIComponent(checkRunId)}/cancel`,
        method: "POST",
        responseSchema: ProfileSourceAccessCheckRunResponseSchema,
      });
    },
  } satisfies {
    listProfileSourceAccessCheckRuns: (
      query?: ListProfileSourceAccessCheckRunsQuery,
    ) => Promise<ApiResult<ProfileSourceAccessCheckRunsListResponse>>;
    getProfileSourceAccessCheckRun: (
      checkRunId: string,
    ) => Promise<ApiResult<ProfileSourceAccessCheckRunResponse>>;
    requestProfileSourceAccessCheckRun: (
      request: RequestProfileSourceAccessCheckRunRequest,
    ) => Promise<ApiResult<ProfileSourceAccessCheckRunResponse>>;
    cancelProfileSourceAccessCheckRun: (
      checkRunId: string,
    ) => Promise<ApiResult<ProfileSourceAccessCheckRunResponse>>;
  };
}
