import type { FacebookPayloadCaptureDiagnostics } from "./collector-runtime.ports";
import {
  PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES,
  type ProfileHomeFeedDiagnosticSummary,
  type ProfileHomeFeedDiagnosticSummaryFailureStage,
  type ProfileHomeFeedDiagnosticWarningCode,
} from "../domain";
import type { FacebookHomeFeedExtractionWarning } from "../platform-extractors/facebook";
import { PROFILE_HOME_FEED_DIAGNOSTIC_SUMMARY_SCHEMA_VERSION } from "../domain/profile-home-feed-diagnostic-summary";

const NonNegativeIntegerSchemaPattern = /^\d+$/u;

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

function sanitizeSanitizedUrl(value: string | undefined): string | undefined {
  const trimmed = sanitizeOptionalString(value);
  if (trimmed === undefined) {
    return undefined;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return `${parsed.origin}${parsed.pathname}`;
    }
    if (parsed.protocol === "about:") {
      return `${parsed.protocol}${parsed.pathname}`;
    }
    return undefined;
  } catch {
    return undefined;
  }
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
  captureFinalPageUrl?: string;
  captureLoginRedirectSuspected?: boolean;
  extractor?: MutableExtractorCounters;
  warningCounts: Map<ProfileHomeFeedDiagnosticWarningCode, number>;
  unsupportedPayloadCount?: number;
  runOutcome: {
    failureStage?: ProfileHomeFeedDiagnosticSummaryFailureStage;
    failureCode?: string;
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
): void {
  summary.captureStage = "SUCCEEDED";
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
  const sanitized = sanitizeSanitizedUrl(diagnostics.finalPageUrl);
  if (sanitized !== undefined) {
    summary.captureFinalPageUrl = sanitized;
  }
}

export function recordCaptureFailed(
  summary: MutableProfileHomeFeedDiagnosticSummary,
  diagnostics: FacebookPayloadCaptureDiagnostics | undefined,
  errorCode: string,
): void {
  summary.captureStage = "CAPTURE_FAILED";
  summary.runOutcome = {
    failureStage: "CAPTURE",
    failureCode: errorCode,
  };
  if (diagnostics !== undefined) {
    summary.capture = {
      pageContextFetchCaptureCount: diagnostics.pageContextFetchCaptureCount,
      pageContextXhrCaptureCount: diagnostics.pageContextXhrCaptureCount,
      networkListenerCaptureCount: diagnostics.networkListenerCaptureCount,
      parseFailureCount: diagnostics.parseFailureCount,
      totalPayloadsPassedToExtractor: diagnostics.totalPayloadsPassedToExtractor,
    };
    summary.captureLoginRedirectSuspected = diagnostics.loginRedirectSuspected;
    const sanitized = sanitizeSanitizedUrl(diagnostics.finalPageUrl);
    if (sanitized !== undefined) {
      summary.captureFinalPageUrl = sanitized;
    }
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
  if (diagnostics !== undefined) {
    summary.capture = {
      pageContextFetchCaptureCount: diagnostics.pageContextFetchCaptureCount,
      pageContextXhrCaptureCount: diagnostics.pageContextXhrCaptureCount,
      networkListenerCaptureCount: diagnostics.networkListenerCaptureCount,
      parseFailureCount: diagnostics.parseFailureCount,
      totalPayloadsPassedToExtractor: diagnostics.totalPayloadsPassedToExtractor,
    };
    summary.captureLoginRedirectSuspected = diagnostics.loginRedirectSuspected;
    const sanitized = sanitizeSanitizedUrl(diagnostics.finalPageUrl);
    if (sanitized !== undefined) {
      summary.captureFinalPageUrl = sanitized;
    }
  }
}

export function recordExtractionResult(
  summary: MutableProfileHomeFeedDiagnosticSummary,
  input: {
    readonly acceptedCount: number;
    readonly deduplicatedAfterCaptureCount: number;
    readonly warnings: readonly FacebookHomeFeedExtractionWarning[];
  },
): void {
  if (isNonNegativeInteger(input.acceptedCount)) {
    summary.extractor = {
      ...(summary.extractor ?? {}),
      extractedCandidateCount:
        (summary.extractor?.extractedCandidateCount ?? 0) + input.acceptedCount,
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
  code: string,
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
    Record<ProfileHomeFeedDiagnosticWarningCode, number>
  > = {};
  for (const [code, value] of summary.warningCounts) {
    if (isNonNegativeInteger(value)) {
      warningCounts[code] = value;
    }
  }

  const runOutcome: { failureStage?: string; failureCode?: string } = {};
  if (summary.runOutcome.failureStage !== undefined) {
    runOutcome.failureStage = summary.runOutcome.failureStage;
  }
  const failureCode = sanitizeOptionalString(summary.runOutcome.failureCode);
  if (failureCode !== undefined) {
    runOutcome.failureCode = failureCode;
  }

  const finalized: {
    schemaVersion: 1;
    capture?: typeof capture;
    captureStage?: MutableProfileHomeFeedDiagnosticSummary["captureStage"];
    captureFinalPageUrl?: string;
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
  const sanitizedUrl = sanitizeSanitizedUrl(summary.captureFinalPageUrl);
  if (sanitizedUrl !== undefined) {
    finalized.captureFinalPageUrl = sanitizedUrl;
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
  if (isNonNegativeInteger(summary.unsupportedPayloadCount) && summary.unsupportedPayloadCount > 0) {
    finalized.unsupportedPayloadCount = summary.unsupportedPayloadCount;
  }
  if (Object.keys(runOutcome).length > 0) {
    finalized.runOutcome = runOutcome;
  }

  return finalized as unknown as ProfileHomeFeedDiagnosticSummary;
}
