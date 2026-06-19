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
    postsSeen: NonNegativeIntegerSchema.optional(),
    extractorCandidates: NonNegativeIntegerSchema.optional(),
    sourcePublishersObserved: NonNegativeIntegerSchema.optional(),
    contentItemsSubmitted: NonNegativeIntegerSchema.optional(),
    failedSubmissions: NonNegativeIntegerSchema.optional(),
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
    if (run.status === "SUCCEEDED") {
      if (run.failureReason !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["failureReason"],
          message:
            "Succeeded home-feed collection runs must not contain a failure reason.",
        });
      }

      return;
    }

    if (run.status === "FAILED") {
      if (run.failureReason === undefined) {
        context.addIssue({
          code: "custom",
          path: ["failureReason"],
          message:
            "Failed home-feed collection runs require a failure reason.",
        });
      }

      return;
    }

    if (run.summary !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message:
          "Queued, running, and canceled home-feed collection runs must not contain a summary.",
      });
    }

    if (run.failureReason !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["failureReason"],
        message:
          "Queued, running, and canceled home-feed collection runs must not contain a failure reason.",
      });
    }
  });
