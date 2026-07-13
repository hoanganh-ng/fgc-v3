import type { FacebookPayloadCaptureDiagnostics } from "./collector-runtime.ports";
import {
  PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES,
  type ProfileHomeFeedDiagnosticFailureCode,
  type ProfileHomeFeedDiagnosticPageState,
  type ProfileHomeFeedDiagnosticSummary,
  type ProfileHomeFeedDiagnosticSummaryFailureStage,
  type ProfileHomeFeedDiagnosticWarningCode,
} from "../domain";
import type { FacebookHomeFeedExtractionWarning } from "../platform-extractors/facebook";
import { PROFILE_HOME_FEED_DIAGNOSTIC_SUMMARY_SCHEMA_VERSION } from "../domain/profile-home-feed-diagnostic-summary";

const KNOWN_WARNING_CODES = new Set<string>(
  PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES,
);

function isKnownWarningCode(code: string): code is ProfileHomeFeedDiagnosticWarningCode {
  return KNOWN_WARNING_CODES.has(code);
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= 0
  );
}

function sanitizeOptionalString(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

interface MutableCaptureCounters {
  pageContextFetchCaptureCount?: number;
  pageContextXhrCaptureCount?: number;
  networkListenerCaptureCount?: number;
  parseFailureCount?: number;
  totalPayloadsPassedToExtractor?: number;
}

interface MutableExtractorCounters {
  extractedCandidateCount?: number;
  deduplicatedCandidateCount?: number;
}

export interface MutableProfileHomeFeedDiagnosticSummary {
  capture?: MutableCaptureCounters;
  captureStage?:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "SUCCEEDED"
    | "CAPTURE_FAILED"
    | "INTERRUPTED";
  capturePageState?: ProfileHomeFeedDiagnosticPageState;
  captureLoginRedirectSuspected?: boolean;
  extractor?: MutableExtractorCounters;
  warningCounts: Map<ProfileHomeFeedDiagnosticWarningCode, number>;
  unsupportedPayloadCount?: number;
  runOutcome: {
    failureStage?: ProfileHomeFeedDiagnosticSummaryFailureStage;
    failureCode?: ProfileHomeFeedDiagnosticFailureCode;
  };
}

export function createEmptyDiagnosticSummary(): MutableProfileHomeFeedDiagnosticSummary {
  return {
    warningCounts: new Map(),
    runOutcome: {},
  };
}

export function recordCaptureAttempt(
  summary: MutableProfileHomeFeedDiagnosticSummary,
): void {
  summary.captureStage = "IN_PROGRESS";
}

export function recordCaptureSucceeded(
  summary: MutableProfileHomeFeedDiagnosticSummary,
  diagnostics: FacebookPayloadCaptureDiagnostics | undefined,
  payloadCount: number,
  pageState?: ProfileHomeFeedDiagnosticPageState,
): void {
  summary.captureStage = "SUCCEEDED";
  if (pageState !== undefined) {
    summary.capturePageState = pageState;
  } else if (summary.capturePageState === undefined) {
    summary.capturePageState = "HOME_FEED";
  }
  if (diagnostics === undefined) {
    return;
  }
  summary.capture = {
    pageContextFetchCaptureCount: diagnostics.pageContextFetchCaptureCount,
    pageContextXhrCaptureCount: diagnostics.pageContextXhrCaptureCount,
    networkListenerCaptureCount: diagnostics.networkListenerCaptureCount,
    parseFailureCount: diagnostics.parseFailureCount,
    totalPayloadsPassedToExtractor: payloadCount,
  };
  summary.captureLoginRedirectSuspected = diagnostics.loginRedirectSuspected;
}

export function recordCaptureFailed(
  summary: MutableProfileHomeFeedDiagnosticSummary,
  diagnostics: FacebookPayloadCaptureDiagnostics | undefined,
  failureCode: ProfileHomeFeedDiagnosticFailureCode,
  pageState?: ProfileHomeFeedDiagnosticPageState,
): void {
  summary.captureStage = "CAPTURE_FAILED";
  summary.runOutcome = { failureStage: "CAPTURE", failureCode };
  if (pageState !== undefined) {
    summary.capturePageState = pageState;
  } else if (summary.capturePageState === undefined) {
    summary.capturePageState = "OTHER";
  }
  if (diagnostics !== undefined) {
    summary.capture = {
      pageContextFetchCaptureCount: diagnostics.pageContextFetchCaptureCount,
      pageContextXhrCaptureCount: diagnostics.pageContextXhrCaptureCount,
      networkListenerCaptureCount: diagnostics.networkListenerCaptureCount,
      parseFailureCount: diagnostics.parseFailureCount,
      totalPayloadsPassedToExtractor: diagnostics.totalPayloadsPassedToExtractor,
    };
    summary.captureLoginRedirectSuspected = diagnostics.loginRedirectSuspected;
  }
}

export function recordCaptureInterrupted(
  summary: MutableProfileHomeFeedDiagnosticSummary,
  diagnostics: FacebookPayloadCaptureDiagnostics | undefined,
): void {
  summary.captureStage = "INTERRUPTED";
  summary.runOutcome = {
    failureStage: "INTERRUPTED",
    failureCode: "HOME_FEED_EXECUTION_INTERRUPTED",
  };
  if (summary.capturePageState === undefined) {
    summary.capturePageState = "OTHER";
  }
  if (diagnostics !== undefined) {
    summary.capture = {
      pageContextFetchCaptureCount: diagnostics.pageContextFetchCaptureCount,
      pageContextXhrCaptureCount: diagnostics.pageContextXhrCaptureCount,
      networkListenerCaptureCount: diagnostics.networkListenerCaptureCount,
      parseFailureCount: diagnostics.parseFailureCount,
      totalPayloadsPassedToExtractor: diagnostics.totalPayloadsPassedToExtractor,
    };
    summary.captureLoginRedirectSuspected = diagnostics.loginRedirectSuspected;
  }
}

export function recordExtractionResult(
  summary: MutableProfileHomeFeedDiagnosticSummary,
  input: {
    readonly extractedCount: number;
    readonly deduplicatedAfterCaptureCount: number;
    readonly warnings: readonly FacebookHomeFeedExtractionWarning[];
  },
): void {
  if (isNonNegativeInteger(input.extractedCount)) {
    summary.extractor = {
      ...(summary.extractor ?? {}),
      extractedCandidateCount:
        (summary.extractor?.extractedCandidateCount ?? 0) + input.extractedCount,
      deduplicatedCandidateCount:
        (summary.extractor?.deduplicatedCandidateCount ?? 0) +
        input.deduplicatedAfterCaptureCount,
    };
  }

  for (const warning of input.warnings) {
    const code = warning.code;
    if (!isKnownWarningCode(code)) {
      continue;
    }
    if (code === "UNSUPPORTED_PAYLOAD_SHAPE") {
      summary.unsupportedPayloadCount = (summary.unsupportedPayloadCount ?? 0) + 1;
    }
    summary.warningCounts.set(
      code,
      (summary.warningCounts.get(code) ?? 0) + 1,
    );
  }
}

export function recordFailureStage(
  summary: MutableProfileHomeFeedDiagnosticSummary,
  stage: ProfileHomeFeedDiagnosticSummaryFailureStage,
  code: ProfileHomeFeedDiagnosticFailureCode,
): void {
  summary.runOutcome = { failureStage: stage, failureCode: code };
}

export function finalizeDiagnosticSummary(
  summary: MutableProfileHomeFeedDiagnosticSummary,
): ProfileHomeFeedDiagnosticSummary {
  const capture =
    summary.capture === undefined
      ? undefined
      : {
          ...(isNonNegativeInteger(
            summary.capture.pageContextFetchCaptureCount,
          )
            ? {
                pageContextFetchCaptureCount:
                  summary.capture.pageContextFetchCaptureCount,
              }
            : {}),
          ...(isNonNegativeInteger(summary.capture.pageContextXhrCaptureCount)
            ? {
                pageContextXhrCaptureCount:
                  summary.capture.pageContextXhrCaptureCount,
              }
            : {}),
          ...(isNonNegativeInteger(summary.capture.networkListenerCaptureCount)
            ? {
                networkListenerCaptureCount:
                  summary.capture.networkListenerCaptureCount,
              }
            : {}),
          ...(isNonNegativeInteger(summary.capture.parseFailureCount)
            ? { parseFailureCount: summary.capture.parseFailureCount }
            : {}),
          ...(isNonNegativeInteger(
            summary.capture.totalPayloadsPassedToExtractor,
          )
            ? {
                totalPayloadsPassedToExtractor:
                  summary.capture.totalPayloadsPassedToExtractor,
              }
            : {}),
        };

  const extractor =
    summary.extractor === undefined
      ? undefined
      : {
          ...(isNonNegativeInteger(summary.extractor.extractedCandidateCount)
            ? {
                extractedCandidateCount:
                  summary.extractor.extractedCandidateCount,
              }
            : {}),
          ...(isNonNegativeInteger(
            summary.extractor.deduplicatedCandidateCount,
          )
            ? {
                deduplicatedCandidateCount:
                  summary.extractor.deduplicatedCandidateCount,
              }
            : {}),
        };

  const warningCounts: Partial<
    Record<ProfileHomeFeedDiagnosticWarningCode, number | undefined>
  > = {};
  for (const [code, value] of summary.warningCounts) {
    if (isNonNegativeInteger(value) && value > 0) {
      warningCounts[code] = value;
    }
  }

  const runOutcome: {
    failureStage?: ProfileHomeFeedDiagnosticSummaryFailureStage;
    failureCode?: ProfileHomeFeedDiagnosticFailureCode;
  } = {};
  if (summary.runOutcome.failureStage !== undefined) {
    runOutcome.failureStage = summary.runOutcome.failureStage;
  }
  if (summary.runOutcome.failureCode !== undefined) {
    runOutcome.failureCode = summary.runOutcome.failureCode;
  }

  const finalized: {
    schemaVersion: 1;
    capture?: typeof capture;
    captureStage?: MutableProfileHomeFeedDiagnosticSummary["captureStage"];
    capturePageState?:
      | MutableProfileHomeFeedDiagnosticSummary["capturePageState"]
      | undefined;
    captureLoginRedirectSuspected?: boolean;
    extractor?: typeof extractor;
    warningCounts?: typeof warningCounts;
    unsupportedPayloadCount?: number;
    runOutcome?: typeof runOutcome;
  } = {
    schemaVersion: PROFILE_HOME_FEED_DIAGNOSTIC_SUMMARY_SCHEMA_VERSION,
  };

  if (capture !== undefined && Object.keys(capture).length > 0) {
    finalized.capture = capture;
  }
  if (summary.captureStage !== undefined) {
    finalized.captureStage = summary.captureStage;
  }
  if (summary.capturePageState !== undefined) {
    finalized.capturePageState = summary.capturePageState;
  }
  if (typeof summary.captureLoginRedirectSuspected === "boolean") {
    finalized.captureLoginRedirectSuspected =
      summary.captureLoginRedirectSuspected;
  }
  if (extractor !== undefined && Object.keys(extractor).length > 0) {
    finalized.extractor = extractor;
  }
  if (Object.keys(warningCounts).length > 0) {
    finalized.warningCounts = warningCounts;
  }
  if (
    isNonNegativeInteger(summary.unsupportedPayloadCount) &&
    summary.unsupportedPayloadCount > 0
  ) {
    finalized.unsupportedPayloadCount = summary.unsupportedPayloadCount;
  }
  if (Object.keys(runOutcome).length > 0) {
    finalized.runOutcome = runOutcome;
  }

  return finalized as unknown as ProfileHomeFeedDiagnosticSummary;
}

/**
 * Map an arbitrary upstream capture-port error code to a safe
 * allowlisted diagnostic failure code. Unknown values fall back to
 * `HOME_FEED_CAPTURE_FAILED`; the original code is never copied
 * through into persistence, HTTP, UI, or operator logs.
 */
export function mapCaptureErrorCodeToFailureCode(
  upstreamErrorCode: string,
): ProfileHomeFeedDiagnosticFailureCode {
  switch (upstreamErrorCode) {
    case "LOGIN_REQUIRED":
      return "HOME_FEED_CAPTURE_AUTH_REQUIRED";
    case "CHECKPOINT_REQUIRED":
      return "HOME_FEED_CAPTURE_AUTH_REQUIRED";
    case "RUNTIME_PROFILE_CONFIGURATION_FAILED":
    case "RUNTIME_PROFILE_CONFIGURATION_MISMATCH":
    case "FACEBOOK_HOME_FEED_NAVIGATION_FAILED":
    case "FACEBOOK_BROWSER_CAPTURE_INTERRUPTED":
    case "HOME_FEED_CAPTURE_PORT_ERROR":
    default:
      return "HOME_FEED_CAPTURE_FAILED";
  }
}

/**
 * Map a page-state observation to an allowlisted diagnostic page
 * state. The original observation is never copied through into
 * persistence, HTTP, UI, or operator logs.
 */
export function mapToPageState(
  value: string | undefined,
): ProfileHomeFeedDiagnosticPageState {
  if (value === undefined) {
    return "OTHER";
  }
  const normalized = value.trim().toUpperCase();
  if (normalized === "HOME_FEED" || normalized === "NONE_DETECTED") {
    return "HOME_FEED";
  }
  if (normalized === "LOGIN" || normalized === "LOGIN_REQUIRED") {
    return "LOGIN";
  }
  if (
    normalized === "CHECKPOINT" ||
    normalized === "CHECKPOINT_REQUIRED"
  ) {
    return "CHECKPOINT";
  }
  return "OTHER";
}
