import type {
  TransformType,
  ValidationIssue,
} from "../../../content-builder/domain";
import { validateTransformType } from "../../../content-builder/domain";
import { contentBuilderTransformTypes } from "../schema/content-builder.schema";

export type TransformTypeRow =
  typeof contentBuilderTransformTypes.$inferSelect;
export type TransformTypeInsert =
  typeof contentBuilderTransformTypes.$inferInsert;

export class InvalidPersistedContentBuilderRecordError extends Error {
  public readonly recordType = "transform type";
  public readonly recordId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(recordId: string, issues: readonly ValidationIssue[]) {
    super(`Persisted transform type is invalid: ${recordId}.`);
    this.name = "InvalidPersistedContentBuilderRecordError";
    this.recordId = recordId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toTransformTypeRow(
  transformType: TransformType,
): TransformTypeInsert {
  const validTransformType = parseTransformTypeForPersistence(transformType);

  return {
    transformTypeId: validTransformType.transformTypeId,
    name: validTransformType.name,
    normalizedName: validTransformType.normalizedName,
    description: validTransformType.description ?? null,
    initialPrompt: validTransformType.initialPrompt,
    status: validTransformType.status,
    createdAt: validTransformType.createdAt,
    updatedAt: validTransformType.updatedAt,
  };
}

export function toTransformTypeDomain(row: TransformTypeRow): TransformType {
  const candidate = {
    transformTypeId: row.transformTypeId,
    name: row.name,
    normalizedName: row.normalizedName,
    ...(row.description !== null ? { description: row.description } : {}),
    initialPrompt: row.initialPrompt,
    status: row.status,
    createdAt: normalizeIsoDateTime(row.createdAt),
    updatedAt: normalizeIsoDateTime(row.updatedAt),
  };
  const result = validateTransformType(candidate);

  if (!result.valid) {
    throw new InvalidPersistedContentBuilderRecordError(
      row.transformTypeId,
      result.issues,
    );
  }

  return result.value;
}

function parseTransformTypeForPersistence(
  transformType: TransformType,
): TransformType {
  const result = validateTransformType(transformType);

  if (!result.valid) {
    throw new InvalidPersistedContentBuilderRecordError(
      transformType.transformTypeId,
      result.issues,
    );
  }

  return result.value;
}

function normalizeIsoDateTime(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}
