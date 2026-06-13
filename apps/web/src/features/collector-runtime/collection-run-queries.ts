import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type CollectionRunsListResponse,
  type ListCollectionRunsQuery,
  DEFAULT_COLLECTION_RUN_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";

const defaultCollectionRunsQuery = {
  limit: DEFAULT_COLLECTION_RUN_LIST_LIMIT,
  offset: 0,
} satisfies ListCollectionRunsQuery;

export const collectionRunQueryKeys = {
  all: ["collection-runs"] as const,
  list: (query: ListCollectionRunsQuery) =>
    [...collectionRunQueryKeys.all, "list", query] as const,
};

export function useCollectionRunsQuery(
  query: ListCollectionRunsQuery = defaultCollectionRunsQuery,
  options?: {
    readonly refetchInterval: number | false;
  },
): UseQueryResult<CollectionRunsListResponse, ApiResultError> {
  const queryOptions: Parameters<typeof useQuery<CollectionRunsListResponse, ApiResultError>>[0] =
    {
      queryKey: collectionRunQueryKeys.list(query),
      queryFn: async () =>
        unwrapApiResult(await collectorRuntimeClient.listCollectionRuns(query)),
    };

  if (options?.refetchInterval !== undefined) {
    queryOptions.refetchInterval = options.refetchInterval;
  }

  return useQuery<CollectionRunsListResponse, ApiResultError>(queryOptions);
}
