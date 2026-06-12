import type {
  CollectorProfile,
  IdentityMetadata,
  IsoDateTime,
  ValidationIssue,
} from "../../../collector-profile-manager/domain";
import { validateCollectorProfile } from "../../../collector-profile-manager/domain";
import {
  toPersistedProvisioningTokenHash,
} from "../provisioning-token-hashing";
import { collectorProfiles } from "../schema/collector-profile-manager.schema";

export type CollectorProfileRow = typeof collectorProfiles.$inferSelect;
export type CollectorProfileInsert = typeof collectorProfiles.$inferInsert;

type IdentityMetadataJson = Partial<
  Pick<IdentityMetadata, "externalReference" | "labels">
>;

export interface CollectorProfileMapperOptions {
  readonly verifiedProvisioningToken?: string;
}

export class InvalidPersistedCollectorProfileError extends Error {
  public readonly profileId: string;
  public readonly issues: readonly ValidationIssue[];

  public constructor(profileId: string, issues: readonly ValidationIssue[]) {
    super(`Persisted collector profile is invalid: ${profileId}.`);
    this.name = "InvalidPersistedCollectorProfileError";
    this.profileId = profileId;
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function toCollectorProfileRow(
  profile: CollectorProfile,
): CollectorProfileRow {
  const validProfile = parseProfileForPersistence(profile);
  const identityMetadata: IdentityMetadataJson = {};

  if (validProfile.identity.externalReference !== undefined) {
    identityMetadata.externalReference = validProfile.identity.externalReference;
  }

  if (validProfile.identity.labels !== undefined) {
    identityMetadata.labels = [...validProfile.identity.labels];
  }

  return {
    id: validProfile.identity.id,
    displayName: validProfile.identity.displayName,
    status: validProfile.identity.status,
    accountStage: validProfile.identity.accountStage,
    provisioningTokenStatus: validProfile.provisioningToken.status,
    provisioningTokenHash: toPersistedProvisioningTokenHash(
      validProfile.provisioningToken.tokenHash,
    ),
    provisioningTokenIssuedAt: validProfile.provisioningToken.issuedAt,
    provisioningTokenExpiresAt: validProfile.provisioningToken.expiresAt,
    provisioningTokenConsumedAt: validProfile.provisioningToken.consumedAt,
    lastCheckoutAt: validProfile.identity.lastCheckoutAt,
    lastReleasedAt: validProfile.identity.lastReleasedAt,
    nextAvailableAt: validProfile.identity.nextAvailableAt,
    dailyUsageLocalDate: validProfile.identity.dailyUsage.localDate,
    dailySessionsStarted: validProfile.identity.dailyUsage.sessionsStarted,
    dailyActiveDurationMinutes:
      validProfile.identity.dailyUsage.activeDurationMinutes,
    dailyMacroActions: validProfile.identity.dailyUsage.macroActions,
    version: 1,
    createdAt: validProfile.identity.createdAt,
    updatedAt: validProfile.identity.updatedAt,
    identityMetadata,
    networkContext: validProfile.networkContext,
    hardwareFingerprint: validProfile.hardwareFingerprint,
    authenticationState: validProfile.authenticationState,
    behavioralPersona: validProfile.behavioralPersona,
    temporalRoutine: validProfile.temporalRoutine,
    safetyThresholds: validProfile.safetyThresholds,
    contentAffinities: validProfile.contentAffinities,
  };
}

export function toCollectorProfileInsert(
  profile: CollectorProfile,
): CollectorProfileInsert {
  return toCollectorProfileRow(profile);
}

export function toCollectorProfileDomain(
  row: CollectorProfileRow,
  options: CollectorProfileMapperOptions = {},
): CollectorProfile {
  const identityMetadata = getIdentityMetadata(row.identityMetadata);
  const candidate = {
    identity: {
      id: row.id,
      displayName: row.displayName,
      status: row.status,
      accountStage: row.accountStage ?? "NEW_ACCOUNT",
      createdAt: normalizeIsoDateTime(row.createdAt),
      updatedAt: normalizeIsoDateTime(row.updatedAt),
      lastCheckoutAt: normalizeNullableIsoDateTime(row.lastCheckoutAt),
      lastReleasedAt: normalizeNullableIsoDateTime(row.lastReleasedAt),
      nextAvailableAt: normalizeNullableIsoDateTime(row.nextAvailableAt),
      dailyUsage: {
        localDate: row.dailyUsageLocalDate,
        sessionsStarted: row.dailySessionsStarted,
        activeDurationMinutes: row.dailyActiveDurationMinutes,
        macroActions: row.dailyMacroActions,
      },
      ...identityMetadata,
    },
    networkContext: row.networkContext,
    hardwareFingerprint: row.hardwareFingerprint,
    authenticationState: row.authenticationState,
    behavioralPersona: row.behavioralPersona,
    temporalRoutine: row.temporalRoutine,
    safetyThresholds: row.safetyThresholds,
    contentAffinities: row.contentAffinities,
    provisioningToken: {
      status: row.provisioningTokenStatus,
      tokenHash:
        options.verifiedProvisioningToken ?? row.provisioningTokenHash,
      issuedAt: normalizeNullableIsoDateTime(row.provisioningTokenIssuedAt),
      expiresAt: normalizeNullableIsoDateTime(row.provisioningTokenExpiresAt),
      consumedAt: normalizeNullableIsoDateTime(row.provisioningTokenConsumedAt),
    },
  };
  const result = validateCollectorProfile(candidate);

  if (!result.valid) {
    throw new InvalidPersistedCollectorProfileError(row.id, result.issues);
  }

  return result.value;
}

function parseProfileForPersistence(
  profile: CollectorProfile,
): CollectorProfile {
  const result = validateCollectorProfile(profile);

  if (!result.valid) {
    throw new InvalidPersistedCollectorProfileError(
      profile.identity.id,
      result.issues,
    );
  }

  return result.value;
}

function getIdentityMetadata(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  return {
    invalidIdentityMetadata: value,
  };
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
