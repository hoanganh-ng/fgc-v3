import { z } from "zod";
import { env } from "@/lib/env";
import {
  createHttpClient,
  type ApiResult,
  type HttpClient,
} from "@/lib/api/http-client";

export const KnownProfileStatusSchema = z.enum([
  "PENDING_CONFIG",
  "PENDING_LOGIN",
  "READY",
  "BUSY",
]);

export type KnownProfileStatus = z.infer<typeof KnownProfileStatusSchema>;
export type ProfileStatus = KnownProfileStatus | (string & {});

export const ProfileStatusSchema = z
  .string()
  .min(1)
  .transform((status) => status as ProfileStatus);

export const ProvisioningTokenStatusSchema = z.enum([
  "NOT_ISSUED",
  "ISSUED",
  "CONSUMED",
  "EXPIRED",
]);

export const ProxyProtocolSchema = z.enum(["HTTP", "HTTPS", "SOCKS5"]);
export const ScrollStyleSchema = z.enum(["STEADY", "SKIMMING", "DEEP_READ"]);
export const ChronotypeSchema = z.enum([
  "MORNING",
  "AFTERNOON",
  "EVENING",
  "NIGHT",
]);

const NonEmptyStringSchema = z.string().min(1);

const DailyUsageSchema = z
  .object({
    localDate: z.string().nullable(),
    sessionsStarted: z.number().int().min(0),
    activeDurationMinutes: z.number().min(0),
    macroActions: z.number().int().min(0),
  })
  .strict();

const ProfileReadProxyRoutingSchema = z
  .object({
    protocol: ProxyProtocolSchema,
    host: NonEmptyStringSchema,
    port: z.number().int().min(1).max(65_535),
    countryCode: NonEmptyStringSchema.optional(),
    region: NonEmptyStringSchema.optional(),
  })
  .strict();

const ProxyCredentialsSchema = z
  .object({
    username: NonEmptyStringSchema,
    password: NonEmptyStringSchema,
  })
  .strict();

const ProxyRoutingConfigurationSchema = ProfileReadProxyRoutingSchema.extend({
  credentials: ProxyCredentialsSchema.nullable(),
}).strict();

const ProfileReadNetworkContextSchema = z
  .object({
    proxy: ProfileReadProxyRoutingSchema.nullable(),
    killswitch: z
      .object({
        enabled: z.boolean(),
        failClosed: z.boolean(),
      })
      .strict(),
  })
  .strict();

const NetworkContextConfigurationSchema = z
  .object({
    proxy: ProxyRoutingConfigurationSchema.nullable(),
    killswitch: z
      .object({
        enabled: z.boolean(),
        failClosed: z.boolean(),
      })
      .strict(),
  })
  .strict();

const ViewportSizeSchema = z
  .object({
    width: z.number().positive(),
    height: z.number().positive(),
    deviceScaleFactor: z.number().positive().optional(),
  })
  .strict();

const HardwareFingerprintSchema = z
  .object({
    userAgent: NonEmptyStringSchema,
    viewport: ViewportSizeSchema,
    languages: z.array(NonEmptyStringSchema),
    hardwareConcurrency: z.number().positive(),
    platform: NonEmptyStringSchema.optional(),
    deviceMemoryGb: z.number().positive().optional(),
    timezone: NonEmptyStringSchema.optional(),
  })
  .strict();

const NumericRangeSchema = z
  .object({
    min: z.number().min(0),
    max: z.number().min(0),
  })
  .strict();

const BehavioralPersonaSchema = z
  .object({
    scrollStyle: ScrollStyleSchema,
    microDelayMs: NumericRangeSchema,
    reverseScrollProbability: z.number().min(0).max(1),
    dwellTimeMs: NumericRangeSchema,
  })
  .strict();

const ActiveTimeWindowSchema = z
  .object({
    days: z.array(z.number().int().min(0).max(6)),
    startsAt: NonEmptyStringSchema,
    endsAt: NonEmptyStringSchema,
  })
  .strict();

const TemporalRoutineSchema = z
  .object({
    timezone: z.string(),
    chronotype: ChronotypeSchema,
    activeWindows: z.array(ActiveTimeWindowSchema),
    cooldownMinutes: z.number().min(0),
  })
  .strict();

