import { describe, expect, it } from "vitest";
import {
  createEmptyDiagnosticSummary,
  finalizeDiagnosticSummary,
  recordCaptureAttempt,
  recordCaptureFailed,
  recordCaptureInterrupted,
  recordCaptureSucceeded,
  recordExtractionResult,
  recordFailureStage,
} from "./profile-home-feed-diagnostic-aggregator";
import type { FacebookPayloadCaptureDiagnostics } from "./collector-runtime.ports";

describe("profile-home-feed diagnostic aggregator", () => {
  it("builds a success-path summary from capture + extraction events", () => {
    const summary = createEmptyDiagnosticSummary();
    recordCaptureAttempt(summary);
    const captureDiagnostics: FacebookPayloadCaptureDiagnostics = {
      pageContextFetchCaptureCount: 2,
      pageContextXhrCaptureCount: 0,
      networkListenerCaptureCount: 1,
      parseFailureCount: 0,
      totalPayloadsPassedToExtractor: 3,
      finalPageUrl: "https://www.facebook.com/",
      loginRedirectSuspected: false,
    };
    recordCaptureSucceeded(summary, captureDiagnostics, 3);
    recordExtractionResult(summary, {
      extractedCount: 4,
      deduplicatedAfterCaptureCount: 4,
      warnings: [
        {
          code: "UNKNOWN_PUBLISHER_KIND",
          message: "Unknown publisher kind",
        },
        {
          code: "MISSING_SOURCE_URL",
          message: "Missing source URL",
        },
      ],
    });

    const finalized = finalizeDiagnosticSummary(summary);

    expect(finalized).toMatchObject({
      schemaVersion: 1,
      captureStage: "SUCCEEDED",
      capture: {
        pageContextFetchCaptureCount: 2,
        pageContextXhrCaptureCount: 0,
        networkListenerCaptureCount: 1,
        parseFailureCount: 0,
        totalPayloadsPassedToExtractor: 3,
      },
      capturePageState: "HOME_FEED",
      captureLoginRedirectSuspected: false,
      extractor: {
        extractedCandidateCount: 4,
        deduplicatedCandidateCount: 4,
      },
      warningCounts: {
        UNKNOWN_PUBLISHER_KIND: 1,
        MISSING_SOURCE_URL: 1,
      },
    });
    expect(finalized.runOutcome).toBeUndefined();
  });

  it("records a capture-failed path with sanitized finalPageUrl", () => {
    const summary = createEmptyDiagnosticSummary();
    recordCaptureFailed(
      summary,
      {
        pageContextFetchCaptureCount: 0,
        pageContextXhrCaptureCount: 0,
        networkListenerCaptureCount: 0,
        parseFailureCount: 4,
        totalPayloadsPassedToExtractor: 0,
        finalPageUrl: "https://www.facebook.com/login/?next=foo&secret=ABC",
        loginRedirectSuspected: true,
      },
      "HOME_FEED_CAPTURE_AUTH_REQUIRED",
      "LOGIN",
    );

    const finalized = finalizeDiagnosticSummary(summary);
    expect(finalized.captureStage).toBe("CAPTURE_FAILED");
    expect(finalized.captureLoginRedirectSuspected).toBe(true);
    expect(finalized.capturePageState).toBe("LOGIN");
    expect(finalized.runOutcome).toEqual({
      failureStage: "CAPTURE",
      failureCode: "HOME_FEED_CAPTURE_AUTH_REQUIRED",
    });
  });

  it("records an interrupted capture path", () => {
    const summary = createEmptyDiagnosticSummary();
    recordCaptureInterrupted(summary, {
      pageContextFetchCaptureCount: 0,
      pageContextXhrCaptureCount: 0,
      networkListenerCaptureCount: 0,
      parseFailureCount: 0,
      totalPayloadsPassedToExtractor: 0,
      loginRedirectSuspected: false,
    });

    const finalized = finalizeDiagnosticSummary(summary);
    expect(finalized.captureStage).toBe("INTERRUPTED");
    expect(finalized.runOutcome).toEqual({
      failureStage: "INTERRUPTED",
      failureCode: "HOME_FEED_EXECUTION_INTERRUPTED",
    });
  });

  it("aggregates unknown warning codes by ignoring them", () => {
    const summary = createEmptyDiagnosticSummary();
    recordCaptureAttempt(summary);
    recordCaptureSucceeded(summary, undefined, 0);
    recordExtractionResult(summary, {
      extractedCount: 0,
      deduplicatedAfterCaptureCount: 0,
      warnings: [
        { code: "UNKNOWN_PUBLISHER_KIND", message: "x" },
        { code: "EXCLUDED_SPONSORED_POST", message: "x" },
      ],
    });

    const finalized = finalizeDiagnosticSummary(summary);
    expect(finalized.warningCounts).toEqual({
      UNKNOWN_PUBLISHER_KIND: 1,
      EXCLUDED_SPONSORED_POST: 1,
    });
  });

  it("ignores UNSUPPORTED_PAYLOAD_SHAPE when extractor reports zero candidates", () => {
    const summary = createEmptyDiagnosticSummary();
    recordCaptureAttempt(summary);
    recordCaptureSucceeded(summary, undefined, 0);
    recordExtractionResult(summary, {
      extractedCount: 0,
      deduplicatedAfterCaptureCount: 0,
      warnings: [
        { code: "UNSUPPORTED_PAYLOAD_SHAPE", message: "shape" },
      ],
    });

    const finalized = finalizeDiagnosticSummary(summary);
    expect(finalized.unsupportedPayloadCount).toBe(1);
  });

  it("preserves partial diagnostics on a later recordFailureStage call", () => {
    const summary = createEmptyDiagnosticSummary();
    recordCaptureAttempt(summary);
    recordCaptureSucceeded(summary, undefined, 2);
    recordFailureStage(summary, "PARTIAL", "HOME_FEED_EXECUTION_PARTIAL_FAILURE");

    const finalized = finalizeDiagnosticSummary(summary);
    expect(finalized.captureStage).toBe("SUCCEEDED");
    expect(finalized.runOutcome).toEqual({
      failureStage: "PARTIAL",
      failureCode: "HOME_FEED_EXECUTION_PARTIAL_FAILURE",
    });
  });

  it("produces an empty summary when no events were recorded", () => {
    const finalized = finalizeDiagnosticSummary(createEmptyDiagnosticSummary());
    expect(finalized).toEqual({ schemaVersion: 1 });
  });
});
