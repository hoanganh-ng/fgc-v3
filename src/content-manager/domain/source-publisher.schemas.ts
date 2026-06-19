import { z } from "zod";
import type { infer as zInfer } from "zod";
import { ContentPlatformSchema, IsoDateTimeSchema } from "./content.schemas";
import { SourcePublisherIdSchema } from "./shared-identifier.schemas";
import { SOURCE_PUBLISHER_KINDS } from "./source-publisher-kind";
import { SOURCE_PUBLISHER_STATUSES } from "./source-publisher-status";

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

const PositiveIntegerSchema = z.number().int().min(1);

export const ExternalPublisherIdSchema = NonEmptyStringSchema;
// `SourcePublisherIdSchema` is owned by
// `./shared-identifier.schemas` and re-exported here for callers
// that import it from this module.
export { SourcePublisherIdSchema };
export const SourcePublisherKindSchema = z.enum(SOURCE_PUBLISHER_KINDS);
export const SourcePublisherStatusSchema = z.enum(SOURCE_PUBLISHER_STATUSES);

export const SourcePublisherSchema = z
  .object({
    id: SourcePublisherIdSchema,
    platform: ContentPlatformSchema,
    kind: SourcePublisherKindSchema,
    externalPublisherId: ExternalPublisherIdSchema,
    displayName: NonEmptyStringSchema.optional(),
    canonicalUrl: z.url().optional(),
    status: SourcePublisherStatusSchema,
    firstObservedAt: IsoDateTimeSchema,
    lastObservedAt: IsoDateTimeSchema,
    observationCount: PositiveIntegerSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
  })
  .strict()
  .superRefine((sourcePublisher, context) => {
    if (
      Date.parse(sourcePublisher.firstObservedAt) >
      Date.parse(sourcePublisher.lastObservedAt)
    ) {
      context.addIssue({
        code: "custom",
        path: ["lastObservedAt"],
        message:
          "lastObservedAt must be greater than or equal to firstObservedAt.",
      });
    }
  });

export const ObserveSourcePublisherInputSchema = z
  .object({
    platform: ContentPlatformSchema,
    kind: SourcePublisherKindSchema,
    externalPublisherId: ExternalPublisherIdSchema,
    observedAt: IsoDateTimeSchema,
    displayName: NonEmptyStringSchema.optional(),
    canonicalUrl: z.url().optional(),
  })
  .strict();

export type ObserveSourcePublisherApplicationInput = zInfer<
  typeof ObserveSourcePublisherInputSchema
>;
