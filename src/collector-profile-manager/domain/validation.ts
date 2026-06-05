import type { ZodIssue } from "zod";
import { getMissingRequiredProfileConfiguration } from "./profile";
import type { CollectorProfile } from "./profile";
import type { ProfileLease } from "./profile-lease";
import { CollectorProfileSchema, ProfileLeaseSchema } from "./profile.schemas";

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

export function validateCollectorProfile(
  value: unknown,
): ValidationResult<CollectorProfile> {
  return parseCollectorProfile(value);
}

export function parseCollectorProfile(
  value: unknown,
): ValidationResult<CollectorProfile> {
  const result = CollectorProfileSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateProfileLease(value: unknown): ValidationResult<ProfileLease> {
  const result = ProfileLeaseSchema.safeParse(value);

  if (!result.success) {
    return invalid(formatZodIssues(result.error.issues));
  }

  return {
    valid: true,
    value: result.data,
  };
}

export function validateRequiredProfileConfiguration(
  profile: CollectorProfile,
): ValidationResult<CollectorProfile> {
  const missingFields = getMissingRequiredProfileConfiguration(profile);

  if (missingFields.length === 0) {
    return {
      valid: true,
      value: profile,
    };
  }

  return invalid(
    missingFields.map((path) => ({
      path,
      message: "Required before profile can enter PENDING_LOGIN.",
    })),
  );
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
