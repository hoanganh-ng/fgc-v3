import type { infer as zInfer } from "zod";
import type {
  CollectionScheduleIntervalMinutesSchema,
  CollectionScheduleIsoDateTimeSchema,
  CollectionScheduleSchema,
  CollectionScheduleSourceGroupIdSchema,
} from "./collection-schedule.schemas";

export type CollectionScheduleIsoDateTime = zInfer<
  typeof CollectionScheduleIsoDateTimeSchema
>;
export type CollectionScheduleSourceGroupId = zInfer<
  typeof CollectionScheduleSourceGroupIdSchema
>;
export type CollectionScheduleIntervalMinutes = zInfer<
  typeof CollectionScheduleIntervalMinutesSchema
>;
export type CollectionSchedule = zInfer<typeof CollectionScheduleSchema>;
