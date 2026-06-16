import type { infer as zInfer } from "zod";
import type { CollectorProfile } from "./profile";
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

/**
 * Domain-owned eligibility predicate for `StartProfileProvisioningUseCase`.
 *
 * Determines whether an operator may start or restart provisioning through
 * the existing `POST /collector/profiles/:profileId/provisioning/start`
 * endpoint. The supported combinations are:
 *
 * - `PENDING_CONFIG`: initial provisioning allowed.
 * - `PENDING_LOGIN`: explicit token restart allowed; the previous token is
 *   superseded by a new one-time token.
 * - `READY` with `authenticationHealth = REAUTH_REQUIRED`: reauthentication
 *   recovery allowed.
 * - `READY` with `authenticationHealth = CHECKPOINT_REVIEW_REQUIRED`:
 *   manual checkpoint recovery allowed; the operator must drive the
 *   existing headed provisioning CLI. There is no automated bypass.
 *
 * Rejected combinations:
 *
 * - `READY` with `authenticationHealth = HEALTHY` or `NOT_PROVISIONED`.
 * - `BUSY` (the profile is currently leased by runtime work).
 *
 * This function is pure and performs no IO.
 */
export function canStartProvisioning(profile: CollectorProfile): boolean {
  if (profile.identity.status === "PENDING_CONFIG") {
    return true;
  }

  if (profile.identity.status === "PENDING_LOGIN") {
    return true;
  }

  if (profile.identity.status === "READY") {
    return (
      profile.authenticationHealth === "REAUTH_REQUIRED" ||
      profile.authenticationHealth === "CHECKPOINT_REVIEW_REQUIRED"
    );
  }

  return false;
}

/**
 * Domain-owned rejection reason for `StartProfileProvisioningUseCase`.
 *
 * Returned by `explainStartProvisioningRejection` so the application and
 * HTTP layers can surface a precise backend-owned message without
 * duplicating the policy. The codes are stable and machine-readable.
 */
export type StartProvisioningRejectionReason =
  | "PROFILE_BUSY"
  | "PROFILE_READY_NOT_RECOVERABLE";

/**
 * Pure helper that returns the rejection reason for a profile that does
 * not satisfy `canStartProvisioning`. Returns `null` when the profile is
 * eligible, in which case the caller should proceed with the existing
 * status-based flow.
 */
export function explainStartProvisioningRejection(
  profile: CollectorProfile,
): StartProvisioningRejectionReason | null {
  if (canStartProvisioning(profile)) {
    return null;
  }

  if (profile.identity.status === "BUSY") {
    return "PROFILE_BUSY";
  }

  return "PROFILE_READY_NOT_RECOVERABLE";
}
