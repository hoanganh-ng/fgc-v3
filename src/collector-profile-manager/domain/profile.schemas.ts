import { z } from "zod";
import { PROFILE_LEASE_STATUSES } from "./profile-lease";
import { PROFILE_ACCOUNT_STAGES } from "./profile-account-stage";
import { PROFILE_STATUSES } from "./profile-status";
import {
  CHRONOTYPES,
  COOKIE_SAME_SITE_VALUES,
  PROVISIONING_TOKEN_STATUSES,
  PROXY_PROTOCOLS,
  SCROLL_STYLES,
} from "./profile-properties";

const localTimePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

const NonNegativeNumberSchema = z.number().finite().min(0);
const PositiveNumberSchema = z.number().finite().positive();
const ProbabilitySchema = z.number().finite().min(0).max(1);

export const ProfileStatusSchema = z.enum(PROFILE_STATUSES);
export const ProfileAccountStageSchema = z.enum(PROFILE_ACCOUNT_STAGES);
export const ProfileIdSchema = NonEmptyStringSchema;
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const LocalDateSchema = z.iso.date();
export const IanaTimezoneSchema = z.string();
export const LocalTimeSchema = z
  .string()
  .regex(localTimePattern, "Expected HH:mm local time.");
export const DayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const DailySafetyUsageSchema = z
  .object({
    localDate: LocalDateSchema.nullable(),
    sessionsStarted: z.number().int().min(0),
    activeDurationMinutes: NonNegativeNumberSchema,
    macroActions: z.number().int().min(0),
  })
  .strict();

export const IdentityMetadataSchema = z
  .object({
    id: ProfileIdSchema,
    displayName: NonEmptyStringSchema,
    status: ProfileStatusSchema,
    accountStage: ProfileAccountStageSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    lastCheckoutAt: IsoDateTimeSchema.nullable(),
    lastReleasedAt: IsoDateTimeSchema.nullable(),
    nextAvailableAt: IsoDateTimeSchema.nullable(),
    dailyUsage: DailySafetyUsageSchema,
    externalReference: NonEmptyStringSchema.optional(),
    labels: z.array(NonEmptyStringSchema).optional(),
  })
  .strict();

export const ProxyProtocolSchema = z.enum(PROXY_PROTOCOLS);

export const ProxyCredentialsSchema = z
  .object({
    username: NonEmptyStringSchema,
    password: NonEmptyStringSchema,
  })
  .strict();

export const ProxyRoutingSchema = z
  .object({
    protocol: ProxyProtocolSchema,
    host: NonEmptyStringSchema,
    port: z.number().int().min(1).max(65535),
    credentials: ProxyCredentialsSchema.nullable(),
    countryCode: NonEmptyStringSchema.optional(),
    region: NonEmptyStringSchema.optional(),
  })
  .strict();

export const NetworkKillswitchSchema = z
  .object({
    enabled: z.boolean(),
    failClosed: z.boolean(),
  })
  .strict();

export const NetworkContextSchema = z
  .object({
    proxy: ProxyRoutingSchema.nullable(),
    killswitch: NetworkKillswitchSchema,
  })
  .strict();

export const ViewportSizeSchema = z
  .object({
    width: PositiveNumberSchema,
    height: PositiveNumberSchema,
    deviceScaleFactor: PositiveNumberSchema.optional(),
  })
  .strict();

export const HardwareFingerprintSchema = z
  .object({
    userAgent: NonEmptyStringSchema,
    viewport: ViewportSizeSchema,
    languages: z.array(NonEmptyStringSchema),
    hardwareConcurrency: PositiveNumberSchema,
    platform: NonEmptyStringSchema.optional(),
    deviceMemoryGb: PositiveNumberSchema.optional(),
    timezone: IanaTimezoneSchema.optional(),
  })
  .strict();

export const CookieSameSiteSchema = z.enum(COOKIE_SAME_SITE_VALUES);

export const BrowserCookieSchema = z
  .object({
    name: NonEmptyStringSchema,
    value: z.string(),
    domain: NonEmptyStringSchema,
    path: NonEmptyStringSchema,
    expiresAt: IsoDateTimeSchema.nullable(),
    httpOnly: z.boolean(),
    secure: z.boolean(),
    sameSite: CookieSameSiteSchema.optional(),
  })
  .strict();

export const LocalStorageEntrySchema = z
  .object({
    origin: NonEmptyStringSchema,
    key: NonEmptyStringSchema,
    value: z.string(),
  })
  .strict();

export const AuthenticationStateSchema = z
  .object({
    cookies: z.array(BrowserCookieSchema),
    localStorage: z.array(LocalStorageEntrySchema),
    sessionCapturedAt: IsoDateTimeSchema.nullable(),
    sessionExpiresAt: IsoDateTimeSchema.nullable(),
  })
  .strict();

export const ScrollStyleSchema = z.enum(SCROLL_STYLES);

export const NumericRangeSchema = z
  .object({
    min: NonNegativeNumberSchema,
    max: NonNegativeNumberSchema,
  })
  .strict()
  .refine((range) => range.min <= range.max, {
    message: "Range min must be less than or equal to max.",
  });

export const BehavioralPersonaSchema = z
  .object({
    scrollStyle: ScrollStyleSchema,
    microDelayMs: NumericRangeSchema,
    reverseScrollProbability: ProbabilitySchema,
    dwellTimeMs: NumericRangeSchema,
  })
  .strict();

export const ChronotypeSchema = z.enum(CHRONOTYPES);

export const ActiveTimeWindowSchema = z
  .object({
    days: z.array(DayOfWeekSchema),
    startsAt: LocalTimeSchema,
    endsAt: LocalTimeSchema,
  })
  .strict();

