import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type AccountExerciseRunResponse,
  type RequestAccountExerciseRunRequest,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";
import { accountExerciseRunQueryKeys } from "@/features/collector-runtime/account-exercise-run-queries";

export interface CancelAccountExerciseRunVariables {
  readonly accountExerciseRunId: string;
}

export async function invalidateAccountExerciseRunQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: accountExerciseRunQueryKeys.all,
  });
}

export function useRequestAccountExerciseRunMutation(): UseMutationResult<
  AccountExerciseRunResponse,
  ApiResultError,
  RequestAccountExerciseRunRequest
> {
  const queryClient = useQueryClient();

  return useMutation<
    AccountExerciseRunResponse,
    ApiResultError,
    RequestAccountExerciseRunRequest
  >({
    mutationFn: async (request) =>
      unwrapApiResult(
        await collectorRuntimeClient.requestAccountExerciseRun(request),
      ),
    onSuccess: async () => {
      await invalidateAccountExerciseRunQueries(queryClient);
    },
  });
}

export function useCancelAccountExerciseRunMutation(): UseMutationResult<
  AccountExerciseRunResponse,
  ApiResultError,
  CancelAccountExerciseRunVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    AccountExerciseRunResponse,
    ApiResultError,
    CancelAccountExerciseRunVariables
  >({
    mutationFn: async ({ accountExerciseRunId }) =>
      unwrapApiResult(
        await collectorRuntimeClient.cancelAccountExerciseRun(
          accountExerciseRunId,
        ),
      ),
    onSuccess: async () => {
      await invalidateAccountExerciseRunQueries(queryClient);
    },
  });
}
