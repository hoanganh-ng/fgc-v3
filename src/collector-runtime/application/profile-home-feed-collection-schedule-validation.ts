import {
  ProfileHomeFeedCollectionScheduleNotFoundError,
  ProfileHomeFeedCollectionScheduleValidationError,
} from "./application-errors";
import type { ProfileHomeFeedCollectionScheduleRepository } from "./ports/profile-home-feed-collection-schedule-repository.port";
import {
  validateProfileHomeFeedCollectionRunParameters,
  validateProfileHomeFeedCollectionSchedule,
} from "../domain";
import type {
  ProfileHomeFeedCollectionRunParameters,
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleIsoDateTime,
  ProfileHomeFeedCollectionScheduleProfileId,
} from "../domain";

export function toProfileHomeFeedCollectionScheduleIsoDateTime(
  date: Date,
): ProfileHomeFeedCollectionScheduleIsoDateTime {
  return date.toISOString();
}

export async function loadValidatedProfileHomeFeedCollectionScheduleByProfileId(
  repository: ProfileHomeFeedCollectionScheduleRepository,
  profileId: ProfileHomeFeedCollectionScheduleProfileId,
): Promise<ProfileHomeFeedCollectionSchedule> {
  const schedule = await repository.findByProfileId(profileId);

  if (schedule === null) {
    throw new ProfileHomeFeedCollectionScheduleNotFoundError(profileId);
  }

  return validateProfileHomeFeedCollectionScheduleForApplication(schedule);
}

export function validateProfileHomeFeedCollectionScheduleForApplication(
  schedule: ProfileHomeFeedCollectionSchedule,
): ProfileHomeFeedCollectionSchedule {
  const result = validateProfileHomeFeedCollectionSchedule(schedule);

  if (!result.valid) {
    throw new ProfileHomeFeedCollectionScheduleValidationError(result.issues);
  }

  return result.value;
}

export function validateProfileHomeFeedCollectionScheduleParametersForApplication(
  parameters: ProfileHomeFeedCollectionRunParameters,
): ProfileHomeFeedCollectionRunParameters {
  const result = validateProfileHomeFeedCollectionRunParameters(parameters);

  if (!result.valid) {
    throw new ProfileHomeFeedCollectionScheduleValidationError(result.issues);
  }

  return result.value;
}
