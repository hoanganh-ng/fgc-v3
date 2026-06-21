import { z } from "zod";
import { ProfileHomeFeedCollectionRunParametersSchema } from "./profile-home-feed-collection-run.schemas";

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });
const NonNegativeIntegerSchema = z.number().int().min(0);

export const ProfileHomeFeedCollectionScheduleIsoDateTimeSchema =
  z.iso.datetime({
    offset: true,
  });

export const ProfileHomeFeedCollectionScheduleProfileIdSchema =
  NonEmptyStringSchema;

export const ProfileHomeFeedCollectionScheduleIntervalMinutesSchema = z
  .number()
  .int()
  .min(1)
  .max(10080);

export const PROFILE_HOME_FEED_COLLECTION_SCHEDULE_DISPATCH_STATUSES = [
  "DISPATCHED",
  "SKIPPED_ACTIVE_RUN",
  "PROFILE_NOT_FOUND",
  "PROFILE_LOOKUP_FAILED",
] as const;

export const ProfileHomeFeedCollectionScheduleDispatchStatusSchema = z.enum(
  PROFILE_HOME_FEED_COLLECTION_SCHEDULE_DISPATCH_STATUSES,
);

export const ProfileHomeFeedCollectionScheduleFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

export const ProfileHomeFeedCollectionScheduleSchema = z
  .object({
    profileId: ProfileHomeFeedCollectionScheduleProfileIdSchema,
    enabled: z.boolean(),
    intervalMinutes: ProfileHomeFeedCollectionScheduleIntervalMinutesSchema,
    nextRunAt: ProfileHomeFeedCollectionScheduleIsoDateTimeSchema,
    parameters: ProfileHomeFeedCollectionRunParametersSchema,
    lastAttemptedAt:
      ProfileHomeFeedCollectionScheduleIsoDateTimeSchema.optional(),
    lastDispatchStatus:
      ProfileHomeFeedCollectionScheduleDispatchStatusSchema.optional(),
    lastFailureReason:
      ProfileHomeFeedCollectionScheduleFailureReasonSchema.optional(),
    consecutiveFailures: NonNegativeIntegerSchema,
    createdAt: ProfileHomeFeedCollectionScheduleIsoDateTimeSchema,
    updatedAt: ProfileHomeFeedCollectionScheduleIsoDateTimeSchema,
  })
  .strict();
