import type { infer as zInfer } from "zod";
import type {
  AccountExerciseRunActionBudgetSchema,
  AccountExerciseRunFailureReasonSchema,
  AccountExerciseRunIdSchema,
  AccountExerciseRunIsoDateTimeSchema,
  AccountExerciseRunSafeSummarySchema,
  AccountExerciseRunSchema,
} from "./account-exercise-run.schemas";

export type AccountExerciseRunIsoDateTime = zInfer<
  typeof AccountExerciseRunIsoDateTimeSchema
>;
export type AccountExerciseRunId = zInfer<typeof AccountExerciseRunIdSchema>;
export type AccountExerciseRunActionBudget = zInfer<
  typeof AccountExerciseRunActionBudgetSchema
>;
export type AccountExerciseRunSafeSummary = zInfer<
  typeof AccountExerciseRunSafeSummarySchema
>;
export type AccountExerciseRunFailureReason = zInfer<
  typeof AccountExerciseRunFailureReasonSchema
>;
export type AccountExerciseRun = zInfer<typeof AccountExerciseRunSchema>;
