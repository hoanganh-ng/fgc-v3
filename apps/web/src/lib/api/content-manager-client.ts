import { z } from "zod";
import { env } from "@/lib/env";
import {
  createHttpClient,
  type ApiResult,
  type HttpClient,
} from "@/lib/api/http-client";

export const SourceGroupStatusSchema = z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]);
export const ContentStatusSchema = z.enum([
  "COLLECTED",
  "SELECTED",
  "REJECTED",
  "USED",
]);
export const ContentPlatformSchema = z.enum(["FACEBOOK"]);

export type SourceGroupStatus = z.infer<typeof SourceGroupStatusSchema>;
export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type ContentPlatform = z.infer<typeof ContentPlatformSchema>;

const NonEmptyStringSchema = z.string().min(1);

const PageSchema = z
  .object({
    limit: z.number(),
    offset: z.number(),
    total: z.number().optional(),
  })
  .strict();

export const ContentCategorySchema = z
  .object({
    id: NonEmptyStringSchema,
    name: NonEmptyStringSchema,
    slug: NonEmptyStringSchema,
    description: NonEmptyStringSchema.optional(),
    createdAt: NonEmptyStringSchema,
    updatedAt: NonEmptyStringSchema,
  })
  .strict();

export const SourceGroupSchema = z
  .object({
    id: NonEmptyStringSchema,
    platform: ContentPlatformSchema,
    externalGroupId: NonEmptyStringSchema,
    name: NonEmptyStringSchema,
    url: NonEmptyStringSchema,
    categoryId: NonEmptyStringSchema,
    status: SourceGroupStatusSchema,
    collectionPriority: z.number().int().min(0).max(100),
    notes: NonEmptyStringSchema.optional(),
    createdAt: NonEmptyStringSchema,
    updatedAt: NonEmptyStringSchema,
  })
  .strict();

const TopCommentSchema = z
  .object({
    externalCommentId: NonEmptyStringSchema,
    bodyText: NonEmptyStringSchema,
    authorDisplayName: NonEmptyStringSchema.optional(),
    authorExternalId: NonEmptyStringSchema.optional(),
    reactionCount: z.number(),
    replyCount: z.number().optional(),
    postedAt: NonEmptyStringSchema.optional(),
    collectedAt: NonEmptyStringSchema,
  })
  .strict();

export const ContentItemSchema = z
  .object({
    id: NonEmptyStringSchema,
    platform: ContentPlatformSchema,
    sourceGroupId: NonEmptyStringSchema,
    externalPostId: NonEmptyStringSchema,
    sourceUrl: NonEmptyStringSchema,
    title: NonEmptyStringSchema.optional(),
    bodyText: NonEmptyStringSchema,
    authorDisplayName: NonEmptyStringSchema.optional(),
    authorExternalId: NonEmptyStringSchema.optional(),
    postedAt: NonEmptyStringSchema.optional(),
    firstCollectedAt: NonEmptyStringSchema,
    lastCollectedAt: NonEmptyStringSchema,
    reactionCount: z.number(),
    commentCount: z.number(),
    shareCount: z.number().optional(),
    topComments: z.array(TopCommentSchema),
    status: ContentStatusSchema,
    createdAt: NonEmptyStringSchema,
    updatedAt: NonEmptyStringSchema,
  })
  .strict();

export const ContentCategoriesListResponseSchema = z
  .object({
    items: z.array(ContentCategorySchema),
  })
  .strict();

export const CreateContentCategoryRequestSchema = z
  .object({
    name: NonEmptyStringSchema,
    slug: NonEmptyStringSchema,
    description: NonEmptyStringSchema.optional(),
  })
  .strict();

export const CreateContentCategoryResponseSchema = z
  .object({
    category: ContentCategorySchema,
  })
  .strict();

export const CreateSourceGroupRequestSchema = z
  .object({
    platform: ContentPlatformSchema,
    externalGroupId: NonEmptyStringSchema,
    name: NonEmptyStringSchema,
    url: NonEmptyStringSchema,
    categoryId: NonEmptyStringSchema,
    status: SourceGroupStatusSchema.optional(),
    collectionPriority: z.number().int().min(0).max(100),
    notes: NonEmptyStringSchema.optional(),
  })
  .strict();

export const CreateSourceGroupResponseSchema = z
  .object({
    sourceGroup: SourceGroupSchema,
  })
  .strict();

export const UpdateSourceGroupStatusRequestSchema = z
  .object({
    status: SourceGroupStatusSchema,
  })
  .strict();

export const UpdateSourceGroupStatusResponseSchema = z
  .object({
    sourceGroup: SourceGroupSchema,
  })
  .strict();

