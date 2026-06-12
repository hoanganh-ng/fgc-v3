import { z } from "zod";
import { COLLECTION_RUN_STATUSES } from "./collection-run-status";
import { COLLECTION_RUN_TRIGGER_TYPES } from "./collection-run-trigger-type";

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().min(1);

export const CollectionRunIsoDateTimeSchema = z.iso.datetime({ offset: true });
export const CollectionRunIdSchema = NonEmptyStringSchema;
export const CollectionRunSourceGroupIdSchema = NonEmptyStringSchema;
export const CollectionRunStatusSchema = z.enum(COLLECTION_RUN_STATUSES);
export const CollectionRunTriggerTypeSchema = z.enum(
  COLLECTION_RUN_TRIGGER_TYPES,
);

export const CollectionRunParametersSchema = z
  .object({
    maxScrolls: NonNegativeIntegerSchema.optional(),
    maxDurationMs: PositiveIntegerSchema.optional(),
  })
  .strict();

export const CollectionRunSummarySchema = z
  .object({
    capturedPayloads: NonNegativeIntegerSchema.optional(),
    extractorCandidates: NonNegativeIntegerSchema.optional(),
    contentItemsSubmitted: NonNegativeIntegerSchema.optional(),
    failedSubmissions: NonNegativeIntegerSchema.optional(),
    leaseReleased: z.boolean().optional(),
  })
  .strict();

export const CollectionRunFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

export const CollectionRunSchema = z
  .object({
    id: CollectionRunIdSchema,
    sourceGroupId: CollectionRunSourceGroupIdSchema,
    status: CollectionRunStatusSchema,
    triggerType: CollectionRunTriggerTypeSchema,
    parameters: CollectionRunParametersSchema,
    summary: CollectionRunSummarySchema.optional(),
    failureReason: CollectionRunFailureReasonSchema.optional(),
    requestedAt: CollectionRunIsoDateTimeSchema,
    startedAt: CollectionRunIsoDateTimeSchema.optional(),
    finishedAt: CollectionRunIsoDateTimeSchema.optional(),
    createdAt: CollectionRunIsoDateTimeSchema,
    updatedAt: CollectionRunIsoDateTimeSchema,
  })
  .strict();
