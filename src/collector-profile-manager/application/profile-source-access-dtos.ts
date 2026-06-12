import type {
  IsoDateTime,
  ProfileId,
  ProfileSourceAccess,
  ProfileSourceAccessFailureReason,
  ProfileSourceAccessId,
  ProfileSourceAccessSourceGroupId,
  ProfileSourceAccessState,
} from "../domain";

export interface ProfileSourceAccessDto {
  readonly id: ProfileSourceAccessId;
  readonly profileId: ProfileId;
  readonly sourceGroupId: ProfileSourceAccessSourceGroupId;
  readonly accessState: ProfileSourceAccessState;
  readonly lastCheckedAt: IsoDateTime | null;
  readonly lastSuccessfulAt: IsoDateTime | null;
  readonly lastFailureReason: ProfileSourceAccessFailureReason | null;
  readonly joinRequestedAt: IsoDateTime | null;
  readonly notes?: string;
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

export function toProfileSourceAccessDto(
  profileSourceAccess: ProfileSourceAccess,
): ProfileSourceAccessDto {
  return {
    id: profileSourceAccess.id,
    profileId: profileSourceAccess.profileId,
    sourceGroupId: profileSourceAccess.sourceGroupId,
    accessState: profileSourceAccess.accessState,
    lastCheckedAt: profileSourceAccess.lastCheckedAt,
    lastSuccessfulAt: profileSourceAccess.lastSuccessfulAt,
    lastFailureReason:
      profileSourceAccess.lastFailureReason === null
        ? null
        : { ...profileSourceAccess.lastFailureReason },
    joinRequestedAt: profileSourceAccess.joinRequestedAt,
    ...(profileSourceAccess.notes !== undefined
      ? { notes: profileSourceAccess.notes }
      : {}),
    createdAt: profileSourceAccess.createdAt,
    updatedAt: profileSourceAccess.updatedAt,
  };
}
