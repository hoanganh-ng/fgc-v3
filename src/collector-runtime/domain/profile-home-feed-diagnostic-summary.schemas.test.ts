import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  PROFILE_HOME_FEED_COLLECTION_RUN_CAPTURE_STAGES,
  PROFILE_HOME_FEED_COLLECTION_RUN_FAILURE_STAGES,
  PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES,
  ProfileHomeFeedDiagnosticSummaryCaptureStageSchema,
  ProfileHomeFeedDiagnosticSummaryFailureStageSchema,
  ProfileHomeFeedDiagnosticSummarySchema,
  ProfileHomeFeedDiagnosticSummaryWarningCodeSchema,
} from "./profile-home-feed-diagnostic-summary.schemas";

const base = {
  schemaVersion: 1 as const,
};

describe("ProfileHomeFeedDiagnosticSummarySchema", () => {
  it("accepts the minimum valid summary", () => {
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(base);
    expect(result.success).toBe(true);
  });

  it("accepts a fully populated safe summary", () => {
    const summary = {
      ...base,
      capture: {
        pageContextFetchCaptureCount: 2,
        pageContextXhrCaptureCount: 0,
        networkListenerCaptureCount: 1,
        parseFailureCount: 1,
        totalPayloadsPassedToExtractor: 3,
      },
      captureStage: "SUCCEEDED" as const,
      capturePageState: "HOME_FEED" as const,
      captureLoginRedirectSuspected: false,
      extractor: {
        extractedCandidateCount: 4,
        deduplicatedCandidateCount: 4,
      },
      warningCounts: {
        UNKNOWN_PUBLISHER_KIND: 2,
        MISSING_SOURCE_URL: 1,
      },
      unsupportedPayloadCount: 1,
      runOutcome: {
        failureStage: "CAPTURE" as const,
        failureCode: "HOME_FEED_CAPTURE_FAILED" as const,
      },
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(true);
  });

  it("rejects unknown warning codes", () => {
    const summary = {
      ...base,
      warningCounts: {
        NOT_A_REAL_CODE: 1,
      },
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects unknown warning keys in the strict histogram allowlist", () => {
    const summary = {
      ...base,
      warningCounts: {
        UNKNOWN_PUBLISHER_KIND: 1,
        NOT_AN_ALLOWLISTED_CODE: 2,
      },
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects non-integer warning counts", () => {
    const summary = {
      ...base,
      warningCounts: {
        MISSING_SOURCE_URL: 1.5,
      },
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects negative warning counts", () => {
    const summary = {
      ...base,
      warningCounts: {
        MISSING_SOURCE_URL: -1,
      },
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects unknown capture stages", () => {
    const summary = {
      ...base,
      captureStage: "MYSTERY",
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects unknown failure stages", () => {
    const summary = {
      ...base,
      runOutcome: {
        failureStage: "UNEXPECTED",
        failureCode: "X",
      },
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const summary = {
      ...base,
      secret: "x",
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects a non-positive counter", () => {
    const summary = {
      ...base,
      capture: {
        pageContextFetchCaptureCount: -1,
      },
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects non-integer counter", () => {
    const summary = {
      ...base,
      extractor: {
        extractedCandidateCount: 0.5,
      },
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });

  it("rejects empty failureCode", () => {
    const summary = {
      ...base,
      runOutcome: {
        failureCode: "   ",
      },
    };
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse(summary);
    expect(result.success).toBe(false);
  });
});

describe("warning-code enum", () => {
  it("contains the documented warning-code vocabulary", () => {
    expect(PROFILE_HOME_FEED_DIAGNOSTIC_WARNING_CODES).toEqual(
      expect.arrayContaining([
        "DUPLICATE_POST_CANDIDATE",
        "EXCLUDED_PERSONAL_PROFILE_POST",
        "EXCLUDED_SPONSORED_POST",
        "MISSING_OPTIONAL_AUTHOR",
        "MISSING_POSTED_AT",
        "MISSING_SOURCE_URL",
        "MISSING_STABLE_PUBLISHER_ID",
        "SKIPPED_CANDIDATE_WITHOUT_BODY_TEXT",
        "SKIPPED_CANDIDATE_WITHOUT_POST_ID",
        "SKIPPED_COMMENT_WITHOUT_BODY_TEXT",
        "SKIPPED_COMMENT_WITHOUT_ID",
        "UNKNOWN_PUBLISHER_KIND",
        "UNSUPPORTED_PAYLOAD_SHAPE",
      ]),
    );
  });

  it("exposes a Zod enum that rejects unknown codes", () => {
    const result = ProfileHomeFeedDiagnosticSummaryWarningCodeSchema.safeParse(
      "NOT_A_CODE",
    );
    expect(result.success).toBe(false);
  });
});

describe("capture stage enum", () => {
  it("contains the documented capture stages", () => {
    expect(PROFILE_HOME_FEED_COLLECTION_RUN_CAPTURE_STAGES).toEqual([
      "NOT_STARTED",
      "IN_PROGRESS",
      "SUCCEEDED",
      "CAPTURE_FAILED",
      "INTERRUPTED",
    ]);
  });

  it("exposes a Zod enum that rejects unknown stages", () => {
    const result =
      ProfileHomeFeedDiagnosticSummaryCaptureStageSchema.safeParse("MYSTERY");
    expect(result.success).toBe(false);
  });
});

describe("failure stage enum", () => {
  it("contains the documented failure stages", () => {
    expect(PROFILE_HOME_FEED_COLLECTION_RUN_FAILURE_STAGES).toEqual([
      "BOUNDS_EXCEEDED",
      "CHECKOUT",
      "CAPTURE",
      "PUBLISHER_OBSERVATION",
      "CONTENT_SUBMISSION",
      "LEASE_RELEASE",
      "PARTIAL",
      "INTERRUPTED",
      "EXECUTION",
    ]);
  });

  it("exposes a Zod enum that rejects unknown stages", () => {
    const result =
      ProfileHomeFeedDiagnosticSummaryFailureStageSchema.safeParse("OOPS");
    expect(result.success).toBe(false);
  });
});

describe("schema-version safety", () => {
  it("rejects an unsupported schema version", () => {
    const result = ProfileHomeFeedDiagnosticSummarySchema.safeParse({
      schemaVersion: 2,
    });
    expect(result.success).toBe(false);
  });

  it("still accepts the strict zod pass-through to a typed output", () => {
    const value: z.infer<typeof ProfileHomeFeedDiagnosticSummarySchema> = {
      schemaVersion: 1,
    };
    expect(value.schemaVersion).toBe(1);
  });
});
