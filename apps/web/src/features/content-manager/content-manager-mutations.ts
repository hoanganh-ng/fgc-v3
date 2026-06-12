import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  contentManagerClient,
  type ContentStatus,
  type CreateSourceGroupEntryRouteRequest,
  type CreateSourceGroupEntryRouteResponse,
  type CreateContentCategoryRequest,
  type CreateContentCategoryResponse,
  type CreateSourceGroupRequest,
  type CreateSourceGroupResponse,
  type SourceGroupStatus,
  type UpdateContentItemStatusResponse,
  type UpdateSourceGroupEntryRouteRequest,
  type UpdateSourceGroupEntryRouteResponse,
  type UpdateSourceGroupStatusResponse,
  type RemoveSourceGroupEntryRouteResponse,
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

export interface CreateSourceGroupEntryRouteVariables {
  readonly sourceGroupId: string;
  readonly request: CreateSourceGroupEntryRouteRequest;
}

export interface UpdateSourceGroupEntryRouteVariables {
  readonly sourceGroupId: string;
  readonly entryRouteId: string;
  readonly request: UpdateSourceGroupEntryRouteRequest;
}

export interface RemoveSourceGroupEntryRouteVariables {
  readonly sourceGroupId: string;
  readonly entryRouteId: string;
}

export interface UpdateContentItemStatusVariables {
  readonly contentItemId: string;
  readonly status: ContentStatus;
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

export function useCreateSourceGroupEntryRouteMutation(): UseMutationResult<
  CreateSourceGroupEntryRouteResponse,
  ApiResultError,
  CreateSourceGroupEntryRouteVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    CreateSourceGroupEntryRouteResponse,
    ApiResultError,
    CreateSourceGroupEntryRouteVariables
  >({
    mutationFn: async ({ sourceGroupId, request }) =>
      unwrapApiResult(
        await contentManagerClient.createSourceGroupEntryRoute(
          sourceGroupId,
          request,
        ),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentManagerQueryKeys.all,
      });
    },
  });
}

export function useUpdateSourceGroupEntryRouteMutation(): UseMutationResult<
  UpdateSourceGroupEntryRouteResponse,
  ApiResultError,
  UpdateSourceGroupEntryRouteVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateSourceGroupEntryRouteResponse,
    ApiResultError,
    UpdateSourceGroupEntryRouteVariables
  >({
    mutationFn: async ({ sourceGroupId, entryRouteId, request }) =>
      unwrapApiResult(
        await contentManagerClient.updateSourceGroupEntryRoute(
          sourceGroupId,
          entryRouteId,
          request,
        ),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentManagerQueryKeys.all,
      });
    },
  });
}

export function useRemoveSourceGroupEntryRouteMutation(): UseMutationResult<
  RemoveSourceGroupEntryRouteResponse,
  ApiResultError,
  RemoveSourceGroupEntryRouteVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    RemoveSourceGroupEntryRouteResponse,
    ApiResultError,
    RemoveSourceGroupEntryRouteVariables
  >({
    mutationFn: async ({ sourceGroupId, entryRouteId }) =>
      unwrapApiResult(
        await contentManagerClient.removeSourceGroupEntryRoute(
          sourceGroupId,
          entryRouteId,
        ),
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: contentManagerQueryKeys.all,
      });
    },
  });
}

export function useUpdateContentItemStatusMutation(): UseMutationResult<
  UpdateContentItemStatusResponse,
  ApiResultError,
  UpdateContentItemStatusVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    UpdateContentItemStatusResponse,
    ApiResultError,
    UpdateContentItemStatusVariables
  >({
    mutationFn: async ({ contentItemId, status }) =>
      unwrapApiResult(
        await contentManagerClient.updateContentItemStatus(
          contentItemId,
          status,
        ),
      ),
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: contentManagerQueryKeys.contentItems(),
        }),
        queryClient.invalidateQueries({
          queryKey: contentManagerQueryKeys.contentItem(variables.contentItemId),
        }),
      ]);
    },
  });
}
