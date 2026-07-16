import { z } from "zod";
import type { ApiResult, HttpClient } from "@/lib/api/http-client";
import { NonEmptyStringSchema, PageSchema } from "./transport";

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

export const DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT = 50;
export const MAX_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT = 100;

export interface ListProfileHomeFeedCollectionSchedulesQuery {
  readonly enabled?: boolean;
  readonly limit?: number;
  readonly offset?: number;
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

export function createProfileHomeFeedCollectionSchedulesOperations(
  httpClient: HttpClient,
) {
  return {
    listProfileHomeFeedCollectionSchedules(
      query?: ListProfileHomeFeedCollectionSchedulesQuery,
    ) {
      return httpClient.request({
        path: "/collector/profile-home-feed-collection-schedules",
        query: toListProfileHomeFeedCollectionSchedulesQueryParams(query),
        responseSchema:
          ProfileHomeFeedCollectionScheduleListResponseSchema,
      });
    },
    getProfileHomeFeedCollectionSchedule(profileId: string) {
      return httpClient.request({
        path: `/collector/profile-home-feed-collection-schedules/${encodeURIComponent(profileId)}`,
        responseSchema: ProfileHomeFeedCollectionScheduleResponseSchema,
      });
    },
    upsertProfileHomeFeedCollectionSchedule(
      profileId: string,
      request: UpsertProfileHomeFeedCollectionScheduleRequest,
    ) {
      return httpClient.request({
        path: `/collector/profile-home-feed-collection-schedules/${encodeURIComponent(profileId)}`,
        method: "PUT",
        body: request,
        responseSchema: ProfileHomeFeedCollectionScheduleResponseSchema,
      });
    },
  } satisfies {
    listProfileHomeFeedCollectionSchedules: (
      query?: ListProfileHomeFeedCollectionSchedulesQuery,
    ) => Promise<ApiResult<ProfileHomeFeedCollectionScheduleListResponse>>;
    getProfileHomeFeedCollectionSchedule: (
      profileId: string,
    ) => Promise<ApiResult<ProfileHomeFeedCollectionScheduleResponse>>;
    upsertProfileHomeFeedCollectionSchedule: (
      profileId: string,
      request: UpsertProfileHomeFeedCollectionScheduleRequest,
    ) => Promise<ApiResult<ProfileHomeFeedCollectionScheduleResponse>>;
  };
}
