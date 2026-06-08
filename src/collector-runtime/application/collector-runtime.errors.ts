import type { ContentSubmissionResult } from "./collector-runtime.types";

export type CollectorRuntimeErrorCode =
  | "CONTENT_SUBMISSION_FAILED"
  | "FACEBOOK_PAYLOAD_CAPTURE_FAILED"
  | "FACEBOOK_PAYLOAD_EXTRACTION_FAILED"
  | "PROFILE_CHECKOUT_FAILED"
  | "PROFILE_LEASE_RELEASE_FAILED";

export interface CollectorRuntimeError {
  readonly code: CollectorRuntimeErrorCode;
  readonly message: string;
  readonly causeCode?: string;
  readonly payloadIndex?: number;
  readonly externalPostId?: string;
  readonly statusCode?: number;
  readonly path?: string;
}

export interface CollectorRuntimeErrorContext {
  readonly causeCode?: string;
  readonly payloadIndex?: number;
  readonly externalPostId?: string;
  readonly statusCode?: number;
  readonly path?: string;
}

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

export function createCollectorRuntimeError(
  code: CollectorRuntimeErrorCode,
  message: string,
  context: CollectorRuntimeErrorContext = {},
): CollectorRuntimeError {
  return {
    code,
    message,
    ...(context.causeCode !== undefined
      ? { causeCode: context.causeCode }
      : {}),
    ...(context.payloadIndex !== undefined
      ? { payloadIndex: context.payloadIndex }
      : {}),
    ...(context.externalPostId !== undefined
      ? { externalPostId: context.externalPostId }
      : {}),
    ...(context.statusCode !== undefined
      ? { statusCode: context.statusCode }
      : {}),
    ...(context.path !== undefined ? { path: context.path } : {}),
  };
}
