import { sql, type Kysely, type Selectable } from "kysely";
import { z } from "zod";
import {
  activeWindowSchema,
  authenticationStateSchema,
  behavioralPersonaSchema,
  contentAffinitiesSchema,
  hardwareFingerprintSchema,
  identityMetadataSchema,
  networkContextSchema,
  safetyThresholdsSchema,
  temporalRoutineSchema
} from "@dtpm/contracts";
import { ConcurrencyConflictError, type ProfileAggregate, type ProfileRepository } from "@dtpm/core";
import type { Database, ProfilesTable } from "./database.js";

const dateStringSchema = z.string().datetime();

const dailySafetyMetricsSchema = z.object({
  date: z.string().min(1),
  sessionCount: z.number().int().min(0),
  macroActionCount: z.number().int().min(0),
  totalDurationMinutes: z.number().int().min(0)
});

const activeLeaseSchema = z.object({
  id: z.string().uuid(),
  holder: z.string().min(1).optional(),
  expiresAt: dateStringSchema
});

const persistedPillarsSchema = z.object({
  identityMetadata: identityMetadataSchema,
  networkContext: networkContextSchema.nullable(),
  hardwareFingerprint: hardwareFingerprintSchema.nullable(),
  authenticationState: authenticationStateSchema.nullable(),
  behavioralPersona: behavioralPersonaSchema.nullable(),
  temporalRoutine: temporalRoutineSchema.extend({
    activeWindows: z.array(activeWindowSchema).min(1)
  }).nullable(),
  safetyThresholds: safetyThresholdsSchema.nullable(),
  contentAffinities: contentAffinitiesSchema.nullable()
});

type ProfileRow = Selectable<ProfilesTable>;

export class KyselyProfileRepository implements ProfileRepository {
  constructor(private readonly db: Kysely<Database>) {}

  async insert(profile: ProfileAggregate): Promise<void> {
    await this.db.insertInto("profiles").values(toRow(profile)).execute();
  }

  async update(profile: ProfileAggregate, expectedVersion: number): Promise<void> {
    const result = await this.db
      .updateTable("profiles")
      .set(toUpdateRow(profile))
      .where("id", "=", profile.id)
      .where("version", "=", expectedVersion)
      .executeTakeFirst();

    if (Number(result.numUpdatedRows) !== 1) {
      throw new ConcurrencyConflictError();
    }
  }

  async findById(id: string): Promise<ProfileAggregate | null> {
    const row = await this.db
      .selectFrom("profiles")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    return row === undefined ? null : fromRow(row);
  }

  async findByProvisioningTokenHash(tokenHash: string): Promise<ProfileAggregate | null> {
    const row = await this.db
      .selectFrom("profiles")
      .selectAll()
      .where("provisioning_token_hash", "=", tokenHash)
      .executeTakeFirst();

    return row === undefined ? null : fromRow(row);
  }

  async findCheckoutCandidates(now: Date, limit: number): Promise<ProfileAggregate[]> {
    const rows = await this.db
      .selectFrom("profiles")
      .selectAll()
      .where("status", "=", "READY")
      .where((builder) => builder.or([
        builder("next_available_window_at", "is", null),
        builder("next_available_window_at", "<=", now)
      ]))
      .orderBy(sql`next_available_window_at asc nulls first`)
      .limit(limit)
      .execute();

    return rows.map(fromRow);
  }

  async list(): Promise<ProfileAggregate[]> {
    const rows = await this.db
      .selectFrom("profiles")
      .selectAll()
      .orderBy("created_at", "desc")
      .execute();

    return rows.map(fromRow);
  }
}

function toRow(profile: ProfileAggregate) {
  return {
    id: profile.id,
    status: profile.status,
    version: profile.version,
    pillars: serializePillars(profile),
    provisioning_token_hash: profile.provisioningTokenHash,
    provisioning_token_expires_at: profile.provisioningTokenExpiresAt,
    next_available_window_at: profile.nextAvailableWindowAt,
    daily_safety_metrics: profile.dailySafetyMetrics,
    active_lease: profile.activeLease === null ? null : {
      ...profile.activeLease,
      expiresAt: profile.activeLease.expiresAt.toISOString()
    },
    created_at: profile.createdAt,
    updated_at: profile.updatedAt
  };
}

function toUpdateRow(profile: ProfileAggregate) {
  const row = toRow(profile);
  return {
    status: row.status,
    version: row.version,
    pillars: row.pillars,
    provisioning_token_hash: row.provisioning_token_hash,
    provisioning_token_expires_at: row.provisioning_token_expires_at,
    next_available_window_at: row.next_available_window_at,
    daily_safety_metrics: row.daily_safety_metrics,
    active_lease: row.active_lease,
    updated_at: row.updated_at
  };
}

function fromRow(row: ProfileRow): ProfileAggregate {
  const pillars = persistedPillarsSchema.parse(row.pillars);
  const metrics = dailySafetyMetricsSchema.parse(row.daily_safety_metrics);
  const activeLease = row.active_lease === null ? null : activeLeaseSchema.parse(row.active_lease);

  return {
    id: row.id,
    status: row.status,
    version: row.version,
    pillars: {
      ...pillars,
      authenticationState: pillars.authenticationState === null ? null : {
        ...pillars.authenticationState,
        capturedAt: new Date(pillars.authenticationState.capturedAt)
      }
    },
    provisioningTokenHash: row.provisioning_token_hash,
    provisioningTokenExpiresAt: row.provisioning_token_expires_at,
    nextAvailableWindowAt: row.next_available_window_at,
    dailySafetyMetrics: metrics,
    activeLease: activeLease === null ? null : {
      ...activeLease,
      expiresAt: new Date(activeLease.expiresAt)
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serializePillars(profile: ProfileAggregate) {
  return persistedPillarsSchema.parse({
    ...profile.pillars,
    authenticationState: profile.pillars.authenticationState === null ? null : {
      ...profile.pillars.authenticationState,
      capturedAt: profile.pillars.authenticationState.capturedAt.toISOString()
    }
  });
}
