import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import {
  InvalidProfileHomeFeedCollectionRunStatusTransitionError,
  ProfileHomeFeedCollectionRunConflictError,
  ProfileHomeFeedCollectionRunNotFoundError,
  ProfileNotFoundError,
} from "../../collector-runtime/application";
import { createHttpServer } from "./server";
import {
  createFakeCollectorRuntimeHttpService,
  createProfileHomeFeedCollectionRun,
} from "./test-support/collector-runtime-http-service";
import { createUnusedCollectorProfileManagerHttpService } from "./test-support/collector-profile-manager-http-service";
import { createFakeContentManagerHttpService } from "./test-support/content-manager-http-service";
import { FakeSourceGroupReferencePort } from "./test-support/source-group-reference-port";

describe("ProfileHomeFeedCollectionRun HTTP routes", () => {
  it("requests, lists, gets, and cancels profile home-feed collection runs through safe DTOs", async () => {
    const { server, service } = createTestServer();
    service.requestProfileHomeFeedCollectionRun.setOutput(
      createProfileHomeFeedCollectionRun({
        id: "run-1",
        profileId: "profile-1",
      }),
    );
    service.listProfileHomeFeedCollectionRuns.setOutput({
      items: [
        createProfileHomeFeedCollectionRun({
          id: "run-2",
          status: "RUNNING",
          startedAt: "2026-04-01T10:00:00.000Z",
        }),
      ],
      page: {
        limit: 10,
        offset: 5,
        total: 1,
      },
    });
    service.getProfileHomeFeedCollectionRun.setOutput(
      createProfileHomeFeedCollectionRun({
        id: "run-2",
        status: "SUCCEEDED",
        startedAt: "2026-04-01T10:00:00.000Z",
        finishedAt: "2026-04-01T10:05:00.000Z",
        summary: {
          capturedPayloads: 4,
          extractorCandidates: 3,
          sourcePublishersObserved: 2,
          contentItemsSubmitted: 1,
          failedPublisherObservations: 0,
          failedContentSubmissions: 0,
          leaseReleased: true,
        },
      }),
    );
    service.cancelProfileHomeFeedCollectionRun.setOutput(
      createProfileHomeFeedCollectionRun({
        id: "run-1",
        status: "CANCELED",
        finishedAt: "2026-04-01T10:00:00.000Z",
      }),
    );

    try {
      const requestResponse = await server.inject({
        method: "POST",
        url: "/collector/profile-home-feed-collection-runs",
        payload: {
          profileId: "profile-1",
          maxScrolls: 3,
          maxDurationMs: 30_000,
          maxPosts: 10,
        },
      });
      const listResponse = await server.inject({
        method: "GET",
        url: "/collector/profile-home-feed-collection-runs?status=RUNNING&profileId=profile-1&limit=10&offset=5",
      });
      const getResponse = await server.inject({
        method: "GET",
        url: "/collector/profile-home-feed-collection-runs/run-2",
      });
      const cancelResponse = await server.inject({
        method: "POST",
        url: "/collector/profile-home-feed-collection-runs/run-1/cancel",
      });

      expect(requestResponse.statusCode).toBe(201);
      expect(listResponse.statusCode).toBe(200);
      expect(getResponse.statusCode).toBe(200);
      expect(cancelResponse.statusCode).toBe(200);
      expect(service.requestProfileHomeFeedCollectionRun.calls).toEqual([
        {
          profileId: "profile-1",
          maxScrolls: 3,
          maxDurationMs: 30_000,
          maxPosts: 10,
        },
      ]);
      expect(service.listProfileHomeFeedCollectionRuns.calls).toEqual([
        {
          status: "RUNNING",
          profileId: "profile-1",
          limit: 10,
          offset: 5,
        },
      ]);
      expect(service.getProfileHomeFeedCollectionRun.calls).toEqual([
        {
          runId: "run-2",
        },
      ]);
      expect(service.cancelProfileHomeFeedCollectionRun.calls).toEqual([
        {
          runId: "run-1",
        },
      ]);
      expect(requestResponse.json()).toMatchObject({
        profileHomeFeedCollectionRun: {
          id: "run-1",
          profileId: "profile-1",
          triggerType: "MANUAL_API",
          status: "QUEUED",
          accountStageAtRequest: "WARMING",
          target: {
            platform: "FACEBOOK",
            surface: "PROFILE_HOME_FEED",
          },
          parameters: {
            maxScrolls: 3,
            maxDurationMs: 30_000,
            maxPosts: 10,
          },
        },
      });
      expect(listResponse.json()).toMatchObject({
        items: [{ id: "run-2", profileId: "profile-1", status: "RUNNING" }],
        page: { limit: 10, offset: 5, total: 1 },
      });
      expect(getResponse.json()).toMatchObject({
        profileHomeFeedCollectionRun: {
          id: "run-2",
          status: "SUCCEEDED",
          summary: {
            capturedPayloads: 4,
            failedContentSubmissions: 0,
            leaseReleased: true,
          },
        },
      });
      expect(JSON.stringify(getResponse.json())).not.toContain("postsSeen");
      expect(JSON.stringify(getResponse.json())).not.toContain(
        "failedSubmissions",
      );
      expect(cancelResponse.json()).toMatchObject({
        profileHomeFeedCollectionRun: { id: "run-1", status: "CANCELED" },
      });
      expectProfileHomeFeedCollectionRunPayloadIsSafe(requestResponse.json());
      expectProfileHomeFeedCollectionRunPayloadIsSafe(listResponse.json());
      expectProfileHomeFeedCollectionRunPayloadIsSafe(getResponse.json());
      expectProfileHomeFeedCollectionRunPayloadIsSafe(cancelResponse.json());
    } finally {
      await server.close();
    }
  });

  it("returns 400 for invalid request bodies before invoking the service", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profile-home-feed-collection-runs",
        payload: {
          profileId: "",
          maxScrolls: -1,
          maxDurationMs: 0,
          maxPosts: 0,
          extra: "not allowed",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
      expect(service.requestProfileHomeFeedCollectionRun.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("maps profile home-feed collection run errors to safe HTTP responses", async () => {
    const { server, service } = createTestServer();
    service.requestProfileHomeFeedCollectionRun.setError(
      new ProfileNotFoundError("profile-1"),
    );
    service.getProfileHomeFeedCollectionRun.setError(
      new ProfileHomeFeedCollectionRunNotFoundError("missing-run"),
    );
    service.cancelProfileHomeFeedCollectionRun.setError(
      new InvalidProfileHomeFeedCollectionRunStatusTransitionError(
        "RUNNING",
        "CANCELED",
      ),
    );

    try {
      const profileNotFoundResponse = await server.inject({
        method: "POST",
        url: "/collector/profile-home-feed-collection-runs",
        payload: {
          profileId: "profile-1",
        },
      });
      service.requestProfileHomeFeedCollectionRun.setError(
        new ProfileHomeFeedCollectionRunConflictError("profile-1"),
      );
      const conflictResponse = await server.inject({
        method: "POST",
        url: "/collector/profile-home-feed-collection-runs",
        payload: {
          profileId: "profile-1",
        },
      });
      const missingResponse = await server.inject({
        method: "GET",
        url: "/collector/profile-home-feed-collection-runs/missing-run",
      });
      const invalidCancelResponse = await server.inject({
        method: "POST",
        url: "/collector/profile-home-feed-collection-runs/run-1/cancel",
      });

      expect(profileNotFoundResponse.statusCode).toBe(404);
      expect(profileNotFoundResponse.json().error.code).toBe(
        "PROFILE_NOT_FOUND",
      );
      expect(conflictResponse.statusCode).toBe(409);
      expect(conflictResponse.json().error.code).toBe(
        "PROFILE_HOME_FEED_COLLECTION_RUN_CONFLICT",
      );
      expect(missingResponse.statusCode).toBe(404);
      expect(missingResponse.json().error.code).toBe(
        "PROFILE_HOME_FEED_COLLECTION_RUN_NOT_FOUND",
      );
      expect(invalidCancelResponse.statusCode).toBe(409);
      expect(invalidCancelResponse.json().error.code).toBe(
        "INVALID_PROFILE_HOME_FEED_COLLECTION_RUN_STATUS_TRANSITION",
      );
    } finally {
      await server.close();
    }
  });

  it("does not expose internal claim, succeed, or fail routes", async () => {
    const { server } = createTestServer();

    try {
      const claimResponse = await server.inject({
        method: "POST",
        url: "/collector/profile-home-feed-collection-runs/claim-next",
      });
      const succeedResponse = await server.inject({
        method: "POST",
        url: "/collector/profile-home-feed-collection-runs/run-1/succeed",
      });
      const failResponse = await server.inject({
        method: "POST",
        url: "/collector/profile-home-feed-collection-runs/run-1/fail",
        payload: {
          failureReason: {
            code: "FAILED",
            message: "failed",
          },
        },
      });

      expect(claimResponse.statusCode).toBe(404);
      expect(succeedResponse.statusCode).toBe(404);
      expect(failResponse.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });
});

function createTestServer(): {
  readonly server: FastifyInstance;
  readonly service: ReturnType<typeof createFakeCollectorRuntimeHttpService>;
} {
  const service = createFakeCollectorRuntimeHttpService();
  const server = createHttpServer({
    collectorProfileManager: createUnusedCollectorProfileManagerHttpService(),
    collectorRuntime: service,
    contentManager: createFakeContentManagerHttpService(),
    sourceGroupReferences: new FakeSourceGroupReferencePort(),
  });

  return { server, service };
}

function expectProfileHomeFeedCollectionRunPayloadIsSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("sourceGroupId");
  expect(serialized).not.toContain("cookie");
  expect(serialized).not.toContain("localStorage");
  expect(serialized).not.toContain("authorization");
  expect(serialized).not.toContain("proxy");
  expect(serialized).not.toContain("fingerprint");
  expect(serialized).not.toContain("rawGraphQL");
  expect(serialized).not.toContain("rawHtml");
  expect(serialized).not.toContain("trustedRuntimeConfiguration");
}
