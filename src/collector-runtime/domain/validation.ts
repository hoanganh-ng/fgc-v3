import type { ZodIssue } from "zod";
import type {
  CollectionRun,
  CollectionRunFailureReason,
  CollectionRunParameters,
  CollectionRunSummary,
} from "./collection-run";
import type {
  CollectionSchedule,
} from "./collection-schedule";
import type {
  AccountExerciseRun,
  AccountExerciseRunActionBudget,
  AccountExerciseRunFailureReason,
  AccountExerciseRunSafeSummary,
  CategoryBrowseExerciseTarget,
} from "./account-exercise-run";
import type { ProfileSourceAccessCheckRun } from "./profile-source-access-check-run";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunFailureReason,
  ProfileHomeFeedCollectionRunParameters,
  ProfileHomeFeedCollectionRunSummary,
} from "./profile-home-feed-collection-run";
import type { ProfileHomeFeedCollectionSchedule } from "./profile-home-feed-collection-schedule";
import {
  AccountExerciseRunActionBudgetSchema,
  AccountExerciseRunFailureReasonSchema,
  AccountExerciseRunSafeSummarySchema,
  AccountExerciseRunSchema,
  CategoryBrowseExerciseTargetSchema,
} from "./account-exercise-run.schemas";
import {
  CollectionRunFailureReasonSchema,
  CollectionRunParametersSchema,
  CollectionRunSchema,
  CollectionRunSummarySchema,
} from "./collection-run.schemas";
import { CollectionScheduleSchema } from "./collection-schedule.schemas";
import { ProfileSourceAccessCheckRunSchema } from "./profile-source-access-check-run.schemas";
import {
  ProfileHomeFeedCollectionRunFailureReasonSchema,
  ProfileHomeFeedCollectionRunParametersSchema,
  ProfileHomeFeedCollectionRunSchema,
  ProfileHomeFeedCollectionRunSummarySchema,
} from "./profile-home-feed-collection-run.schemas";
import { ProfileHomeFeedCollectionScheduleSchema } from "./profile-home-feed-collection-schedule.schemas";

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | {
      readonly valid: true;
      readonly value: T;
    }
  | {
      readonly valid: false;
      readonly issues: readonly ValidationIssue[];
    };

export function validateCollectionRun(
  value: unknown,
): ValidationResult<CollectionRun> {
  return parseCollectionRun(value);
}

export function parseCollectionRun(
  value: unknown,
): ValidationResult<CollectionRun> {
  const result = CollectionRunSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateCollectionRunParameters(
  value: unknown,
): ValidationResult<CollectionRunParameters> {
  const result = CollectionRunParametersSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateCollectionRunSummary(
  value: unknown,
): ValidationResult<CollectionRunSummary> {
  const result = CollectionRunSummarySchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateCollectionRunFailureReason(
  value: unknown,
): ValidationResult<CollectionRunFailureReason> {
  const result = CollectionRunFailureReasonSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateAccountExerciseRun(
  value: unknown,
): ValidationResult<AccountExerciseRun> {
  const result = AccountExerciseRunSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateAccountExerciseRunActionBudget(
  value: unknown,
): ValidationResult<AccountExerciseRunActionBudget> {
  const result = AccountExerciseRunActionBudgetSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateAccountExerciseRunSafeSummary(
  value: unknown,
): ValidationResult<AccountExerciseRunSafeSummary> {
  const result = AccountExerciseRunSafeSummarySchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateAccountExerciseRunFailureReason(
  value: unknown,
): ValidationResult<AccountExerciseRunFailureReason> {
  const result = AccountExerciseRunFailureReasonSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateCategoryBrowseExerciseTarget(
  value: unknown,
): ValidationResult<CategoryBrowseExerciseTarget> {
  const result = CategoryBrowseExerciseTargetSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

function formatZodIssues(
  issues: readonly ZodIssue[],
): readonly ValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

function invalid(issues: readonly ValidationIssue[]): {
  readonly valid: false;
  readonly issues: readonly ValidationIssue[];
} {
  return {
    valid: false,
    issues,
  };
}

export function validateProfileSourceAccessCheckRun(
  value: unknown,
): ValidationResult<ProfileSourceAccessCheckRun> {
  const result = ProfileSourceAccessCheckRunSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateProfileHomeFeedCollectionRun(
  value: unknown,
): ValidationResult<ProfileHomeFeedCollectionRun> {
  const result = ProfileHomeFeedCollectionRunSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateProfileHomeFeedCollectionRunParameters(
  value: unknown,
): ValidationResult<ProfileHomeFeedCollectionRunParameters> {
  const result = ProfileHomeFeedCollectionRunParametersSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateProfileHomeFeedCollectionRunSummary(
  value: unknown,
): ValidationResult<ProfileHomeFeedCollectionRunSummary> {
  const result = ProfileHomeFeedCollectionRunSummarySchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateProfileHomeFeedCollectionRunFailureReason(
  value: unknown,
): ValidationResult<ProfileHomeFeedCollectionRunFailureReason> {
  const result =
    ProfileHomeFeedCollectionRunFailureReasonSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateProfileHomeFeedCollectionSchedule(
  value: unknown,
): ValidationResult<ProfileHomeFeedCollectionSchedule> {
  const result = ProfileHomeFeedCollectionScheduleSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateCollectionSchedule(
  value: unknown,
): ValidationResult<CollectionSchedule> {
  const result = CollectionScheduleSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}
