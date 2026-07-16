import { z } from "zod";
import {
  COLLECTOR_RUNTIME_ACCOUNT_STAGES,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_OUTCOMES,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES,
  ProfileSourceAccessCheckRunFailureReasonSchema,
  ProfileSourceAccessCheckRunIdSchema,
  ProfileSourceAccessCheckRunStatusSchema,
} from "../../../../collector-runtime/domain";
import {
  errorResponseJsonSchema,
  isoDateTimeJsonSchema,
  nonEmptyStringJsonSchema,
  pageJsonSchema,
  NonEmptyStringHttpSchema,
} from "./http-schema-primitives";


const DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT = 50;
const MAX_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT = 500;

export const ProfileSourceAccessCheckRunIdHttpParamsSchema = z
  .object({
    checkRunId: ProfileSourceAccessCheckRunIdSchema,
  })
  .strict();
export const RequestProfileSourceAccessCheckRunHttpBodySchema = z
  .object({
    profileId: NonEmptyStringHttpSchema,
    sourceGroupId: NonEmptyStringHttpSchema,
  })
  .strict();
export const ListProfileSourceAccessCheckRunsHttpQuerySchema = z
  .object({
    status: ProfileSourceAccessCheckRunStatusSchema.optional(),
    profileId: NonEmptyStringHttpSchema.optional(),
    sourceGroupId: NonEmptyStringHttpSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT)
      .default(DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type ProfileSourceAccessCheckRunIdHttpParams = z.infer<
  typeof ProfileSourceAccessCheckRunIdHttpParamsSchema
>;
export type RequestProfileSourceAccessCheckRunHttpBody = z.infer<
  typeof RequestProfileSourceAccessCheckRunHttpBodySchema
>;
export type ListProfileSourceAccessCheckRunsHttpQuery = z.infer<
  typeof ListProfileSourceAccessCheckRunsHttpQuerySchema
>;
const profileSourceAccessCheckRunIdParamsJsonSchema = {
  type: "object",
  required: ["checkRunId"],
  additionalProperties: false,
  properties: {
    checkRunId: nonEmptyStringJsonSchema,
  },
} as const;

const requestProfileSourceAccessCheckRunBodyJsonSchema = {
  type: "object",
  required: ["profileId", "sourceGroupId"],
  additionalProperties: false,
  properties: {
    profileId: nonEmptyStringJsonSchema,
    sourceGroupId: nonEmptyStringJsonSchema,
  },
} as const;



const profileSourceAccessCheckRunTargetJsonSchema = {
  type: "object",
  required: ["platform", "routeType", "url"],
  additionalProperties: false,
  properties: {
    platform: { type: "string", enum: ["FACEBOOK"] },
    routeType: { type: "string", enum: ["DIRECT_GROUP_URL"] },
    url: { type: "string", minLength: 1, format: "uri" },
  },
} as const;

const profileSourceAccessCheckRunFailureReasonJsonSchema = {
  type: "object",
  required: ["code", "message"],
  additionalProperties: false,
  properties: {
    code: nonEmptyStringJsonSchema,
    message: nonEmptyStringJsonSchema,
  },
} as const;

const profileSourceAccessCheckRunJsonSchema = {
  type: "object",
  required: [
    "id",
    "profileId",
    "sourceGroupId",
    "triggerType",
    "status",
    "accountStageAtRequest",
    "target",
    "requestedAt",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    profileId: nonEmptyStringJsonSchema,
    sourceGroupId: nonEmptyStringJsonSchema,
    triggerType: { type: "string", enum: ["MANUAL"] },
    status: { type: "string", enum: PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES },
    accountStageAtRequest: { type: "string", enum: COLLECTOR_RUNTIME_ACCOUNT_STAGES },
    target: profileSourceAccessCheckRunTargetJsonSchema,
    outcome: { type: "string", enum: PROFILE_SOURCE_ACCESS_CHECK_RUN_OUTCOMES },
    failureReason: profileSourceAccessCheckRunFailureReasonJsonSchema,
    requestedAt: isoDateTimeJsonSchema,
    startedAt: isoDateTimeJsonSchema,
    finishedAt: isoDateTimeJsonSchema,
    createdAt: isoDateTimeJsonSchema,
    updatedAt: isoDateTimeJsonSchema,
  },
} as const;
export const requestProfileSourceAccessCheckRunHttpRouteSchema = {
  body: requestProfileSourceAccessCheckRunBodyJsonSchema,
  response: {
    201: {
      type: "object",
      required: ["profileSourceAccessCheckRun"],
      additionalProperties: false,
      properties: {
        profileSourceAccessCheckRun: profileSourceAccessCheckRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
export const getProfileSourceAccessCheckRunHttpRouteSchema = {
  params: profileSourceAccessCheckRunIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["profileSourceAccessCheckRun"],
      additionalProperties: false,
      properties: {
        profileSourceAccessCheckRun: profileSourceAccessCheckRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
export const listProfileSourceAccessCheckRunsHttpRouteSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: { type: "string", enum: PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES },
      profileId: nonEmptyStringJsonSchema,
      sourceGroupId: nonEmptyStringJsonSchema,
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT,
        default: DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT,
      },
      offset: {
        type: "integer",
        minimum: 0,
        default: 0,
      },
    },
  },
  response: {
    200: {
      type: "object",
      required: ["items", "page"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: profileSourceAccessCheckRunJsonSchema,
        },
        page: pageJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
export const cancelProfileSourceAccessCheckRunHttpRouteSchema = {
  params: profileSourceAccessCheckRunIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["profileSourceAccessCheckRun"],
      additionalProperties: false,
      properties: {
        profileSourceAccessCheckRun: profileSourceAccessCheckRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
