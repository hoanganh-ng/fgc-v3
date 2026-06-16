import type { infer as zInfer } from "zod";
import type { ProfileAuthenticationHealthSchema } from "./profile.schemas";

export const PROFILE_AUTHENTICATION_HEALTH_VALUES = [
  "NOT_PROVISIONED",
  "HEALTHY",
  "REAUTH_REQUIRED",
  "CHECKPOINT_REVIEW_REQUIRED",
] as const;

export type ProfileAuthenticationHealth = zInfer<
  typeof ProfileAuthenticationHealthSchema
>;

export function isProfileAuthenticationHealth(
  value: unknown,
): value is ProfileAuthenticationHealth {
  return (
    typeof value === "string" &&
    PROFILE_AUTHENTICATION_HEALTH_VALUES.some((h) => h === value)
  );
}
