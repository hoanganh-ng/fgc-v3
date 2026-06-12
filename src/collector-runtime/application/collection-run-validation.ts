import {
  CollectionRunNotFoundError,
  CollectionRunValidationError,
} from "./application-errors";
import type { CollectionRunRepository } from "./ports/collection-run-repository.port";
import {
  validateCollectionRun,
  validateCollectionRunFailureReason,
  validateCollectionRunParameters,
  validateCollectionRunSummary,
} from "../domain";
import type {
  CollectionRun,
  CollectionRunFailureReason,
  CollectionRunId,
  CollectionRunIsoDateTime,
  CollectionRunParameters,
  CollectionRunSummary,
} from "../domain";

export function toCollectionRunIsoDateTime(
  date: Date,
): CollectionRunIsoDateTime {
  return date.toISOString();
}

export async function loadValidatedCollectionRunById(
  repository: CollectionRunRepository,
  collectionRunId: CollectionRunId,
): Promise<CollectionRun> {
  const collectionRun = await repository.findById(collectionRunId);

  if (collectionRun === null) {
    throw new CollectionRunNotFoundError(collectionRunId);
  }

  return validateCollectionRunForApplication(collectionRun);
}

export function validateCollectionRunForApplication(
  collectionRun: CollectionRun,
): CollectionRun {
  const result = validateCollectionRun(collectionRun);

  if (!result.valid) {
    throw new CollectionRunValidationError(result.issues);
  }

  return result.value;
}

export function validateCollectionRunParametersForApplication(
  parameters: CollectionRunParameters,
): CollectionRunParameters {
  const result = validateCollectionRunParameters(parameters);

  if (!result.valid) {
    throw new CollectionRunValidationError(result.issues);
  }

  return result.value;
}

export function validateCollectionRunSummaryForApplication(
  summary: CollectionRunSummary,
): CollectionRunSummary {
  const result = validateCollectionRunSummary(summary);

  if (!result.valid) {
    throw new CollectionRunValidationError(result.issues);
  }

  return result.value;
}

export function validateCollectionRunFailureReasonForApplication(
  failureReason: CollectionRunFailureReason,
): CollectionRunFailureReason {
  const result = validateCollectionRunFailureReason(failureReason);

  if (!result.valid) {
    throw new CollectionRunValidationError(result.issues);
  }

  return result.value;
}
