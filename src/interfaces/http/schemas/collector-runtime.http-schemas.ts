import { z } from "zod";
import {
  ACCOUNT_EXERCISE_RUN_STATUSES,
  COLLECTION_RUN_STATUSES,
  COLLECTION_RUN_TRIGGER_TYPES,
  AccountExerciseRunFailureReasonSchema,
  AccountExerciseRunIdSchema,
  AccountExerciseRunSafeSummarySchema,
  AccountExerciseRunStatusSchema,
  CollectionRunIdSchema,
  CollectionRunSourceGroupIdSchema,
  CollectionRunStatusSchema,
} from "../../../collector-runtime/domain";
import {
  DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
  DEFAULT_COLLECTION_RUN_LIST_LIMIT,
  MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
  MAX_COLLECTION_RUN_LIST_LIMIT,
} from "../../../collector-runtime/application";
export { parseHttpInput } from "./http-validation";

const NonEmptyStringHttpSchema = z.string().trim().min(1);

export const CollectionRunIdHttpParamsSchema = z
  .object({
    collectionRunId: CollectionRunIdSchema,
  })
  .strict();

export const AccountExerciseRunIdHttpParamsSchema = z
  .object({
    accountExerciseRunId: AccountExerciseRunIdSchema,
  })
  .strict();

export const RequestCollectionRunHttpBodySchema = z
  .object({
    sourceGroupId: CollectionRunSourceGroupIdSchema,
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
  })
  .strict();

export const RequestAccountExerciseRunHttpBodySchema = z
  .object({
    profileId: NonEmptyStringHttpSchema,
    stageAtStart: NonEmptyStringHttpSchema,
    maxDurationMs: z.number().int().min(1),
    maxScrolls: z.number().int().min(0),
    minDwellMs: z.number().int().min(0).optional(),
  })
  .strict();

export const StartAccountExerciseRunHttpBodySchema = z
  .object({
    leaseId: NonEmptyStringHttpSchema.optional(),
  })
  .strict();

export const SucceedAccountExerciseRunHttpBodySchema = z
  .object({
    safeSummary: AccountExerciseRunSafeSummarySchema,
  })
  .strict();

