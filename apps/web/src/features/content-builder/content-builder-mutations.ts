import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  contentBuilderClient,
  type CreateTransformTypeRequest,
  type TransformTypeResponse,
  type UpdateTransformTypeRequest,
} from "@/lib/api/content-builder-client";
import {
  unwrapApiResult,
  type ApiResultError,
} from "@/lib/api/http-client";
import { contentBuilderQueryKeys } from "@/features/content-builder/content-builder-queries";

export interface UpdateTransformTypeVariables {
  readonly transformTypeId: string;
  readonly request: UpdateTransformTypeRequest;
}

export interface ArchiveTransformTypeVariables {
  readonly transformTypeId: string;
}

export function useCreateTransformTypeMutation(): UseMutationResult<
  TransformTypeResponse,
  ApiResultError,
  CreateTransformTypeRequest
> {
  const queryClient = useQueryClient();

  return useMutation<
    TransformTypeResponse,
    ApiResultError,
    CreateTransformTypeRequest
  >({
    mutationFn: async (request) =>
      unwrapApiResult(await contentBuilderClient.createTransformType(request)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentBuilderQueryKeys.all,
      });
    },
  });
}

export function useUpdateTransformTypeMutation(): UseMutationResult<
  TransformTypeResponse,
  ApiResultError,
  UpdateTransformTypeVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    TransformTypeResponse,
    ApiResultError,
    UpdateTransformTypeVariables
  >({
    mutationFn: async ({ transformTypeId, request }) =>
      unwrapApiResult(
        await contentBuilderClient.updateTransformType(
          transformTypeId,
          request,
        ),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentBuilderQueryKeys.all,
      });
    },
  });
}

export function useArchiveTransformTypeMutation(): UseMutationResult<
  TransformTypeResponse,
  ApiResultError,
  ArchiveTransformTypeVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    TransformTypeResponse,
    ApiResultError,
    ArchiveTransformTypeVariables
  >({
    mutationFn: async ({ transformTypeId }) =>
      unwrapApiResult(
        await contentBuilderClient.archiveTransformType(transformTypeId),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentBuilderQueryKeys.all,
      });
    },
  });
}