const SafetyThresholdsSchema = z
  .object({
    maxSessionsPerDay: z.number().min(0),
    maxSessionDurationMinutes: z.number().min(0),
    maxMacroActionsPerDay: z.number().min(0),
    minCooldownMinutes: z.number().min(0),
  })
  .strict();

const WeightedTopicSchema = z
  .object({
    topic: NonEmptyStringSchema,
    weight: z.number().min(0),
  })
  .strict();

const InteractionWeightsSchema = z
  .object({
    view: z.number().min(0),
    like: z.number().min(0),
    save: z.number().min(0),
    comment: z.number().min(0),
    share: z.number().min(0),
  })
  .strict();

const ContentAffinitiesSchema = z
  .object({
    primaryTopics: z.array(WeightedTopicSchema),
    secondaryTopics: z.array(WeightedTopicSchema),
    interactionWeights: InteractionWeightsSchema,
  })
  .strict();

export const ProfileSummarySchema = z
  .object({
    id: NonEmptyStringSchema,
    displayName: NonEmptyStringSchema,
    status: ProfileStatusSchema,
    timezone: z.string(),
    createdAt: NonEmptyStringSchema,
    updatedAt: NonEmptyStringSchema,
    lastCheckoutAt: z.string().nullable(),
    lastReleasedAt: z.string().nullable(),
    nextAvailableAt: z.string().nullable(),
    dailyUsage: DailyUsageSchema,
    hasHardwareFingerprint: z.boolean(),
    hasAuthenticationState: z.boolean(),
    externalReference: NonEmptyStringSchema.optional(),
    labels: z.array(NonEmptyStringSchema).optional(),
  })
  .strict();

export const ProfileMutationSummarySchema = z
  .object({
    id: NonEmptyStringSchema,
    displayName: NonEmptyStringSchema,
    status: ProfileStatusSchema,
    createdAt: NonEmptyStringSchema,
    updatedAt: NonEmptyStringSchema,
    lastCheckoutAt: z.string().nullable(),
    lastReleasedAt: z.string().nullable(),
    nextAvailableAt: z.string().nullable(),
    dailyUsage: DailyUsageSchema,
    hasHardwareFingerprint: z.boolean(),
    hasAuthenticationState: z.boolean(),
    provisioningTokenStatus: ProvisioningTokenStatusSchema,
  })
  .strict();

export const ProfileDetailSchema = ProfileSummarySchema.extend({
  networkContext: ProfileReadNetworkContextSchema,
  hardwareFingerprint: HardwareFingerprintSchema.nullable(),
  behavioralPersona: BehavioralPersonaSchema,
  temporalRoutine: TemporalRoutineSchema,
  safetyThresholds: SafetyThresholdsSchema,
  contentAffinities: ContentAffinitiesSchema,
}).strict();

const PageSchema = z
  .object({
    limit: z.number(),
    offset: z.number(),
    total: z.number().optional(),
  })
  .strict();

export const ProfilesListResponseSchema = z
  .object({
    items: z.array(ProfileSummarySchema),
    page: PageSchema,
  })
  .strict();

export const ProfileDetailResponseSchema = z
  .object({
    profile: ProfileDetailSchema,
  })
  .strict();

export const CreateProfileRequestSchema = z
  .object({
    id: NonEmptyStringSchema,
    displayName: NonEmptyStringSchema,
  })
  .strict();

export const UpdateProfileConfigurationRequestSchema = z
  .object({
    networkContext: NetworkContextConfigurationSchema.optional(),
    hardwareFingerprint: HardwareFingerprintSchema.optional(),
    behavioralPersona: BehavioralPersonaSchema.optional(),
    temporalRoutine: TemporalRoutineSchema.optional(),
    safetyThresholds: SafetyThresholdsSchema.optional(),
    contentAffinities: ContentAffinitiesSchema.optional(),
  })
  .strict()
  .refine(
    (body) =>
      body.networkContext !== undefined ||
      body.hardwareFingerprint !== undefined ||
      body.behavioralPersona !== undefined ||
      body.temporalRoutine !== undefined ||
      body.safetyThresholds !== undefined ||
      body.contentAffinities !== undefined,
    {
      message: "At least one profile configuration property group is required.",
    },
  );