export const FailAccountExerciseRunHttpBodySchema = z
  .object({
    failureReason: AccountExerciseRunFailureReasonSchema,
    safeSummary: AccountExerciseRunSafeSummarySchema.optional(),
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

export const ListAccountExerciseRunsHttpQuerySchema = z
  .object({
    status: AccountExerciseRunStatusSchema.optional(),
    profileId: NonEmptyStringHttpSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT)
      .default(DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type CollectionRunIdHttpParams = z.infer<
  typeof CollectionRunIdHttpParamsSchema
>;
export type AccountExerciseRunIdHttpParams = z.infer<
  typeof AccountExerciseRunIdHttpParamsSchema
>;
export type RequestCollectionRunHttpBody = z.infer<
  typeof RequestCollectionRunHttpBodySchema
>;
export type RequestAccountExerciseRunHttpBody = z.infer<
  typeof RequestAccountExerciseRunHttpBodySchema
>;
export type StartAccountExerciseRunHttpBody = z.infer<
  typeof StartAccountExerciseRunHttpBodySchema
>;
export type SucceedAccountExerciseRunHttpBody = z.infer<
  typeof SucceedAccountExerciseRunHttpBodySchema
>;
export type FailAccountExerciseRunHttpBody = z.infer<
  typeof FailAccountExerciseRunHttpBodySchema
>;
export type ListCollectionRunsHttpQuery = z.infer<
  typeof ListCollectionRunsHttpQuerySchema
>;
export type ListAccountExerciseRunsHttpQuery = z.infer<
  typeof ListAccountExerciseRunsHttpQuerySchema
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

const accountExerciseRunActionBudgetJsonSchema = {
  type: "object",
  required: ["maxDurationMs", "maxScrolls"],
  additionalProperties: false,
  properties: {
    maxDurationMs: {
      type: "integer",
      minimum: 1,
    },
    maxScrolls: {
      type: "integer",
      minimum: 0,
    },
    minDwellMs: {
      type: "integer",
      minimum: 0,
    },
  },
} as const;

const accountExerciseRunSafeSummaryJsonSchema = {
  type: "object",
  required: [
    "pageLoaded",
    "loginRequired",
    "checkpointDetected",
    "scrollsPerformed",
    "durationMs",
    "leaseReleased",
  ],
  additionalProperties: false,
  properties: {
    pageLoaded: {
      type: "boolean",
    },
    loginRequired: {
      type: "boolean",
    },
    checkpointDetected: {
      type: "boolean",
    },
    scrollsPerformed: {
      type: "integer",
      minimum: 0,
    },
    durationMs: {
      type: "integer",
      minimum: 0,
    },
    leaseReleased: {
      type: "boolean",
    },
  },
} as const;

const accountExerciseRunFailureReasonJsonSchema = {
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

const accountExerciseRunJsonSchema = {
  type: "object",
  required: [
    "id",
    "profileId",
    "exerciseType",
    "status",
    "stageAtStart",
    "actionBudget",
    "requestedAt",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    profileId: nonEmptyStringJsonSchema,
    leaseId: nonEmptyStringJsonSchema,
    exerciseType: {
      type: "string",
      enum: ["AMBIENT_ACCOUNT"],
    },
    status: {
      type: "string",
      enum: ACCOUNT_EXERCISE_RUN_STATUSES,
    },
    stageAtStart: nonEmptyStringJsonSchema,
    actionBudget: accountExerciseRunActionBudgetJsonSchema,
    safeSummary: accountExerciseRunSafeSummaryJsonSchema,
    failureReason: accountExerciseRunFailureReasonJsonSchema,
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

const accountExerciseRunIdParamsJsonSchema = {
  type: "object",
  required: ["accountExerciseRunId"],
  additionalProperties: false,
  properties: {
    accountExerciseRunId: nonEmptyStringJsonSchema,
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

const requestAccountExerciseRunBodyJsonSchema = {
  type: "object",
  required: ["profileId", "stageAtStart", "maxDurationMs", "maxScrolls"],
  additionalProperties: false,
  properties: {
    profileId: nonEmptyStringJsonSchema,
    stageAtStart: nonEmptyStringJsonSchema,
    maxDurationMs: {
      type: "integer",
      minimum: 1,
    },
    maxScrolls: {
      type: "integer",
      minimum: 0,
    },
    minDwellMs: {
      type: "integer",
      minimum: 0,
    },
  },
} as const;

const startAccountExerciseRunBodyJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    leaseId: nonEmptyStringJsonSchema,
  },
} as const;

const succeedAccountExerciseRunBodyJsonSchema = {
  type: "object",
  required: ["safeSummary"],
  additionalProperties: false,
  properties: {
    safeSummary: accountExerciseRunSafeSummaryJsonSchema,
  },
} as const;

const failAccountExerciseRunBodyJsonSchema = {
  type: "object",
  required: ["failureReason"],
  additionalProperties: false,
  properties: {
    failureReason: accountExerciseRunFailureReasonJsonSchema,
    safeSummary: accountExerciseRunSafeSummaryJsonSchema,
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

const accountExerciseRunsQueryJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ACCOUNT_EXERCISE_RUN_STATUSES,
    },
    profileId: nonEmptyStringJsonSchema,
    limit: {
      type: "integer",
      minimum: 1,
      maximum: MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
      default: DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
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

export const requestAccountExerciseRunHttpRouteSchema = {
  body: requestAccountExerciseRunBodyJsonSchema,
  response: {
    201: {
      type: "object",
      required: ["accountExerciseRun"],
      additionalProperties: false,
      properties: {
        accountExerciseRun: accountExerciseRunJsonSchema,
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

export const listAccountExerciseRunsHttpRouteSchema = {
  querystring: accountExerciseRunsQueryJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["items", "page"],
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: accountExerciseRunJsonSchema,
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

export const getAccountExerciseRunHttpRouteSchema = {
  params: accountExerciseRunIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["accountExerciseRun"],
      additionalProperties: false,
      properties: {
        accountExerciseRun: accountExerciseRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const startAccountExerciseRunHttpRouteSchema = {
  params: accountExerciseRunIdParamsJsonSchema,
  body: startAccountExerciseRunBodyJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["accountExerciseRun"],
      additionalProperties: false,
      properties: {
        accountExerciseRun: accountExerciseRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const succeedAccountExerciseRunHttpRouteSchema = {
  params: accountExerciseRunIdParamsJsonSchema,
  body: succeedAccountExerciseRunBodyJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["accountExerciseRun"],
      additionalProperties: false,
      properties: {
        accountExerciseRun: accountExerciseRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const failAccountExerciseRunHttpRouteSchema = {
  params: accountExerciseRunIdParamsJsonSchema,
  body: failAccountExerciseRunBodyJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["accountExerciseRun"],
      additionalProperties: false,
      properties: {
        accountExerciseRun: accountExerciseRunJsonSchema,
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

export const cancelAccountExerciseRunHttpRouteSchema = {
  params: accountExerciseRunIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["accountExerciseRun"],
      additionalProperties: false,
      properties: {
        accountExerciseRun: accountExerciseRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;
