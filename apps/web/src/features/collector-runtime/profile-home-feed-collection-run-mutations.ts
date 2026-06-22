import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  collectorRuntimeClient,
  type ProfileHomeFeedCollectionRunResponse,
  type RequestProfileHomeFeedCollectionRunRequest,
} from "@/lib/api/collector-runtime-client";
import { unwrapApiResult, type ApiResultError } from "@/lib/api/http-client";
import { profileHomeFeedCollectionRunQueryKeys } from "@/features/collector-runtime/profile-home-feed-collection-run-queries";

export interface CancelProfileHomeFeedCollectionRunVariables {
  readonly profileHomeFeedCollectionRunId: string;
}

export async function requestProfileHomeFeedCollectionRun(
  request: RequestProfileHomeFeedCollectionRunRequest,
): Promise<ProfileHomeFeedCollectionRunResponse> {
  return unwrapApiResult(
    await collectorRuntimeClient.requestProfileHomeFeedCollectionRun(request),
  );
}

export async function cancelProfileHomeFeedCollectionRun({
  profileHomeFeedCollectionRunId,
}: CancelProfileHomeFeedCollectionRunVariables): Promise<ProfileHomeFeedCollectionRunResponse> {
  return unwrapApiResult(
    await collectorRuntimeClient.cancelProfileHomeFeedCollectionRun(
      profileHomeFeedCollectionRunId,
    ),
  );
}

export async function invalidateProfileHomeFeedCollectionRunQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: profileHomeFeedCollectionRunQueryKeys.all,
  });
}

export function useRequestProfileHomeFeedCollectionRunMutation(): UseMutationResult<
  ProfileHomeFeedCollectionRunResponse,
  ApiResultError,
  RequestProfileHomeFeedCollectionRunRequest
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileHomeFeedCollectionRunResponse,
    ApiResultError,
    RequestProfileHomeFeedCollectionRunRequest
  >({
    mutationFn: requestProfileHomeFeedCollectionRun,
    onSuccess: async () => {
      await invalidateProfileHomeFeedCollectionRunQueries(queryClient);
    },
  });
}

export function useCancelProfileHomeFeedCollectionRunMutation(): UseMutationResult<
  ProfileHomeFeedCollectionRunResponse,
  ApiResultError,
  CancelProfileHomeFeedCollectionRunVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileHomeFeedCollectionRunResponse,
    ApiResultError,
    CancelProfileHomeFeedCollectionRunVariables
  >({
    mutationFn: cancelProfileHomeFeedCollectionRun,
    onSuccess: async () => {
      await invalidateProfileHomeFeedCollectionRunQueries(queryClient);
    },
  });
}
