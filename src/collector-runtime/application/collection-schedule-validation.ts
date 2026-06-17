import { CollectionScheduleNotFoundError, CollectionScheduleValidationError } from "./application-errors";
import type { CollectionScheduleRepository } from "./ports/collection-schedule-repository.port";
import {
  validateCollectionRunParameters,
  validateCollectionSchedule,
} from "../domain";
import type {
  CollectionRunParameters,
  CollectionSchedule,
  CollectionScheduleIsoDateTime,
  CollectionScheduleSourceGroupId,
} from "../domain";

export function toCollectionScheduleIsoDateTime(
  date: Date,
): CollectionScheduleIsoDateTime {
  return date.toISOString();
}

export async function loadValidatedCollectionScheduleBySourceGroupId(
  repository: CollectionScheduleRepository,
  sourceGroupId: CollectionScheduleSourceGroupId,
): Promise<CollectionSchedule> {
  const collectionSchedule = await repository.findBySourceGroupId(sourceGroupId);

  if (collectionSchedule === null) {
    throw new CollectionScheduleNotFoundError(sourceGroupId);
  }

  return validateCollectionScheduleForApplication(collectionSchedule);
}

export function validateCollectionScheduleForApplication(
  collectionSchedule: CollectionSchedule,
): CollectionSchedule {
  const result = validateCollectionSchedule(collectionSchedule);

  if (!result.valid) {
    throw new CollectionScheduleValidationError(result.issues);
  }

  return result.value;
}

export function validateCollectionScheduleParametersForApplication(
  parameters: CollectionRunParameters,
): CollectionRunParameters {
  const result = validateCollectionRunParameters(parameters);

  if (!result.valid) {
    throw new CollectionScheduleValidationError(result.issues);
  }

  return result.value;
}
