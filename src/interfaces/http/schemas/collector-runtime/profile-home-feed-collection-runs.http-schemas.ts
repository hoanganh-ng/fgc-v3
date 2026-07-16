import { z } from "zod";
import {
  COLLECTOR_RUNTIME_ACCOUNT_STAGES,
  PROFILE_HOME_FEED_COLLECTION_RUN_CAPTURE_STAGES,
  PROFILE_HOME_FEED_COLLECTION_RUN_FAILURE_STAGES,
  PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES,
  PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES,
  PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES,
  PROFILE_HOME_FEED_DIAGNOSTIC_PAGE_STATES,
  PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES,
  ProfileHomeFeedCollectionRunIdSchema,
  ProfileHomeFeedCollectionRunProfileIdSchema,
  ProfileHomeFeedCollectionRunStatusSchema,
} from "../../../../collector-runtime/domain";
import {
  DEFAULT_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
  MAX_PROFILE_HOME_FEED_COLLECTION_RUN_LIST_LIMIT,
} from "../../../../collector-runtime/application";
import {
  errorResponseJsonSchema,
  isoDateTimeJsonSchema,
  nonEmptyStringJsonSchema,
  pageJsonSchema,
  NonEmptyStringHttpSchema,
} from "./http-schema-primitives";


export const ProfileHomeFeedCollectionRunIdHttpParamsSchema = z
  .object({
    profileHomeFeedCollectionRunId: ProfileHomeFeedCollectionRunIdSchema,
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
export type ProfileHomeFeedCollectionRunIdHttpParams = z.infer<
  typeof ProfileHomeFeedCollectionRunIdHttpParamsSchema
>;
export type RequestProfileHomeFeedCollectionRunHttpBody = z.infer<
  typeof RequestProfileHomeFeedCollectionRunHttpBodySchema
>;
export type ListProfileHomeFeedCollectionRunsHttpQuery = z.infer<
  typeof ListProfileHomeFeedCollectionRunsHttpQuerySchema
>;
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
const profileHomeFeedDiagnosticCaptureCountersJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageContextFetchCaptureCount: { type: "integer", minimum: 0 },
    pageContextXhrCaptureCount: { type: "integer", minimum: 0 },
    networkListenerCaptureCount: { type: "integer", minimum: 0 },
    parseFailureCount: { type: "integer", minimum: 0 },
    totalPayloadsPassedToExtractor: { type: "integer", minimum: 0 },
  },
} as const;

const profileHomeFeedDiagnosticExtractorCountersJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    extractedCandidateCount: { type: "integer", minimum: 0 },
    deduplicatedCandidateCount: { type: "integer", minimum: 0 },
  },
} as const;
const profileHomeFeedDiagnosticWarningCountsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: Object.fromEntries(
    PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES.map((code) => [
      code,
      { type: "integer", minimum: 0 },
    ]),
  ),
} as const;
const profileHomeFeedDiagnosticRunOutcomeJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    failureStage: {
      type: "string",
      enum: PROFILE_HOME_FEED_COLLECTION_RUN_FAILURE_STAGES,
    },
    failureCode: {
      type: "string",
      enum: PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES,
    },
  },
} as const;
const profileHomeFeedDiagnosticSummaryJsonSchema = {
  type: "object",
  required: ["schemaVersion"],
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "integer", enum: [1] },
    capture: profileHomeFeedDiagnosticCaptureCountersJsonSchema,
    captureStage: {
      type: "string",
      enum: PROFILE_HOME_FEED_COLLECTION_RUN_CAPTURE_STAGES,
    },
    capturePageState: {
      type: "string",
      enum: PROFILE_HOME_FEED_DIAGNOSTIC_PAGE_STATES,
    },
    captureLoginRedirectSuspected: { type: "boolean" },
    extractor: profileHomeFeedDiagnosticExtractorCountersJsonSchema,
    warningCounts: profileHomeFeedDiagnosticWarningCountsJsonSchema,
    unsupportedPayloadCount: { type: "integer", minimum: 0 },
    runOutcome: profileHomeFeedDiagnosticRunOutcomeJsonSchema,
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
    diagnostics: profileHomeFeedDiagnosticSummaryJsonSchema,
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
