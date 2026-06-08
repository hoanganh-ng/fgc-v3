import type { ZodIssue } from "zod";
import type {
  CollectedContentInput,
  ContentCategory,
  ContentItem,
  SourceGroup,
  TopComment,
} from "./content";
import {
  CollectedContentInputSchema,
  ContentCategorySchema,
  ContentItemSchema,
  SourceGroupSchema,
  TopCommentSchema,
} from "./content.schemas";

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

export function validateContentCategory(
  value: unknown,
): ValidationResult<ContentCategory> {
  return parseContentCategory(value);
}

export function parseContentCategory(
  value: unknown,
): ValidationResult<ContentCategory> {
  const result = ContentCategorySchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateSourceGroup(
  value: unknown,
): ValidationResult<SourceGroup> {
  return parseSourceGroup(value);
}

export function parseSourceGroup(value: unknown): ValidationResult<SourceGroup> {
  const result = SourceGroupSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateTopComment(value: unknown): ValidationResult<TopComment> {
  return parseTopComment(value);
}

export function parseTopComment(value: unknown): ValidationResult<TopComment> {
  const result = TopCommentSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateContentItem(
  value: unknown,
): ValidationResult<ContentItem> {
  return parseContentItem(value);
}

export function parseContentItem(value: unknown): ValidationResult<ContentItem> {
  const result = ContentItemSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateCollectedContentInput(
  value: unknown,
): ValidationResult<CollectedContentInput> {
  return parseCollectedContentInput(value);
}

export function parseCollectedContentInput(
  value: unknown,
): ValidationResult<CollectedContentInput> {
  const result = CollectedContentInputSchema.safeParse(value);

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
