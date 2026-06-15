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

export const CategoryBrowseExerciseTargetSchema = z
  .object({
    categoryId: NonEmptyStringSchema,
    sourceGroupId: NonEmptyStringSchema,
    entryRouteId: NonEmptyStringSchema,
    entryRouteType: z.literal("CATEGORY_ENTRY_URL"),
    url: NonEmptyStringSchema,
    riskLevel: z.enum(["LOW", "MEDIUM"]),
  })
  .strict()
  .superRefine((target, context) => {
    const parsedUrl = parseUrl(target.url);

    if (
      parsedUrl === undefined ||
      parsedUrl.protocol !== "https:" ||
      !isFacebookHostname(parsedUrl.hostname)
    ) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Category Browse target URL must be an https Facebook URL.",
      });
      return;
    }

    if (parsedUrl.username || parsedUrl.password) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "Category Browse target URL must not contain credentials.",
      });
    }
  });

export const AccountExerciseRunSchema = z
  .object({
    id: AccountExerciseRunIdSchema,
    profileId: NonEmptyStringSchema,
    leaseId: NonEmptyStringSchema.optional(),
    exerciseType: AccountExerciseTypeSchema,
    status: AccountExerciseRunStatusSchema,
    stageAtStart: NonEmptyStringSchema,
    actionBudget: AccountExerciseRunActionBudgetSchema,
    target: CategoryBrowseExerciseTargetSchema.optional(),
    safeSummary: AccountExerciseRunSafeSummarySchema.optional(),
    failureReason: AccountExerciseRunFailureReasonSchema.optional(),
    requestedAt: AccountExerciseRunIsoDateTimeSchema,
    startedAt: AccountExerciseRunIsoDateTimeSchema.optional(),
    finishedAt: AccountExerciseRunIsoDateTimeSchema.optional(),
    createdAt: AccountExerciseRunIsoDateTimeSchema,
    updatedAt: AccountExerciseRunIsoDateTimeSchema,
  })
  .strict()
  .superRefine((run, context) => {
    if (run.exerciseType === "AMBIENT_ACCOUNT" && run.target !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: "Ambient account exercise runs must not include a target.",
      });
    }

    if (run.exerciseType === "CATEGORY_BROWSE" && run.target === undefined) {
      context.addIssue({
        code: "custom",
        path: ["target"],
        message: "Category Browse exercise runs require a target.",
      });
    }
  });

function parseUrl(value: string): URL | undefined {
  try {
    return new URL(value);
  } catch {
    return undefined;
  }
}

function isFacebookHostname(hostname: string): boolean {
  const normalizedHostname = hostname.toLowerCase();

  return (
    normalizedHostname === "facebook.com" ||
    normalizedHostname.endsWith(".facebook.com")
  );
}
