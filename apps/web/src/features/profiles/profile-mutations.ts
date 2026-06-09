import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  profileManagerClient,
  type CreateProfileRequest,
  type ProfileMutationResponse,
  type UpdateProfileConfigurationRequest,
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