export const SourceGroupsListResponseSchema = z
  .object({
    items: z.array(SourceGroupSchema),
    page: PageSchema,
  })
  .strict();

export const ContentItemsListResponseSchema = z
  .object({
    items: z.array(ContentItemSchema),
    page: PageSchema,
  })
  .strict();

export type ContentCategory = z.infer<typeof ContentCategorySchema>;
export type SourceGroup = z.infer<typeof SourceGroupSchema>;
export type ContentItem = z.infer<typeof ContentItemSchema>;
export type ContentCategoriesListResponse = z.infer<
  typeof ContentCategoriesListResponseSchema
>;
export type CreateContentCategoryRequest = z.infer<
  typeof CreateContentCategoryRequestSchema
>;
export type CreateContentCategoryResponse = z.infer<
  typeof CreateContentCategoryResponseSchema
>;
export type CreateSourceGroupRequest = z.infer<
  typeof CreateSourceGroupRequestSchema
>;
export type CreateSourceGroupResponse = z.infer<
  typeof CreateSourceGroupResponseSchema
>;
export type UpdateSourceGroupStatusRequest = z.infer<
  typeof UpdateSourceGroupStatusRequestSchema
>;
export type UpdateSourceGroupStatusResponse = z.infer<
  typeof UpdateSourceGroupStatusResponseSchema
>;
export type SourceGroupsListResponse = z.infer<
  typeof SourceGroupsListResponseSchema
>;
export type ContentItemsListResponse = z.infer<
  typeof ContentItemsListResponseSchema
>;

export interface ListSourceGroupsQuery {
  readonly status?: SourceGroupStatus;
  readonly categoryId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ListContentItemsQuery {
  readonly status?: ContentStatus;
  readonly sourceGroupId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ContentManagerClient {
  readonly listContentCategories: () => Promise<
    ApiResult<ContentCategoriesListResponse>
  >;
  readonly createContentCategory: (
    request: CreateContentCategoryRequest,
  ) => Promise<ApiResult<CreateContentCategoryResponse>>;
  readonly listSourceGroups: (
    query?: ListSourceGroupsQuery,
  ) => Promise<ApiResult<SourceGroupsListResponse>>;
  readonly createSourceGroup: (
    request: CreateSourceGroupRequest,
  ) => Promise<ApiResult<CreateSourceGroupResponse>>;
  readonly updateSourceGroupStatus: (
    sourceGroupId: string,
    status: SourceGroupStatus,
  ) => Promise<ApiResult<UpdateSourceGroupStatusResponse>>;
  readonly listContentItems: (
    query?: ListContentItemsQuery,
  ) => Promise<ApiResult<ContentItemsListResponse>>;
}

export function createContentManagerClient(
  httpClient: HttpClient = createHttpClient({ baseUrl: env.VITE_API_BASE_URL }),
): ContentManagerClient {
  return {
    listContentCategories() {
      return httpClient.request({
        path: "/collector/content-categories",
        responseSchema: ContentCategoriesListResponseSchema,
      });
    },
    createContentCategory(request) {
      return httpClient.request({
        path: "/collector/content-categories",
        method: "POST",
        body: request,
        responseSchema: CreateContentCategoryResponseSchema,
      });
    },
    listSourceGroups(query) {
      return httpClient.request({
        path: "/collector/source-groups",
        query: toListSourceGroupsQueryParams(query),
        responseSchema: SourceGroupsListResponseSchema,
      });
    },
    createSourceGroup(request) {
      return httpClient.request({
        path: "/collector/source-groups",
        method: "POST",
        body: request,
        responseSchema: CreateSourceGroupResponseSchema,
      });
    },
    updateSourceGroupStatus(sourceGroupId, status) {
      return httpClient.request({
        path: `/collector/source-groups/${encodeURIComponent(sourceGroupId)}/status`,
        method: "PATCH",
        body: { status } satisfies UpdateSourceGroupStatusRequest,
        responseSchema: UpdateSourceGroupStatusResponseSchema,
      });
    },
    listContentItems(query) {
      return httpClient.request({
        path: "/collector/content-items",
        query: toListContentItemsQueryParams(query),
        responseSchema: ContentItemsListResponseSchema,
      });
    },
  };
}

export const contentManagerClient = createContentManagerClient();

function toListSourceGroupsQueryParams(
  query: ListSourceGroupsQuery | undefined,
): Readonly<Record<string, string | number>> | undefined {
  if (query === undefined) {
    return undefined;
  }

  return {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.categoryId !== undefined ? { categoryId: query.categoryId } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
    ...(query.offset !== undefined ? { offset: query.offset } : {}),
  };
}

function toListContentItemsQueryParams(
  query: ListContentItemsQuery | undefined,
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
