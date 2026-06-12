import type { ZodIssue } from "zod";
import type {
  CollectionRun,
  CollectionRunFailureReason,
  CollectionRunParameters,
  CollectionRunSummary,
} from "./collection-run";
import {
  CollectionRunFailureReasonSchema,
  CollectionRunParametersSchema,
  CollectionRunSchema,
  CollectionRunSummarySchema,
} from "./collection-run.schemas";

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
