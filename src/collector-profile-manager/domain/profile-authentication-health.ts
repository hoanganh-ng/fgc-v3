import type { infer as zInfer } from "zod";
import type {
  ProfileAuthenticationHealthObservationSchema,
  ProfileAuthenticationHealthSchema,
} from "./profile.schemas";

export const PROFILE_AUTHENTICATION_HEALTH_VALUES = [
  "NOT_PROVISIONED",
  "HEALTHY",
  "REAUTH_REQUIRED",
  "CHECKPOINT_REVIEW_REQUIRED",
] as const;

export const PROFILE_AUTHENTICATION_HEALTH_OBSERVATION_VALUES = [
  "LOGIN_REQUIRED",
  "CHECKPOINT_REQUIRED",
] as const;

export type ProfileAuthenticationHealth = zInfer<
  typeof ProfileAuthenticationHealthSchema
>;

export type ProfileAuthenticationHealthObservation = zInfer<
  typeof ProfileAuthenticationHealthObservationSchema
>;

export function isProfileAuthenticationHealth(
  value: unknown,
): value is ProfileAuthenticationHealth {
  return (
    typeof value === "string" &&
    PROFILE_AUTHENTICATION_HEALTH_VALUES.some((h) => h === value)
  );
}

export function isProfileAuthenticationHealthObservation(
  value: unknown,
): value is ProfileAuthenticationHealthObservation {
  return (
    typeof value === "string" &&
    PROFILE_AUTHENTICATION_HEALTH_OBSERVATION_VALUES.some((o) => o === value)
  );
}

/**
 * Domain-owned transition policy for runtime authentication observations.
 *
 * Maps an exact runtime observation to a single domain health state.
 *
 * Mapping:
 *   - `LOGIN_REQUIRED`       -> `REAUTH_REQUIRED`
 *   - `CHECKPOINT_REQUIRED` -> `CHECKPOINT_REVIEW_REQUIRED`
 *
 * Invariants:
 *   - `CHECKPOINT_REVIEW_REQUIRED` cannot be downgraded by a `LOGIN_REQUIRED`
 *     observation; it preserves the existing checkpoint state.
 *   - Repeated equivalent observations are idempotent: `changed` is `false`
 *     when the effective health state does not change.
 *   - Successful session ingestion remains the only recovery transition to
 *     `HEALTHY`. Runtime observations cannot transition back to `HEALTHY`,
 *     `NOT_PROVISIONED`, or lower the existing checkpoint state.
 *   - This function is pure and performs no IO. The caller is responsible
 *     for refreshing `authenticationHealthUpdatedAt` only when `changed`
 *     is `true`.
 */
export function applyProfileAuthenticationHealthObservation(
  current: ProfileAuthenticationHealth,
  observation: ProfileAuthenticationHealthObservation,
): {
  readonly nextHealth: ProfileAuthenticationHealth;
  readonly changed: boolean;
} {
  const nextHealth = observationToHealth(current, observation);

  if (nextHealth === current) {
    return {
      nextHealth: current,
      changed: false,
    };
  }

  return {
    nextHealth,
    changed: true,
  };
}

function observationToHealth(
  current: ProfileAuthenticationHealth,
  observation: ProfileAuthenticationHealthObservation,
): ProfileAuthenticationHealth {
  // `CHECKPOINT_REVIEW_REQUIRED` is sticky: a later LOGIN_REQUIRED observation
  // cannot downgrade the checkpoint state.
  if (current === "CHECKPOINT_REVIEW_REQUIRED") {
    return "CHECKPOINT_REVIEW_REQUIRED";
  }

  if (observation === "LOGIN_REQUIRED") {
    return "REAUTH_REQUIRED";
  }

  return "CHECKPOINT_REVIEW_REQUIRED";
}
