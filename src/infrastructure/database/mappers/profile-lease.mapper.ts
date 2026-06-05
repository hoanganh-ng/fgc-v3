import type {
  IsoDateTime,
  ProfileLease,
  ValidationIssue,
} from "../../../collector-profile-manager/domain";
import { validateProfileLease } from "../../../collector-profile-manager/domain";
import { collectorProfileLeases } from "../schema/collector-profile-manager.schema";

export type ProfileLeaseRow = typeof collectorProfileLeases.$inferSelect;
export type ProfileLeaseInsert = typeof collectorProfileLeases.$inferInsert;

export class InvalidPersistedProfileLeaseError extends Error {
  public readonly leaseId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(leaseId: string, issues: readonly ValidationIssue[]) {
    super(`Persisted profile lease is invalid: ${leaseId}.`);
    this.name = "InvalidPersistedProfileLeaseError";
    this.leaseId = leaseId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export interface ProfileLeaseRowTimestamps {
  readonly createdAt?: IsoDateTime;
  readonly updatedAt?: IsoDateTime;
}

export function toProfileLeaseRow(
  lease: ProfileLease,
  timestamps: ProfileLeaseRowTimestamps = {},
): ProfileLeaseRow {
  const validLease = parseLeaseForPersistence(lease);

  return {
    id: validLease.id,
    profileId: validLease.profileId,
    status: validLease.status,
    leasedAt: validLease.leasedAt,
    expiresAt: validLease.expiresAt,
    releasedAt: validLease.releasedAt,
    createdAt: timestamps.createdAt ?? validLease.leasedAt,
    updatedAt: timestamps.updatedAt ?? validLease.releasedAt ?? validLease.leasedAt,
  };
}

export function toProfileLeaseInsert(
  lease: ProfileLease,
): ProfileLeaseInsert {
  const validLease = parseLeaseForPersistence(lease);

  return {
    id: validLease.id,
    profileId: validLease.profileId,
    status: validLease.status,
    leasedAt: validLease.leasedAt,
    expiresAt: validLease.expiresAt,
    releasedAt: validLease.releasedAt,
  };
}

export function toProfileLeaseDomain(row: ProfileLeaseRow): ProfileLease {
  const candidate = {
    id: row.id,
    profileId: row.profileId,
    status: row.status,
    leasedAt: normalizeIsoDateTime(row.leasedAt),
    expiresAt: normalizeIsoDateTime(row.expiresAt),
    releasedAt: normalizeNullableIsoDateTime(row.releasedAt),
  };
  const result = validateProfileLease(candidate);

  if (!result.valid) {
    throw new InvalidPersistedProfileLeaseError(row.id, result.issues);
  }

  return result.value;
}

function parseLeaseForPersistence(lease: ProfileLease): ProfileLease {
  const result = validateProfileLease(lease);

  if (!result.valid) {
    throw new InvalidPersistedProfileLeaseError(lease.id, result.issues);
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
