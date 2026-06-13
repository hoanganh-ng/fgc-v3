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

export type CollectionRunStatus = z.infer<typeof CollectionRunStatusSchema>;
export type CollectionRunTriggerType = z.infer<
  typeof CollectionRunTriggerTypeSchema
>;

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

export const RequestCollectionRunRequestSchema = z
  .object({
    sourceGroupId: NonEmptyStringSchema,
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
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

export const DEFAULT_COLLECTION_RUN_LIST_LIMIT = 50;
export const MAX_COLLECTION_RUN_LIST_LIMIT = 100;

export interface ListCollectionRunsQuery {
  readonly status?: CollectionRunStatus;
  readonly sourceGroupId?: string;
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
  };
}

export const collectorRuntimeClient = createCollectorRuntimeClient();

function toListCollectionRunsQueryParams(
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
