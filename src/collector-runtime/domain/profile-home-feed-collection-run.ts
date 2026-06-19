import type { infer as zInfer } from "zod";
import type {
  ProfileHomeFeedCollectionRunFailureReasonSchema,
  ProfileHomeFeedCollectionRunIdSchema,
  ProfileHomeFeedCollectionRunIsoDateTimeSchema,
  ProfileHomeFeedCollectionRunParametersSchema,
  ProfileHomeFeedCollectionRunProfileIdSchema,
  ProfileHomeFeedCollectionRunSchema,
  ProfileHomeFeedCollectionRunSummarySchema,
  ProfileHomeFeedCollectionRunTargetSchema,
} from "./profile-home-feed-collection-run.schemas";

export type ProfileHomeFeedCollectionRunIsoDateTime = zInfer<
  typeof ProfileHomeFeedCollectionRunIsoDateTimeSchema
>;
export type ProfileHomeFeedCollectionRunId = zInfer<
  typeof ProfileHomeFeedCollectionRunIdSchema
>;
export type ProfileHomeFeedCollectionRunProfileId = zInfer<
  typeof ProfileHomeFeedCollectionRunProfileIdSchema
>;
export type ProfileHomeFeedCollectionRunTarget = zInfer<
  typeof ProfileHomeFeedCollectionRunTargetSchema
>;
export type ProfileHomeFeedCollectionRunParameters = zInfer<
  typeof ProfileHomeFeedCollectionRunParametersSchema
>;
export type ProfileHomeFeedCollectionRunSummary = zInfer<
  typeof ProfileHomeFeedCollectionRunSummarySchema
>;
export type ProfileHomeFeedCollectionRunFailureReason = zInfer<
  typeof ProfileHomeFeedCollectionRunFailureReasonSchema
>;
export type ProfileHomeFeedCollectionRun = zInfer<
  typeof ProfileHomeFeedCollectionRunSchema
>;
