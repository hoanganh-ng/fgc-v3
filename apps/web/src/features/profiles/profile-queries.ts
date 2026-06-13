import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  profileManagerClient,
  type ListProfilesQuery,
  type ProfileDetailResponse,
  type ProfileSourceAccessListResponse,
  type ProfilesListResponse,
} from "@/lib/api/profile-manager-client";
import {
  unwrapApiResult,
  type ApiResultError,
} from "@/lib/api/http-client";

const defaultProfilesQuery = {
  limit: 100,
  offset: 0,
} satisfies ListProfilesQuery;

export const profileQueryKeys = {
  all: ["profiles"] as const,
  list: (query: ListProfilesQuery) =>
    [...profileQueryKeys.all, "list", query] as const,
  detail: (profileId: string) =>
    [...profileQueryKeys.all, "detail", profileId] as const,
  sourceAccess: (profileId: string) =>
    [...profileQueryKeys.all, "source-access", profileId] as const,
};

export function useProfilesQuery(
  query: ListProfilesQuery = defaultProfilesQuery,
): UseQueryResult<ProfilesListResponse, ApiResultError> {
  return useQuery<ProfilesListResponse, ApiResultError>({
    queryKey: profileQueryKeys.list(query),
    queryFn: async () => unwrapApiResult(await profileManagerClient.listProfiles(query)),
  });
}

export function useProfileQuery(
  profileId: string,
): UseQueryResult<ProfileDetailResponse, ApiResultError> {
  return useQuery<ProfileDetailResponse, ApiResultError>({
    queryKey: profileQueryKeys.detail(profileId),
    enabled: profileId.trim().length > 0,
    queryFn: async () =>
      unwrapApiResult(await profileManagerClient.getProfile(profileId)),
  });
}

export function useProfileSourceAccessQuery(
  profileId: string,
): UseQueryResult<ProfileSourceAccessListResponse, ApiResultError> {
  return useQuery<ProfileSourceAccessListResponse, ApiResultError>({
    queryKey: profileQueryKeys.sourceAccess(profileId),
    enabled: profileId.trim().length > 0,
    queryFn: async () =>
      unwrapApiResult(await profileManagerClient.listProfileSourceAccess(profileId)),
  });
}
