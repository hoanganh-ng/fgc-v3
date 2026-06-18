import {
  useMutation,
  useQueryClient,
  type QueryClient,
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

export async function upsertCollectionSchedule(
  variables: UpsertCollectionScheduleVariables,
): Promise<CollectionScheduleResponse> {
  return unwrapApiResult(
    await collectorRuntimeClient.upsertCollectionSchedule(
      variables.sourceGroupId,
      variables.request,
    ),
  );
}

export async function invalidateCollectionScheduleQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: collectionScheduleQueryKeys.all,
  });
  await queryClient.invalidateQueries({
    queryKey: collectionRunQueryKeys.all,
  });
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
    mutationFn: upsertCollectionSchedule,
    onSuccess: async () => {
      await invalidateCollectionScheduleQueries(queryClient);
    },
  });
}
