import { z } from "zod";
import { CollectionRunParametersSchema } from "./collection-run.schemas";

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

export const CollectionScheduleIsoDateTimeSchema = z.iso.datetime({
  offset: true,
});

export const CollectionScheduleSourceGroupIdSchema = NonEmptyStringSchema;

export const CollectionScheduleIntervalMinutesSchema = z
  .number()
  .int()
  .min(1)
  .max(10080);

export const CollectionScheduleSchema = z
  .object({
    sourceGroupId: CollectionScheduleSourceGroupIdSchema,
    enabled: z.boolean(),
    intervalMinutes: CollectionScheduleIntervalMinutesSchema,
    nextRunAt: CollectionScheduleIsoDateTimeSchema,
    parameters: CollectionRunParametersSchema,
    createdAt: CollectionScheduleIsoDateTimeSchema,
    updatedAt: CollectionScheduleIsoDateTimeSchema,
  })
  .strict();
