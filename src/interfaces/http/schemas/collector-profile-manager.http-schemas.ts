import { z } from "zod";
import {
  BehavioralPersonaSchema,
  BrowserCookieSchema,
  ContentAffinitiesSchema,
  HardwareFingerprintSchema,
  IsoDateTimeSchema,
  LocalStorageEntrySchema,
  NetworkContextSchema,
  ProfileAccountStageSchema,
  ProfileIdSchema,
  ProfileLeaseIdSchema,
  ProfileSourceAccessSourceGroupIdSchema,
  ProfileSourceAccessStateSchema,
  ProfileStatusSchema,
  SafetyThresholdsSchema,
  TemporalRoutineSchema,
} from "../../../collector-profile-manager/domain";
import {
  PROFILE_SOURCE_ACCESS_STATES,
} from "../../../collector-profile-manager/domain";
import {
  MAX_PROFILE_LIST_LIMIT,
} from "../../../collector-profile-manager/application";
export { HttpRequestValidationError, parseHttpInput } from "./http-validation";

export const MAX_PROFILE_SOURCE_ACCESS_FAILURE_CODE_LENGTH = 64;
export const MAX_PROFILE_SOURCE_ACCESS_FAILURE_MESSAGE_LENGTH = 500;
export const MAX_PROFILE_SOURCE_ACCESS_NOTES_LENGTH = 2000;

export const CreateProfileHttpBodySchema = z
  .object({
    id: ProfileIdSchema,
    displayName: z.string().trim().min(1),
  })
  .strict();

export const ProfileIdHttpParamsSchema = z
  .object({
    profileId: ProfileIdSchema,
  })
  .strict();

export const ProfileSourceAccessHttpParamsSchema = z
  .object({
    profileId: ProfileIdSchema,
    sourceGroupId: ProfileSourceAccessSourceGroupIdSchema,
  })
  .strict();

export const ProfileSourceAccessSourceGroupHttpParamsSchema = z
  .object({
    sourceGroupId: ProfileSourceAccessSourceGroupIdSchema,
  })
  .strict();

export const ProvisioningTokenHttpParamsSchema = z
  .object({
    token: z.string().trim().min(1),
  })
  .strict();

export const ProfileLeaseIdHttpParamsSchema = z
  .object({
    leaseId: ProfileLeaseIdSchema,
  })
  .strict();

export const ListProfilesHttpQuerySchema = z
  .object({
    status: ProfileStatusSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PROFILE_LIST_LIMIT)
      .optional(),
    offset: z.coerce.number().int().min(0).optional(),
  })
  .strict();

export const UpdateProfileConfigurationHttpBodySchema = z
  .object({
    networkContext: NetworkContextSchema.optional(),
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

export const UpdateProfileAccountStageHttpBodySchema = z
  .object({
    accountStage: ProfileAccountStageSchema,
  })
  .strict();

export const IngestProfileSessionHttpBodySchema = z
  .object({
    cookies: z.array(BrowserCookieSchema),
    localStorage: z.array(LocalStorageEntrySchema),
    sessionExpiresAt: IsoDateTimeSchema.nullable().optional(),
  })
  .strict();

export const CheckoutProfileHttpBodySchema = z
  .object({
    sourceGroupId: z.string().trim().min(1),
    profileId: ProfileIdSchema.optional(),
  })
  .strict();

export const ReleaseProfileLeaseHttpBodySchema = z
  .object({
    macroActionsPerformed: z.number().int().min(0).optional(),
  })
  .strict();

const SourceAccessFailureCodeHttpSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PROFILE_SOURCE_ACCESS_FAILURE_CODE_LENGTH)
  .regex(/^[A-Z0-9_:-]+$/, "Expected sanitized failure reason code.");

const ProfileSourceAccessFailureMessageHttpSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PROFILE_SOURCE_ACCESS_FAILURE_MESSAGE_LENGTH)
  .refine((value) => !containsUnsafeProfileSourceAccessText(value), {
    message: "Expected sanitized profile-source access text.",
  });

const ProfileSourceAccessNotesHttpSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_PROFILE_SOURCE_ACCESS_NOTES_LENGTH)
  .refine((value) => !containsUnsafeProfileSourceAccessText(value), {
    message: "Expected sanitized profile-source access text.",
  });

const ProfileSourceAccessFailureReasonHttpSchema = z
  .object({
    code: SourceAccessFailureCodeHttpSchema,
    message: ProfileSourceAccessFailureMessageHttpSchema,
  })
  .strict();

export const UpsertProfileSourceAccessHttpBodySchema = z
  .object({
    accessState: ProfileSourceAccessStateSchema,
    lastFailureReason: ProfileSourceAccessFailureReasonHttpSchema.nullable()
      .optional(),
    notes: ProfileSourceAccessNotesHttpSchema.optional(),
  })
  .strict();

export type CreateProfileHttpBody = z.infer<
  typeof CreateProfileHttpBodySchema
>;
export type ProfileIdHttpParams = z.infer<typeof ProfileIdHttpParamsSchema>;
export type ProfileSourceAccessHttpParams = z.infer<
  typeof ProfileSourceAccessHttpParamsSchema
>;
export type ProfileSourceAccessSourceGroupHttpParams = z.infer<
  typeof ProfileSourceAccessSourceGroupHttpParamsSchema
>;
export type ProvisioningTokenHttpParams = z.infer<
  typeof ProvisioningTokenHttpParamsSchema
>;
export type ProfileLeaseIdHttpParams = z.infer<
  typeof ProfileLeaseIdHttpParamsSchema
>;
export type ListProfilesHttpQuery = z.infer<
  typeof ListProfilesHttpQuerySchema
>;
export type UpdateProfileConfigurationHttpBody = z.infer<
  typeof UpdateProfileConfigurationHttpBodySchema
>;
export type UpdateProfileAccountStageHttpBody = z.infer<
  typeof UpdateProfileAccountStageHttpBodySchema
>;
export type IngestProfileSessionHttpBody = z.infer<
  typeof IngestProfileSessionHttpBodySchema
>;
export type CheckoutProfileHttpBody = z.infer<
  typeof CheckoutProfileHttpBodySchema
>;
export type ReleaseProfileLeaseHttpBody = z.infer<
  typeof ReleaseProfileLeaseHttpBodySchema
>;
export type UpsertProfileSourceAccessHttpBody = z.infer<
  typeof UpsertProfileSourceAccessHttpBodySchema
>;

const nonEmptyStringJsonSchema = { type: "string", minLength: 1 } as const;
const stringJsonSchema = { type: "string" } as const;
const nullableIsoDateTimeJsonSchema = {
  anyOf: [{ type: "string" }, { type: "null" }],
} as const;
const nullableProfileSourceAccessFailureReasonJsonSchema = {
  anyOf: [
    {
      type: "object",
      required: ["code", "message"],
      additionalProperties: false,
      properties: {
        code: {
          ...nonEmptyStringJsonSchema,
          maxLength: MAX_PROFILE_SOURCE_ACCESS_FAILURE_CODE_LENGTH,
        },
        message: {
          ...nonEmptyStringJsonSchema,
          maxLength: MAX_PROFILE_SOURCE_ACCESS_FAILURE_MESSAGE_LENGTH,
        },
      },
    },
    { type: "null" },
  ],
} as const;
const looseObjectJsonSchema = {
  type: "object",
  additionalProperties: true,
} as const;
const nullableLooseObjectJsonSchema = {
  anyOf: [looseObjectJsonSchema, { type: "null" }],
} as const;

const errorResponseJsonSchema = {
  type: "object",
  required: ["error"],
  additionalProperties: false,
  properties: {
    error: {
      type: "object",
      required: ["code", "message"],
      additionalProperties: true,
      properties: {
        code: nonEmptyStringJsonSchema,
        message: nonEmptyStringJsonSchema,
      },
    },
  },
} as const;

const dailyUsageJsonSchema = {
  type: "object",
  required: [
    "localDate",
    "sessionsStarted",
    "activeDurationMinutes",
    "macroActions",
  ],
  additionalProperties: false,
  properties: {
    localDate: nullableIsoDateTimeJsonSchema,
    sessionsStarted: { type: "integer", minimum: 0 },
    activeDurationMinutes: { type: "number", minimum: 0 },
    macroActions: { type: "integer", minimum: 0 },
  },
} as const;

