import type {
  ProfileSourceAccessCheckRun,
  ProfileSourceAccessCheckRunIsoDateTime,
  ValidationIssue,
} from "../../../collector-runtime/domain";
import { validateProfileSourceAccessCheckRun } from "../../../collector-runtime/domain";
import { collectorProfileSourceAccessCheckRuns } from "../schema/collector-runtime.schema";

export type ProfileSourceAccessCheckRunRow =
  typeof collectorProfileSourceAccessCheckRuns.$inferSelect;
export type ProfileSourceAccessCheckRunInsert =
  typeof collectorProfileSourceAccessCheckRuns.$inferInsert;

export class InvalidPersistedProfileSourceAccessCheckRunRecordError extends Error {
  public readonly recordId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(recordId: string, issues: readonly ValidationIssue[]) {
    super(`Persisted profile-source access check run is invalid: ${recordId}.`);
    this.name = "InvalidPersistedProfileSourceAccessCheckRunRecordError";
    this.recordId = recordId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toDomainProfileSourceAccessCheckRun(
  record: ProfileSourceAccessCheckRunRow,
): ProfileSourceAccessCheckRun {
  const candidate = {
    id: record.id,
    profileId: record.profileId,
    sourceGroupId: record.sourceGroupId,
    triggerType: record.triggerType,
    status: record.status,
    accountStageAtRequest: record.accountStageAtRequest,
    target: record.target,
    ...optional("outcome", record.outcome),
    ...optional("failureReason", record.failureReason),
    requestedAt: normalizeIsoDateTime(record.requestedAt),
    ...optionalIsoDateTime("startedAt", record.startedAt),
    ...optionalIsoDateTime("finishedAt", record.finishedAt),
    createdAt: normalizeIsoDateTime(record.createdAt),
    updatedAt: normalizeIsoDateTime(record.updatedAt),
  };
  const result = validateProfileSourceAccessCheckRun(candidate);

  if (!result.valid) {
    throw new InvalidPersistedProfileSourceAccessCheckRunRecordError(
      record.id,
      result.issues,
    );
  }

  return result.value;
}

export function toProfileSourceAccessCheckRunRecord(
  domain: ProfileSourceAccessCheckRun,
): ProfileSourceAccessCheckRunInsert {
  const result = validateProfileSourceAccessCheckRun(domain);

  if (!result.valid) {
    throw new InvalidPersistedProfileSourceAccessCheckRunRecordError(
      domain.id,
      result.issues,
    );
  }

  const validRun = result.value;

  return {
    id: validRun.id,
    profileId: validRun.profileId,
    sourceGroupId: validRun.sourceGroupId,
    triggerType: validRun.triggerType,
    status: validRun.status,
    accountStageAtRequest: validRun.accountStageAtRequest,
    target: validRun.target,
    outcome: validRun.outcome ?? null,
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
): Record<string, ProfileSourceAccessCheckRunIsoDateTime> | Record<string, never> {
  if (value === null) {
    return {};
  }

  return { [key]: normalizeIsoDateTime(value) };
}

function normalizeIsoDateTime(
  value: string | Date,
): ProfileSourceAccessCheckRunIsoDateTime {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}
