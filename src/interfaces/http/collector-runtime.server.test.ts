import { describe, expect, it } from "vitest";
import {
  AccountExerciseRunLeaseConflictError,
  AccountExerciseRunNotFoundError,
  CollectionRunNotFoundError,
  InvalidAccountExerciseRunStatusTransitionError,
  InvalidCollectionRunStatusTransitionError,
  AccountExerciseSourceGroupNotFoundError,
  AccountExerciseSourceGroupNotActiveError,
  AccountExerciseSourceGroupPlatformUnsupportedError,
  CategoryBrowseEntryRouteNotEligibleError,
  CategoryBrowseEntryRouteNotFoundError,
  SourceGroupLookupFailedError,
  CollectionScheduleNotFoundError,
  CollectionScheduleSourceGroupNotActiveError,
  CollectionScheduleSourceGroupNotFoundError,
  CollectionScheduleSourceGroupPlatformUnsupportedError,
  CollectionScheduleValidationError,
} from "../../collector-runtime/application";
import { createHttpServer } from "./server";
import {
  createUnusedCollectorProfileManagerHttpService,
} from "./test-support/collector-profile-manager-http-service";
import {
  createAccountExerciseRun,
  createCollectionRun,
  createCollectionSchedule,
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

  it("requests a queued category browse exercise run happy path", async () => {
    const { server, service } = createTestServer();
    const target = {
      categoryId: "category-1",
      sourceGroupId: "source-group-1",
      entryRouteId: "route-1",
      entryRouteType: "CATEGORY_ENTRY_URL" as const,
      url: "https://www.facebook.com/groups/source-group-1/categories",
      riskLevel: "LOW" as const,
    };
    service.requestAccountExerciseRun.setOutput(
      createAccountExerciseRun({
        id: "account-exercise-run-created",
        exerciseType: "CATEGORY_BROWSE",
        actionBudget: {
          maxDurationMs: 90_000,
          maxScrolls: 3,
        },
        target,
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs",
        payload: {
          profileId: "profile-1",
          stageAtStart: "WARMING",
          exerciseType: "CATEGORY_BROWSE",
          sourceGroupId: "source-group-1",
          maxDurationMs: 90_000,
          maxScrolls: 3,
        },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).toMatchObject({
        accountExerciseRun: {
          id: "account-exercise-run-created",
          profileId: "profile-1",
          exerciseType: "CATEGORY_BROWSE",
          target,
        },
      });
      expectAccountExerciseRunPayloadIsSafe(response.json());
    } finally {
      await server.close();
    }
  });

  it("returns 400 for Category Browse requests missing sourceGroupId", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs",
        payload: {
          profileId: "profile-1",
          stageAtStart: "WARMING",
          exerciseType: "CATEGORY_BROWSE",
          maxDurationMs: 90_000,
          maxScrolls: 3,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
      expect(service.requestAccountExerciseRun.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("maps AccountExerciseSourceGroupNotFoundError to 404", async () => {
    const { server, service } = createTestServer();
    service.requestAccountExerciseRun.setError(
      new AccountExerciseSourceGroupNotFoundError("missing-group"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs",
        payload: {
          profileId: "profile-1",
          stageAtStart: "WARMING",
          exerciseType: "CATEGORY_BROWSE",
          sourceGroupId: "missing-group",
          maxDurationMs: 90_000,
          maxScrolls: 3,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("ACCOUNT_EXERCISE_SOURCE_GROUP_NOT_FOUND");
    } finally {
      await server.close();
    }
  });

  it("maps inactive, unsupported platform, or no eligible route to 409", async () => {
    const errors = [
      new AccountExerciseSourceGroupNotActiveError("group-1", "PAUSED"),
      new AccountExerciseSourceGroupPlatformUnsupportedError("group-1", "TWITTER"),
      new CategoryBrowseEntryRouteNotEligibleError("group-1", "No eligible route"),
    ];

    for (const error of errors) {
      const { server, service } = createTestServer();
      service.requestAccountExerciseRun.setError(error);

      try {
        const response = await server.inject({
          method: "POST",
          url: "/collector/account-exercise-runs",
          payload: {
            profileId: "profile-1",
            stageAtStart: "WARMING",
            exerciseType: "CATEGORY_BROWSE",
            sourceGroupId: "group-1",
            maxDurationMs: 90_000,
            maxScrolls: 3,
          },
        });

        expect(response.statusCode).toBe(409);
        expect(response.json().error.code).toBe(error.code);
      } finally {
        await server.close();
      }
    }
  });

  it("maps unknown explicit entry route to 404", async () => {
    const { server, service } = createTestServer();
    service.requestAccountExerciseRun.setError(
      new CategoryBrowseEntryRouteNotFoundError("group-1", "missing-route"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs",
        payload: {
          profileId: "profile-1",
          stageAtStart: "WARMING",
          exerciseType: "CATEGORY_BROWSE",
          sourceGroupId: "group-1",
          entryRouteId: "missing-route",
          maxDurationMs: 90_000,
          maxScrolls: 3,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("CATEGORY_BROWSE_ENTRY_ROUTE_NOT_FOUND");
    } finally {
      await server.close();
    }
  });

  it("sanitizes SourceGroupLookupFailedError response to 502 with a safe public message and metadata", async () => {
    const { server, service } = createTestServer();
    const sensitiveError = new SourceGroupLookupFailedError(
      "group-1",
      "Internal HTTP client error: Connection failed to http://credentials:secret@internal-server:1234/some/raw/html/endpoint",
      {
        causeCode: "RAW_NETWORK_TIMEOUT",
        statusCode: 504,
      },
    );
    service.requestAccountExerciseRun.setError(sensitiveError);

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs",
        payload: {
          profileId: "profile-1",
          stageAtStart: "WARMING",
          exerciseType: "CATEGORY_BROWSE",
          sourceGroupId: "group-1",
          maxDurationMs: 90_000,
          maxScrolls: 3,
        },
      });

      expect(response.statusCode).toBe(502);

      const body = response.json();
      expect(body.error.code).toBe("SOURCE_GROUP_LOOKUP_FAILED");
      expect(body.error.message).toBe("Content Manager source group lookup failed.");

      const bodyString = JSON.stringify(body);
      expect(bodyString).not.toContain("credentials");
      expect(bodyString).not.toContain("secret");
      expect(bodyString).not.toContain("internal-server");
      expect(bodyString).not.toContain("Connection failed");

      expect(body.error.reasons).toEqual([
        { causeCode: "RAW_NETWORK_TIMEOUT" },
        { statusCode: 504 },
      ]);
    } finally {
      await server.close();
    }
  });

  it("sanitizes and validates causeCode in SourceGroupLookupFailedError to prevent exposing arbitrary codes", async () => {
    const { server, service } = createTestServer();
    const testCases = [
      { causeCode: "CONTENT_MANAGER_RESPONSE_ERROR", expectPreserved: true },
      { causeCode: "content_manager_response_error", expectPreserved: false },
      { causeCode: "CONTENT MANAGER RESPONSE ERROR", expectPreserved: false },
      { causeCode: "/api/v1/error", expectPreserved: false },
      { causeCode: "user:pass", expectPreserved: false },
      { causeCode: "A" + "B".repeat(64), expectPreserved: false },
    ];

    try {
      for (const testCase of testCases) {
        const sensitiveError = new SourceGroupLookupFailedError(
          "group-1",
          "Some sensitive internal message.",
          {
            causeCode: testCase.causeCode,
            statusCode: 504,
          },
        );
        service.requestAccountExerciseRun.setError(sensitiveError);

        const response = await server.inject({
          method: "POST",
          url: "/collector/account-exercise-runs",
          payload: {
            profileId: "profile-1",
            stageAtStart: "WARMING",
            exerciseType: "CATEGORY_BROWSE",
            sourceGroupId: "group-1",
            maxDurationMs: 90_000,
            maxScrolls: 3,
          },
        });

        expect(response.statusCode).toBe(502);

        const body = response.json();
        expect(body.error.code).toBe("SOURCE_GROUP_LOOKUP_FAILED");
        expect(body.error.message).toBe("Content Manager source group lookup failed.");

        const bodyString = JSON.stringify(body);
        expect(bodyString).not.toContain("Some sensitive internal message.");

        if (testCase.expectPreserved) {
          expect(body.error.reasons).toEqual([
            { causeCode: testCase.causeCode },
            { statusCode: 504 },
          ]);
        } else {
          expect(body.error.reasons).toEqual([
            { statusCode: 504 },
          ]);
        }
      }
    } finally {
      await server.close();
    }
  });

  it("lists and gets account exercise runs with safe DTOs", async () => {
    const { server, service } = createTestServer();
    const target = {
      categoryId: "category-1",
      sourceGroupId: "group-2",
      entryRouteId: "route-2",
      entryRouteType: "CATEGORY_ENTRY_URL" as const,
      url: "https://www.facebook.com/groups/group-2/categories",
      riskLevel: "LOW" as const,
    };

    service.listAccountExerciseRuns.setOutput({
      items: [
        createAccountExerciseRun({
          id: "account-exercise-run-2",
          exerciseType: "CATEGORY_BROWSE",
          status: "RUNNING",
          profileId: "profile-2",
          leaseId: "lease-2",
          startedAt: "2026-04-01T10:30:00.000Z",
          target,
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
        exerciseType: "CATEGORY_BROWSE",
        status: "RUNNING",
        profileId: "profile-2",
        leaseId: "lease-2",
        startedAt: "2026-04-01T10:30:00.000Z",
        target,
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
            exerciseType: "CATEGORY_BROWSE",
            status: "RUNNING",
            leaseId: "lease-2",
            target,
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
          exerciseType: "CATEGORY_BROWSE",
          status: "RUNNING",
          leaseId: "lease-2",
          target,
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
      expect(service.attachAccountExerciseRunLease.calls).toEqual([]);
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

  it("starts account exercise runs without a lease id", async () => {
    const { server, service } = createTestServer();

    service.markAccountExerciseRunRunning.setOutput(
      createAccountExerciseRun({
        status: "RUNNING",
        startedAt: "2026-04-01T10:00:00.000Z",
        updatedAt: "2026-04-01T10:00:00.000Z",
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs/account-exercise-run-1/start",
        payload: {},
      });

      expect(response.statusCode).toBe(200);
      expect(service.markAccountExerciseRunRunning.calls).toEqual([
        {
          accountExerciseRunId: "account-exercise-run-1",
        },
      ]);
      expect(service.attachAccountExerciseRunLease.calls).toEqual([]);
      expect(response.json()).toMatchObject({
        accountExerciseRun: {
          status: "RUNNING",
        },
      });
      expect(response.json().accountExerciseRun).not.toHaveProperty("leaseId");
      expectAccountExerciseRunPayloadIsSafe(response.json());
    } finally {
      await server.close();
    }
  });

  it("attaches a lease through the dedicated account exercise run lease endpoint", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs/account-exercise-run-1/lease",
        payload: {
          leaseId: "lease-1",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(service.markAccountExerciseRunRunning.calls).toEqual([]);
      expect(service.attachAccountExerciseRunLease.calls).toEqual([
        {
          accountExerciseRunId: "account-exercise-run-1",
          leaseId: "lease-1",
        },
      ]);
      expect(response.json()).toMatchObject({
        accountExerciseRun: {
          status: "RUNNING",
          leaseId: "lease-1",
        },
      });
      expectAccountExerciseRunPayloadIsSafe(response.json());
    } finally {
      await server.close();
    }
  });

  it("rejects empty account exercise run lease attachment requests", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs/account-exercise-run-1/lease",
        payload: {
          leaseId: " ",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
        },
      });
      expect(service.attachAccountExerciseRunLease.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("maps account exercise run lease conflicts to 409", async () => {
    const { server, service } = createTestServer();

    service.attachAccountExerciseRunLease.setError(
      new AccountExerciseRunLeaseConflictError("account-exercise-run-1"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/account-exercise-runs/account-exercise-run-1/lease",
        payload: {
          leaseId: "lease-2",
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: {
          code: "ACCOUNT_EXERCISE_RUN_LEASE_CONFLICT",
        },
      });
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

  it("lists collection schedules with default paging", async () => {
    const { server, service } = createTestServer();

    service.listCollectionSchedules.setOutput({
      items: [
        createCollectionSchedule({
          sourceGroupId: "source-group-1",
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2026-04-01T11:00:00.000Z",
          parameters: { maxScrolls: 5, maxDurationMs: 60_000 },
        }),
      ],
      page: { limit: 50, offset: 0, total: 1 },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/collection-schedules",
      });

      expect(response.statusCode).toBe(200);
      expect(service.listCollectionSchedules.calls).toEqual([
        { limit: 50, offset: 0 },
      ]);
      expect(response.json()).toMatchObject({
        items: [
          {
            sourceGroupId: "source-group-1",
            enabled: true,
            intervalMinutes: 30,
            nextRunAt: "2026-04-01T11:00:00.000Z",
            parameters: { maxScrolls: 5, maxDurationMs: 60_000 },
          },
        ],
        page: { limit: 50, offset: 0, total: 1 },
      });
    } finally {
      await server.close();
    }
  });

  it("coerces collection-schedule limit and offset querystrings", async () => {
    const { server, service } = createTestServer();

    service.listCollectionSchedules.setOutput({
      items: [],
      page: { limit: 25, offset: 50, total: 0 },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/collection-schedules?limit=25&offset=50",
      });

      expect(response.statusCode).toBe(200);
      expect(service.listCollectionSchedules.calls).toEqual([
        { limit: 25, offset: 50 },
      ]);
    } finally {
      await server.close();
    }
  });

  it("returns 400 for invalid collection-schedule list query", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/collection-schedules?limit=abc",
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
      expect(service.listCollectionSchedules.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("gets a single collection schedule by source group id", async () => {
    const { server, service } = createTestServer();

    service.getCollectionSchedule.setOutput(
      createCollectionSchedule({
        sourceGroupId: "source-group-1",
        enabled: true,
        intervalMinutes: 60,
        nextRunAt: "2026-04-01T12:00:00.000Z",
        parameters: { maxDurationMs: 90_000 },
        createdAt: "2026-03-31T12:00:00.000Z",
        updatedAt: "2026-04-01T08:00:00.000Z",
      }),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/collection-schedules/source-group-1",
      });

      expect(response.statusCode).toBe(200);
      expect(service.getCollectionSchedule.calls).toEqual([
        { sourceGroupId: "source-group-1" },
      ]);
      expect(response.json()).toMatchObject({
        collectionSchedule: {
          sourceGroupId: "source-group-1",
          enabled: true,
          intervalMinutes: 60,
          nextRunAt: "2026-04-01T12:00:00.000Z",
          parameters: { maxDurationMs: 90_000 },
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps missing collection schedule to 404", async () => {
    const { server, service } = createTestServer();

    service.getCollectionSchedule.setError(
      new CollectionScheduleNotFoundError("source-group-1"),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/collection-schedules/source-group-1",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: "COLLECTION_SCHEDULE_NOT_FOUND" },
      });
    } finally {
      await server.close();
    }
  });

  it("upserts a collection schedule happy path with a safe DTO", async () => {
    const { server, service } = createTestServer();

    service.upsertCollectionSchedule.setOutput(
      createCollectionSchedule({
        sourceGroupId: "source-group-1",
        enabled: true,
        intervalMinutes: 120,
        nextRunAt: "2026-04-01T14:00:00.000Z",
        parameters: { maxScrolls: 3 },
        createdAt: "2026-03-31T12:00:00.000Z",
        updatedAt: "2026-04-01T08:00:00.000Z",
      }),
    );

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: true,
          intervalMinutes: 120,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: { maxScrolls: 3 },
        },
      });

      expect(response.statusCode).toBe(200);
      expect(service.upsertCollectionSchedule.calls).toEqual([
        {
          sourceGroupId: "source-group-1",
          enabled: true,
          intervalMinutes: 120,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: { maxScrolls: 3 },
        },
      ]);
      expect(response.json()).toMatchObject({
        collectionSchedule: {
          sourceGroupId: "source-group-1",
          enabled: true,
          intervalMinutes: 120,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: { maxScrolls: 3 },
          createdAt: "2026-03-31T12:00:00.000Z",
          updatedAt: "2026-04-01T08:00:00.000Z",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("accepts an empty parameters object on upsert and keeps the safe DTO empty", async () => {
    const { server, service } = createTestServer();

    service.upsertCollectionSchedule.setOutput(
      createCollectionSchedule({
        sourceGroupId: "source-group-1",
        enabled: false,
        intervalMinutes: 30,
        nextRunAt: "2026-04-01T14:00:00.000Z",
        parameters: {},
        createdAt: "2026-03-31T12:00:00.000Z",
        updatedAt: "2026-04-01T08:00:00.000Z",
      }),
    );

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: false,
          intervalMinutes: 30,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: {},
        },
      });

      expect(response.statusCode).toBe(200);
      expect(service.upsertCollectionSchedule.calls).toEqual([
        {
          sourceGroupId: "source-group-1",
          enabled: false,
          intervalMinutes: 30,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: {},
        },
      ]);
      const body = response.json();
      expect(body.collectionSchedule.parameters).toEqual({});
      expect(Object.prototype.hasOwnProperty.call(
        body.collectionSchedule.parameters,
        "maxScrolls",
      )).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(
        body.collectionSchedule.parameters,
        "maxDurationMs",
      )).toBe(false);
    } finally {
      await server.close();
    }
  });

  it("returns 400 when the upsert body has an out-of-range interval", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: true,
          intervalMinutes: 0,
          nextRunAt: "2026-04-01T14:00:00.000Z",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
      expect(service.upsertCollectionSchedule.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("returns 400 when the upsert body has a non-ISO nextRunAt", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "tomorrow",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
      expect(service.upsertCollectionSchedule.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("returns 400 when the upsert body omits parameters", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2026-04-01T14:00:00.000Z",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
      expect(service.upsertCollectionSchedule.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("returns 400 with structured issues on collection-schedule validation errors", async () => {
    const { server, service } = createTestServer();

    service.upsertCollectionSchedule.setError(
      new CollectionScheduleValidationError([
        { path: "intervalMinutes", message: "intervalMinutes must be an integer between 1 and 10080." },
      ]),
    );

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: {},
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "COLLECTION_SCHEDULE_VALIDATION_ERROR",
          issues: [
            {
              path: "intervalMinutes",
              message: "intervalMinutes must be an integer between 1 and 10080.",
            },
          ],
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps missing source group on upsert to 404", async () => {
    const { server, service } = createTestServer();

    service.upsertCollectionSchedule.setError(
      new CollectionScheduleSourceGroupNotFoundError("source-group-1"),
    );

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: {},
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: "COLLECTION_SCHEDULE_SOURCE_GROUP_NOT_FOUND" },
      });
    } finally {
      await server.close();
    }
  });

  it("maps PAUSED+enabled upsert to 409", async () => {
    const { server, service } = createTestServer();

    service.upsertCollectionSchedule.setError(
      new CollectionScheduleSourceGroupNotActiveError("source-group-1", "PAUSED"),
    );

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: {},
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: { code: "COLLECTION_SCHEDULE_SOURCE_GROUP_NOT_ACTIVE" },
      });
    } finally {
      await server.close();
    }
  });

  it("maps non-Facebook platform upsert to 409", async () => {
    const { server, service } = createTestServer();

    service.upsertCollectionSchedule.setError(
      new CollectionScheduleSourceGroupPlatformUnsupportedError(
        "source-group-1",
        "TIKTOK",
      ),
    );

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: {},
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: { code: "COLLECTION_SCHEDULE_SOURCE_GROUP_PLATFORM_UNSUPPORTED" },
      });
    } finally {
      await server.close();
    }
  });

  it("maps unexpected source group lookup failure on upsert to sanitized 502", async () => {
    const { server, service } = createTestServer();

    service.upsertCollectionSchedule.setError(
      new SourceGroupLookupFailedError("source-group-1", "upstream timeout", {
        causeCode: "UPSTREAM_TIMEOUT",
        statusCode: 504,
      }),
    );

    try {
      const response = await server.inject({
        method: "PUT",
        url: "/collector/collection-schedules/source-group-1",
        payload: {
          enabled: true,
          intervalMinutes: 30,
          nextRunAt: "2026-04-01T14:00:00.000Z",
          parameters: {},
        },
      });

      expect(response.statusCode).toBe(502);
      expect(response.json()).toMatchObject({
        error: { code: "SOURCE_GROUP_LOOKUP_FAILED" },
      });
      const serialized = JSON.stringify(response.json());
      expect(serialized).not.toContain("upstream timeout");
      expect(serialized).not.toContain("source-group-1");
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
