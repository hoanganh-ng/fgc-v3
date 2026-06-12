import { describe, expect, it } from "vitest";
import {
  CollectionRunNotFoundError,
  InvalidCollectionRunStatusTransitionError,
} from "../../collector-runtime/application";
import { createHttpServer } from "./server";
import {
  createUnusedCollectorProfileManagerHttpService,
} from "./test-support/collector-profile-manager-http-service";
import {
  createCollectionRun,
  createFakeCollectorRuntimeHttpService,
} from "./test-support/collector-runtime-http-service";
import {
  createFakeContentManagerHttpService,
} from "./test-support/content-manager-http-service";

describe("Collector Runtime HTTP routes", () => {
  it("requests collection runs without executing browser collection", async () => {
    const { server, service } = createTestServer();

    service.requestCollectionRun.setOutput(
      createCollectionRun({
        id: "collection-run-created",
        parameters: {
          maxScrolls: 5,
          maxDurationMs: 45_000,
        },
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/collection-runs",
        payload: {
          sourceGroupId: "source-group-1",
          maxScrolls: 5,
          maxDurationMs: 45_000,
        },
      });
      const body = response.json();

      expect(response.statusCode).toBe(201);
      expect(service.requestCollectionRun.calls).toEqual([
        {
          sourceGroupId: "source-group-1",
          maxScrolls: 5,
          maxDurationMs: 45_000,
        },
      ]);
      expect(body).toMatchObject({
        collectionRun: {
          id: "collection-run-created",
          sourceGroupId: "source-group-1",
          status: "QUEUED",
          triggerType: "MANUAL_API",
          parameters: {
            maxScrolls: 5,
            maxDurationMs: 45_000,
          },
        },
      });
      expectCollectionRunPayloadIsSafe(body);
    } finally {
      await server.close();
    }
  });

  it("returns 400 for invalid request bodies before calling the service", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/collection-runs",
        payload: {
          sourceGroupId: "",
          maxDurationMs: 0,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
        },
      });
      expect(service.requestCollectionRun.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("lists collection runs with filters and pagination", async () => {
    const { server, service } = createTestServer();

    service.listCollectionRuns.setOutput({
      items: [
        createCollectionRun({
          id: "collection-run-2",
          status: "RUNNING",
          startedAt: "2026-04-01T10:30:00.000Z",
        }),
      ],
      page: {
        limit: 10,
        offset: 5,
        total: 1,
      },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/collection-runs?status=RUNNING&sourceGroupId=source-group-1&limit=10&offset=5",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.listCollectionRuns.calls).toEqual([
        {
          status: "RUNNING",
          sourceGroupId: "source-group-1",
          limit: 10,
          offset: 5,
        },
      ]);
      expect(body).toMatchObject({
        items: [
          {
            id: "collection-run-2",
            status: "RUNNING",
          },
        ],
        page: {
          limit: 10,
          offset: 5,
          total: 1,
        },
      });
      expectCollectionRunPayloadIsSafe(body);
    } finally {
      await server.close();
    }
  });

  it("gets one collection run", async () => {
    const { server, service } = createTestServer();

    service.getCollectionRun.setOutput(
      createCollectionRun({
        id: "collection-run-1",
        status: "SUCCEEDED",
        startedAt: "2026-04-01T10:05:00.000Z",
        finishedAt: "2026-04-01T10:10:00.000Z",
        summary: {
          capturedPayloads: 3,
          extractorCandidates: 4,
          contentItemsSubmitted: 4,
          failedSubmissions: 0,
          leaseReleased: true,
        },
      }),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/collection-runs/collection-run-1",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.getCollectionRun.calls).toEqual([
        {
          collectionRunId: "collection-run-1",
        },
      ]);
      expect(body).toMatchObject({
        collectionRun: {
          id: "collection-run-1",
          status: "SUCCEEDED",
          summary: {
            capturedPayloads: 3,
            contentItemsSubmitted: 4,
            leaseReleased: true,
          },
        },
      });
      expectCollectionRunPayloadIsSafe(body);
    } finally {
      await server.close();
    }
  });

  it("maps missing collection runs to 404", async () => {
    const { server, service } = createTestServer();

    service.getCollectionRun.setError(
      new CollectionRunNotFoundError("collection-run-missing"),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/collection-runs/collection-run-missing",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: {
          code: "COLLECTION_RUN_NOT_FOUND",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("cancels queued collection runs", async () => {
    const { server, service } = createTestServer();

    service.cancelCollectionRun.setOutput(
      createCollectionRun({
        status: "CANCELED",
        finishedAt: "2026-04-01T10:10:00.000Z",
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/collection-runs/collection-run-1/cancel",
      });

      expect(response.statusCode).toBe(200);
      expect(service.cancelCollectionRun.calls).toEqual([
        {
          collectionRunId: "collection-run-1",
        },
      ]);
      expect(response.json()).toMatchObject({
        collectionRun: {
          id: "collection-run-1",
          status: "CANCELED",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps invalid cancel transitions to 409", async () => {
    const { server, service } = createTestServer();

    service.cancelCollectionRun.setError(
      new InvalidCollectionRunStatusTransitionError("RUNNING", "CANCELED"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/collection-runs/collection-run-1/cancel",
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: {
          code: "INVALID_COLLECTION_RUN_STATUS_TRANSITION",
        },
      });
    } finally {
      await server.close();
    }
  });
});

function createTestServer(): {
  readonly server: ReturnType<typeof createHttpServer>;
  readonly service: ReturnType<typeof createFakeCollectorRuntimeHttpService>;
} {
  const service = createFakeCollectorRuntimeHttpService();

  return {
    server: createHttpServer({
      collectorProfileManager: createUnusedCollectorProfileManagerHttpService(),
      collectorRuntime: service,
      contentManager: createFakeContentManagerHttpService(),
    }),
    service,
  };
}

function expectCollectionRunPayloadIsSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("rawFacebookGraphqlPayload");
  expect(serialized).not.toContain("GraphQL");
  expect(serialized).not.toContain("cookie");
  expect(serialized).not.toContain("localStorage");
  expect(serialized).not.toContain("proxy");
  expect(serialized).not.toContain("provisioning");
  expect(serialized).not.toContain("session");
}
