import { z } from "zod";
import {
  ACCOUNT_EXERCISE_RUN_STATUSES,
  ACCOUNT_EXERCISE_TYPES,
  COLLECTION_RUN_STATUSES,
  COLLECTION_RUN_TRIGGER_TYPES,
  AccountExerciseRunFailureReasonSchema,
  AccountExerciseRunIdSchema,
  AccountExerciseRunSafeSummarySchema,
  AccountExerciseRunStatusSchema,
  AccountExerciseTypeSchema,
  COLLECTOR_RUNTIME_ACCOUNT_STAGES,
  CollectionRunIdSchema,
  CollectionRunSourceGroupIdSchema,
  CollectionRunStatusSchema,
  PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES,
  PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES,
  ProfileHomeFeedCollectionRunIdSchema,
  ProfileHomeFeedCollectionRunProfileIdSchema,
  ProfileHomeFeedCollectionRunStatusSchema,
  ProfileHomeFeedCollectionScheduleProfileIdSchema,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_OUTCOMES,
  PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUSES,
  ProfileSourceAccessCheckRunFailureReasonSchema,
  ProfileSourceAccessCheckRunIdSchema,
  ProfileSourceAccessCheckRunStatusSchema,
} from "../../../collector-runtime/domain";
import {
  DEFAULT_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
  DEFAULT_COLLECTION_RUN_LIST_LIMIT,
  DEFAULT_COLLECTION_SCHEDULE_LIST_LIMIT,
  DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
  DEFAULT_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
  MAX_ACCOUNT_EXERCISE_RUN_LIST_LIMIT,
  MAX_COLLECTION_RUN_LIST_LIMIT,
  MAX_COLLECTION_SCHEDULE_LIST_LIMIT,
  MAX_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
  MAX_PROFILE_HOME_FEED_COLLECTION_SCHEDULE_LIST_LIMIT,
} from "../../../collector-runtime/application";
export { parseHttpInput } from "./http-validation";

const DEFAULT_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT = 50;
const MAX_PROFILE_SOURCE_ACCESS_CHECK_RUN_LIST_LIMIT = 500;

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

