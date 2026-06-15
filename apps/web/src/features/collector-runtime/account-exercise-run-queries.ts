import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type AccountExerciseRunResponse,
  type AccountExerciseRunsListResponse,
  type ListAccountExerciseRunsQuery,
  DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";

const defaultAccountExerciseRunsQuery = {
  limit: DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
  offset: 0,
} satisfies ListAccountExerciseRunsQuery;

export const accountExerciseRunQueryKeys = {
  all: ["account-exercise-runs"] as const,
  list: (query: ListAccountExerciseRunsQuery) =>
    [...accountExerciseRunQueryKeys.all, "list", query] as const,
  detail: (accountExerciseRunId: string) =>
    [...accountExerciseRunQueryKeys.all, "detail", accountExerciseRunId] as const,
};

export function useAccountExerciseRunsQuery(
  query: ListAccountExerciseRunsQuery = defaultAccountExerciseRunsQuery,
  options?: {
    readonly refetchInterval?: number | false;
  },
): UseQueryResult<AccountExerciseRunsListResponse, ApiResultError> {
  const queryOptions: Parameters<
    typeof useQuery<AccountExerciseRunsListResponse, ApiResultError>
  >[0] = {
    queryKey: accountExerciseRunQueryKeys.list(query),
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.listAccountExerciseRuns(query),
      ),
  };

  if (options?.refetchInterval !== undefined) {
    queryOptions.refetchInterval = options.refetchInterval;
  }

  return useQuery<AccountExerciseRunsListResponse, ApiResultError>(
    queryOptions,
  );
}

export function useAccountExerciseRunQuery(
  accountExerciseRunId: string | undefined,
): UseQueryResult<AccountExerciseRunResponse, ApiResultError> {
  const normalizedId = accountExerciseRunId?.trim() ?? "";

  return useQuery<AccountExerciseRunResponse, ApiResultError>({
    queryKey: accountExerciseRunQueryKeys.detail(normalizedId),
    enabled: normalizedId.length > 0,
    queryFn: async () =>
      unwrapApiResult(
        await collectorRuntimeClient.getAccountExerciseRun(normalizedId),
      ),
  });
}
