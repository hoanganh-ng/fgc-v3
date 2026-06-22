import { z } from "zod";
import { TRANSFORM_TYPE_STATUSES } from "./transform-type-status";

const NonEmptyStringSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, {
    message: "Expected non-empty string.",
  });

const OptionalDescriptionSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, {
    message: "Expected non-empty string.",
  });

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const TransformTypeIdSchema = NonEmptyStringSchema;
export const TransformTypeStatusSchema = z.enum(TRANSFORM_TYPE_STATUSES);

export const TransformTypeSchema = z
  .object({
    transformTypeId: TransformTypeIdSchema,
    name: NonEmptyStringSchema,
    normalizedName: NonEmptyStringSchema,
    description: OptionalDescriptionSchema.optional(),
    initialPrompt: NonEmptyStringSchema,
    status: TransformTypeStatusSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict();
