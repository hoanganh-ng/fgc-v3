import type {
  AccountExerciseRun,
  AccountExerciseRunIsoDateTime,
  ValidationIssue,
} from "../../../collector-runtime/domain";
import { validateAccountExerciseRun } from "../../../collector-runtime/domain";
import { collectorAccountExerciseRuns } from "../schema/collector-runtime.schema";

export type AccountExerciseRunRow =
  typeof collectorAccountExerciseRuns.$inferSelect;
export type AccountExerciseRunInsert =
  typeof collectorAccountExerciseRuns.$inferInsert;

export class InvalidPersistedAccountExerciseRunRecordError extends Error {
  public readonly recordId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(recordId: string, issues: readonly ValidationIssue[]) {
    super(`Persisted account exercise run is invalid: ${recordId}.`);
    this.name = "InvalidPersistedAccountExerciseRunRecordError";
    this.recordId = recordId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toAccountExerciseRunRow(
  accountExerciseRun: AccountExerciseRun,
): AccountExerciseRunInsert {
  const validRun = parseAccountExerciseRunForPersistence(accountExerciseRun);

  return {
    id: validRun.id,
    profileId: validRun.profileId,
    leaseId: validRun.leaseId ?? null,
    exerciseType: validRun.exerciseType,
    status: validRun.status,
    stageAtStart: validRun.stageAtStart,
    actionBudget: { ...validRun.actionBudget },
    safeSummary:
      validRun.safeSummary === undefined
        ? null
        : { ...validRun.safeSummary },
    failureReason:
      validRun.failureReason === undefined
        ? null
        : { ...validRun.failureReason },
    requestedAt: validRun.requestedAt,
    startedAt: validRun.startedAt ?? null,
    finishedAt: validRun.finishedAt ?? null,
    createdAt: validRun.createdAt,
    updatedAt: validRun.updatedAt,
  };
}

export function toAccountExerciseRunDomain(
  row: AccountExerciseRunRow,
): AccountExerciseRun {
  const candidate = {
    id: row.id,
    profileId: row.profileId,
    ...optional("leaseId", row.leaseId),
    exerciseType: row.exerciseType,
    status: row.status,
    stageAtStart: row.stageAtStart,
    actionBudget: row.actionBudget,
    ...optional("safeSummary", row.safeSummary),
    ...optional("failureReason", row.failureReason),
    requestedAt: normalizeIsoDateTime(row.requestedAt),
    ...optionalIsoDateTime("startedAt", row.startedAt),
    ...optionalIsoDateTime("finishedAt", row.finishedAt),
    createdAt: normalizeIsoDateTime(row.createdAt),
    updatedAt: normalizeIsoDateTime(row.updatedAt),
  };
  const result = validateAccountExerciseRun(candidate);

  if (!result.valid) {
    throw new InvalidPersistedAccountExerciseRunRecordError(
      row.id,
      result.issues,
    );
  }

  return result.value;
}

function parseAccountExerciseRunForPersistence(
  accountExerciseRun: AccountExerciseRun,
): AccountExerciseRun {
  const result = validateAccountExerciseRun(accountExerciseRun);

  if (!result.valid) {
    throw new InvalidPersistedAccountExerciseRunRecordError(
      accountExerciseRun.id,
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
): Record<string, AccountExerciseRunIsoDateTime> | Record<string, never> {
  if (value === null) {
    return {};
  }

  return {
    [key]: normalizeIsoDateTime(value),
  };
}

function normalizeIsoDateTime(
  value: string | Date,
): AccountExerciseRunIsoDateTime {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}
