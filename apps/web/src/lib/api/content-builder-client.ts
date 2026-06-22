import { z } from "zod";
import { env } from "@/lib/env";
import {
  createHttpClient,
  type ApiPage,
  type ApiResult,
  type HttpClient,
} from "@/lib/api/http-client";

export const TransformTypeStatusSchema = z.enum(["ACTIVE", "ARCHIVED"]);
export type TransformTypeStatus = z.infer<typeof TransformTypeStatusSchema>;

const NonEmptyStringSchema = z.string().min(1);

const PageSchema = z
  .object({
    limit: z.number(),
    offset: z.number(),
    total: z.number().optional(),
  })
  .strict();

export const TransformTypeSchema = z
  .object({
    transformTypeId: NonEmptyStringSchema,
    name: NonEmptyStringSchema,
    description: NonEmptyStringSchema.optional(),
    initialPrompt: NonEmptyStringSchema,
    status: TransformTypeStatusSchema,
    createdAt: NonEmptyStringSchema,
    updatedAt: NonEmptyStringSchema,
  })
  .strict();

export const TransformTypeResponseSchema = z
  .object({
    transformType: TransformTypeSchema,
  })
  .strict();

export const TransformTypesListResponseSchema = z
  .object({
    items: z.array(TransformTypeSchema),
    page: PageSchema,
  })
  .strict();

export const CreateTransformTypeRequestSchema = z
  .object({
    name: NonEmptyStringSchema,
    description: NonEmptyStringSchema.optional(),
    initialPrompt: NonEmptyStringSchema,
  })
  .strict();

export const UpdateTransformTypeRequestSchema = z
  .object({
    name: NonEmptyStringSchema.optional(),
    description: NonEmptyStringSchema.nullable().optional(),
    initialPrompt: NonEmptyStringSchema.optional(),
  })
  .strict();

export type TransformType = z.infer<typeof TransformTypeSchema>;
export type TransformTypeResponse = z.infer<typeof TransformTypeResponseSchema>;
export type TransformTypesListResponse = z.infer<
  typeof TransformTypesListResponseSchema
>;
export type CreateTransformTypeRequest = z.infer<
  typeof CreateTransformTypeRequestSchema
>;
export type UpdateTransformTypeRequest = z.infer<
  typeof UpdateTransformTypeRequestSchema
>;

export interface ListTransformTypesQuery {
  readonly status?: TransformTypeStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ContentBuilderClient {
  listTransformTypes(
    query?: ListTransformTypesQuery,
  ): Promise<ApiResult<TransformTypesListResponse>>;
  createTransformType(
    request: CreateTransformTypeRequest,
  ): Promise<ApiResult<TransformTypeResponse>>;
  getTransformType(
    transformTypeId: string,
  ): Promise<ApiResult<TransformTypeResponse>>;
  updateTransformType(
    transformTypeId: string,
    request: UpdateTransformTypeRequest,
  ): Promise<ApiResult<TransformTypeResponse>>;
  archiveTransformType(
    transformTypeId: string,
  ): Promise<ApiResult<TransformTypeResponse>>;
}

export function createContentBuilderClient(
  httpClient: HttpClient,
): ContentBuilderClient {
  return {
    listTransformTypes(query = {}) {
      return httpClient.request<TransformTypesListResponse>({
        path: "/builder/transform-types",
        query: {
          ...(query.status !== undefined ? { status: query.status } : {}),
          ...(query.limit !== undefined ? { limit: query.limit } : {}),
          ...(query.offset !== undefined ? { offset: query.offset } : {}),
        },
        responseSchema: TransformTypesListResponseSchema,
      });
    },
    createTransformType(request) {
      return httpClient.request<
        TransformTypeResponse,
        CreateTransformTypeRequest
      >({
        path: "/builder/transform-types",
        method: "POST",
        body: request,
        responseSchema: TransformTypeResponseSchema,
      });
    },
    getTransformType(transformTypeId) {
      return httpClient.request<TransformTypeResponse>({
        path: `/builder/transform-types/${encodeURIComponent(transformTypeId)}`,
        responseSchema: TransformTypeResponseSchema,
      });
    },
    updateTransformType(transformTypeId, request) {
      return httpClient.request<
        TransformTypeResponse,
        UpdateTransformTypeRequest
      >({
        path: `/builder/transform-types/${encodeURIComponent(transformTypeId)}`,
        method: "PATCH",
        body: request,
        responseSchema: TransformTypeResponseSchema,
      });
    },
    archiveTransformType(transformTypeId) {
      return httpClient.request<TransformTypeResponse>({
        path: `/builder/transform-types/${encodeURIComponent(
          transformTypeId,
        )}/archive`,
        method: "POST",
        responseSchema: TransformTypeResponseSchema,
      });
    },
  };
}

export const contentBuilderClient = createContentBuilderClient(
  createHttpClient({ baseUrl: env.VITE_API_BASE_URL }),
);

export type { ApiPage };
