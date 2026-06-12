import type { infer as zInfer } from "zod";
import type { ProfileAccountStageSchema } from "./profile.schemas";

export const PROFILE_ACCOUNT_STAGES = [
  "NEW_ACCOUNT",
  "WARMING",
  "COLLECTION_READY",
  "LIMITED",
  "NEEDS_REVIEW",
  "RETIRED",
] as const;

export type ProfileAccountStage = zInfer<typeof ProfileAccountStageSchema>;

export function isProfileAccountStage(
  value: unknown,
): value is ProfileAccountStage {
  return (
    typeof value === "string" &&
    PROFILE_ACCOUNT_STAGES.some((stage) => stage === value)
  );
}