const profileSummaryJsonSchema = {
  type: "object",
  required: [
    "id",
    "displayName",
    "status",
    "accountStage",
    "createdAt",
    "updatedAt",
    "lastCheckoutAt",
    "lastReleasedAt",
    "nextAvailableAt",
    "dailyUsage",
    "hasHardwareFingerprint",
    "hasAuthenticationState",
    "provisioningTokenStatus",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    displayName: nonEmptyStringJsonSchema,
    status: {
      type: "string",
      enum: ["PENDING_CONFIG", "PENDING_LOGIN", "READY", "BUSY"],
    },
    accountStage: {
      type: "string",
      enum: [
        "NEW_ACCOUNT",
        "WARMING",
        "COLLECTION_READY",
        "LIMITED",
        "NEEDS_REVIEW",
        "RETIRED",
      ],
    },
    createdAt: nonEmptyStringJsonSchema,
    updatedAt: nonEmptyStringJsonSchema,
    lastCheckoutAt: nullableIsoDateTimeJsonSchema,
    lastReleasedAt: nullableIsoDateTimeJsonSchema,
    nextAvailableAt: nullableIsoDateTimeJsonSchema,
    dailyUsage: dailyUsageJsonSchema,
    hasHardwareFingerprint: { type: "boolean" },
    hasAuthenticationState: { type: "boolean" },
    provisioningTokenStatus: {
      type: "string",
      enum: ["NOT_ISSUED", "ISSUED", "CONSUMED", "EXPIRED"],
    },
  },
} as const;

const profileReadSummaryJsonSchema = {
  type: "object",
  required: [
    "id",
    "displayName",
    "status",
    "accountStage",
    "timezone",
    "createdAt",
    "updatedAt",
    "lastCheckoutAt",
    "lastReleasedAt",
    "nextAvailableAt",
    "dailyUsage",
    "hasHardwareFingerprint",
    "hasAuthenticationState",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    displayName: nonEmptyStringJsonSchema,
    status: {
      type: "string",
      enum: ["PENDING_CONFIG", "PENDING_LOGIN", "READY", "BUSY"],
    },
    accountStage: profileSummaryJsonSchema.properties.accountStage,
    timezone: stringJsonSchema,
    createdAt: nonEmptyStringJsonSchema,
    updatedAt: nonEmptyStringJsonSchema,
    lastCheckoutAt: nullableIsoDateTimeJsonSchema,
    lastReleasedAt: nullableIsoDateTimeJsonSchema,
    nextAvailableAt: nullableIsoDateTimeJsonSchema,
    dailyUsage: dailyUsageJsonSchema,
    hasHardwareFingerprint: { type: "boolean" },
    hasAuthenticationState: { type: "boolean" },
    externalReference: nonEmptyStringJsonSchema,
    labels: {
      type: "array",
      items: nonEmptyStringJsonSchema,
    },
  },
} as const;

const profileDetailJsonSchema = {
  type: "object",
  required: [
    "id",
    "displayName",
    "status",
    "timezone",
    "createdAt",
    "updatedAt",
    "lastCheckoutAt",
    "lastReleasedAt",
    "nextAvailableAt",
    "dailyUsage",
    "hasHardwareFingerprint",
    "hasAuthenticationState",
    "networkContext",
    "hardwareFingerprint",
    "behavioralPersona",
    "temporalRoutine",
    "safetyThresholds",
    "contentAffinities",
  ],
  additionalProperties: false,
  properties: {
    ...profileReadSummaryJsonSchema.properties,
    networkContext: looseObjectJsonSchema,
    hardwareFingerprint: nullableLooseObjectJsonSchema,
    behavioralPersona: looseObjectJsonSchema,
    temporalRoutine: looseObjectJsonSchema,
    safetyThresholds: looseObjectJsonSchema,
    contentAffinities: looseObjectJsonSchema,
  },
} as const;

const listProfilesQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["PENDING_CONFIG", "PENDING_LOGIN", "READY", "BUSY"],
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_PROFILE_LIST_LIMIT,
    },
    offset: {
      type: "integer",
      minimum: 0,
    },
  },
} as const;

const listProfilesPageJsonSchema = {
  type: "object",
  required: ["limit", "offset"],
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_PROFILE_LIST_LIMIT,
    },
    offset: {
      type: "integer",
      minimum: 0,
    },
    total: {
      type: "integer",
      minimum: 0,
    },
  },
} as const;

const profileLeaseJsonSchema = {
  type: "object",
  required: [
    "id",
    "profileId",
    "purpose",
    "leasedAt",
    "expiresAt",
    "releasedAt",
    "status",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    profileId: nonEmptyStringJsonSchema,
    purpose: {
      type: "string",
      enum: ["COLLECTION", "AMBIENT_EXERCISE"],
    },
    leasedAt: nonEmptyStringJsonSchema,
    expiresAt: nonEmptyStringJsonSchema,
    releasedAt: nullableIsoDateTimeJsonSchema,
    status: {
      type: "string",
      enum: ["ACTIVE", "RELEASED", "EXPIRED"],
    },
  },
} as const;

const profileSourceAccessJsonSchema = {
  type: "object",
  required: [
    "id",
    "profileId",
    "sourceGroupId",
    "accessState",
    "lastCheckedAt",
    "lastSuccessfulAt",
    "lastFailureReason",
    "joinRequestedAt",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    profileId: nonEmptyStringJsonSchema,
    sourceGroupId: nonEmptyStringJsonSchema,
    accessState: {
      type: "string",
      enum: PROFILE_SOURCE_ACCESS_STATES,
    },
    lastCheckedAt: nullableIsoDateTimeJsonSchema,
    lastSuccessfulAt: nullableIsoDateTimeJsonSchema,
    lastFailureReason: nullableProfileSourceAccessFailureReasonJsonSchema,
    joinRequestedAt: nullableIsoDateTimeJsonSchema,
    notes: {
      ...nonEmptyStringJsonSchema,
      maxLength: MAX_PROFILE_SOURCE_ACCESS_NOTES_LENGTH,
    },
    createdAt: nonEmptyStringJsonSchema,
    updatedAt: nonEmptyStringJsonSchema,
  },
} as const;

const profileIdParamsJsonSchema = {
  type: "object",
  required: ["profileId"],
  additionalProperties: false,
  properties: {
    profileId: nonEmptyStringJsonSchema,
  },
} as const;

const profileSourceAccessParamsJsonSchema = {
  type: "object",
  required: ["profileId", "sourceGroupId"],
  additionalProperties: false,
  properties: {
    profileId: nonEmptyStringJsonSchema,
    sourceGroupId: nonEmptyStringJsonSchema,
  },
} as const;

const profileSourceAccessSourceGroupParamsJsonSchema = {
  type: "object",
  required: ["sourceGroupId"],
  additionalProperties: false,
  properties: {
    sourceGroupId: nonEmptyStringJsonSchema,
  },
} as const;

const profileSourceAccessUpsertBodyJsonSchema = {
  type: "object",
  required: ["accessState"],
  additionalProperties: false,
  properties: {
    accessState: {
      type: "string",
      enum: PROFILE_SOURCE_ACCESS_STATES,
    },
    lastFailureReason: {
      anyOf: [
        {
          type: "object",
          required: ["code", "message"],
          additionalProperties: false,
          properties: {
            code: {
              ...nonEmptyStringJsonSchema,
              maxLength: MAX_PROFILE_SOURCE_ACCESS_FAILURE_CODE_LENGTH,
              pattern: "^[A-Z0-9_:-]+$",
            },
            message: {
              ...nonEmptyStringJsonSchema,
              maxLength: MAX_PROFILE_SOURCE_ACCESS_FAILURE_MESSAGE_LENGTH,
            },
          },
        },
        { type: "null" },
      ],
    },
    notes: {
      ...nonEmptyStringJsonSchema,
      maxLength: MAX_PROFILE_SOURCE_ACCESS_NOTES_LENGTH,
    },
  },
} as const;

