import type {
  ProfileId,
  ProfileSourceAccess,
  ProfileSourceAccessSourceGroupId,
  ProfileSourceAccessState,
} from "../../domain";

export interface ProfileSourceAccessRepository {
  upsert(profileSourceAccess: ProfileSourceAccess): Promise<void>;
  getByProfileAndSourceGroup(
    profileId: ProfileId,
    sourceGroupId: ProfileSourceAccessSourceGroupId,
  ): Promise<ProfileSourceAccess | null>;
  listByProfile(profileId: ProfileId): Promise<readonly ProfileSourceAccess[]>;
  listBySourceGroup(
    sourceGroupId: ProfileSourceAccessSourceGroupId,
  ): Promise<readonly ProfileSourceAccess[]>;
  findProfileIdsBySourceGroupAndStates(
    sourceGroupId: ProfileSourceAccessSourceGroupId,
    accessStates: readonly ProfileSourceAccessState[],
  ): Promise<readonly ProfileId[]>;
}
