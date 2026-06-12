import { describe, expect, it } from "vitest";
import type {
  FacebookCollectorCommandResult,
  RunFacebookCollectorCommandInput,
} from "../facebook-collector/collector-runner";
import { FacebookCollectionRunExecutor } from "./facebook-collection-run-executor";

describe("FacebookCollectionRunExecutor", () => {
  it("executes the existing Facebook collector runner with run parameters", async () => {
    const calls: RunFacebookCollectorCommandInput[] = [];
    const executor = new FacebookCollectionRunExecutor({
      baseUrl: "http://localhost:8081",
      browserProvider: "cloakbrowser",
      runCommand: async (input) => {
        calls.push(input);

        return createCommandResult({
          ok: true,
          capturedGraphQLResponseCount: 2,
          extractedCandidateCount: 3,
          submittedContentItemCount: 3,
          failedSubmissionCount: 0,
          leaseReleased: true,
        });
      },
    });

    await expect(
      executor.execute({
        collectionRunId: "collection-run-1",
        sourceGroupId: "source-group-1",
        parameters: {
          maxScrolls: 7,
          maxDurationMs: 45_000,
        },
      }),
    ).resolves.toEqual({
      ok: true,
      summary: {
        capturedPayloads: 2,
        extractorCandidates: 3,
        contentItemsSubmitted: 3,
        failedSubmissions: 0,
        leaseReleased: true,
      },
    });
    expect(calls[0]?.args).toMatchObject({
      sourceGroupId: "source-group-1",
      baseUrl: "http://localhost:8081",
      browserProvider: "cloakbrowser",
      maxScrolls: 7,
      maxDurationMs: 45_000,
      diagnoseCheckout: false,
    });
  });

  it("returns sanitized failure reasons from failed collector results", async () => {
    const executor = new FacebookCollectionRunExecutor({
      baseUrl: "http://localhost:8081",
      browserProvider: "playwright",
      runCommand: async () =>
        createCommandResult({
          ok: false,
          leaseReleased: true,
          errors: [
            {
              code: "CONTENT_SUBMISSION_FAILED",
              message:
                "unsafe rawGraphQLPayload session-cookie-value proxy-password",
            },
          ],
        }),
    });

    const result = await executor.execute({
      collectionRunId: "collection-run-1",
      sourceGroupId: "source-group-1",
      parameters: {},
    });

    expect(result).toEqual({
      ok: false,
      summary: {
        capturedPayloads: 0,
        extractorCandidates: 0,
        contentItemsSubmitted: 0,
        failedSubmissions: 0,
        leaseReleased: true,
      },
      failureReason: {
        code: "CONTENT_SUBMISSION_FAILED",
        message: "Content submission failed.",
      },
    });
    expect(JSON.stringify(result)).not.toContain("rawGraphQLPayload");
    expect(JSON.stringify(result)).not.toContain("session-cookie-value");
    expect(JSON.stringify(result)).not.toContain("proxy-password");
  });
});

function createCommandResult(
  options: Partial<FacebookCollectorCommandResult> = {},
): FacebookCollectorCommandResult {
  return {
    ok: options.ok ?? true,
    sourceGroupId: options.sourceGroupId ?? "source-group-1",
    leaseReleased: options.leaseReleased ?? true,
    capturedGraphQLResponseCount: options.capturedGraphQLResponseCount ?? 0,
    pageContextFetchCaptureCount: options.pageContextFetchCaptureCount ?? 0,
    pageContextXhrCaptureCount: options.pageContextXhrCaptureCount ?? 0,
    networkListenerCaptureCount: options.networkListenerCaptureCount ?? 0,
    captureParseFailureCount: options.captureParseFailureCount ?? 0,
    totalPayloadsPassedToExtractor: options.totalPayloadsPassedToExtractor ?? 0,
    loginRedirectSuspected: options.loginRedirectSuspected ?? false,
    extractedCandidateCount: options.extractedCandidateCount ?? 0,
    submittedContentItemCount: options.submittedContentItemCount ?? 0,
    failedSubmissionCount: options.failedSubmissionCount ?? 0,
    warningCount: options.warningCount ?? 0,
    durationMs: options.durationMs ?? 10,
    errors: options.errors ?? [],
  };
}
