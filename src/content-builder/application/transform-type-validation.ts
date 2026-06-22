import {
  TransformTypeNotFoundError,
  TransformTypeValidationError,
} from "./application-errors";
import type { TransformTypeRepository } from "./ports/transform-type-repository.port";
import type {
  IsoDateTime,
  TransformType,
  TransformTypeId,
} from "../domain";
import { validateTransformType } from "../domain";

export function toIsoDateTime(date: Date): IsoDateTime {
  return date.toISOString();
}

export async function loadValidatedTransformTypeById(
  repository: TransformTypeRepository,
  transformTypeId: TransformTypeId,
): Promise<TransformType> {
  const transformType = await repository.findById(transformTypeId);

  if (transformType === null) {
    throw new TransformTypeNotFoundError(transformTypeId);
  }

  return validateTransformTypeForApplication(transformType);
}

export function validateTransformTypeForApplication(
  transformType: TransformType,
): TransformType {
  const result = validateTransformType(transformType);

  if (!result.valid) {
    throw new TransformTypeValidationError(result.issues);
  }

  return result.value;
}
