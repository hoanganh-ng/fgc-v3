import type { infer as zInfer } from "zod";
import type {
  ProfileHomeFeedCollectionRunDiagnosticsSchema,
  ProfileHomeFeedCollectionRunFailureReasonSchema,
  ProfileHomeFeedCollectionRunIdSchema,
  ProfileHomeFeedCollectionRunIsoDateTimeSchema,
  ProfileHomeFeedCollectionRunParametersSchema,
  ProfileHomeFeedCollectionRunProfileIdSchema,
  ProfileHomeFeedCollectionRunSchema,
  ProfileHomeFeedCollectionRunSummarySchema,
  ProfileHomeFeedCollectionRunTargetSchema,
} from "./profile-home-feed-collection-run.schemas";
import type { ProfileHomeFeedDiagnosticSummary } from "./profile-home-feed-diagnostic-summary.schemas";

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
export type ProfileHomeFeedCollectionRunDiagnostics = zInfer<
  typeof ProfileHomeFeedCollectionRunDiagnosticsSchema
>;
export type ProfileHomeFeedCollectionRunFailureReason = zInfer<
  typeof ProfileHomeFeedCollectionRunFailureReasonSchema
>;
export type ProfileHomeFeedCollectionRun = zInfer<
  typeof ProfileHomeFeedCollectionRunSchema
>;

export type {
  ProfileHomeFeedDiagnosticSummary,
  ProfileHomeFeedDiagnosticSummaryFailureStage,
  ProfileHomeFeedDiagnosticSummaryCaptureStage,
  ProfileHomeFeedDiagnosticWarningCode,
} from "./profile-home-feed-diagnostic-summary.schemas";
