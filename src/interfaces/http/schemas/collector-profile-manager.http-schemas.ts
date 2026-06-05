import { z } from "zod";
import {
  BehavioralPersonaSchema,
  BrowserCookieSchema,
  ContentAffinitiesSchema,
  HardwareFingerprintSchema,
  IsoDateTimeSchema,
  LocalStorageEntrySchema,
  NetworkContextSchema,
  ProfileIdSchema,
  ProfileLeaseIdSchema,
  ProfileStatusSchema,
  SafetyThresholdsSchema,
  TemporalRoutineSchema,
} from "../../../collector-profile-manager/domain";
import type { ValidationIssue } from "../../../collector-profile-manager/domain";
import {
  MAX_PROFILE_LIST_LIMIT,
} from "../../../collector-profile-manager/application";

export class HttpRequestValidationError extends Error {
  public readonly issues: readonly ValidationIssue[];

  public constructor(issues: readonly ValidationIssue[]) {
    super("HTTP request validation failed.");
    this.name = "HttpRequestValidationError";
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseHttpInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new HttpRequestValidationError(
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }

  return result.data;
}

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

export const IngestProfileSessionHttpBodySchema = z
  .object({
    cookies: z.array(BrowserCookieSchema),
    localStorage: z.array(LocalStorageEntrySchema),
    sessionExpiresAt: IsoDateTimeSchema.nullable().optional(),
  })
  .strict();

export const CheckoutProfileHttpBodySchema = z
  .object({
    profileId: ProfileIdSchema.optional(),
  })
  .strict();

export const ReleaseProfileLeaseHttpBodySchema = z
  .object({
    macroActionsPerformed: z.number().int().min(0).optional(),
  })
  .strict();

export type CreateProfileHttpBody = z.infer<
  typeof CreateProfileHttpBodySchema
>;
export type ProfileIdHttpParams = z.infer<typeof ProfileIdHttpParamsSchema>;
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
export type IngestProfileSessionHttpBody = z.infer<
  typeof IngestProfileSessionHttpBodySchema
>;
export type CheckoutProfileHttpBody = z.infer<
  typeof CheckoutProfileHttpBodySchema
>;
export type ReleaseProfileLeaseHttpBody = z.infer<
  typeof ReleaseProfileLeaseHttpBodySchema
>;

const nonEmptyStringJsonSchema = { type: "string", minLength: 1 } as const;
const stringJsonSchema = { type: "string" } as const;
const nullableIsoDateTimeJsonSchema = {
  anyOf: [{ type: "string" }, { type: "null" }],
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
  required: ["id", "profileId", "leasedAt", "expiresAt", "releasedAt", "status"],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    profileId: nonEmptyStringJsonSchema,
    leasedAt: nonEmptyStringJsonSchema,
    expiresAt: nonEmptyStringJsonSchema,
    releasedAt: nullableIsoDateTimeJsonSchema,
    status: {
      type: "string",
      enum: ["ACTIVE", "RELEASED", "EXPIRED"],
    },
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
    additionalProperties: false,
    properties: {
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
