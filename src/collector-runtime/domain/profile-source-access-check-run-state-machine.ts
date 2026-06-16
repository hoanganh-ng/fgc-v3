import { InvalidProfileSourceAccessCheckRunStatusTransitionError } from "./collection-run-errors";
import type { ProfileSourceAccessCheckRunStatus } from "./profile-source-access-check-run-status";

export const ALLOWED_PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUS_TRANSITIONS: Readonly<
  Record<ProfileSourceAccessCheckRunStatus, readonly ProfileSourceAccessCheckRunStatus[]>
> = {
  QUEUED: ["RUNNING", "CANCELED"],
  RUNNING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELED: [],
};

export function canTransitionProfileSourceAccessCheckRunStatus(
  from: ProfileSourceAccessCheckRunStatus,
  to: ProfileSourceAccessCheckRunStatus,
): boolean {
  return ALLOWED_PROFILE_SOURCE_ACCESS_CHECK_RUN_STATUS_TRANSITIONS[from].some(
    (allowedStatus) => allowedStatus === to,
  );
}

export function assertValidProfileSourceAccessCheckRunStatusTransition(
  from: ProfileSourceAccessCheckRunStatus,
  to: ProfileSourceAccessCheckRunStatus,
): void {
  if (!canTransitionProfileSourceAccessCheckRunStatus(from, to)) {
    throw new InvalidProfileSourceAccessCheckRunStatusTransitionError(from, to);
  }
}
