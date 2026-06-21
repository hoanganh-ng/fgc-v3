import type { infer as zInfer } from "zod";
import type {
  ProfileHomeFeedCollectionScheduleIntervalMinutesSchema,
  ProfileHomeFeedCollectionScheduleIsoDateTimeSchema,
  ProfileHomeFeedCollectionScheduleProfileIdSchema,
  ProfileHomeFeedCollectionScheduleSchema,
} from "./profile-home-feed-collection-schedule.schemas";

export type ProfileHomeFeedCollectionScheduleIsoDateTime = zInfer<
  typeof ProfileHomeFeedCollectionScheduleIsoDateTimeSchema
>;
export type ProfileHomeFeedCollectionScheduleProfileId = zInfer<
  typeof ProfileHomeFeedCollectionScheduleProfileIdSchema
>;
export type ProfileHomeFeedCollectionScheduleIntervalMinutes = zInfer<
  typeof ProfileHomeFeedCollectionScheduleIntervalMinutesSchema
>;
export type ProfileHomeFeedCollectionSchedule = zInfer<
  typeof ProfileHomeFeedCollectionScheduleSchema
>;
