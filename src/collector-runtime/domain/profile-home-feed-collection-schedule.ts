import type { infer as zInfer } from "zod";
import type {
  ProfileHomeFeedCollectionScheduleIntervalMinutesSchema,
  ProfileHomeFeedCollectionScheduleIsoDateTimeSchema,
  ProfileHomeFeedCollectionScheduleDispatchStatusSchema,
  ProfileHomeFeedCollectionScheduleFailureReasonSchema,
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
export type ProfileHomeFeedCollectionScheduleDispatchStatus = zInfer<
  typeof ProfileHomeFeedCollectionScheduleDispatchStatusSchema
>;
export type ProfileHomeFeedCollectionScheduleFailureReason = zInfer<
  typeof ProfileHomeFeedCollectionScheduleFailureReasonSchema
>;
export type ProfileHomeFeedCollectionSchedule = zInfer<
  typeof ProfileHomeFeedCollectionScheduleSchema
>;
