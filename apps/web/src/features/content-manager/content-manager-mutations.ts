import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  contentManagerClient,
  type CreateContentCategoryRequest,
  type CreateContentCategoryResponse,
  type CreateSourceGroupRequest,
  type CreateSourceGroupResponse,
  type SourceGroupStatus,
  type UpdateSourceGroupStatusResponse,
} from "@/lib/api/content-manager-client";
import {
  unwrapApiResult,
  type ApiResultError,
} from "@/lib/api/http-client";
import { contentManagerQueryKeys } from "@/features/content-manager/content-manager-queries";

export interface UpdateSourceGroupStatusVariables {
  readonly sourceGroupId: string;
  readonly status: SourceGroupStatus;
}

export function useCreateContentCategoryMutation(): UseMutationResult<
  CreateContentCategoryResponse,
  ApiResultError,
  CreateContentCategoryRequest
> {
  const queryClient = useQueryClient();

  return useMutation<
    CreateContentCategoryResponse,
    ApiResultError,
    CreateContentCategoryRequest
  >({
    mutationFn: async (request) =>
      unwrapApiResult(await contentManagerClient.createContentCategory(request)),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: contentManagerQueryKeys.categories(),
        }),
        queryClient.invalidateQueries({
          queryKey: contentManagerQueryKeys.all,
        }),
      ]);
    },
  });
}

export function useCreateSourceGroupMutation(): UseMutationResult<
  CreateSourceGroupResponse,
  ApiResultError,
  CreateSourceGroupRequest
> {
  const queryClient = useQueryClient();

  return useMutation<
    CreateSourceGroupResponse,
    ApiResultError,
    CreateSourceGroupRequest
  >({
    mutationFn: async (request) =>
      unwrapApiResult(await contentManagerClient.createSourceGroup(request)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentManagerQueryKeys.all,
      });
    },
  });
}

export function useUpdateSourceGroupStatusMutation(): UseMutationResult<
  UpdateSourceGroupStatusResponse,
  ApiResultError,
  UpdateSourceGroupStatusVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateSourceGroupStatusResponse,
    ApiResultError,
    UpdateSourceGroupStatusVariables
  >({
    mutationFn: async ({ sourceGroupId, status }) =>
      unwrapApiResult(
        await contentManagerClient.updateSourceGroupStatus(
          sourceGroupId,
          status,
        ),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentManagerQueryKeys.all,
      });
    },
  });
}
