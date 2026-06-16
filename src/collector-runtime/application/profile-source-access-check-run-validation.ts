import {
  ProfileSourceAccessCheckRunNotFoundError,
  ProfileSourceAccessCheckRunValidationError,
} from "./application-errors";
import type { ProfileSourceAccessCheckRunRepository } from "./ports/profile-source-access-check-run-repository.port";
import { validateProfileSourceAccessCheckRun } from "../domain";
import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunFailureReason,
  ProfileSourceAccessCheckRunId,
  ProfileSourceAccessCheckRunIsoDateTime,
  ProfileSourceAccessCheckRunOutcome,
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

export function validateProfileSourceAccessCheckRunOutcomeForApplication(
  outcome: ProfileSourceAccessCheckRunOutcome,
): ProfileSourceAccessCheckRunOutcome {
  const result = validateProfileSourceAccessCheckRun({
    id: "validation-run",
    profileId: "validation-profile",
    sourceGroupId: "validation-source-group",
    triggerType: "MANUAL",
    status: "SUCCEEDED",
    accountStageAtRequest: "WARMING",
    target: {
      platform: "FACEBOOK",
      routeType: "DIRECT_GROUP_URL",
      url: "https://www.facebook.com/groups/validation-source-group",
    },
    outcome,
    requestedAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:01.000Z",
    finishedAt: "2026-01-01T00:00:02.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:02.000Z",
  });

  if (!result.valid) {
    throw new ProfileSourceAccessCheckRunValidationError(result.issues);
  }

  if (result.value.outcome === undefined) {
    throw new ProfileSourceAccessCheckRunValidationError([]);
  }

  return result.value.outcome;
}

export function validateProfileSourceAccessCheckRunFailureReasonForApplication(
  failureReason: ProfileSourceAccessCheckRunFailureReason,
): ProfileSourceAccessCheckRunFailureReason {
  const result = validateProfileSourceAccessCheckRun({
    id: "validation-run",
    profileId: "validation-profile",
    sourceGroupId: "validation-source-group",
    triggerType: "MANUAL",
    status: "FAILED",
    accountStageAtRequest: "WARMING",
    target: {
      platform: "FACEBOOK",
      routeType: "DIRECT_GROUP_URL",
      url: "https://www.facebook.com/groups/validation-source-group",
    },
    failureReason,
    requestedAt: "2026-01-01T00:00:00.000Z",
    startedAt: "2026-01-01T00:00:01.000Z",
    finishedAt: "2026-01-01T00:00:02.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:02.000Z",
  });

  if (!result.valid) {
    throw new ProfileSourceAccessCheckRunValidationError(result.issues);
  }

  if (result.value.failureReason === undefined) {
    throw new ProfileSourceAccessCheckRunValidationError([]);
  }

  return result.value.failureReason;
}
