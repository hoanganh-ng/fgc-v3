import type {
  ProfileId,
  ProfileSourceAccess,
  ProfileSourceAccessSourceGroupId,
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
}
