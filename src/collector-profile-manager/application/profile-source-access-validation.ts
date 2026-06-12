import {
  InvalidProfileSourceAccessError,
  ProfileSourceAccessNotFoundError,
} from "./application-errors";
import type {
  ProfileSourceAccessRepository,
} from "./ports/profile-source-access-repository.port";
import {
  validateProfileSourceAccess,
} from "../domain";
import type {
  ProfileId,
  ProfileSourceAccess,
  ProfileSourceAccessSourceGroupId,
} from "../domain";

export async function loadValidatedProfileSourceAccessByProfileAndSourceGroup(
  repository: ProfileSourceAccessRepository,
  profileId: ProfileId,
  sourceGroupId: ProfileSourceAccessSourceGroupId,
): Promise<ProfileSourceAccess> {
  const profileSourceAccess =
    await repository.getByProfileAndSourceGroup(profileId, sourceGroupId);

  if (profileSourceAccess === null) {
    throw new ProfileSourceAccessNotFoundError(profileId, sourceGroupId);
  }

  return validateProfileSourceAccessForApplication(profileSourceAccess);
}

export function validateProfileSourceAccessForApplication(
  profileSourceAccess: ProfileSourceAccess,
): ProfileSourceAccess {
  const result = validateProfileSourceAccess(profileSourceAccess);

  if (!result.valid) {
    throw new InvalidProfileSourceAccessError(result.issues);
  }

  return result.value;
}
