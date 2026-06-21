import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type ProfileHomeFeedCollectionScheduleResponse,
  type UpsertProfileHomeFeedCollectionScheduleRequest,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";
import { profileHomeFeedCollectionScheduleQueryKeys } from "@/features/collector-runtime/profile-home-feed-collection-schedule-queries";

export interface UpsertProfileHomeFeedCollectionScheduleVariables {
  readonly profileId: string;
  readonly request: UpsertProfileHomeFeedCollectionScheduleRequest;
}

export async function upsertProfileHomeFeedCollectionSchedule(
  variables: UpsertProfileHomeFeedCollectionScheduleVariables,
): Promise<ProfileHomeFeedCollectionScheduleResponse> {
  return unwrapApiResult(
    await collectorRuntimeClient.upsertProfileHomeFeedCollectionSchedule(
      variables.profileId,
      variables.request,
    ),
  );
}

export async function invalidateProfileHomeFeedCollectionScheduleQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: profileHomeFeedCollectionScheduleQueryKeys.all,
  });
}

export function useUpsertProfileHomeFeedCollectionScheduleMutation(): UseMutationResult<
  ProfileHomeFeedCollectionScheduleResponse,
  ApiResultError,
  UpsertProfileHomeFeedCollectionScheduleVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileHomeFeedCollectionScheduleResponse,
    ApiResultError,
    UpsertProfileHomeFeedCollectionScheduleVariables
  >({
    mutationFn: upsertProfileHomeFeedCollectionSchedule,
    onSuccess: async () => {
      await invalidateProfileHomeFeedCollectionScheduleQueries(queryClient);
    },
  });
}