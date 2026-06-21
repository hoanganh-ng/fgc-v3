import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type ListProfileHomeFeedCollectionSchedulesQuery,
  type ProfileHomeFeedCollectionScheduleListResponse,
  type ProfileHomeFeedCollectionScheduleResponse,
  DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";

const defaultProfileHomeFeedCollectionSchedulesQuery = {
  limit: DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
  offset: 0,
} satisfies ListProfileHomeFeedCollectionSchedulesQuery;

export const profileHomeFeedCollectionScheduleQueryKeys = {
  all: ["profile-home-feed-collection-schedules"] as const,
  list: (query: ListProfileHomeFeedCollectionSchedulesQuery) =>
    [
      ...profileHomeFeedCollectionScheduleQueryKeys.all,
      "list",
      query,
    ] as const,
  detail: (profileId: string) =>
    [
      ...profileHomeFeedCollectionScheduleQueryKeys.all,
      "detail",
      profileId,
    ] as const,
};

export function useProfileHomeFeedCollectionSchedulesQuery(
  query: ListProfileHomeFeedCollectionSchedulesQuery = defaultProfileHomeFeedCollectionSchedulesQuery,
): UseQueryResult<
  ProfileHomeFeedCollectionScheduleListResponse,
  ApiResultError
> {
  return useQuery<
    ProfileHomeFeedCollectionScheduleListResponse,
    ApiResultError
  >({
    queryKey: profileHomeFeedCollectionScheduleQueryKeys.list(query),
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.listProfileHomeFeedCollectionSchedules(
          query,
        ),
      ),
  });
}

export function useProfileHomeFeedCollectionScheduleQuery(
  profileId: string,
): UseQueryResult<
  ProfileHomeFeedCollectionScheduleResponse,
  ApiResultError
> {
  const trimmed = profileId.trim();
  const enabled = trimmed.length > 0;

  return useQuery<
    ProfileHomeFeedCollectionScheduleResponse,
    ApiResultError
  >({
    queryKey: profileHomeFeedCollectionScheduleQueryKeys.detail(trimmed),
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.getProfileHomeFeedCollectionSchedule(
          trimmed,
        ),
      ),
    enabled,
  });
}