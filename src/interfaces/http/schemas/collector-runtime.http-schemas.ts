import { z } from "zod";
import {
  COLLECTION_RUN_STATUSES,
  COLLECTION_RUN_TRIGGER_TYPES,
  CollectionRunIdSchema,
  CollectionRunSourceGroupIdSchema,
  CollectionRunStatusSchema,
} from "../../../collector-runtime/domain";
import {
  DEFAULT_COLLECTION_RUN_LIST_LIMIT,
  MAX_COLLECTION_RUN_LIST_LIMIT,
} from "../../../collector-runtime/application";
export { parseHttpInput } from "./http-validation";

const NonEmptyStringHttpSchema = z.string().trim().min(1);

export const CollectionRunIdHttpParamsSchema = z
  .object({
    collectionRunId: CollectionRunIdSchema,
  })
  .strict();

export const RequestCollectionRunHttpBodySchema = z
  .object({
    sourceGroupId: CollectionRunSourceGroupIdSchema,
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
  })
  .strict();

export const ListCollectionRunsHttpQuerySchema = z
  .object({
    status: CollectionRunStatusSchema.optional(),
    sourceGroupId: CollectionRunSourceGroupIdSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_COLLECTION_RUN_LIST_LIMIT)
      .default(DEFAULT_COLLECTION_RUN_LIST_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type CollectionRunIdHttpParams = z.infer<
  typeof CollectionRunIdHttpParamsSchema
>;
export type RequestCollectionRunHttpBody = z.infer<
  typeof RequestCollectionRunHttpBodySchema
>;
export type ListCollectionRunsHttpQuery = z.infer<
  typeof ListCollectionRunsHttpQuerySchema
>;

const nonEmptyStringJsonSchema = { type: "string", minLength: 1 } as const;

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

const collectionRunParametersJsonSchema = {
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

const collectionRunSummaryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    capturedPayloads: {
      type: "integer",
      minimum: 0,
    },
    extractorCandidates: {
      type: "integer",
      minimum: 0,
    },
    contentItemsSubmitted: {
      type: "integer",
      minimum: 0,
    },
    failedSubmissions: {
      type: "integer",
      minimum: 0,
    },
    leaseReleased: {
      type: "boolean",
    },
  },
} as const;

const collectionRunFailureReasonJsonSchema = {
  type: "object",
  required: ["code", "message"],
  additionalProperties: false,
  properties: {
    code: nonEmptyStringJsonSchema,
    message: nonEmptyStringJsonSchema,
  },
} as const;

const collectionRunJsonSchema = {
  type: "object",
  required: [
    "id",
    "sourceGroupId",
    "status",
    "triggerType",
    "parameters",
    "requestedAt",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    sourceGroupId: nonEmptyStringJsonSchema,
    status: {
      type: "string",
      enum: COLLECTION_RUN_STATUSES,
    },
    triggerType: {
      type: "string",
      enum: COLLECTION_RUN_TRIGGER_TYPES,
    },
    parameters: collectionRunParametersJsonSchema,
    summary: collectionRunSummaryJsonSchema,
    failureReason: collectionRunFailureReasonJsonSchema,
    requestedAt: nonEmptyStringJsonSchema,
    startedAt: nonEmptyStringJsonSchema,
    finishedAt: nonEmptyStringJsonSchema,
    createdAt: nonEmptyStringJsonSchema,
    updatedAt: nonEmptyStringJsonSchema,
  },
} as const;

const collectionRunIdParamsJsonSchema = {
  type: "object",
  required: ["collectionRunId"],
  additionalProperties: false,
  properties: {
    collectionRunId: nonEmptyStringJsonSchema,
  },
} as const;

const requestCollectionRunBodyJsonSchema = {
  type: "object",
  required: ["sourceGroupId"],
  additionalProperties: false,
  properties: {
    sourceGroupId: nonEmptyStringJsonSchema,
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

const collectionRunsQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: COLLECTION_RUN_STATUSES,
    },
    sourceGroupId: nonEmptyStringJsonSchema,
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_COLLECTION_RUN_LIST_LIMIT,
      default: DEFAULT_COLLECTION_RUN_LIST_LIMIT,
    },
    offset: {
      type: "integer",
      minimum: 0,
      default: 0,
    },
  },
} as const;

const pageJsonSchema = {
  type: "object",
  required: ["limit", "offset"],
  additionalProperties: false,
  properties: {
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_COLLECTION_RUN_LIST_LIMIT,
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

export const requestCollectionRunHttpRouteSchema = {
  body: requestCollectionRunBodyJsonSchema,
  response: {
    201: {
      type: "object",
      required: ["collectionRun"],
      additionalProperties: false,
      properties: {
        collectionRun: collectionRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const listCollectionRunsHttpRouteSchema = {
  querystring: collectionRunsQueryJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["items", "page"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: collectionRunJsonSchema,
        },
        page: pageJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const getCollectionRunHttpRouteSchema = {
  params: collectionRunIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["collectionRun"],
      additionalProperties: false,
      properties: {
        collectionRun: collectionRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const cancelCollectionRunHttpRouteSchema = {
  params: collectionRunIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["collectionRun"],
      additionalProperties: false,
      properties: {
        collectionRun: collectionRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
