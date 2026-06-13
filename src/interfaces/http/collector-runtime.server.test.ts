import { describe, expect, it } from "vitest";
import {
  AccountExerciseRunNotFoundError,
  CollectionRunNotFoundError,
  InvalidAccountExerciseRunStatusTransitionError,
  InvalidCollectionRunStatusTransitionError,
} from "../../collector-runtime/application";
import { createHttpServer } from "./server";
import {
  createUnusedCollectorProfileManagerHttpService,
} from "./test-support/collector-profile-manager-http-service";
import {
  createAccountExerciseRun,
  createCollectionRun,
  createFakeCollectorRuntimeHttpService,
} from "./test-support/collector-runtime-http-service";
import {
  createFakeContentManagerHttpService,
} from "./test-support/content-manager-http-service";
import { FakeSourceGroupReferencePort } from "./test-support/source-group-reference-port";

describe("Collector Runtime HTTP routes", () => {
  it("requests account exercise runs without executing browser exercise", async () => {
    const { server, service } = createTestServer();

    service.requestAccountExerciseRun.setOutput(
      createAccountExerciseRun({
        id: "account-exercise-run-created",
        actionBudget: {
          maxDurationMs: 90_000,
          maxScrolls: 3,
          minDwellMs: 1_000,
        },
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs",
        payload: {
          profileId: "profile-1",
          stageAtStart: "WARMING",
          maxDurationMs: 90_000,
          maxScrolls: 3,
          minDwellMs: 1_000,
        },
      });
      const body = response.json();

      expect(response.statusCode).toBe(201);
      expect(service.requestAccountExerciseRun.calls).toEqual([
        {
          profileId: "profile-1",
          stageAtStart: "WARMING",
          maxDurationMs: 90_000,
          maxScrolls: 3,
          minDwellMs: 1_000,
        },
      ]);
      expect(body).toMatchObject({
        accountExerciseRun: {
          id: "account-exercise-run-created",
          profileId: "profile-1",
          exerciseType: "AMBIENT_ACCOUNT",
          status: "QUEUED",
          actionBudget: {
            maxDurationMs: 90_000,
            maxScrolls: 3,
            minDwellMs: 1_000,
          },
        },
      });
      expectAccountExerciseRunPayloadIsSafe(body);
    } finally {
      await server.close();
    }
  });

  it("returns 400 for invalid account exercise request bodies", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs",
        payload: {
          profileId: "",
          stageAtStart: "NEW_ACCOUNT",
          maxDurationMs: 0,
          maxScrolls: -1,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
        },
      });
      expect(service.requestAccountExerciseRun.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("lists and gets account exercise runs with safe DTOs", async () => {
    const { server, service } = createTestServer();

    service.listAccountExerciseRuns.setOutput({
      items: [
        createAccountExerciseRun({
          id: "account-exercise-run-2",
          status: "RUNNING",
          profileId: "profile-2",
          leaseId: "lease-2",
          startedAt: "2026-04-01T10:30:00.000Z",
        }),
      ],
      page: {
        limit: 10,
        offset: 5,
        total: 1,
      },
    });
    service.getAccountExerciseRun.setOutput(
      createAccountExerciseRun({
        id: "account-exercise-run-2",
        status: "RUNNING",
        profileId: "profile-2",
        leaseId: "lease-2",
        startedAt: "2026-04-01T10:30:00.000Z",
      }),
    );

    try {
      const listResponse = await server.inject({
        method: "GET",
        url: "/collector/account-exercise-runs?status=RUNNING&profileId=profile-2&limit=10&offset=5",
      });
      const getResponse = await server.inject({
        method: "GET",
        url: "/collector/account-exercise-runs/account-exercise-run-2",
      });

      expect(listResponse.statusCode).toBe(200);
      expect(service.listAccountExerciseRuns.calls).toEqual([
        {
          status: "RUNNING",
          profileId: "profile-2",
          limit: 10,
          offset: 5,
        },
      ]);
      expect(listResponse.json()).toMatchObject({
        items: [
          {
            id: "account-exercise-run-2",
            status: "RUNNING",
            leaseId: "lease-2",
          },
        ],
        page: {
          limit: 10,
          offset: 5,
          total: 1,
        },
      });
      expect(getResponse.statusCode).toBe(200);
      expect(service.getAccountExerciseRun.calls).toEqual([
        {
          accountExerciseRunId: "account-exercise-run-2",
        },
      ]);
      expect(getResponse.json()).toMatchObject({
        accountExerciseRun: {
          id: "account-exercise-run-2",
          status: "RUNNING",
          leaseId: "lease-2",
        },
      });
      expectAccountExerciseRunPayloadIsSafe(listResponse.json());
      expectAccountExerciseRunPayloadIsSafe(getResponse.json());
    } finally {
      await server.close();
    }
  });

  it("marks account exercise runs running, succeeded, failed, and canceled", async () => {
    const { server, service } = createTestServer();

    try {
      const startResponse = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs/account-exercise-run-1/start",
        payload: {
          leaseId: "lease-1",
        },
      });
      const succeedResponse = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs/account-exercise-run-1/succeed",
        payload: {
          safeSummary: {
            pageLoaded: true,
            loginRequired: false,
            checkpointDetected: false,
            scrollsPerformed: 2,
            durationMs: 10_000,
            leaseReleased: true,
          },
        },
      });
      const failResponse = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs/account-exercise-run-1/fail",
        payload: {
          failureReason: {
            code: "LOGIN_REQUIRED",
            message: "Login is required before ambient exercise can continue.",
          },
          safeSummary: {
            pageLoaded: true,
            loginRequired: true,
            checkpointDetected: false,
            scrollsPerformed: 0,
            durationMs: 1_000,
            leaseReleased: true,
          },
        },
      });
      const cancelResponse = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs/account-exercise-run-1/cancel",
      });

      expect(startResponse.statusCode).toBe(200);
      expect(succeedResponse.statusCode).toBe(200);
      expect(failResponse.statusCode).toBe(200);
      expect(cancelResponse.statusCode).toBe(200);
      expect(service.markAccountExerciseRunRunning.calls).toEqual([
        {
          accountExerciseRunId: "account-exercise-run-1",
          leaseId: "lease-1",
        },
      ]);
      expect(service.markAccountExerciseRunSucceeded.calls).toEqual([
        {
          accountExerciseRunId: "account-exercise-run-1",
          safeSummary: {
            pageLoaded: true,
            loginRequired: false,
            checkpointDetected: false,
            scrollsPerformed: 2,
            durationMs: 10_000,
            leaseReleased: true,
          },
        },
      ]);
      expect(service.markAccountExerciseRunFailed.calls).toEqual([
        {
          accountExerciseRunId: "account-exercise-run-1",
          failureReason: {
            code: "LOGIN_REQUIRED",
            message: "Login is required before ambient exercise can continue.",
          },
          safeSummary: {
            pageLoaded: true,
            loginRequired: true,
            checkpointDetected: false,
            scrollsPerformed: 0,
            durationMs: 1_000,
            leaseReleased: true,
          },
        },
      ]);
      expect(service.cancelAccountExerciseRun.calls).toEqual([
        {
          accountExerciseRunId: "account-exercise-run-1",
        },
      ]);
      expect(startResponse.json()).toMatchObject({
        accountExerciseRun: {
          status: "RUNNING",
          leaseId: "lease-1",
        },
      });
      expect(succeedResponse.json()).toMatchObject({
        accountExerciseRun: {
          status: "SUCCEEDED",
          safeSummary: {
            leaseReleased: true,
          },
        },
      });
      expect(failResponse.json()).toMatchObject({
        accountExerciseRun: {
          status: "FAILED",
          failureReason: {
            code: "LOGIN_REQUIRED",
          },
        },
      });
      expect(cancelResponse.json()).toMatchObject({
        accountExerciseRun: {
          status: "CANCELED",
        },
      });
      expectAccountExerciseRunPayloadIsSafe(startResponse.json());
      expectAccountExerciseRunPayloadIsSafe(succeedResponse.json());
      expectAccountExerciseRunPayloadIsSafe(failResponse.json());
      expectAccountExerciseRunPayloadIsSafe(cancelResponse.json());
    } finally {
      await server.close();
    }
  });

  it("maps missing account exercise runs to 404", async () => {
    const { server, service } = createTestServer();

    service.getAccountExerciseRun.setError(
      new AccountExerciseRunNotFoundError("account-exercise-run-missing"),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/account-exercise-runs/account-exercise-run-missing",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: {
          code: "ACCOUNT_EXERCISE_RUN_NOT_FOUND",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps invalid account exercise transitions to 409", async () => {
    const { server, service } = createTestServer();

    service.markAccountExerciseRunSucceeded.setError(
      new InvalidAccountExerciseRunStatusTransitionError("QUEUED", "SUCCEEDED"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs/account-exercise-run-1/succeed",
        payload: {
          safeSummary: {
            pageLoaded: true,
            loginRequired: false,
            checkpointDetected: false,
            scrollsPerformed: 0,
            durationMs: 1_000,
            leaseReleased: true,
          },
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: {
          code: "INVALID_ACCOUNT_EXERCISE_RUN_STATUS_TRANSITION",
        },
      });
    } finally {
      await server.close();
    }
  });

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
      sourceGroupReferences: new FakeSourceGroupReferencePort(),
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

function expectAccountExerciseRunPayloadIsSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("rawFacebookGraphqlPayload");
  expect(serialized).not.toContain("GraphQL");
  expect(serialized).not.toContain("cookie");
  expect(serialized).not.toContain("localStorage");
  expect(serialized).not.toContain("proxy");
  expect(serialized).not.toContain("provisioning");
  expect(serialized).not.toContain("session");
  expect(serialized).not.toContain("authenticationState");
}
