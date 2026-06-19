import { z } from "zod";
import { COLLECTOR_RUNTIME_ACCOUNT_STAGES } from "./account-stage";
import { PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES } from "./profile-home-feed-collection-run-status";
import { PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES } from "./profile-home-feed-collection-run-trigger-type";

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().min(1);

export const ProfileHomeFeedCollectionRunIsoDateTimeSchema = z.iso.datetime({
  offset: true,
});
export const ProfileHomeFeedCollectionRunIdSchema = NonEmptyStringSchema;
export const ProfileHomeFeedCollectionRunProfileIdSchema =
  NonEmptyStringSchema;
export const ProfileHomeFeedCollectionRunStatusSchema = z.enum(
  PROFILE_HOME_FEED_COLLECTION_RUN_STATUSES,
);
export const ProfileHomeFeedCollectionRunTriggerTypeSchema = z.enum(
  PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES,
);

export const ProfileHomeFeedCollectionRunTargetSchema = z
  .object({
    platform: z.literal("FACEBOOK"),
    surface: z.literal("PROFILE_HOME_FEED"),
  })
  .strict();

export const ProfileHomeFeedCollectionRunParametersSchema = z
  .object({
    maxScrolls: NonNegativeIntegerSchema.optional(),
    maxDurationMs: PositiveIntegerSchema.optional(),
    maxPosts: PositiveIntegerSchema.optional(),
  })
  .strict();

export const ProfileHomeFeedCollectionRunSummarySchema = z
  .object({
    capturedPayloads: NonNegativeIntegerSchema.optional(),
    extractorCandidates: NonNegativeIntegerSchema.optional(),
    sourcePublishersObserved: NonNegativeIntegerSchema.optional(),
    contentItemsSubmitted: NonNegativeIntegerSchema.optional(),
    failedPublisherObservations: NonNegativeIntegerSchema.optional(),
    failedContentSubmissions: NonNegativeIntegerSchema.optional(),
    leaseReleased: z.boolean().optional(),
  })
  .strict();

export const ProfileHomeFeedCollectionRunFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionRunSchema = z
  .object({
    id: ProfileHomeFeedCollectionRunIdSchema,
    profileId: ProfileHomeFeedCollectionRunProfileIdSchema,
    triggerType: ProfileHomeFeedCollectionRunTriggerTypeSchema,
    status: ProfileHomeFeedCollectionRunStatusSchema,
    accountStageAtRequest: z.enum(COLLECTOR_RUNTIME_ACCOUNT_STAGES),
    target: ProfileHomeFeedCollectionRunTargetSchema,
    parameters: ProfileHomeFeedCollectionRunParametersSchema,
    summary: ProfileHomeFeedCollectionRunSummarySchema.optional(),
    failureReason: ProfileHomeFeedCollectionRunFailureReasonSchema.optional(),
    requestedAt: ProfileHomeFeedCollectionRunIsoDateTimeSchema,
    startedAt: ProfileHomeFeedCollectionRunIsoDateTimeSchema.optional(),
    finishedAt: ProfileHomeFeedCollectionRunIsoDateTimeSchema.optional(),
    createdAt: ProfileHomeFeedCollectionRunIsoDateTimeSchema,
    updatedAt: ProfileHomeFeedCollectionRunIsoDateTimeSchema,
  })
  .strict()
  .superRefine((run, context) => {
    if (run.status === "QUEUED") {
      rejectPresent(context, "startedAt", run.startedAt);
      rejectPresent(context, "finishedAt", run.finishedAt);
      rejectPresent(context, "summary", run.summary);
      rejectPresent(context, "failureReason", run.failureReason);

      return;
    }

    if (run.status === "RUNNING") {
      requirePresent(context, "startedAt", run.startedAt);
      rejectPresent(context, "finishedAt", run.finishedAt);
      rejectPresent(context, "summary", run.summary);
      rejectPresent(context, "failureReason", run.failureReason);

      return;
    }

    if (run.status === "SUCCEEDED") {
      requirePresent(context, "startedAt", run.startedAt);
      requirePresent(context, "finishedAt", run.finishedAt);
      requirePresent(context, "summary", run.summary);
      rejectPresent(context, "failureReason", run.failureReason);

      return;
    }

    if (run.status === "FAILED") {
      requirePresent(context, "startedAt", run.startedAt);
      requirePresent(context, "finishedAt", run.finishedAt);
      requirePresent(context, "failureReason", run.failureReason);

      return;
    }

    requirePresent(context, "finishedAt", run.finishedAt);
    rejectPresent(context, "startedAt", run.startedAt);
    rejectPresent(context, "summary", run.summary);
    rejectPresent(context, "failureReason", run.failureReason);
  });

function requirePresent(
  context: z.RefinementCtx,
  path: string,
  value: unknown,
): void {
  if (value !== undefined) {
    return;
  }

  context.addIssue({
    code: "custom",
    path: [path],
    message: `${path} is required for this home-feed collection run status.`,
  });
}

function rejectPresent(
  context: z.RefinementCtx,
  path: string,
  value: unknown,
): void {
  if (value === undefined) {
    return;
  }

  context.addIssue({
    code: "custom",
    path: [path],
    message: `${path} is not allowed for this home-feed collection run status.`,
  });
}
