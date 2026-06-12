import type {
  IsoDateTime,
  ProfileSourceAccess,
  ValidationIssue,
} from "../../../collector-profile-manager/domain";
import {
  validateProfileSourceAccess,
} from "../../../collector-profile-manager/domain";
import {
  collectorProfileSourceAccess,
} from "../schema/collector-profile-manager.schema";

export type ProfileSourceAccessRow =
  typeof collectorProfileSourceAccess.$inferSelect;
export type ProfileSourceAccessInsert =
  typeof collectorProfileSourceAccess.$inferInsert;

export class InvalidPersistedProfileSourceAccessError extends Error {
  public readonly profileSourceAccessId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(
    profileSourceAccessId: string,
    issues: readonly ValidationIssue[],
  ) {
    super(
      `Persisted profile-source access record is invalid: ${profileSourceAccessId}.`,
    );
    this.name = "InvalidPersistedProfileSourceAccessError";
    this.profileSourceAccessId = profileSourceAccessId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toProfileSourceAccessRow(
  profileSourceAccess: ProfileSourceAccess,
): ProfileSourceAccessRow {
  const validProfileSourceAccess =
    parseProfileSourceAccessForPersistence(profileSourceAccess);

  return {
    id: validProfileSourceAccess.id,
    profileId: validProfileSourceAccess.profileId,
    sourceGroupId: validProfileSourceAccess.sourceGroupId,
    accessState: validProfileSourceAccess.accessState,
    lastCheckedAt: validProfileSourceAccess.lastCheckedAt,
    lastSuccessfulAt: validProfileSourceAccess.lastSuccessfulAt,
    lastFailureReason: validProfileSourceAccess.lastFailureReason,
    joinRequestedAt: validProfileSourceAccess.joinRequestedAt,
    notes: validProfileSourceAccess.notes ?? null,
    createdAt: validProfileSourceAccess.createdAt,
    updatedAt: validProfileSourceAccess.updatedAt,
  };
}

export function toProfileSourceAccessDomain(
  row: ProfileSourceAccessRow,
): ProfileSourceAccess {
  const candidate = {
    id: row.id,
    profileId: row.profileId,
    sourceGroupId: row.sourceGroupId,
    accessState: row.accessState,
    lastCheckedAt: normalizeNullableIsoDateTime(row.lastCheckedAt),
    lastSuccessfulAt: normalizeNullableIsoDateTime(row.lastSuccessfulAt),
    lastFailureReason: row.lastFailureReason ?? null,
    joinRequestedAt: normalizeNullableIsoDateTime(row.joinRequestedAt),
    ...(row.notes !== null ? { notes: row.notes } : {}),
    createdAt: normalizeIsoDateTime(row.createdAt),
    updatedAt: normalizeIsoDateTime(row.updatedAt),
  };
  const result = validateProfileSourceAccess(candidate);

  if (!result.valid) {
    throw new InvalidPersistedProfileSourceAccessError(row.id, result.issues);
  }

  return result.value;
}

function parseProfileSourceAccessForPersistence(
  profileSourceAccess: ProfileSourceAccess,
): ProfileSourceAccess {
  const result = validateProfileSourceAccess(profileSourceAccess);

  if (!result.valid) {
    throw new InvalidPersistedProfileSourceAccessError(
      profileSourceAccess.id,
      result.issues,
    );
  }

  return result.value;
}

function normalizeNullableIsoDateTime(
  value: string | Date | null,
): IsoDateTime | null {
  if (value === null) {
    return null;
  }

  return normalizeIsoDateTime(value);
}

function normalizeIsoDateTime(value: string | Date): IsoDateTime {
  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = Date.parse(value);

  if (Number.isNaN(parsed)) {
    return value;
  }

  return new Date(parsed).toISOString();
}