export const ProfileMutationResponseSchema = z
  .object({
    profile: ProfileMutationSummarySchema,
  })
  .strict();

export type ProvisioningTokenStatus = z.infer<
  typeof ProvisioningTokenStatusSchema
>;
export type ProxyProtocol = z.infer<typeof ProxyProtocolSchema>;
export type ScrollStyle = z.infer<typeof ScrollStyleSchema>;
export type Chronotype = z.infer<typeof ChronotypeSchema>;
export type ProfileSummary = z.infer<typeof ProfileSummarySchema>;
export type ProfileMutationSummary = z.infer<
  typeof ProfileMutationSummarySchema
>;
export type ProfileDetail = z.infer<typeof ProfileDetailSchema>;
export type ProfileReadNetworkContext = z.infer<
  typeof ProfileReadNetworkContextSchema
>;
export type ProxyCredentials = z.infer<typeof ProxyCredentialsSchema>;
export type NetworkContextConfiguration = z.infer<
  typeof NetworkContextConfigurationSchema
>;
export type HardwareFingerprint = z.infer<typeof HardwareFingerprintSchema>;
export type BehavioralPersona = z.infer<typeof BehavioralPersonaSchema>;
export type TemporalRoutine = z.infer<typeof TemporalRoutineSchema>;
export type SafetyThresholds = z.infer<typeof SafetyThresholdsSchema>;
export type ContentAffinities = z.infer<typeof ContentAffinitiesSchema>;
export type ProfilesListResponse = z.infer<typeof ProfilesListResponseSchema>;
export type ProfileDetailResponse = z.infer<typeof ProfileDetailResponseSchema>;
export type CreateProfileRequest = z.infer<typeof CreateProfileRequestSchema>;
export type UpdateProfileConfigurationRequest = z.infer<
  typeof UpdateProfileConfigurationRequestSchema
>;
export type ProfileMutationResponse = z.infer<
  typeof ProfileMutationResponseSchema
>;

export interface ListProfilesQuery {
  readonly status?: KnownProfileStatus;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ProfileManagerClient {
  readonly listProfiles: (
    query?: ListProfilesQuery,
  ) => Promise<ApiResult<ProfilesListResponse>>;
  readonly getProfile: (
    profileId: string,
  ) => Promise<ApiResult<ProfileDetailResponse>>;
  readonly createProfile: (
    request: CreateProfileRequest,
  ) => Promise<ApiResult<ProfileMutationResponse>>;
  readonly updateProfileConfiguration: (
    profileId: string,
    request: UpdateProfileConfigurationRequest,
  ) => Promise<ApiResult<ProfileMutationResponse>>;
}

export function createProfileManagerClient(
  httpClient: HttpClient = createHttpClient({ baseUrl: env.VITE_API_BASE_URL }),
): ProfileManagerClient {
  return {
    listProfiles(query) {
      return httpClient.request({
        path: "/collector/profiles",
        query: toListProfilesQueryParams(query),
        responseSchema: ProfilesListResponseSchema,
      });
    },
    getProfile(profileId) {
      return httpClient.request({
        path: `/collector/profiles/${encodeURIComponent(profileId)}`,
        responseSchema: ProfileDetailResponseSchema,
      });
    },
    createProfile(request) {
      return httpClient.request({
        path: "/collector/profiles",
        method: "POST",
        body: request,
        responseSchema: ProfileMutationResponseSchema,
      });
    },
    updateProfileConfiguration(profileId, request) {
      return httpClient.request({
        path: `/collector/profiles/${encodeURIComponent(profileId)}/configuration`,
        method: "PATCH",
        body: request,
        responseSchema: ProfileMutationResponseSchema,
      });
    },
  };
}

export const profileManagerClient = createProfileManagerClient();

function toListProfilesQueryParams(
  query: ListProfilesQuery | undefined,
): Readonly<Record<string, string | number>> | undefined {
  if (query === undefined) {
    return undefined;
  }

  return {
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.limit !== undefined ? { limit: query.limit } : {}),
    ...(query.offset !== undefined ? { offset: query.offset } : {}),
  };
}
