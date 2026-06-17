import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type CollectionScheduleResponse,
  type UpsertCollectionScheduleRequest,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";
import { collectionRunQueryKeys } from "@/features/collector-runtime/collection-run-queries";
import { collectionScheduleQueryKeys } from "@/features/collector-runtime/collection-schedule-queries";

export interface UpsertCollectionScheduleVariables {
  readonly sourceGroupId: string;
  readonly request: UpsertCollectionScheduleRequest;
}

export function useUpsertCollectionScheduleMutation(): UseMutationResult<
  CollectionScheduleResponse,
  ApiResultError,
  UpsertCollectionScheduleVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    CollectionScheduleResponse,
    ApiResultError,
    UpsertCollectionScheduleVariables
  >({
    mutationFn: async ({ sourceGroupId, request }) =>
      unwrapApiResult(
        await collectorRuntimeClient.upsertCollectionSchedule(
          sourceGroupId,
          request,
        ),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: collectionScheduleQueryKeys.all,
      });
      await queryClient.invalidateQueries({
        queryKey: collectionRunQueryKeys.all,
      });
    },
  });
}
