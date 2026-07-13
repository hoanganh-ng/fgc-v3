import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import type {
  ProfileHomeFeedCollectionRun,
  ProfileHomeFeedCollectionRunSummary,
} from "../../collector-runtime/domain";
import { createHttpServer } from "./server";
import { createFakeCollectorRuntimeHttpService } from "./test-support/collector-runtime-http-service";
import { createUnusedCollectorProfileManagerHttpService } from "./test-support/collector-profile-manager-http-service";
import { createFakeContentManagerHttpService } from "./test-support/content-manager-http-service";
import { FakeSourceGroupReferencePort } from "./test-support/source-group-reference-port";
import { createUnusedContentBuilderHttpService } from "./test-support/content-builder-http-service";

const createdAt = "2026-04-01T09:00:00.000Z";
const startedAt = "2026-04-01T10:00:00.000Z";
const finishedAt = "2026-04-01T10:05:00.000Z";

function createRunWithDiagnostics(
  diagnostics: ProfileHomeFeedCollectionRun["diagnostics"],
  summary?: ProfileHomeFeedCollectionRunSummary,
): ProfileHomeFeedCollectionRun {
  return {
    id: "run-diagnostics-1",
    profileId: "profile-1",
    triggerType: "MANUAL_API",
    status: "SUCCEEDED",
    accountStageAtRequest: "COLLECTION_READY",
    target: { platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" },
    parameters: { maxScrolls: 3, maxDurationMs: 30_000, maxPosts: 20 },
    ...(summary !== undefined ? { summary } : {}),
    ...(diagnostics !== undefined ? { diagnostics } : {}),
    requestedAt: createdAt,
    startedAt,
    finishedAt,
    createdAt,
    updatedAt: finishedAt,
  };
}

describe("profile home-feed collection run diagnostics HTTP", () => {
  let server: FastifyInstance;
  let service: ReturnType<typeof createFakeCollectorRuntimeHttpService>;

  beforeEach(() => {
    service = createFakeCollectorRuntimeHttpService();
    server = createHttpServer({
      collectorProfileManager: createUnusedCollectorProfileManagerHttpService(),
      collectorRuntime: service,
      contentManager: createFakeContentManagerHttpService(),
      sourceGroupReferences: new FakeSourceGroupReferencePort(),
      contentBuilder: createUnusedContentBuilderHttpService(),
    });
  });

  afterEach(async () => {
    await server.close();
  });

  it("returns diagnostics when present on a SUCCEEDED run", async () => {
    service.getProfileHomeFeedCollectionRun.setOutput(
      createRunWithDiagnostics(
        {
          schemaVersion: 1,
          capture: {
            pageContextFetchCaptureCount: 0,
            pageContextXhrCaptureCount: 0,
            networkListenerCaptureCount: 5,
            parseFailureCount: 1,
            totalPayloadsPassedToExtractor: 3,
          },
          captureStage: "SUCCEEDED",
          capturePageState: "HOME_FEED",
          captureLoginRedirectSuspected: false,
          extractor: {
            extractedCandidateCount: 3,
            deduplicatedCandidateCount: 3,
          },
          warningCounts: {
            UNKNOWN_PUBLISHER_KIND: 2,
            MISSING_SOURCE_URL: 1,
          },
          unsupportedPayloadCount: 1,
        },
        {
          capturedPayloads: 3,
          extractorCandidates: 3,
          sourcePublishersObserved: 1,
          contentItemsSubmitted: 1,
          failedPublisherObservations: 0,
          failedContentSubmissions: 0,
          leaseReleased: true,
        },
      ),
    );

    const response = await server.inject({
      method: "GET",
      url: "/collector/profile-home-feed-collection-runs/run-diagnostics-1",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.profileHomeFeedCollectionRun.diagnostics).toEqual({
      schemaVersion: 1,
      capture: {
        pageContextFetchCaptureCount: 0,
        pageContextXhrCaptureCount: 0,
        networkListenerCaptureCount: 5,
        parseFailureCount: 1,
        totalPayloadsPassedToExtractor: 3,
      },
      captureStage: "SUCCEEDED",
      capturePageState: "HOME_FEED",
      captureLoginRedirectSuspected: false,
      extractor: {
        extractedCandidateCount: 3,
        deduplicatedCandidateCount: 3,
      },
      warningCounts: {
        UNKNOWN_PUBLISHER_KIND: 2,
        MISSING_SOURCE_URL: 1,
      },
      unsupportedPayloadCount: 1,
    });
  });

  it("omits diagnostics for older runs that never recorded them", async () => {
    service.getProfileHomeFeedCollectionRun.setOutput(
      createRunWithDiagnostics(undefined, {
        capturedPayloads: 4,
        extractorCandidates: 0,
        sourcePublishersObserved: 0,
        contentItemsSubmitted: 0,
        failedPublisherObservations: 0,
        failedContentSubmissions: 0,
        leaseReleased: true,
      }),
    );

    const response = await server.inject({
      method: "GET",
      url: "/collector/profile-home-feed-collection-runs/run-diagnostics-1",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.profileHomeFeedCollectionRun.diagnostics).toBeUndefined();
  });

  it("returns diagnostics on the list endpoint when present", async () => {
    service.listProfileHomeFeedCollectionRuns.setOutput({
      items: [
        createRunWithDiagnostics(
          {
            schemaVersion: 1,
            captureStage: "SUCCEEDED",
            warningCounts: { UNKNOWN_PUBLISHER_KIND: 1 },
            runOutcome: {
              failureStage: "PARTIAL",
              failureCode: "HOME_FEED_EXECUTION_PARTIAL_FAILURE",
            },
          },
          {
            capturedPayloads: 2,
            extractorCandidates: 1,
            sourcePublishersObserved: 0,
            contentItemsSubmitted: 0,
            failedPublisherObservations: 1,
            failedContentSubmissions: 1,
            leaseReleased: true,
          },
        ),
      ],
      page: { limit: 50, offset: 0, total: 1 },
    });

    const response = await server.inject({
      method: "GET",
      url: "/collector/profile-home-feed-collection-runs",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].diagnostics.warningCounts).toEqual({
      UNKNOWN_PUBLISHER_KIND: 1,
    });
    expect(body.items[0].diagnostics.runOutcome).toEqual({
      failureStage: "PARTIAL",
      failureCode: "HOME_FEED_EXECUTION_PARTIAL_FAILURE",
    });
  });
});
