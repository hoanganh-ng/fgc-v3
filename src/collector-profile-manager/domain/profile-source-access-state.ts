import type { infer as zInfer } from "zod";
import type { ProfileSourceAccessStateSchema } from "./profile.schemas";

export const PROFILE_SOURCE_ACCESS_STATES = [
  "UNKNOWN",
  "PUBLIC_ACCESSIBLE",
  "JOIN_REQUIRED",
  "JOIN_REQUESTED",
  "JOINED_ACCESSIBLE",
  "ACCESS_DENIED",
  "LOGIN_REQUIRED",
  "CHECKPOINT_REQUIRED",
  "NEEDS_MANUAL_REVIEW",
] as const;

export type ProfileSourceAccessState = zInfer<
  typeof ProfileSourceAccessStateSchema
>;

export function isProfileSourceAccessState(
  value: unknown,
): value is ProfileSourceAccessState {
  return (
    typeof value === "string" &&
    PROFILE_SOURCE_ACCESS_STATES.some((state) => state === value)
  );
}

export function isSuccessfulProfileSourceAccessState(
  state: ProfileSourceAccessState,
): boolean {
  return state === "PUBLIC_ACCESSIBLE" || state === "JOINED_ACCESSIBLE";
}
