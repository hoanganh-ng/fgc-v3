import {
  InvalidProfileConfigurationError,
  ProfileNotFoundError,
} from "./application-errors";
import type { ProfileRepository } from "./ports/profile-repository.port";
import {
  validateCollectorProfile,
  validateRequiredProfileConfiguration,
} from "../domain";
import type { CollectorProfile, ProfileId } from "../domain";

export async function loadValidatedProfileById(
  repository: ProfileRepository,
  profileId: ProfileId,
): Promise<CollectorProfile> {
  const profile = await repository.findById(profileId);

  if (profile === null) {
    throw new ProfileNotFoundError(profileId);
  }

  return validateProfileForApplication(profile);
}

export function validateProfileForApplication(
  profile: CollectorProfile,
): CollectorProfile {
  const result = validateCollectorProfile(profile);

  if (!result.valid) {
    throw new InvalidProfileConfigurationError(result.issues);
  }

  return result.value;
}

export function validateRequiredConfigurationForApplication(
  profile: CollectorProfile,
): CollectorProfile {
  const result = validateRequiredProfileConfiguration(profile);

  if (!result.valid) {
    throw new InvalidProfileConfigurationError(result.issues);
  }

  return result.value;
}
