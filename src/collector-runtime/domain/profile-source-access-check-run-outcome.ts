import type { infer as zInfer } from "zod";
import type { ProfileSourceAccessCheckRunOutcomeSchema } from "./profile-source-access-check-run.schemas";

export const PROFILE_SOURCE_ACCESS_CHECK_RUN_OUTCOMES = [
  "PUBLIC_ACCESSIBLE",
  "JOIN_REQUIRED",
  "JOINED_ACCESSIBLE",
  "ACCESS_DENIED",
  "LOGIN_REQUIRED",
  "CHECKPOINT_REQUIRED",
  "NEEDS_MANUAL_REVIEW",
] as const;

export type ProfileSourceAccessCheckRunOutcome = zInfer<
  typeof ProfileSourceAccessCheckRunOutcomeSchema
>;