export const ProfileSourceAccessCheckRunIdHttpParamsSchema = z
  .object({
    checkRunId: ProfileSourceAccessCheckRunIdSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionRunIdHttpParamsSchema = z
  .object({
    profileHomeFeedCollectionRunId: ProfileHomeFeedCollectionRunIdSchema,
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
    exerciseType: AccountExerciseTypeSchema.optional(),
    sourceGroupId: NonEmptyStringHttpSchema.optional(),
    entryRouteId: NonEmptyStringHttpSchema.optional(),
    maxDurationMs: z.number().int().min(1),
    maxScrolls: z.number().int().min(0),
    minDwellMs: z.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((body, context) => {
    const exerciseType = body.exerciseType ?? "AMBIENT_ACCOUNT";
    if (
      exerciseType === "CATEGORY_BROWSE" &&
      body.sourceGroupId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["sourceGroupId"],
        message: "sourceGroupId is required for Category Browse exercise.",
      });
    }

    if (
      exerciseType === "AMBIENT_ACCOUNT" &&
      (body.sourceGroupId !== undefined || body.entryRouteId !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        path: ["exerciseType"],
        message: "Ambient account exercise requests must not include a target.",
      });
    }
  });

export const RequestProfileSourceAccessCheckRunHttpBodySchema = z
  .object({
    profileId: NonEmptyStringHttpSchema,
    sourceGroupId: NonEmptyStringHttpSchema,
  })
  .strict();

export const RequestProfileHomeFeedCollectionRunHttpBodySchema = z
  .object({
    profileId: ProfileHomeFeedCollectionRunProfileIdSchema,
    maxScrolls: z.number().int().min(0).optional(),
    maxDurationMs: z.number().int().min(1).optional(),
    maxPosts: z.number().int().min(1).optional(),
  })
  .strict();

export const StartAccountExerciseRunHttpBodySchema = z
  .object({
    leaseId: NonEmptyStringHttpSchema.optional(),
  })
  .strict();

export const AttachAccountExerciseRunLeaseHttpBodySchema = z
  .object({
    leaseId: NonEmptyStringHttpSchema,
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

export const ListProfileHomeFeedCollectionRunsHttpQuerySchema = z
  .object({
    status: ProfileHomeFeedCollectionRunStatusSchema.optional(),
    profileId: ProfileHomeFeedCollectionRunProfileIdSchema.optional(),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(MAX_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT)
      .default(DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export type CollectionRunIdHttpParams = z.infer<
  typeof CollectionRunIdHttpParamsSchema
>;
export type AccountExerciseRunIdHttpParams = z.infer<
  typeof AccountExerciseRunIdHttpParamsSchema
>;
export type ProfileSourceAccessCheckRunIdHttpParams = z.infer<
  typeof ProfileSourceAccessCheckRunIdHttpParamsSchema
>;
export type ProfileHomeFeedCollectionRunIdHttpParams = z.infer<
  typeof ProfileHomeFeedCollectionRunIdHttpParamsSchema
>;
export type RequestCollectionRunHttpBody = z.infer<
  typeof RequestCollectionRunHttpBodySchema
>;
export type RequestAccountExerciseRunHttpBody = z.infer<
  typeof RequestAccountExerciseRunHttpBodySchema
>;
export type RequestProfileSourceAccessCheckRunHttpBody = z.infer<
  typeof RequestProfileSourceAccessCheckRunHttpBodySchema
>;
export type RequestProfileHomeFeedCollectionRunHttpBody = z.infer<
  typeof RequestProfileHomeFeedCollectionRunHttpBodySchema
>;
export type StartAccountExerciseRunHttpBody = z.infer<
  typeof StartAccountExerciseRunHttpBodySchema
>;
export type AttachAccountExerciseRunLeaseHttpBody = z.infer<
  typeof AttachAccountExerciseRunLeaseHttpBodySchema
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
export type ListProfileSourceAccessCheckRunsHttpQuery = z.infer<
  typeof ListProfileSourceAccessCheckRunsHttpQuerySchema
>;
export type ListProfileHomeFeedCollectionRunsHttpQuery = z.infer<
  typeof ListProfileHomeFeedCollectionRunsHttpQuerySchema
>;

export const CollectionScheduleSourceGroupIdHttpParamsSchema = z
  .object({
    sourceGroupId: NonEmptyStringHttpSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionScheduleProfileIdHttpParamsSchema = z
  .object({
    profileId: ProfileHomeFeedCollectionScheduleProfileIdSchema,
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

export type CollectionScheduleSourceGroupIdHttpParams = z.infer<
  typeof CollectionScheduleSourceGroupIdHttpParamsSchema
>;
export type ProfileHomeFeedCollectionScheduleProfileIdHttpParams = z.infer<
  typeof ProfileHomeFeedCollectionScheduleProfileIdHttpParamsSchema
>;
export type UpsertCollectionScheduleHttpBody = z.infer<
  typeof UpsertCollectionScheduleHttpBodySchema
>;
export type CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBody = z.infer<
  typeof CreateOrUpdateProfileHomeFeedCollectionScheduleHttpBodySchema
>;
export type ListCollectionSchedulesHttpQuery = z.infer<
  typeof ListCollectionSchedulesHttpQuerySchema
>;
export type ListProfileHomeFeedCollectionSchedulesHttpQuery = z.infer<
  typeof ListProfileHomeFeedCollectionSchedulesHttpQuerySchema
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

const categoryBrowseExerciseTargetJsonSchema = {
  type: "object",
  required: [
    "categoryId",
    "sourceGroupId",
    "entryRouteId",
    "entryRouteType",
    "url",
    "riskLevel",
  ],
  additionalProperties: false,
  properties: {
    categoryId: nonEmptyStringJsonSchema,
    sourceGroupId: nonEmptyStringJsonSchema,
    entryRouteId: nonEmptyStringJsonSchema,
    entryRouteType: {
      type: "string",
      enum: ["CATEGORY_ENTRY_URL"],
    },
    url: nonEmptyStringJsonSchema,
    riskLevel: {
      type: "string",
      enum: ["LOW", "MEDIUM"],
    },
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
      enum: ACCOUNT_EXERCISE_TYPES,
    },
    status: {
      type: "string",
      enum: ACCOUNT_EXERCISE_RUN_STATUSES,
    },
    stageAtStart: nonEmptyStringJsonSchema,
    actionBudget: accountExerciseRunActionBudgetJsonSchema,
    target: categoryBrowseExerciseTargetJsonSchema,
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
    exerciseType: {
      type: "string",
      enum: ACCOUNT_EXERCISE_TYPES,
    },
    sourceGroupId: nonEmptyStringJsonSchema,
    entryRouteId: nonEmptyStringJsonSchema,
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

const attachAccountExerciseRunLeaseBodyJsonSchema = {
  type: "object",
  required: ["leaseId"],
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

export const attachAccountExerciseRunLeaseHttpRouteSchema = {
  params: accountExerciseRunIdParamsJsonSchema,
  body: attachAccountExerciseRunLeaseBodyJsonSchema,
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

const isoDateTimeJsonSchema = { type: "string", format: "date-time" } as const;

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

const profileHomeFeedCollectionRunIdParamsJsonSchema = {
  type: "object",
  required: ["profileHomeFeedCollectionRunId"],
  additionalProperties: false,
  properties: {
    profileHomeFeedCollectionRunId: nonEmptyStringJsonSchema,
  },
} as const;

const requestProfileHomeFeedCollectionRunBodyJsonSchema = {
  type: "object",
  required: ["profileId"],
  additionalProperties: false,
  properties: {
    profileId: nonEmptyStringJsonSchema,
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

const profileHomeFeedCollectionRunTargetJsonSchema = {
  type: "object",
  required: ["platform", "surface"],
  additionalProperties: false,
  properties: {
    platform: {
      type: "string",
      enum: ["FACEBOOK"],
    },
    surface: {
      type: "string",
      enum: ["PROFILE_HOME_FEED"],
    },
  },
} as const;

const profileHomeFeedCollectionRunParametersJsonSchema = {
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

const profileHomeFeedCollectionRunSummaryJsonSchema = {
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
    sourcePublishersObserved: {
      type: "integer",
      minimum: 0,
    },
    contentItemsSubmitted: {
      type: "integer",
      minimum: 0,
    },
    failedPublisherObservations: {
      type: "integer",
      minimum: 0,
    },
    failedContentSubmissions: {
      type: "integer",
      minimum: 0,
    },
    leaseReleased: {
      type: "boolean",
    },
  },
} as const;

const profileHomeFeedCollectionRunFailureReasonJsonSchema = {
  type: "object",
  required: ["code", "message"],
  additionalProperties: false,
  properties: {
    code: nonEmptyStringJsonSchema,
    message: nonEmptyStringJsonSchema,
  },
} as const;

const profileHomeFeedCollectionScheduleFailureReasonJsonSchema = {
  type: "object",
  required: ["code", "message"],
  additionalProperties: false,
  properties: {
    code: nonEmptyStringJsonSchema,
    message: nonEmptyStringJsonSchema,
  },
} as const;

const profileHomeFeedCollectionRunJsonSchema = {
  type: "object",
  required: [
    "id",
    "profileId",
    "triggerType",
    "status",
    "accountStageAtRequest",
    "target",
    "parameters",
    "requestedAt",
    "createdAt",
    "updatedAt",
  ],
  additionalProperties: false,
  properties: {
    id: nonEmptyStringJsonSchema,
    profileId: nonEmptyStringJsonSchema,
    triggerType: {
      type: "string",
      enum: PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES,
    },
    status: {
      type: "string",
      enum: PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES,
    },
    accountStageAtRequest: {
      type: "string",
      enum: COLLECTOR_RUNTIME_ACCOUNT_STAGES,
    },
    target: profileHomeFeedCollectionRunTargetJsonSchema,
    parameters: profileHomeFeedCollectionRunParametersJsonSchema,
    summary: profileHomeFeedCollectionRunSummaryJsonSchema,
    failureReason: profileHomeFeedCollectionRunFailureReasonJsonSchema,
    requestedAt: isoDateTimeJsonSchema,
    startedAt: isoDateTimeJsonSchema,
    finishedAt: isoDateTimeJsonSchema,
    createdAt: isoDateTimeJsonSchema,
    updatedAt: isoDateTimeJsonSchema,
  },
} as const;

export const requestProfileHomeFeedCollectionRunHttpRouteSchema = {
  body: requestProfileHomeFeedCollectionRunBodyJsonSchema,
  response: {
    201: {
      type: "object",
      required: ["profileHomeFeedCollectionRun"],
      additionalProperties: false,
      properties: {
        profileHomeFeedCollectionRun: profileHomeFeedCollectionRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const listProfileHomeFeedCollectionRunsHttpRouteSchema = {
  querystring: {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES,
      },
      profileId: nonEmptyStringJsonSchema,
      limit: {
        type: "integer",
        minimum: 1,
        maximum: MAX_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
        default: DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
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
          items: profileHomeFeedCollectionRunJsonSchema,
        },
        page: pageJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const getProfileHomeFeedCollectionRunHttpRouteSchema = {
  params: profileHomeFeedCollectionRunIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["profileHomeFeedCollectionRun"],
      additionalProperties: false,
      properties: {
        profileHomeFeedCollectionRun: profileHomeFeedCollectionRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

export const cancelProfileHomeFeedCollectionRunHttpRouteSchema = {
  params: profileHomeFeedCollectionRunIdParamsJsonSchema,
  response: {
    200: {
      type: "object",
      required: ["profileHomeFeedCollectionRun"],
      additionalProperties: false,
      properties: {
        profileHomeFeedCollectionRun: profileHomeFeedCollectionRunJsonSchema,
      },
    },
    "4xx": errorResponseJsonSchema,
    "5xx": errorResponseJsonSchema,
  },
} as const;

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