export const TemporalRoutineSchema = z
  .object({
    timezone: IanaTimezoneSchema,
    chronotype: ChronotypeSchema,
    activeWindows: z.array(ActiveTimeWindowSchema),
    cooldownMinutes: NonNegativeNumberSchema,
  })
  .strict();

export const SafetyThresholdsSchema = z
  .object({
    maxSessionsPerDay: NonNegativeNumberSchema,
    maxSessionDurationMinutes: NonNegativeNumberSchema,
    maxMacroActionsPerDay: NonNegativeNumberSchema,
    minCooldownMinutes: NonNegativeNumberSchema,
  })
  .strict();

export const WeightedTopicSchema = z
  .object({
    topic: NonEmptyStringSchema,
    weight: NonNegativeNumberSchema,
  })
  .strict();

export const InteractionWeightsSchema = z
  .object({
    view: NonNegativeNumberSchema,
    like: NonNegativeNumberSchema,
    save: NonNegativeNumberSchema,
    comment: NonNegativeNumberSchema,
    share: NonNegativeNumberSchema,
  })
  .strict();

export const ContentAffinitiesSchema = z
  .object({
    primaryTopics: z.array(WeightedTopicSchema),
    secondaryTopics: z.array(WeightedTopicSchema),
    interactionWeights: InteractionWeightsSchema,
  })
  .strict();

export const ProvisioningTokenStatusSchema = z.enum(
  PROVISIONING_TOKEN_STATUSES,
);

export const ProvisioningTokenStateSchema = z
  .object({
    status: ProvisioningTokenStatusSchema,
    tokenHash: z.string().nullable(),
    issuedAt: IsoDateTimeSchema.nullable(),
    expiresAt: IsoDateTimeSchema.nullable(),
    consumedAt: IsoDateTimeSchema.nullable(),
  })
  .strict()
  .superRefine((state, context) => {
    if (state.status === "NOT_ISSUED") {
      if (
        state.tokenHash !== null ||
        state.issuedAt !== null ||
        state.expiresAt !== null ||
        state.consumedAt !== null
      ) {
        addProvisioningTokenIssue(
          context,
          "not-issued tokens cannot contain token data",
        );
      }

      return;
    }

    if (state.status === "ISSUED") {
      if (state.tokenHash === null || state.tokenHash.trim() === "") {
        addProvisioningTokenIssue(
          context,
          "issued tokens require a token hash",
        );
      }

      if (state.issuedAt === null || state.expiresAt === null) {
        addProvisioningTokenIssue(
          context,
          "issued tokens require issuedAt and expiresAt timestamps",
        );
      }

      if (state.consumedAt !== null) {
        addProvisioningTokenIssue(
          context,
          "issued tokens cannot have a consumedAt timestamp",
        );
      }

      return;
    }

    if (state.status === "CONSUMED") {
      if (state.tokenHash !== null) {
        addProvisioningTokenIssue(
          context,
          "consumed tokens must clear the token hash",
        );
      }

      if (state.consumedAt === null) {
        addProvisioningTokenIssue(
          context,
          "consumed tokens require a consumedAt timestamp",
        );
      }

      return;
    }

    if (state.tokenHash !== null) {
      addProvisioningTokenIssue(
        context,
        "expired tokens must clear the token hash",
      );
    }

    if (state.expiresAt === null) {
      addProvisioningTokenIssue(
        context,
        "expired tokens require an expiresAt timestamp",
      );
    }
  });

export const ProfileLeaseStatusSchema = z.enum(PROFILE_LEASE_STATUSES);
export const ProfileLeaseIdSchema = NonEmptyStringSchema;

export const ProfileLeaseSchema = z
  .object({
    id: ProfileLeaseIdSchema,
    profileId: ProfileIdSchema,
    leasedAt: IsoDateTimeSchema,
    expiresAt: IsoDateTimeSchema,
    releasedAt: IsoDateTimeSchema.nullable(),
    status: ProfileLeaseStatusSchema,
  })
  .strict()
  .superRefine((lease, context) => {
    if (Date.parse(lease.expiresAt) <= Date.parse(lease.leasedAt)) {
      context.addIssue({
        code: "custom",
        message: "lease expiresAt must be after leasedAt",
        path: ["expiresAt"],
      });
    }

    if (lease.status === "ACTIVE" && lease.releasedAt !== null) {
      context.addIssue({
        code: "custom",
        message: "active leases cannot have a releasedAt timestamp",
        path: ["releasedAt"],
      });
    }

    if (lease.status === "RELEASED" && lease.releasedAt === null) {
      context.addIssue({
        code: "custom",
        message: "released leases require a releasedAt timestamp",
        path: ["releasedAt"],
      });
    }

    if (lease.status === "EXPIRED" && lease.releasedAt !== null) {
      context.addIssue({
        code: "custom",
        message: "expired leases cannot have a releasedAt timestamp",
        path: ["releasedAt"],
      });
    }
  });

export const CollectorProfilePropertyGroupsSchema = z
  .object({
    identity: IdentityMetadataSchema,
    networkContext: NetworkContextSchema,
    hardwareFingerprint: HardwareFingerprintSchema.nullable(),
    authenticationState: AuthenticationStateSchema,
    behavioralPersona: BehavioralPersonaSchema,
    temporalRoutine: TemporalRoutineSchema,
    safetyThresholds: SafetyThresholdsSchema,
    contentAffinities: ContentAffinitiesSchema,
  })
  .strict();

export const CollectorProfileSchema = CollectorProfilePropertyGroupsSchema.extend({
  provisioningToken: ProvisioningTokenStateSchema,
}).strict();

function addProvisioningTokenIssue(
  context: z.RefinementCtx,
  message: string,
): void {
  context.addIssue({
    code: "custom",
    message,
  });
}
