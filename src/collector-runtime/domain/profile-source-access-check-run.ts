import type { infer as zInfer } from "zod";
import type {
  ProfileSourceAccessCheckRunFailureReasonSchema,
  ProfileSourceAccessCheckRunIdSchema,
  ProfileSourceAccessCheckRunIsoDateTimeSchema,
  ProfileSourceAccessCheckRunSchema,
  ProfileSourceAccessCheckRunStatusSchema,
  ProfileSourceAccessCheckRunTargetSchema,
  ProfileSourceAccessCheckRunTriggerTypeSchema,
} from "./profile-source-access-check-run.schemas";

export type ProfileSourceAccessCheckRunIsoDateTime = zInfer<
  typeof ProfileSourceAccessCheckRunIsoDateTimeSchema
>;
export type ProfileSourceAccessCheckRunId = zInfer<
  typeof ProfileSourceAccessCheckRunIdSchema
>;
export type ProfileSourceAccessCheckRunTarget = zInfer<
  typeof ProfileSourceAccessCheckRunTargetSchema
>;
export type ProfileSourceAccessCheckRunFailureReason = zInfer<
  typeof ProfileSourceAccessCheckRunFailureReasonSchema
>;
export type ProfileSourceAccessCheckRun = zInfer<
  typeof ProfileSourceAccessCheckRunSchema
>;
