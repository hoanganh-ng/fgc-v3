import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type ListProfileHomeFeedCollectionRunsQuery,
  type ProfileHomeFeedCollectionRunResponse,
  type ProfileHomeFeedCollectionRunsListResponse,
  DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";

const defaultProfileHomeFeedCollectionRunsQuery = {
  limit: DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
  offset: 0,
} satisfies ListProfileHomeFeedCollectionRunsQuery;

export const profileHomeFeedCollectionRunQueryKeys = {
  all: ["profile-home-feed-collection-runs"] as const,
  list: (query: ListProfileHomeFeedCollectionRunsQuery) =>
    [...profileHomeFeedCollectionRunQueryKeys.all, "list", query] as const,
  detail: (profileHomeFeedCollectionRunId: string) =>
    [
      ...profileHomeFeedCollectionRunQueryKeys.all,
      "detail",
      profileHomeFeedCollectionRunId,
    ] as const,
};

export function useProfileHomeFeedCollectionRunsQuery(
  query: ListProfileHomeFeedCollectionRunsQuery = defaultProfileHomeFeedCollectionRunsQuery,
  options?: {
    readonly refetchInterval: number | false;
  },
): UseQueryResult<ProfileHomeFeedCollectionRunsListResponse, ApiResultError> {
  const queryOptions: Parameters<
    typeof useQuery<ProfileHomeFeedCollectionRunsListResponse, ApiResultError>
  >[0] = {
    queryKey: profileHomeFeedCollectionRunQueryKeys.list(query),
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.listProfileHomeFeedCollectionRuns(query),
      ),
  };

  if (options?.refetchInterval !== undefined) {
    queryOptions.refetchInterval = options.refetchInterval;
  }

  return useQuery<
    ProfileHomeFeedCollectionRunsListResponse,
    ApiResultError
  >(queryOptions);
}

export function useProfileHomeFeedCollectionRunQuery(
  profileHomeFeedCollectionRunId: string,
): UseQueryResult<ProfileHomeFeedCollectionRunResponse, ApiResultError> {
  const trimmed = profileHomeFeedCollectionRunId.trim();
  const enabled = trimmed.length > 0;

  return useQuery<ProfileHomeFeedCollectionRunResponse, ApiResultError>({
    queryKey: profileHomeFeedCollectionRunQueryKeys.detail(trimmed),
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.getProfileHomeFeedCollectionRun(trimmed),
      ),
    enabled,
  });
}
