import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type ProfileSourceAccessCheckRunResponse,
  type RequestProfileSourceAccessCheckRunRequest,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";
import { profileSourceAccessCheckRunQueryKeys } from "@/features/collector-runtime/profile-source-access-check-run-queries";

export interface CancelProfileSourceAccessCheckRunVariables {
  readonly checkRunId: string;
}

export function useRequestProfileSourceAccessCheckRunMutation(): UseMutationResult<
  ProfileSourceAccessCheckRunResponse,
  ApiResultError,
  RequestProfileSourceAccessCheckRunRequest
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileSourceAccessCheckRunResponse,
    ApiResultError,
    RequestProfileSourceAccessCheckRunRequest
  >({
    mutationFn: async (request) =>
      unwrapApiResult(
        await collectorRuntimeClient.requestProfileSourceAccessCheckRun(request),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: profileSourceAccessCheckRunQueryKeys.all,
      });
    },
  });
}

export function useCancelProfileSourceAccessCheckRunMutation(): UseMutationResult<
  ProfileSourceAccessCheckRunResponse,
  ApiResultError,
  CancelProfileSourceAccessCheckRunVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileSourceAccessCheckRunResponse,
    ApiResultError,
    CancelProfileSourceAccessCheckRunVariables
  >({
    mutationFn: async ({ checkRunId }) =>
      unwrapApiResult(
        await collectorRuntimeClient.cancelProfileSourceAccessCheckRun(checkRunId),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: profileSourceAccessCheckRunQueryKeys.all,
      });
    },
  });
}
