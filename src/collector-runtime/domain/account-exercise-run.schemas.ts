import { z } from "zod";
import { ACCOUNT_EXERCISE_RUN_STATUSES } from "./account-exercise-run-status";
import { ACCOUNT_EXERCISE_TYPES } from "./account-exercise-type";

const NonEmptyStringSchema = z
  .string()
  .refine((value) => value.trim().length > 0, {
    message: "Expected non-empty string.",
  });

const NonNegativeIntegerSchema = z.number().int().min(0);
const PositiveIntegerSchema = z.number().int().min(1);

export const AccountExerciseRunIsoDateTimeSchema = z.iso.datetime({
  offset: true,
});
export const AccountExerciseRunIdSchema = NonEmptyStringSchema;
export const AccountExerciseRunStatusSchema = z.enum(
  ACCOUNT_EXERCISE_RUN_STATUSES,
);
export const AccountExerciseTypeSchema = z.enum(ACCOUNT_EXERCISE_TYPES);

export const AccountExerciseRunActionBudgetSchema = z
  .object({
    maxDurationMs: PositiveIntegerSchema,
    maxScrolls: NonNegativeIntegerSchema,
    minDwellMs: NonNegativeIntegerSchema.optional(),
  })
  .strict();

export const AccountExerciseRunSafeSummarySchema = z
  .object({
    pageLoaded: z.boolean(),
    loginRequired: z.boolean(),
    checkpointDetected: z.boolean(),
    scrollsPerformed: NonNegativeIntegerSchema,
    durationMs: NonNegativeIntegerSchema,
    leaseReleased: z.boolean(),
  })
  .strict();

export const AccountExerciseRunFailureReasonSchema = z
  .object({
    code: NonEmptyStringSchema,
    message: NonEmptyStringSchema,
  })
  .strict();

export const AccountExerciseRunSchema = z
  .object({
    id: AccountExerciseRunIdSchema,
    profileId: NonEmptyStringSchema,
    leaseId: NonEmptyStringSchema.optional(),
    exerciseType: AccountExerciseTypeSchema,
    status: AccountExerciseRunStatusSchema,
    stageAtStart: NonEmptyStringSchema,
    actionBudget: AccountExerciseRunActionBudgetSchema,
    safeSummary: AccountExerciseRunSafeSummarySchema.optional(),
    failureReason: AccountExerciseRunFailureReasonSchema.optional(),
    requestedAt: AccountExerciseRunIsoDateTimeSchema,
    startedAt: AccountExerciseRunIsoDateTimeSchema.optional(),
    finishedAt: AccountExerciseRunIsoDateTimeSchema.optional(),
    createdAt: AccountExerciseRunIsoDateTimeSchema,
    updatedAt: AccountExerciseRunIsoDateTimeSchema,
  })
  .strict();
