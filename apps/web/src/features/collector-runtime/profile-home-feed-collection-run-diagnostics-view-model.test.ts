import { describe, expect, it } from "vitest";
import {
  formatProfileHomeFeedDiagnosticWarningCode,
  getProfileHomeFeedDiagnosticCaptureCounters,
  getProfileHomeFeedDiagnosticCaptureStageLabel,
  getProfileHomeFeedDiagnosticExtractorCounters,
  getProfileHomeFeedDiagnosticFailureStageLabel,
  getProfileHomeFeedDiagnosticWarningRows,
  hasProfileHomeFeedDiagnosticData,
} from "./profile-home-feed-collection-run-view-model";
import type { ProfileHomeFeedDiagnosticSummary } from "@/lib/api/collector-runtime-client";

const base: ProfileHomeFeedDiagnosticSummary = {
  schemaVersion: 1,
};

describe("profile home-feed diagnostics view model", () => {
  it("returns no rows and no data for an empty summary", () => {
    expect(hasProfileHomeFeedDiagnosticData(base)).toBe(false);
    expect(getProfileHomeFeedDiagnosticCaptureCounters(base)).toEqual([]);
    expect(getProfileHomeFeedDiagnosticExtractorCounters(base)).toEqual([]);
    expect(getProfileHomeFeedDiagnosticWarningRows(base)).toEqual([]);
  });

  it("extracts capture counters in stable order", () => {
    const summary: ProfileHomeFeedDiagnosticSummary = {
      ...base,
      capture: {
        pageContextFetchCaptureCount: 2,
        pageContextXhrCaptureCount: 0,
        networkListenerCaptureCount: 1,
        parseFailureCount: 3,
        totalPayloadsPassedToExtractor: 5,
      },
    };
    const rows = getProfileHomeFeedDiagnosticCaptureCounters(summary);
    expect(rows.map((r) => r.label)).toEqual([
      "Page context fetch captures",
      "Page context XHR captures",
      "Network listener captures",
      "Capture parse failures",
      "Payloads passed to extractor",
    ]);
  });

  it("extracts extractor counters when present", () => {
    const summary: ProfileHomeFeedDiagnosticSummary = {
      ...base,
      extractor: {
        extractedCandidateCount: 7,
        deduplicatedCandidateCount: 6,
      },
    };
    const rows = getProfileHomeFeedDiagnosticExtractorCounters(summary);
    expect(rows).toEqual([
      { label: "Extracted candidates", value: "7" },
      { label: "After extractor dedup", value: "6" },
    ]);
  });

  it("orders warning rows by count descending and ignores zero counts", () => {
    const summary: ProfileHomeFeedDiagnosticSummary = {
      ...base,
      warningCounts: {
        UNKNOWN_PUBLISHER_KIND: 5,
        MISSING_SOURCE_URL: 1,
        EXCLUDED_SPONSORED_POST: 0,
      },
    };
    const rows = getProfileHomeFeedDiagnosticWarningRows(summary);
    expect(rows.map((r) => `${r.code}=${r.count}`)).toEqual([
      "UNKNOWN_PUBLISHER_KIND=5",
      "MISSING_SOURCE_URL=1",
    ]);
  });

  it("exposes readable labels for warning codes, capture stages, and failure stages", () => {
    expect(formatProfileHomeFeedDiagnosticWarningCode("MISSING_SOURCE_URL")).toBe(
      "Missing source URL",
    );
    expect(getProfileHomeFeedDiagnosticCaptureStageLabel("CAPTURE_FAILED")).toBe(
      "Capture failed",
    );
    expect(getProfileHomeFeedDiagnosticFailureStageLabel("PARTIAL")).toBe(
      "Partial completion",
    );
  });

  it("detects that a summary has data when any block is populated", () => {
    expect(
      hasProfileHomeFeedDiagnosticData({
        ...base,
        captureStage: "SUCCEEDED",
      }),
    ).toBe(true);
    expect(
      hasProfileHomeFeedDiagnosticData({
        ...base,
        runOutcome: { failureStage: "CAPTURE" },
      }),
    ).toBe(true);
  });
});
