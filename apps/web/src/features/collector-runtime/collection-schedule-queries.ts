import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type CollectionScheduleListResponse,
  type CollectionScheduleResponse,
  type ListCollectionSchedulesQuery,
  DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";

const defaultCollectionSchedulesQuery = {
  limit: DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT,
  offset: 0,
} satisfies ListCollectionSchedulesQuery;

export const collectionScheduleQueryKeys = {
  all: ["collection-schedules"] as const,
  list: (query: ListCollectionSchedulesQuery) =>
    [...collectionScheduleQueryKeys.all, "list", query] as const,
  detail: (sourceGroupId: string) =>
    [...collectionScheduleQueryKeys.all, "detail", sourceGroupId] as const,
};

export function useCollectionSchedulesQuery(
  query: ListCollectionSchedulesQuery = defaultCollectionSchedulesQuery,
): UseQueryResult<CollectionScheduleListResponse, ApiResultError> {
  return useQuery<CollectionScheduleListResponse, ApiResultError>({
    queryKey: collectionScheduleQueryKeys.list(query),
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.listCollectionSchedules(query),
      ),
  });
}

export function useCollectionScheduleQuery(
  sourceGroupId: string,
): UseQueryResult<CollectionScheduleResponse, ApiResultError> {
  const trimmed = sourceGroupId.trim();
  const enabled = trimmed.length > 0;

  return useQuery<CollectionScheduleResponse, ApiResultError>({
    queryKey: collectionScheduleQueryKeys.detail(trimmed),
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.getCollectionSchedule(trimmed),
      ),
    enabled,
  });
}
