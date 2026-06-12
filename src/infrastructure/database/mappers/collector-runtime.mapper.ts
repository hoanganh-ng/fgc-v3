import type {
  CollectionRun,
  CollectionRunIsoDateTime,
  ValidationIssue,
} from "../../../collector-runtime/domain";
import { validateCollectionRun } from "../../../collector-runtime/domain";
import { collectorCollectionRuns } from "../schema/collector-runtime.schema";

export type CollectionRunRow = typeof collectorCollectionRuns.$inferSelect;
export type CollectionRunInsert = typeof collectorCollectionRuns.$inferInsert;

export class InvalidPersistedCollectorRuntimeRecordError extends Error {
  public readonly recordType: "collection run";
  public readonly recordId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(recordId: string, issues: readonly ValidationIssue[]) {
    super(`Persisted collection run is invalid: ${recordId}.`);
    this.name = "InvalidPersistedCollectorRuntimeRecordError";
    this.recordType = "collection run";
    this.recordId = recordId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toCollectionRunRow(
  collectionRun: CollectionRun,
): CollectionRunInsert {
  const validCollectionRun = parseCollectionRunForPersistence(collectionRun);

  return {
    id: validCollectionRun.id,
    sourceGroupId: validCollectionRun.sourceGroupId,
    status: validCollectionRun.status,
    triggerType: validCollectionRun.triggerType,
    parameters: { ...validCollectionRun.parameters },
    summary:
      validCollectionRun.summary === undefined
        ? null
        : { ...validCollectionRun.summary },
    failureReason:
      validCollectionRun.failureReason === undefined
        ? null
        : { ...validCollectionRun.failureReason },
    requestedAt: validCollectionRun.requestedAt,
    startedAt: validCollectionRun.startedAt ?? null,
    finishedAt: validCollectionRun.finishedAt ?? null,
    createdAt: validCollectionRun.createdAt,
    updatedAt: validCollectionRun.updatedAt,
  };
}

export function toCollectionRunDomain(row: CollectionRunRow): CollectionRun {
  const candidate = {
    id: row.id,
    sourceGroupId: row.sourceGroupId,
    status: row.status,
    triggerType: row.triggerType,
    parameters: row.parameters,
    ...optional("summary", row.summary),
    ...optional("failureReason", row.failureReason),
    requestedAt: normalizeIsoDateTime(row.requestedAt),
    ...optionalIsoDateTime("startedAt", row.startedAt),
    ...optionalIsoDateTime("finishedAt", row.finishedAt),
    createdAt: normalizeIsoDateTime(row.createdAt),
    updatedAt: normalizeIsoDateTime(row.updatedAt),
  };
  const result = validateCollectionRun(candidate);

  if (!result.valid) {
    throw new InvalidPersistedCollectorRuntimeRecordError(row.id, result.issues);
  }

  return result.value;
}

function parseCollectionRunForPersistence(
  collectionRun: CollectionRun,
): CollectionRun {
  const result = validateCollectionRun(collectionRun);

  if (!result.valid) {
    throw new InvalidPersistedCollectorRuntimeRecordError(
      collectionRun.id,
      result.issues,
    );
  }

  return result.value;
}

function optional<T>(
  key: string,
  value: T | null,
): Record<string, T> | Record<string, never> {
  if (value === null) {
    return {};
  }

  return {
    [key]: value,
  };
}

function optionalIsoDateTime(
  key: string,
  value: string | Date | null,
): Record<string, CollectionRunIsoDateTime> | Record<string, never> {
  if (value === null) {
    return {};
  }

  return {
    [key]: normalizeIsoDateTime(value),
  };
}

function normalizeIsoDateTime(value: string | Date): CollectionRunIsoDateTime {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}
