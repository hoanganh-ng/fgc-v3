import type { ZodIssue } from "zod";
import type { TransformType } from "./transform-type";
import { TransformTypeSchema } from "./transform-type.schemas";

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

export function validateTransformType(
  value: unknown,
): ValidationResult<TransformType> {
  const result = TransformTypeSchema.safeParse(value);

  if (!result.success) {
    return {
      valid: false,
      issues: formatZodIssues(result.error.issues),
    };
  }

  return {
    valid: true,
    value: {
      transformTypeId: result.data.transformTypeId,
      name: result.data.name,
      normalizedName: result.data.normalizedName,
      ...(result.data.description !== undefined
        ? { description: result.data.description }
        : {}),
      initialPrompt: result.data.initialPrompt,
      status: result.data.status,
      createdAt: result.data.createdAt,
      updatedAt: result.data.updatedAt,
    },
  };
}

function formatZodIssues(issues: readonly ZodIssue[]): readonly ValidationIssue[] {
  return issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}
