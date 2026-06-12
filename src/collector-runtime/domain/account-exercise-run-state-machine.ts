import { InvalidAccountExerciseRunStatusTransitionError } from "./collection-run-errors";
import type { AccountExerciseRunStatus } from "./account-exercise-run-status";

export const ALLOWED_ACCOUNT_EXERCISE_RUN_STATUS_TRANSITIONS: Readonly<
  Record<AccountExerciseRunStatus, readonly AccountExerciseRunStatus[]>
> = {
  QUEUED: ["RUNNING", "CANCELED"],
  RUNNING: ["SUCCEEDED", "FAILED"],
  SUCCEEDED: [],
  FAILED: [],
  CANCELED: [],
};

export function canTransitionAccountExerciseRunStatus(
  from: AccountExerciseRunStatus,
  to: AccountExerciseRunStatus,
): boolean {
  return ALLOWED_ACCOUNT_EXERCISE_RUN_STATUS_TRANSITIONS[from].some(
    (allowedStatus) => allowedStatus === to,
  );
}

export function assertValidAccountExerciseRunStatusTransition(
  from: AccountExerciseRunStatus,
  to: AccountExerciseRunStatus,
): void {
  if (!canTransitionAccountExerciseRunStatus(from, to)) {
    throw new InvalidAccountExerciseRunStatusTransitionError(from, to);
  }
}
