import { InvalidProfileStateTransitionError } from "./profile-errors";
import type { ProfileStatus } from "./profile-status";

export const ALLOWED_PROFILE_STATUS_TRANSITIONS: Readonly<
  Record<ProfileStatus, readonly ProfileStatus[]>
> = {
  PENDING_CONFIG: ["PENDING_LOGIN"],
  PENDING_LOGIN: ["READY"],
  READY: ["BUSY"],
  BUSY: ["READY"],
};

export function getAllowedProfileStatusTransitions(
  from: ProfileStatus,
): readonly ProfileStatus[] {
  return ALLOWED_PROFILE_STATUS_TRANSITIONS[from];
}

export function canTransitionProfileStatus(
  from: ProfileStatus,
  to: ProfileStatus,
): boolean {
  return ALLOWED_PROFILE_STATUS_TRANSITIONS[from].some(
    (allowedStatus) => allowedStatus === to,
  );
}

export function assertValidProfileStatusTransition(
  from: ProfileStatus,
  to: ProfileStatus,
): void {
  if (!canTransitionProfileStatus(from, to)) {
    throw new InvalidProfileStateTransitionError(from, to);
  }
}

export function transitionProfileStatus(
  from: ProfileStatus,
  to: ProfileStatus,
): ProfileStatus {
  assertValidProfileStatusTransition(from, to);
  return to;
}