const provisioningTokenParamsJsonSchema = {
  type: "object",
  required: ["token"],
  additionalProperties: false,
  properties: {
    token: nonEmptyStringJsonSchema,
  },
} as const;

const profileLeaseIdParamsJsonSchema = {
  type: "object",
  required: ["leaseId"],
  additionalProperties: false,
  properties: {
    leaseId: nonEmptyStringJsonSchema,
  },
} as const;

export const listProfilesHttpRouteSchema = {
  querystring: listProfilesQueryJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["items", "page"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: profileReadSummaryJsonSchema,
        },
        page: listProfilesPageJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const getProfileHttpRouteSchema = {
  params: profileIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["profile"],
      additionalProperties: false,
      properties: {
        profile: profileDetailJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const createProfileHttpRouteSchema = {
  body: {
    type: "object",
    required: ["id", "displayName"],
    additionalProperties: false,
    properties: {
      id: nonEmptyStringJsonSchema,
      displayName: nonEmptyStringJsonSchema,
    },
  },
  response: {
    201: {
      type: "object",
      required: ["profile"],
      additionalProperties: false,
      properties: {
        profile: profileSummaryJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const updateProfileConfigurationHttpRouteSchema = {
  params: profileIdParamsJsonSchema,
  body: {
    type: "object",
    minProperties: 1,
    additionalProperties: false,
    properties: {
      networkContext: looseObjectJsonSchema,
      hardwareFingerprint: looseObjectJsonSchema,
      behavioralPersona: looseObjectJsonSchema,
      temporalRoutine: looseObjectJsonSchema,
      safetyThresholds: looseObjectJsonSchema,
      contentAffinities: looseObjectJsonSchema,
    },
  },
  response: {
    200: {
      type: "object",
      required: ["profile"],
      additionalProperties: false,
      properties: {
        profile: profileSummaryJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const updateProfileAccountStageHttpRouteSchema = {
  params: profileIdParamsJsonSchema,
  body: {
    type: "object",
    required: ["accountStage"],
    additionalProperties: false,
    properties: {
      accountStage: profileSummaryJsonSchema.properties.accountStage,
    },
  },
  response: {
    200: {
      type: "object",
      required: ["profile"],
      additionalProperties: false,
      properties: {
        profile: profileDetailJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const startProfileProvisioningHttpRouteSchema = {
  params: profileIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["profile", "provisioningToken", "expiresAt"],
      additionalProperties: false,
      properties: {
        profile: profileSummaryJsonSchema,
        provisioningToken: nonEmptyStringJsonSchema,
        expiresAt: nonEmptyStringJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const getProvisioningConfigurationHttpRouteSchema = {
  params: provisioningTokenParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["profileId", "networkContext", "hardwareFingerprint"],
      additionalProperties: false,
      properties: {
        profileId: nonEmptyStringJsonSchema,
        networkContext: looseObjectJsonSchema,
        hardwareFingerprint: looseObjectJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const ingestProfileSessionHttpRouteSchema = {
  params: provisioningTokenParamsJsonSchema,
  body: {
    type: "object",
    required: ["cookies", "localStorage"],
    additionalProperties: false,
    properties: {
      cookies: {
        type: "array",
        items: looseObjectJsonSchema,
      },
      localStorage: {
        type: "array",
        items: looseObjectJsonSchema,
      },
      sessionExpiresAt: nullableIsoDateTimeJsonSchema,
    },
  },
  response: {
    200: {
      type: "object",
      required: ["profile"],
      additionalProperties: false,
      properties: {
        profile: profileSummaryJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const checkoutProfileHttpRouteSchema = {
  body: {
    type: "object",
    required: ["sourceGroupId"],
    additionalProperties: false,
    properties: {
      sourceGroupId: nonEmptyStringJsonSchema,
      profileId: nonEmptyStringJsonSchema,
    },
  },
  response: {
    200: {
      type: "object",
      required: ["lease", "profile"],
      additionalProperties: false,
      properties: {
        lease: profileLeaseJsonSchema,
        profile: {
          type: "object",
          required: [
            "profileId",
            "networkContext",
            "hardwareFingerprint",
            "authenticationState",
            "behavioralPersona",
            "temporalRoutine",
            "safetyThresholds",
            "contentAffinities",
          ],
          additionalProperties: false,
          properties: {
            profileId: nonEmptyStringJsonSchema,
            networkContext: looseObjectJsonSchema,
            hardwareFingerprint: looseObjectJsonSchema,
            authenticationState: looseObjectJsonSchema,
            behavioralPersona: looseObjectJsonSchema,
            temporalRoutine: looseObjectJsonSchema,
            safetyThresholds: looseObjectJsonSchema,
            contentAffinities: looseObjectJsonSchema,
          },
        },
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const checkoutProfileForExerciseHttpRouteSchema = {
  params: profileIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["lease", "profile"],
      additionalProperties: false,
      properties: {
        lease: profileLeaseJsonSchema,
        profile: {
          type: "object",
          required: ["profileId", "accountStage"],
          additionalProperties: false,
          properties: {
            profileId: nonEmptyStringJsonSchema,
            accountStage: profileSummaryJsonSchema.properties.accountStage,
          },
        },
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const releaseProfileLeaseHttpRouteSchema = {
  params: profileLeaseIdParamsJsonSchema,
  body: {
    type: "object",
    additionalProperties: false,
    properties: {
      macroActionsPerformed: {
        type: "integer",
        minimum: 0,
      },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["lease", "profile"],
      additionalProperties: false,
      properties: {
        lease: profileLeaseJsonSchema,
        profile: profileSummaryJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const getRuntimeProfileConfigurationHttpRouteSchema = {
  params: profileLeaseIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: [
        "profileId",
        "leaseId",
        "leaseExpiresAt",
        "hardwareFingerprint",
        "networkContext",
        "authenticationState",
        "temporalRoutine",
        "safetyThresholds",
        "contentAffinities",
      ],
      additionalProperties: false,
      properties: {
        profileId: nonEmptyStringJsonSchema,
        leaseId: nonEmptyStringJsonSchema,
        leaseExpiresAt: nonEmptyStringJsonSchema,
        hardwareFingerprint: looseObjectJsonSchema,
        networkContext: looseObjectJsonSchema,
        authenticationState: looseObjectJsonSchema,
        temporalRoutine: looseObjectJsonSchema,
        safetyThresholds: looseObjectJsonSchema,
        contentAffinities: looseObjectJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const upsertProfileSourceAccessHttpRouteSchema = {
  params: profileSourceAccessParamsJsonSchema,
  body: profileSourceAccessUpsertBodyJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["profileSourceAccess"],
      additionalProperties: false,
      properties: {
        profileSourceAccess: profileSourceAccessJsonSchema,
      },
    },
    201: {
      type: "object",
      required: ["profileSourceAccess"],
      additionalProperties: false,
      properties: {
        profileSourceAccess: profileSourceAccessJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const listProfileSourceAccessForProfileHttpRouteSchema = {
  params: profileIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["items"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: profileSourceAccessJsonSchema,
        },
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const getProfileSourceAccessHttpRouteSchema = {
  params: profileSourceAccessParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["profileSourceAccess"],
      additionalProperties: false,
      properties: {
        profileSourceAccess: profileSourceAccessJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const listProfileSourceAccessForSourceGroupHttpRouteSchema = {
  params: profileSourceAccessSourceGroupParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["items"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: profileSourceAccessJsonSchema,
        },
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

function containsUnsafeProfileSourceAccessText(value: string): boolean {
  const normalized = value.toLowerCase();
  const unsafeTerms = [
    "cookie",
    "localstorage",
    "local storage",
    "authorization",
    "bearer",
    "proxy credential",
    "proxy password",
    "session header",
    "provisioning token",
    "token hash",
    "fingerprint secret",
    "raw page html",
    "screenshot",
    "raw facebook payload",
    "raw payload",
    "runtime config",
    "localstorage",
  ];

  return unsafeTerms.some((term) => normalized.includes(term));
}
