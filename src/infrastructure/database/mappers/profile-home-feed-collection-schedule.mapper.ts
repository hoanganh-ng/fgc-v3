import type {
  ProfileHomeFeedCollectionSchedule,
  ProfileHomeFeedCollectionScheduleIsoDateTime,
  ValidationIssue,
} from "../../../collector-runtime/domain";
import { validateProfileHomeFeedCollectionSchedule } from "../../../collector-runtime/domain";
import { profileHomeFeedCollectionSchedules } from "../schema/collector-runtime.schema";

export type ProfileHomeFeedCollectionScheduleRow =
  typeof profileHomeFeedCollectionSchedules.$inferSelect;
export type ProfileHomeFeedCollectionScheduleInsert =
  typeof profileHomeFeedCollectionSchedules.$inferInsert;

export class InvalidPersistedProfileHomeFeedCollectionScheduleRecordError extends Error {
  public readonly recordId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(recordId: string, issues: readonly ValidationIssue[]) {
    super(
      `Persisted profile home-feed collection schedule is invalid: ${recordId}.`,
    );
    this.name =
      "InvalidPersistedProfileHomeFeedCollectionScheduleRecordError";
    this.recordId = recordId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toDomainProfileHomeFeedCollectionSchedule(
  record: ProfileHomeFeedCollectionScheduleRow,
): ProfileHomeFeedCollectionSchedule {
  const candidate = {
    profileId: record.profileId,
    enabled: record.enabled,
    intervalMinutes: record.intervalMinutes,
    nextRunAt: normalizeIsoDateTime(record.nextRunAt),
    parameters: record.parameters,
    ...optionalIsoDateTime("lastAttemptedAt", record.lastAttemptedAt),
    ...optional("lastDispatchStatus", record.lastDispatchStatus),
    ...optional("lastFailureReason", record.lastFailureReason),
    consecutiveFailures: record.consecutiveFailures,
    createdAt: normalizeIsoDateTime(record.createdAt),
    updatedAt: normalizeIsoDateTime(record.updatedAt),
  };
  const result = validateProfileHomeFeedCollectionSchedule(candidate);

  if (!result.valid) {
    throw new InvalidPersistedProfileHomeFeedCollectionScheduleRecordError(
      record.profileId,
      result.issues,
    );
  }

  return result.value;
}

export function toProfileHomeFeedCollectionScheduleRecord(
  domain: ProfileHomeFeedCollectionSchedule,
): ProfileHomeFeedCollectionScheduleInsert {
  const result = validateProfileHomeFeedCollectionSchedule(domain);

  if (!result.valid) {
    throw new InvalidPersistedProfileHomeFeedCollectionScheduleRecordError(
      domain.profileId,
      result.issues,
    );
  }

  const validSchedule = result.value;

  return {
    profileId: validSchedule.profileId,
    enabled: validSchedule.enabled,
    intervalMinutes: validSchedule.intervalMinutes,
    nextRunAt: validSchedule.nextRunAt,
    parameters: validSchedule.parameters,
    lastAttemptedAt: validSchedule.lastAttemptedAt ?? null,
    lastDispatchStatus: validSchedule.lastDispatchStatus ?? null,
    lastFailureReason: validSchedule.lastFailureReason ?? null,
    consecutiveFailures: validSchedule.consecutiveFailures,
    createdAt: validSchedule.createdAt,
    updatedAt: validSchedule.updatedAt,
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
): Record<string, ProfileHomeFeedCollectionScheduleIsoDateTime> | Record<string, never> {
  if (value === null) {
    return {};
  }

  return { [key]: normalizeIsoDateTime(value) };
}

function normalizeIsoDateTime(
  value: string | Date,
): ProfileHomeFeedCollectionScheduleIsoDateTime {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}
