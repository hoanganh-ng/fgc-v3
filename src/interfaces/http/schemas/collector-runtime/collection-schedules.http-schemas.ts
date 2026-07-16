import { z } from "zod";
import {
  DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT,
  MAX_COLLECTION_SCHEDULE_LIST_LIMIT,
} from "../../../../collector-runtime/application";
import {
  errorResponseJsonSchema,
  isoDateTimeJsonSchema,
  nonEmptyStringJsonSchema,
  pageJsonSchema,
  NonEmptyStringHttpSchema,
} from "./http-schema-primitives";


export const CollectionScheduleSourceGroupIdHttpParamsSchema = z
  .object({
    sourceGroupId: NonEmptyStringHttpSchema,
  })
  .strict();
export const UpsertCollectionScheduleHttpBodySchema = z
  .object({
    enabled: z.boolean(),
    intervalMinutes: z.number().int().min(1).max(10080),
    nextRunAt: z.iso.datetime({ offset: true }),
    parameters: z
      .object({
        maxScrolls: z.number().int().min(0).optional(),
        maxDurationMs: z.number().int().min(1).optional(),
      })
      .strict(),
  })
  .strict();
export const ListCollectionSchedulesHttpQuerySchema = z
  .object({
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_COLLECTION_SCHEDULE_LIST_LIMIT)
      .default(DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
export type CollectionScheduleSourceGroupIdHttpParams = z.infer<
  typeof CollectionScheduleSourceGroupIdHttpParamsSchema
>;
export type UpsertCollectionScheduleHttpBody = z.infer<
  typeof UpsertCollectionScheduleHttpBodySchema
>;
export type ListCollectionSchedulesHttpQuery = z.infer<
  typeof ListCollectionSchedulesHttpQuerySchema
>;
const collectionScheduleSourceGroupIdParamsJsonSchema = {
  type: "object",
  required: ["sourceGroupId"],
  additionalProperties: false,
  properties: {
    sourceGroupId: nonEmptyStringJsonSchema,
  },
} as const;
const collectionScheduleParametersJsonSchema = {
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
  },
} as const;
const collectionScheduleJsonSchema = {
  type: "object",
  required: [
    "sourceGroupId",
    "enabled",
    "intervalMinutes",
    "nextRunAt",
    "parameters",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    sourceGroupId: nonEmptyStringJsonSchema,
    enabled: {
      type: "boolean",
    },
    intervalMinutes: {
      type: "integer",
      minimum: 1,
      maximum: 10080,
    },
    nextRunAt: isoDateTimeJsonSchema,
    parameters: collectionScheduleParametersJsonSchema,
    createdAt: isoDateTimeJsonSchema,
    updatedAt: isoDateTimeJsonSchema,
  },
} as const;
const upsertCollectionScheduleBodyJsonSchema = {
  type: "object",
  required: ["enabled", "intervalMinutes", "nextRunAt", "parameters"],
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
    parameters: collectionScheduleParametersJsonSchema,
  },
} as const;
const listCollectionSchedulesQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_COLLECTION_SCHEDULE_LIST_LIMIT,
      default: DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT,
    },
    offset: {
      type: "integer",
      minimum: 0,
      default: 0,
    },
  },
} as const;
export const listCollectionSchedulesHttpRouteSchema = {
  querystring: listCollectionSchedulesQueryJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["items", "page"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: collectionScheduleJsonSchema,
        },
        page: pageJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
export const getCollectionScheduleHttpRouteSchema = {
  params: collectionScheduleSourceGroupIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["collectionSchedule"],
      additionalProperties: false,
      properties: {
        collectionSchedule: collectionScheduleJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
export const upsertCollectionScheduleHttpRouteSchema = {
  params: collectionScheduleSourceGroupIdParamsJsonSchema,
  body: upsertCollectionScheduleBodyJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["collectionSchedule"],
      additionalProperties: false,
      properties: {
        collectionSchedule: collectionScheduleJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
