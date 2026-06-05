import { sql } from "drizzle-orm";
import {
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type {
  AuthenticationState,
  BehavioralPersona,
  ContentAffinities,
  HardwareFingerprint,
  IdentityMetadata,
  NetworkContext,
  SafetyThresholds,
  TemporalRoutine,
} from "../../../collector-profile-manager/domain";

type IdentityMetadataJson = Pick<
  IdentityMetadata,
  "externalReference" | "labels"
>;

export const collectorProfileStatusEnum = pgEnum("collector_profile_status", [
  "PENDING_CONFIG",
  "PENDING_LOGIN",
  "READY",
  "BUSY",
]);

export const provisioningTokenStatusEnum = pgEnum("provisioning_token_status", [
  "NOT_ISSUED",
  "ISSUED",
  "CONSUMED",
  "EXPIRED",
]);

export const collectorProfileLeaseStatusEnum = pgEnum(
  "collector_profile_lease_status",
  ["ACTIVE", "RELEASED", "EXPIRED"],
);

const timestampWithTimezone = (name: string) =>
  timestamp(name, { mode: "string", withTimezone: true });

export const collectorProfiles = pgTable(
  "collector_profiles",
  {
    id: text("profile_id").primaryKey(),
    displayName: text("display_name").notNull(),
    status: collectorProfileStatusEnum("status")
      .notNull()
      .default("PENDING_CONFIG"),
    provisioningTokenStatus: provisioningTokenStatusEnum(
      "provisioning_token_status",
    )
      .notNull()
      .default("NOT_ISSUED"),
    provisioningTokenHash: text("provisioning_token_hash"),
    provisioningTokenIssuedAt: timestampWithTimezone(
      "provisioning_token_issued_at",
    ),
    provisioningTokenExpiresAt: timestampWithTimezone(
      "provisioning_token_expires_at",
    ),
    provisioningTokenConsumedAt: timestampWithTimezone(
      "provisioning_token_consumed_at",
    ),
    lastCheckoutAt: timestampWithTimezone("last_checkout_at"),
    lastReleasedAt: timestampWithTimezone("last_released_at"),
    nextAvailableAt: timestampWithTimezone("next_available_at"),
    dailyUsageLocalDate: date("daily_usage_local_date", { mode: "string" }),
    dailySessionsStarted: integer("daily_sessions_started").notNull().default(0),
    dailyActiveDurationMinutes: integer("daily_active_duration_minutes")
      .notNull()
      .default(0),
    dailyMacroActions: integer("daily_macro_actions").notNull().default(0),
    version: integer("version").notNull().default(1),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
    identityMetadata:
      jsonb("identity_metadata").$type<IdentityMetadataJson>().notNull(),
    networkContext: jsonb("network_context").$type<NetworkContext>().notNull(),
    hardwareFingerprint:
      jsonb("hardware_fingerprint").$type<HardwareFingerprint>(),
    authenticationState: jsonb("authentication_state")
      .$type<AuthenticationState>()
      .notNull(),
    behavioralPersona: jsonb("behavioral_persona")
      .$type<BehavioralPersona>()
      .notNull(),
    temporalRoutine: jsonb("temporal_routine").$type<TemporalRoutine>().notNull(),
    safetyThresholds:
      jsonb("safety_thresholds").$type<SafetyThresholds>().notNull(),
    contentAffinities:
      jsonb("content_affinities").$type<ContentAffinities>().notNull(),
  },
  (table) => [
    index("collector_profiles_status_idx").on(table.status),
    uniqueIndex("collector_profiles_issued_token_hash_uidx")
      .on(table.provisioningTokenHash)
      .where(
        sql`${table.provisioningTokenStatus} = 'ISSUED' and ${table.provisioningTokenHash} is not null`,
      ),
    index("collector_profiles_checkout_availability_idx").on(
      table.status,
      table.nextAvailableAt,
    ),
  ],
);

export const collectorProfileLeases = pgTable(
  "collector_profile_leases",
  {
    id: text("lease_id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => collectorProfiles.id, { onDelete: "restrict" }),
    status: collectorProfileLeaseStatusEnum("status")
      .notNull()
      .default("ACTIVE"),
    leasedAt: timestampWithTimezone("leased_at").notNull(),
    expiresAt: timestampWithTimezone("expires_at").notNull(),
    releasedAt: timestampWithTimezone("released_at"),
    createdAt: timestampWithTimezone("created_at").notNull().defaultNow(),
    updatedAt: timestampWithTimezone("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("collector_profile_leases_profile_id_idx").on(table.profileId),
    index("collector_profile_leases_profile_status_idx").on(
      table.profileId,
      table.status,
    ),
    uniqueIndex("collector_profile_leases_active_profile_uidx")
      .on(table.profileId)
      .where(sql`${table.status} = 'ACTIVE'`),
  ],
);
