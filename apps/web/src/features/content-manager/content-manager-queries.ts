import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  contentManagerClient,
  type ContentCategoriesListResponse,
  type ContentItemResponse,
  type ContentItemsListResponse,
  type ListContentItemsQuery,
  type ListSourceGroupsQuery,
  type SourceGroupsListResponse,
} from "@/lib/api/content-manager-client";
import {
  unwrapApiResult,
  type ApiResultError,
} from "@/lib/api/http-client";

const defaultSourceGroupsQuery = {
  limit: 100,
  offset: 0,
} satisfies ListSourceGroupsQuery;

const defaultContentItemsQuery = {
  limit: 100,
  offset: 0,
} satisfies ListContentItemsQuery;

export const contentManagerQueryKeys = {
  all: ["content-manager"] as const,
  categories: () => [...contentManagerQueryKeys.all, "categories"] as const,
  sourceGroups: (query: ListSourceGroupsQuery) =>
    [...contentManagerQueryKeys.all, "source-groups", query] as const,
  contentItems: () => [...contentManagerQueryKeys.all, "content-items"] as const,
  contentItemsList: (query: ListContentItemsQuery) =>
    [...contentManagerQueryKeys.contentItems(), "list", query] as const,
  contentItem: (contentItemId: string) =>
    [...contentManagerQueryKeys.contentItems(), "detail", contentItemId] as const,
};

export function useContentCategoriesQuery(): UseQueryResult<
  ContentCategoriesListResponse,
  ApiResultError
> {
  return useQuery<ContentCategoriesListResponse, ApiResultError>({
    queryKey: contentManagerQueryKeys.categories(),
    queryFn: async () =>
      unwrapApiResult(await contentManagerClient.listContentCategories()),
  });
}

export function useSourceGroupsQuery(
  query: ListSourceGroupsQuery = defaultSourceGroupsQuery,
): UseQueryResult<SourceGroupsListResponse, ApiResultError> {
  return useQuery<SourceGroupsListResponse, ApiResultError>({
    queryKey: contentManagerQueryKeys.sourceGroups(query),
    queryFn: async () =>
      unwrapApiResult(await contentManagerClient.listSourceGroups(query)),
  });
}

export function useContentItemsQuery(
  query: ListContentItemsQuery = defaultContentItemsQuery,
): UseQueryResult<ContentItemsListResponse, ApiResultError> {
  return useQuery<ContentItemsListResponse, ApiResultError>({
    queryKey: contentManagerQueryKeys.contentItemsList(query),
    queryFn: async () =>
      unwrapApiResult(await contentManagerClient.listContentItems(query)),
  });
}

export function useContentItemQuery(
  contentItemId: string,
): UseQueryResult<ContentItemResponse, ApiResultError> {
  const enabled = contentItemId.trim().length > 0;

  return useQuery<ContentItemResponse, ApiResultError>({
    queryKey: contentManagerQueryKeys.contentItem(contentItemId),
    queryFn: async () =>
      unwrapApiResult(await contentManagerClient.getContentItem(contentItemId)),
    enabled,
  });
}
