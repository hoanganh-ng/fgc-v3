import type { infer as zInfer } from "zod";
import type { AccountExerciseRunStatusSchema } from "./account-exercise-run.schemas";

export const ACCOUNT_EXERCISE_RUN_STATUSES = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

export const TERMINAL_ACCOUNT_EXERCISE_RUN_STATUSES = [
  "SUCCEEDED",
  "FAILED",
  "CANCELED",
] as const;

export type AccountExerciseRunStatus = zInfer<
  typeof AccountExerciseRunStatusSchema
>;

export function isTerminalAccountExerciseRunStatus(
  status: AccountExerciseRunStatus,
): boolean {
  return TERMINAL_ACCOUNT_EXERCISE_RUN_STATUSES.some(
    (terminalStatus) => terminalStatus === status,
  );
}
