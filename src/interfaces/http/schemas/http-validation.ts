import { z } from "zod";

export interface HttpValidationIssue {
  readonly path: string;
  readonly message: string;
}

export class HttpRequestValidationError extends Error {
  public readonly issues: readonly HttpValidationIssue[];

  public constructor(issues: readonly HttpValidationIssue[]) {
    super("HTTP request validation failed.");
    this.name = "HttpRequestValidationError";
    this.issues = issues;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function parseHttpInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new HttpRequestValidationError(
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message,
      })),
    );
  }

  return result.data;
}
