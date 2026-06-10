import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  contentManagerClient,
  type ContentCategoriesListResponse,
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

export const contentManagerQueryKeys = {
  all: ["content-manager"] as const,
  categories: () => [...contentManagerQueryKeys.all, "categories"] as const,
  sourceGroups: (query: ListSourceGroupsQuery) =>
    [...contentManagerQueryKeys.all, "source-groups", query] as const,
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
