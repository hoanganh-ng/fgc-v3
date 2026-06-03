import { z } from "zod";

const isoDateTimeSchema = z.string().datetime();
const nullableIsoDateTimeSchema = isoDateTimeSchema.nullable();
const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const profileStatusSchema = z.enum([
  "PENDING_CONFIG",
  "PENDING_LOGIN",
  "READY",
  "BUSY"
]);

export const identityMetadataSchema = z.object({
  displayName: z.string().min(1).max(120),
  externalRef: z.string().min(1).max(160).optional(),
  tags: z.array(z.string().min(1).max(64)).default([])
});

export const networkContextSchema = z.object({
  proxy: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    username: z.string().min(1).optional(),
    password: z.string().min(1).optional()
  }),
  killswitchEnabled: z.boolean()
});

export const hardwareFingerprintSchema = z.object({
  userAgent: z.string().min(1),
  viewport: z.object({
    width: z.number().int().min(320).max(7680),
    height: z.number().int().min(240).max(4320)
  }),
  languageHeaders: z.array(z.string().min(2)).min(1),
  hardwareConcurrency: z.number().int().min(1).max(128)
});

export const cookieSnapshotSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
  domain: z.string().min(1),
  path: z.string().min(1),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional()
});

export const localStorageSnapshotSchema = z.object({
  origin: z.string().url(),
  entries: z.record(z.string())
});

export const authenticationStateSchema = z.object({
  cookies: z.array(cookieSnapshotSchema),
  localStorage: z.array(localStorageSnapshotSchema),
  capturedAt: isoDateTimeSchema
});

export const behavioralPersonaSchema = z.object({
  scrollingStyle: z.enum(["SMOOTH", "STEPPED", "ERRATIC"]),
  microDelayMs: z.object({
    min: z.number().int().min(0),
    max: z.number().int().min(0)
  }),
  reverseScrollProbability: z.number().min(0).max(1)
}).refine((value) => value.microDelayMs.min <= value.microDelayMs.max, {
  message: "microDelayMs.min must be less than or equal to max",
  path: ["microDelayMs"]
});

export const activeWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  start: timeOfDaySchema,
  end: timeOfDaySchema
});

export const temporalRoutineSchema = z.object({
  timezone: z.string().min(1),
  activeWindows: z.array(activeWindowSchema).min(1),
  cooldownMinutes: z.number().int().min(0)
});

export const safetyThresholdsSchema = z.object({
  maxSessionsPerDay: z.number().int().min(1),
  maxSessionDurationMinutes: z.number().int().min(1),
  maxMacroActionsPerDay: z.number().int().min(1)
});

export const contentAffinitiesSchema = z.object({
  primaryTopics: z.array(z.string().min(1)).default([]),
  secondaryTopics: z.array(z.string().min(1)).default([]),
  interactionWeights: z.record(z.number().min(0).max(1)).default({})
});

export const profilePillarsSchema = z.object({
  identityMetadata: identityMetadataSchema,
  networkContext: networkContextSchema.nullable(),
  hardwareFingerprint: hardwareFingerprintSchema.nullable(),
  authenticationState: authenticationStateSchema.nullable(),
  behavioralPersona: behavioralPersonaSchema.nullable(),
  temporalRoutine: temporalRoutineSchema.nullable(),
  safetyThresholds: safetyThresholdsSchema.nullable(),
  contentAffinities: contentAffinitiesSchema.nullable()
});

export const activeLeaseReadSchema = z.object({
  id: z.string().uuid(),
  holder: z.string().min(1).optional(),
  expiresAt: isoDateTimeSchema
});

export const profileConfigurationRequestSchema = z.object({
  identityMetadata: identityMetadataSchema.optional(),
  networkContext: networkContextSchema,
  hardwareFingerprint: hardwareFingerprintSchema,
  behavioralPersona: behavioralPersonaSchema,
  temporalRoutine: temporalRoutineSchema,
  safetyThresholds: safetyThresholdsSchema,
  contentAffinities: contentAffinitiesSchema
});

export const profileReadSchema = z.object({
  id: z.string().uuid(),
  status: profileStatusSchema,
  version: z.number().int().min(1),
  pillars: profilePillarsSchema,
  provisioningTokenExpiresAt: nullableIsoDateTimeSchema,
  nextAvailableWindowAt: nullableIsoDateTimeSchema,
  activeLease: activeLeaseReadSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema
});

export const createProfileRequestSchema = z.object({
  displayName: z.string().min(1).max(120),
  externalRef: z.string().min(1).max(160).optional()
});

export const createProfileResponseSchema = z.object({
  profile: profileReadSchema
});

export const configureProfileResponseSchema = z.object({
  profile: profileReadSchema,
  provisioningToken: z.object({
    token: z.string().min(32),
    expiresAt: isoDateTimeSchema
  }).nullable()
});

export const provisioningTokenResponseSchema = z.object({
  profileId: z.string().uuid(),
  token: z.string().min(32),
  expiresAt: isoDateTimeSchema
});

export const provisioningConfigurationResponseSchema = z.object({
  profileId: z.string().uuid(),
  hardwareFingerprint: hardwareFingerprintSchema,
  networkContext: networkContextSchema,
  expiresAt: isoDateTimeSchema
});

export const sessionIngestionRequestSchema = z.object({
  authenticationState: authenticationStateSchema.omit({ capturedAt: true })
});

export const sessionIngestionResponseSchema = z.object({
  profile: profileReadSchema
});

export const checkoutRequestSchema = z.object({
  profileId: z.string().uuid().optional(),
  requestedBy: z.string().min(1).max(160).optional(),
  leaseTtlMinutes: z.number().int().min(1).max(240).optional()
});

export const checkoutResponseSchema = z.object({
  leaseId: z.string().uuid(),
  profile: profileReadSchema,
  expiresAt: isoDateTimeSchema
});

export const releaseLeaseRequestSchema = z.object({
  sessionDurationMinutes: z.number().int().min(0),
  macroActionsPerformed: z.number().int().min(0)
});

export const releaseLeaseResponseSchema = z.object({
  profile: profileReadSchema
});

export const errorResponseSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.unknown().optional()
});

export const profileListResponseSchema = z.object({
  profiles: z.array(profileReadSchema)
});

export type ProfileStatus = z.infer<typeof profileStatusSchema>;
export type ProfileRead = z.infer<typeof profileReadSchema>;
export type ProfilePillars = z.infer<typeof profilePillarsSchema>;
export type CreateProfileRequest = z.infer<typeof createProfileRequestSchema>;
export type ProfileConfigurationRequest = z.infer<typeof profileConfigurationRequestSchema>;
export type ConfigureProfileResponse = z.infer<typeof configureProfileResponseSchema>;
export type ProvisioningConfigurationResponse = z.infer<typeof provisioningConfigurationResponseSchema>;
export type SessionIngestionRequest = z.infer<typeof sessionIngestionRequestSchema>;
export type CheckoutRequest = z.infer<typeof checkoutRequestSchema>;
export type CheckoutResponse = z.infer<typeof checkoutResponseSchema>;
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
