import { z } from "zod";
import { ProfileHomeFeedCollectionRunParametersSchema } from "./profile-home-feed-collection-run.schemas";

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

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

export const ProfileHomeFeedCollectionScheduleSchema = z
  .object({
    profileId: ProfileHomeFeedCollectionScheduleProfileIdSchema,
    enabled: z.boolean(),
    intervalMinutes: ProfileHomeFeedCollectionScheduleIntervalMinutesSchema,
    nextRunAt: ProfileHomeFeedCollectionScheduleIsoDateTimeSchema,
    parameters: ProfileHomeFeedCollectionRunParametersSchema,
    createdAt: ProfileHomeFeedCollectionScheduleIsoDateTimeSchema,
    updatedAt: ProfileHomeFeedCollectionScheduleIsoDateTimeSchema,
  })
  .strict();
