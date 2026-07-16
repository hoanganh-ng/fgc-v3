import { z } from "zod";
import {
  ProfileHomeFeedCollectionScheduleProfileIdSchema,
} from "../../../../collector-runtime/domain";
import {
  DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
  MAX_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
} from "../../../../collector-runtime/application";
import {
  errorResponseJsonSchema,
  isoDateTimeJsonSchema,
  nonEmptyStringJsonSchema,
  pageJsonSchema,
  NonEmptyStringHttpSchema,
} from "./http-schema-primitives";


export const ProfileHomeFeedCollectionScheduleProfileIdHttpParamsSchema = z
  .object({
    profileId: ProfileHomeFeedCollectionScheduleProfileIdSchema,
  })
  .strict();
export const CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBodySchema = z
  .object({
    enabled: z.boolean(),
    intervalMinutes: z.number().int().min(1).max(10080),
    nextRunAt: z.iso.datetime({ offset: true }),
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
    maxPosts: z.number().int().min(1).optional(),
  })
  .strict();
export const ListProfileHomeFeedCollectionSchedulesHttpQuerySchema = z
  .object({
    enabled: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT)
      .default(DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export type ProfileHomeFeedCollectionScheduleProfileIdHttpParams = z.infer<
  typeof ProfileHomeFeedCollectionScheduleProfileIdHttpParamsSchema
>;
export type CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBody = z.infer<
  typeof CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBodySchema
>;
export type ListProfileHomeFeedCollectionSchedulesHttpQuery = z.infer<
  typeof ListProfileHomeFeedCollectionSchedulesHttpQuerySchema
>;
const profileHomeFeedCollectionScheduleFailureReasonJsonSchema = {
  type: "object",
  required: ["code", "message"],
  additionalProperties: false,
  properties: {
    code: nonEmptyStringJsonSchema,
    message: nonEmptyStringJsonSchema,
  },
} as const;
const profileHomeFeedCollectionScheduleParametersJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    maxScrolls: {
      type: "integer",
      minimum: 0,
    },
    maxDurationMs: {
      type: "integer",
      minimum: 1,
    },
    maxPosts: {
      type: "integer",
      minimum: 1,
    },
  },
} as const;
const profileHomeFeedCollectionScheduleJsonSchema = {
  type: "object",
  required: [
    "profileId",
    "enabled",
    "intervalMinutes",
    "nextRunAt",
    "parameters",
    "consecutiveFailures",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    profileId: nonEmptyStringJsonSchema,
    enabled: {
      type: "boolean",
    },
    intervalMinutes: {
      type: "integer",
      minimum: 1,
      maximum: 10080,
    },
    nextRunAt: isoDateTimeJsonSchema,
    parameters: profileHomeFeedCollectionScheduleParametersJsonSchema,
    lastAttemptedAt: isoDateTimeJsonSchema,
    lastDispatchStatus: {
      type: "string",
      enum: [
        "DISPATCHED",
        "SKIPPED_ACTIVE_RUN",
        "PROFILE_NOT_FOUND",
        "PROFILE_LOOKUP_FAILED",
      ],
    },
    lastFailureReason: profileHomeFeedCollectionScheduleFailureReasonJsonSchema,
    consecutiveFailures: {
      type: "integer",
      minimum: 0,
    },
    createdAt: isoDateTimeJsonSchema,
    updatedAt: isoDateTimeJsonSchema,
  },
} as const;
const profileHomeFeedCollectionScheduleProfileIdParamsJsonSchema = {
  type: "object",
  required: ["profileId"],
  additionalProperties: false,
  properties: {
    profileId: nonEmptyStringJsonSchema,
  },
} as const;
const createOrUpdateProfileHomeFeedCollectionScheduleBodyJsonSchema = {
  type: "object",
  required: ["enabled", "intervalMinutes", "nextRunAt"],
  additionalProperties: false,
  properties: {
    enabled: {
      type: "boolean",
    },
    intervalMinutes: {
      type: "integer",
      minimum: 1,
      maximum: 10080,
    },
    nextRunAt: isoDateTimeJsonSchema,
    maxScrolls: {
      type: "integer",
      minimum: 0,
    },
    maxDurationMs: {
      type: "integer",
      minimum: 1,
    },
    maxPosts: {
      type: "integer",
      minimum: 1,
    },
  },
} as const;
const listProfileHomeFeedCollectionSchedulesQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    enabled: {
      type: "string",
      enum: ["true", "false"],
    },
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
      default: DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
    },
    offset: {
      type: "integer",
      minimum: 0,
      default: 0,
    },
  },
} as const;
export const listProfileHomeFeedCollectionSchedulesHttpRouteSchema = {
  querystring: listProfileHomeFeedCollectionSchedulesQueryJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["items", "page"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: profileHomeFeedCollectionScheduleJsonSchema,
        },
        page: pageJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
export const getProfileHomeFeedCollectionScheduleHttpRouteSchema = {
  params: profileHomeFeedCollectionScheduleProfileIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["schedule"],
      additionalProperties: false,
      properties: {
        schedule: profileHomeFeedCollectionScheduleJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
export const createOrUpdateProfileHomeFeedCollectionScheduleHttpRouteSchema = {
  params: profileHomeFeedCollectionScheduleProfileIdParamsJsonSchema,
  body: createOrUpdateProfileHomeFeedCollectionScheduleBodyJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["schedule"],
      additionalProperties: false,
      properties: {
        schedule: profileHomeFeedCollectionScheduleJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
