import {
  ProfileHomeFeedCollectionRunNotFoundError,
  ProfileHomeFeedCollectionRunValidationError,
} from "./application-errors";
import type { ProfileHomeFeedCollectionRunRepository } from "./ports/profile-home-feed-collection-run-repository.port";
import {
  validateProfileHomeFeedCollectionRun,
  validateProfileHomeFeedCollectionRunFailureReason,
  validateProfileHomeFeedCollectionRunParameters,
  validateProfileHomeFeedCollectionRunSummary,
  validateProfileHomeFeedDiagnosticSummary,
} from "../domain";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunFailureReason,
  ProfileHomeFeedCollectionRunId,
  ProfileHomeFeedCollectionRunIsoDateTime,
  ProfileHomeFeedCollectionRunParameters,
  ProfileHomeFeedCollectionRunSummary,
  ProfileHomeFeedDiagnosticSummary,
} from "../domain";

export function toProfileHomeFeedCollectionRunIsoDateTime(
  date: Date,
): ProfileHomeFeedCollectionRunIsoDateTime {
  return date.toISOString();
}

export async function loadValidatedProfileHomeFeedCollectionRunById(
  repository: ProfileHomeFeedCollectionRunRepository,
  runId: ProfileHomeFeedCollectionRunId,
): Promise<ProfileHomeFeedCollectionRun> {
  const run = await repository.findById(runId);

  if (run === null) {
    throw new ProfileHomeFeedCollectionRunNotFoundError(runId);
  }

  return validateProfileHomeFeedCollectionRunForApplication(run);
}

export function validateProfileHomeFeedCollectionRunForApplication(
  run: ProfileHomeFeedCollectionRun,
): ProfileHomeFeedCollectionRun {
  const result = validateProfileHomeFeedCollectionRun(run);

  if (!result.valid) {
    throw new ProfileHomeFeedCollectionRunValidationError(result.issues);
  }

  return result.value;
}

export function validateProfileHomeFeedCollectionRunParametersForApplication(
  parameters: ProfileHomeFeedCollectionRunParameters,
): ProfileHomeFeedCollectionRunParameters {
  const result = validateProfileHomeFeedCollectionRunParameters(parameters);

  if (!result.valid) {
    throw new ProfileHomeFeedCollectionRunValidationError(result.issues);
  }

  return result.value;
}

export function validateProfileHomeFeedCollectionRunSummaryForApplication(
  summary: ProfileHomeFeedCollectionRunSummary,
): ProfileHomeFeedCollectionRunSummary {
  const result = validateProfileHomeFeedCollectionRunSummary(summary);

  if (!result.valid) {
    throw new ProfileHomeFeedCollectionRunValidationError(result.issues);
  }

  return result.value;
}

export function validateProfileHomeFeedDiagnosticSummaryForApplication(
  diagnostics: ProfileHomeFeedDiagnosticSummary,
): ProfileHomeFeedDiagnosticSummary {
  const result = validateProfileHomeFeedDiagnosticSummary(diagnostics);

  if (!result.valid) {
    throw new ProfileHomeFeedCollectionRunValidationError(result.issues);
  }

  return result.value;
}

export function validateProfileHomeFeedCollectionRunFailureReasonForApplication(
  failureReason: ProfileHomeFeedCollectionRunFailureReason,
): ProfileHomeFeedCollectionRunFailureReason {
  const result = validateProfileHomeFeedCollectionRunFailureReason(
    failureReason,
  );

  if (!result.valid) {
    throw new ProfileHomeFeedCollectionRunValidationError(result.issues);
  }

  return result.value;
}
