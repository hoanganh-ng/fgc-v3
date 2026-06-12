import type { infer as zInfer } from "zod";
import type {
  CollectionRunFailureReasonSchema,
  CollectionRunIdSchema,
  CollectionRunIsoDateTimeSchema,
  CollectionRunParametersSchema,
  CollectionRunSchema,
  CollectionRunSourceGroupIdSchema,
  CollectionRunSummarySchema,
} from "./collection-run.schemas";

export type CollectionRunIsoDateTime = zInfer<
  typeof CollectionRunIsoDateTimeSchema
>;
export type CollectionRunId = zInfer<typeof CollectionRunIdSchema>;
export type CollectionRunSourceGroupId = zInfer<
  typeof CollectionRunSourceGroupIdSchema
>;
export type CollectionRunParameters = zInfer<
  typeof CollectionRunParametersSchema
>;
export type CollectionRunSummary = zInfer<typeof CollectionRunSummarySchema>;
export type CollectionRunFailureReason = zInfer<
  typeof CollectionRunFailureReasonSchema
>;
export type CollectionRun = zInfer<typeof CollectionRunSchema>;
