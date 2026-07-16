import { z } from "zod";
import type { ApiResult, HttpClient } from "@/lib/api/http-client";
import { NonEmptyStringSchema, PageSchema } from "./transport";

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

export const DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT = 50;
export const MAX_COLLECTION_SCHEDULE_LIST_LIMIT = 100;

export interface ListCollectionSchedulesQuery {
  readonly limit?: number;
  readonly offset?: number;
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

export function createCollectionSchedulesOperations(httpClient: HttpClient) {
  return {
    listCollectionSchedules(query?: ListCollectionSchedulesQuery) {
      return httpClient.request({
        path: "/collector/collection-schedules",
        query: toListCollectionSchedulesQueryParams(query),
        responseSchema: CollectionScheduleListResponseSchema,
      });
    },
    getCollectionSchedule(sourceGroupId: string) {
      return httpClient.request({
        path: `/collector/collection-schedules/${encodeURIComponent(sourceGroupId)}`,
        responseSchema: CollectionScheduleResponseSchema,
      });
    },
    upsertCollectionSchedule(
      sourceGroupId: string,
      request: UpsertCollectionScheduleRequest,
    ) {
      return httpClient.request({
        path: `/collector/collection-schedules/${encodeURIComponent(sourceGroupId)}`,
        method: "PUT",
        body: request,
        responseSchema: CollectionScheduleResponseSchema,
      });
    },
  } satisfies {
    listCollectionSchedules: (
      query?: ListCollectionSchedulesQuery,
    ) => Promise<ApiResult<CollectionScheduleListResponse>>;
    getCollectionSchedule: (
      sourceGroupId: string,
    ) => Promise<ApiResult<CollectionScheduleResponse>>;
    upsertCollectionSchedule: (
      sourceGroupId: string,
      request: UpsertCollectionScheduleRequest,
    ) => Promise<ApiResult<CollectionScheduleResponse>>;
  };
}
