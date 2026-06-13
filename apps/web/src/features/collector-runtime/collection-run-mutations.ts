import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type CollectionRunResponse,
  type RequestCollectionRunRequest,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";
import { collectionRunQueryKeys } from "@/features/collector-runtime/collection-run-queries";

export interface CancelCollectionRunVariables {
  readonly collectionRunId: string;
}

export function useRequestCollectionRunMutation(): UseMutationResult<
  CollectionRunResponse,
  ApiResultError,
  RequestCollectionRunRequest
> {
  const queryClient = useQueryClient();

  return useMutation<
    CollectionRunResponse,
    ApiResultError,
    RequestCollectionRunRequest
  >({
    mutationFn: async (request) =>
      unwrapApiResult(await collectorRuntimeClient.requestCollectionRun(request)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: collectionRunQueryKeys.all,
      });
    },
  });
}

export function useCancelCollectionRunMutation(): UseMutationResult<
  CollectionRunResponse,
  ApiResultError,
  CancelCollectionRunVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    CollectionRunResponse,
    ApiResultError,
    CancelCollectionRunVariables
  >({
    mutationFn: async ({ collectionRunId }) =>
      unwrapApiResult(
        await collectorRuntimeClient.cancelCollectionRun(collectionRunId),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: collectionRunQueryKeys.all,
      });
    },
  });
}
