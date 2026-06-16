import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type ProfileSourceAccessCheckRunResponse,
  type ProfileSourceAccessCheckRunsListResponse,
  type ListProfileSourceAccessCheckRunsQuery,
  DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";

const defaultProfileSourceAccessCheckRunsQuery = {
  limit: DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT,
  offset: 0,
} satisfies ListProfileSourceAccessCheckRunsQuery;

export const profileSourceAccessCheckRunQueryKeys = {
  all: ["profile-source-access-check-runs"] as const,
  list: (query: ListProfileSourceAccessCheckRunsQuery) =>
    [...profileSourceAccessCheckRunQueryKeys.all, "list", query] as const,
  detail: (checkRunId: string) =>
    [...profileSourceAccessCheckRunQueryKeys.all, "detail", checkRunId] as const,
};

export function useProfileSourceAccessCheckRunsQuery(
  query: ListProfileSourceAccessCheckRunsQuery = defaultProfileSourceAccessCheckRunsQuery,
  options?: {
    readonly refetchInterval?: number | false;
  },
): UseQueryResult<ProfileSourceAccessCheckRunsListResponse, ApiResultError> {
  const queryOptions: Parameters<
    typeof useQuery<ProfileSourceAccessCheckRunsListResponse, ApiResultError>
  >[0] = {
    queryKey: profileSourceAccessCheckRunQueryKeys.list(query),
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.listProfileSourceAccessCheckRuns(query),
      ),
  };

  if (options?.refetchInterval !== undefined) {
    queryOptions.refetchInterval = options.refetchInterval;
  }

  return useQuery<ProfileSourceAccessCheckRunsListResponse, ApiResultError>(
    queryOptions,
  );
}

export function useProfileSourceAccessCheckRunQuery(
  checkRunId: string | undefined,
): UseQueryResult<ProfileSourceAccessCheckRunResponse, ApiResultError> {
  const normalizedId = checkRunId?.trim() ?? "";

  return useQuery<ProfileSourceAccessCheckRunResponse, ApiResultError>({
    queryKey: profileSourceAccessCheckRunQueryKeys.detail(normalizedId),
    enabled: normalizedId.length > 0,
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.getProfileSourceAccessCheckRun(normalizedId),
      ),
  });
}
