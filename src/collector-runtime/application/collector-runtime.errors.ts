import type { ContentSubmissionResult } from "./collector-runtime.types";

export function createSubmissionPortErrorResult(
  error: unknown,
): ContentSubmissionResult {
  return {
    ok: false,
    errorCode: "SUBMISSION_PORT_ERROR",
    errorMessage: errorToMessage(error),
  };
}

export function errorToMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return "Content submission failed for an unknown reason.";
}

