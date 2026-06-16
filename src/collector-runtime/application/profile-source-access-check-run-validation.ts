import {
  ProfileSourceAccessCheckRunNotFoundError,
  ProfileSourceAccessCheckRunValidationError,
} from "./application-errors";
import type { ProfileSourceAccessCheckRunRepository } from "./ports/profile-source-access-check-run-repository.port";
import { validateProfileSourceAccessCheckRun } from "../domain";
import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunId,
  ProfileSourceAccessCheckRunIsoDateTime,
} from "../domain";

export function toProfileSourceAccessCheckRunIsoDateTime(
  date: Date,
): ProfileSourceAccessCheckRunIsoDateTime {
  return date.toISOString();
}

export async function loadValidatedProfileSourceAccessCheckRunById(
  repository: ProfileSourceAccessCheckRunRepository,
  checkRunId: ProfileSourceAccessCheckRunId,
): Promise<ProfileSourceAccessCheckRun> {
  const checkRun = await repository.findById(checkRunId);

  if (checkRun === null) {
    throw new ProfileSourceAccessCheckRunNotFoundError(checkRunId);
  }

  return validateProfileSourceAccessCheckRunForApplication(checkRun);
}

export function validateProfileSourceAccessCheckRunForApplication(
  checkRun: ProfileSourceAccessCheckRun,
): ProfileSourceAccessCheckRun {
  const result = validateProfileSourceAccessCheckRun(checkRun);

  if (!result.valid) {
    throw new ProfileSourceAccessCheckRunValidationError(result.issues);
  }

  return result.value;
}
