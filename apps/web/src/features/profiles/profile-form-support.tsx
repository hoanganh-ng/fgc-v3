import type { ReactNode } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { z } from "zod";
import { AlertTriangle } from "lucide-react";
import { isApiResultError, type ApiResultError } from "@/lib/api/http-client";
import { cn } from "@/lib/cn";

export interface FormFieldProps {
  readonly label: string;
  readonly htmlFor?: string;
  readonly error?: string | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}

export function FormField({
  label,
  htmlFor,
  error,
  className,
  children,
}: FormFieldProps): JSX.Element {
  return (
    <div className={cn("min-w-0 space-y-2", className)}>
      <label
        className="block text-sm font-medium text-foreground"
        htmlFor={htmlFor}
      >
        {label}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  );
}

export function FieldError({
  message,
}: {
  readonly message?: string | undefined;
}): JSX.Element | null {
  if (message === undefined || message.length === 0) {
    return null;
  }

  return <p className="text-sm leading-5 text-[#b93535]">{message}</p>;
}

export function BackendErrorPanel({
  error,
  fallbackMessage,
}: {
  readonly error: unknown;
  readonly fallbackMessage: string;
}): JSX.Element | null {
  if (error === null || error === undefined) {
    return null;
  }

  const apiError = isApiResultError(error) ? error : undefined;
  const issues = apiError?.error.kind === "http" ? apiError.error.issues : undefined;
  const message = apiError?.message ?? fallbackMessage;

  return (
    <div
      className="rounded border border-[#e4a0a0] bg-[#fff5f5] px-4 py-3 text-sm text-[#7f1d1d]"
      role="alert"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold">{message}</p>
          {issues !== undefined && issues.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {issues.map((issue) => (
                <li key={`${issue.path}:${issue.message}`}>
                  <span className="font-medium">{issue.path || "body"}:</span>{" "}
                  {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function applyZodFieldErrors<TFieldValues extends FieldValues>(
  error: z.ZodError,
  setError: UseFormSetError<TFieldValues>,
): string | undefined {
  let summary: string | undefined;

  for (const issue of error.issues) {
    if (issue.path.length === 0) {
      summary = issue.message;
      continue;
    }

    setError(issue.path.join(".") as Path<TFieldValues>, {
      type: "zod",
      message: issue.message,
    });
  }

  return summary;
}

export function getErrorMessage(error: unknown): string {
  return typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
    ? error.message
    : "";
}
