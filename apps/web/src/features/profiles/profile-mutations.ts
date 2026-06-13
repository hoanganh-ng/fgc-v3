import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  profileManagerClient,
  type CreateProfileRequest,
  type ProfileDetailResponse,
  type ProfileMutationResponse,
  type ProfileSourceAccessResponse,
  type StartProfileProvisioningResponse,
  type UpdateProfileAccountStageRequest,
  type UpdateProfileConfigurationRequest,
  type UpsertProfileSourceAccessRequest,
} from "@/lib/api/profile-manager-client";
import {
  unwrapApiResult,
  type ApiResultError,
} from "@/lib/api/http-client";
import { profileQueryKeys } from "@/features/profiles/profile-queries";

export interface UpdateProfileConfigurationVariables {
  readonly profileId: string;
  readonly configuration: UpdateProfileConfigurationRequest;
}

export interface StartProfileProvisioningVariables {
  readonly profileId: string;
}

export interface UpdateProfileAccountStageVariables {
  readonly profileId: string;
  readonly request: UpdateProfileAccountStageRequest;
}

export interface UpsertProfileSourceAccessVariables {
  readonly profileId: string;
  readonly sourceGroupId: string;
  readonly request: UpsertProfileSourceAccessRequest;
}

export function useCreateProfileMutation(): UseMutationResult<
  ProfileMutationResponse,
  ApiResultError,
  CreateProfileRequest
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileMutationResponse,
    ApiResultError,
    CreateProfileRequest
  >({
    mutationFn: async (request) =>
      unwrapApiResult(await profileManagerClient.createProfile(request)),
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: profileQueryKeys.detail(response.profile.id),
        }),
      ]);
    },
  });
}

export function useUpdateProfileConfigurationMutation(): UseMutationResult<
  ProfileMutationResponse,
  ApiResultError,
  UpdateProfileConfigurationVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileMutationResponse,
    ApiResultError,
    UpdateProfileConfigurationVariables
  >({
    mutationFn: async ({ profileId, configuration }) =>
      unwrapApiResult(
        await profileManagerClient.updateProfileConfiguration(
          profileId,
          configuration,
        ),
      ),
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: profileQueryKeys.detail(variables.profileId),
        }),
      ]);
    },
  });
}

export function useStartProfileProvisioningMutation(): UseMutationResult<
  StartProfileProvisioningResponse,
  ApiResultError,
  StartProfileProvisioningVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    StartProfileProvisioningResponse,
    ApiResultError,
    StartProfileProvisioningVariables
  >({
    mutationFn: async ({ profileId }) =>
      unwrapApiResult(
        await profileManagerClient.startProfileProvisioning(profileId),
      ),
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: profileQueryKeys.detail(variables.profileId),
        }),
      ]);
    },
  });
}

export function useUpdateProfileAccountStageMutation(): UseMutationResult<
  ProfileDetailResponse,
  ApiResultError,
  UpdateProfileAccountStageVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileDetailResponse,
    ApiResultError,
    UpdateProfileAccountStageVariables
  >({
    mutationFn: async ({ profileId, request }) =>
      unwrapApiResult(
        await profileManagerClient.updateProfileAccountStage(
          profileId,
          request,
        ),
      ),
    onSuccess: async (_response, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: profileQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: profileQueryKeys.detail(variables.profileId),
        }),
      ]);
    },
  });
}

export function useUpsertProfileSourceAccessMutation(): UseMutationResult<
  ProfileSourceAccessResponse,
  ApiResultError,
  UpsertProfileSourceAccessVariables
> {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileSourceAccessResponse,
    ApiResultError,
    UpsertProfileSourceAccessVariables
  >({
    mutationFn: async ({ profileId, sourceGroupId, request }) =>
      unwrapApiResult(
        await profileManagerClient.upsertProfileSourceAccess(
          profileId,
          sourceGroupId,
          request,
        ),
      ),
    onSuccess: async (_response, variables) => {
      await queryClient.invalidateQueries({
        queryKey: profileQueryKeys.sourceAccess(variables.profileId),
      });
    },
  });
}
