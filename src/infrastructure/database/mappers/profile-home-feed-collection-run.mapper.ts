import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunIsoDateTime,
  ValidationIssue,
} from "../../../collector-runtime/domain";
import { validateProfileHomeFeedCollectionRun } from "../../../collector-runtime/domain";
import { profileHomeFeedCollectionRuns } from "../schema/collector-runtime.schema";

export type ProfileHomeFeedCollectionRunRow =
  typeof profileHomeFeedCollectionRuns.$inferSelect;
export type ProfileHomeFeedCollectionRunInsert =
  typeof profileHomeFeedCollectionRuns.$inferInsert;

export class InvalidPersistedProfileHomeFeedCollectionRunRecordError extends Error {
  public readonly recordId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(recordId: string, issues: readonly ValidationIssue[]) {
    super(`Persisted profile home-feed collection run is invalid: ${recordId}.`);
    this.name = "InvalidPersistedProfileHomeFeedCollectionRunRecordError";
    this.recordId = recordId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toDomainProfileHomeFeedCollectionRun(
  record: ProfileHomeFeedCollectionRunRow,
): ProfileHomeFeedCollectionRun {
  const candidate = {
    id: record.id,
    profileId: record.profileId,
    triggerType: record.triggerType,
    status: record.status,
    accountStageAtRequest: record.accountStageAtRequest,
    target: record.target,
    parameters: record.parameters,
    ...optional("summary", record.summary),
    ...optional("failureReason", record.failureReason),
    requestedAt: normalizeIsoDateTime(record.requestedAt),
    ...optionalIsoDateTime("startedAt", record.startedAt),
    ...optionalIsoDateTime("finishedAt", record.finishedAt),
    createdAt: normalizeIsoDateTime(record.createdAt),
    updatedAt: normalizeIsoDateTime(record.updatedAt),
  };
  const result = validateProfileHomeFeedCollectionRun(candidate);

  if (!result.valid) {
    throw new InvalidPersistedProfileHomeFeedCollectionRunRecordError(
      record.id,
      result.issues,
    );
  }

  return result.value;
}

export function toProfileHomeFeedCollectionRunRecord(
  domain: ProfileHomeFeedCollectionRun,
): ProfileHomeFeedCollectionRunInsert {
  const result = validateProfileHomeFeedCollectionRun(domain);

  if (!result.valid) {
    throw new InvalidPersistedProfileHomeFeedCollectionRunRecordError(
      domain.id,
      result.issues,
    );
  }

  const validRun = result.value;

  return {
    id: validRun.id,
    profileId: validRun.profileId,
    triggerType: validRun.triggerType,
    status: validRun.status,
    accountStageAtRequest: validRun.accountStageAtRequest,
    target: validRun.target,
    parameters: validRun.parameters,
    summary: validRun.summary ?? null,
    failureReason: validRun.failureReason ?? null,
    requestedAt: validRun.requestedAt,
    startedAt: validRun.startedAt ?? null,
    finishedAt: validRun.finishedAt ?? null,
    createdAt: validRun.createdAt,
    updatedAt: validRun.updatedAt,
  };
}

function optional<T>(
  key: string,
  value: T | null,
): Record<string, T> | Record<string, never> {
  if (value === null) {
    return {};
  }

  return { [key]: value };
}

function optionalIsoDateTime(
  key: string,
  value: string | Date | null,
): Record<string, ProfileHomeFeedCollectionRunIsoDateTime> | Record<string, never> {
  if (value === null) {
    return {};
  }

  return { [key]: normalizeIsoDateTime(value) };
}

function normalizeIsoDateTime(
  value: string | Date,
): ProfileHomeFeedCollectionRunIsoDateTime {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}
