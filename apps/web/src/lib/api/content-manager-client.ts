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

const PageSchema = z
  .object({
    limit: z.number(),
    offset: z.number(),
    total: z.number().optional(),
  })
  .strict();

export const SourceGroupSchema = z
  .object({
    id: z.string().min(1),
    platform: ContentPlatformSchema,
    externalGroupId: z.string().min(1),
    name: z.string().min(1),
    url: z.string().min(1),
    categoryId: z.string().min(1),
    status: SourceGroupStatusSchema,
    collectionPriority: z.number(),
    notes: z.string().min(1).optional(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();

const TopCommentSchema = z
  .object({
    externalCommentId: z.string().min(1),
    bodyText: z.string().min(1),
    authorDisplayName: z.string().min(1).optional(),
    authorExternalId: z.string().min(1).optional(),
    reactionCount: z.number(),
    replyCount: z.number().optional(),
    postedAt: z.string().min(1).optional(),
    collectedAt: z.string().min(1),
  })
  .strict();

export const ContentItemSchema = z
  .object({
    id: z.string().min(1),
    platform: ContentPlatformSchema,
    sourceGroupId: z.string().min(1),
    externalPostId: z.string().min(1),
    sourceUrl: z.string().min(1),
    title: z.string().min(1).optional(),
    bodyText: z.string().min(1),
    authorDisplayName: z.string().min(1).optional(),
    authorExternalId: z.string().min(1).optional(),
    postedAt: z.string().min(1).optional(),
    firstCollectedAt: z.string().min(1),
    lastCollectedAt: z.string().min(1),
    reactionCount: z.number(),
    commentCount: z.number(),
    shareCount: z.number().optional(),
    topComments: z.array(TopCommentSchema),
    status: ContentStatusSchema,
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
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

export type SourceGroup = z.infer<typeof SourceGroupSchema>;
export type ContentItem = z.infer<typeof ContentItemSchema>;
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
  readonly listSourceGroups: (
    query?: ListSourceGroupsQuery,
  ) => Promise<ApiResult<SourceGroupsListResponse>>;
  readonly listContentItems: (
    query?: ListContentItemsQuery,
  ) => Promise<ApiResult<ContentItemsListResponse>>;
}

export function createContentManagerClient(
  httpClient: HttpClient = createHttpClient({ baseUrl: env.VITE_API_BASE_URL }),
): ContentManagerClient {
  return {
    listSourceGroups(query) {
      return httpClient.request({
        path: "/collector/source-groups",
        query: toListSourceGroupsQueryParams(query),
        responseSchema: SourceGroupsListResponseSchema,
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
