import type { infer as zInfer } from "zod";
import type { AccountExerciseTypeSchema } from "./account-exercise-run.schemas";

export const ACCOUNT_EXERCISE_TYPES = [
  "AMBIENT_ACCOUNT",
  "CATEGORY_BROWSE",
] as const;

export type AccountExerciseType = zInfer<typeof AccountExerciseTypeSchema>;
