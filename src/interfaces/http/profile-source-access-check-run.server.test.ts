import { describe, expect, it } from "vitest";
import {
  ProfileSourceAccessCheckRunConflictError,
  ProfileSourceAccessCheckRunNotFoundError,
  ProfileSourceAccessCheckRunSourceGroupNotActiveError,
  ProfileSourceAccessCheckRunSourceGroupNotFoundError,
  ProfileSourceAccessCheckRunSourceGroupPlatformUnsupportedError,
  InvalidProfileSourceAccessCheckRunStatusTransitionError,
  ProfileNotFoundError,
} from "../../collector-runtime/application";
import { createHttpServer } from "./server";
import {
  createProfileSourceAccessCheckRun,
  createFakeCollectorRuntimeHttpService,
} from "./test-support/collector-runtime-http-service";
import { createUnusedCollectorProfileManagerHttpService } from "./test-support/collector-profile-manager-http-service";
import { createFakeContentManagerHttpService } from "./test-support/content-manager-http-service";
import { createUnusedContentBuilderHttpService } from "./test-support/content-builder-http-service";
import { FakeSourceGroupReferencePort } from "./test-support/source-group-reference-port";
import type { FastifyInstance } from "fastify";
import type { CollectorRuntimeHttpService } from "./routes/collector-runtime.routes";

describe("ProfileSourceAccessCheckRun HTTP routes", () => {
  it("requests a check run successfully", async () => {
    const { server, service } = createTestServer();

    service.requestProfileSourceAccessCheckRun.setOutput(
      createProfileSourceAccessCheckRun({
        id: "check-run-1",
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profile-source-access-check-runs",
        payload: {
          profileId: "profile-1",
          sourceGroupId: "source-group-1",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(service.requestProfileSourceAccessCheckRun.calls).toEqual([
        {
          profileId: "profile-1",
          sourceGroupId: "source-group-1",
        },
      ]);
      expect(response.json()).toMatchObject({
        profileSourceAccessCheckRun: {
          id: "check-run-1",
          profileId: "profile-1",
          sourceGroupId: "source-group-1",
          status: "QUEUED",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("returns 400 for invalid request body", async () => {
    const { server, service } = createTestServer();

    try {
      // Empty string violation
      const response1 = await server.inject({
        method: "POST",
        url: "/collector/profile-source-access-check-runs",
        payload: {
          profileId: "", // invalid empty string
          sourceGroupId: "source-group-1",
        },
      });

      expect(response1.statusCode).toBe(400);
      expect(response1.json().error.code).toBe("VALIDATION_ERROR");

      // Additional properties violation
      const response2 = await server.inject({
        method: "POST",
        url: "/collector/profile-source-access-check-runs",
        payload: {
          profileId: "profile-1",
          sourceGroupId: "source-group-1",
          extraProperty: "not-allowed",
        },
      });

      expect(response2.statusCode).toBe(400);
      expect(response2.json().error.code).toBe("VALIDATION_ERROR");

      expect(service.requestProfileSourceAccessCheckRun.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("returns 404 for removed routes", async () => {
    const { server } = createTestServer();

    try {
      const response1 = await server.inject({
        method: "POST",
        url: "/collector/profile-source-access-check-runs/check-run-1/running",
      });
      expect(response1.statusCode).toBe(404);

      const response2 = await server.inject({
        method: "POST",
        url: "/collector/profile-source-access-check-runs/check-run-1/succeed",
      });
      expect(response2.statusCode).toBe(404);

      const response3 = await server.inject({
        method: "POST",
        url: "/collector/profile-source-access-check-runs/check-run-1/fail",
        payload: {
          failureReason: { code: "TEST", message: "fail" },
        },
      });
      expect(response3.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("returns 409 for conflict error", async () => {
    const { server, service } = createTestServer();
    service.requestProfileSourceAccessCheckRun.setError(
      new ProfileSourceAccessCheckRunConflictError("profile-1", "source-group-1"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profile-source-access-check-runs",
        payload: {
          profileId: "profile-1",
          sourceGroupId: "source-group-1",
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json().error.code).toBe("PROFILE_SOURCE_ACCESS_CHECK_RUN_CONFLICT");
    } finally {
      await server.close();
    }
  });

  it("returns 404 for profile not found", async () => {
    const { server, service } = createTestServer();
    service.requestProfileSourceAccessCheckRun.setError(
      new ProfileNotFoundError("profile-1"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profile-source-access-check-runs",
        payload: {
          profileId: "profile-1",
          sourceGroupId: "source-group-1",
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("PROFILE_NOT_FOUND");
    } finally {
      await server.close();
    }
  });

  it("gets a check run successfully", async () => {
    const { server, service } = createTestServer();
    service.getProfileSourceAccessCheckRun.setOutput(
      createProfileSourceAccessCheckRun({ id: "check-run-1" }),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/profile-source-access-check-runs/check-run-1",
      });

      expect(response.statusCode).toBe(200);
      expect(service.getProfileSourceAccessCheckRun.calls).toEqual([{ checkRunId: "check-run-1" }]);
      expect(response.json()).toMatchObject({
        profileSourceAccessCheckRun: {
          id: "check-run-1",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("returns 404 when getting a non-existent check run", async () => {
    const { server, service } = createTestServer();
    service.getProfileSourceAccessCheckRun.setError(
      new ProfileSourceAccessCheckRunNotFoundError("check-run-1"),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/profile-source-access-check-runs/check-run-1",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json().error.code).toBe("PROFILE_SOURCE_ACCESS_CHECK_RUN_NOT_FOUND");
    } finally {
      await server.close();
    }
  });

  it("lists check runs", async () => {
    const { server, service } = createTestServer();
    service.listProfileSourceAccessCheckRuns.setOutput({
      items: [
        createProfileSourceAccessCheckRun({ id: "check-run-1" }),
        createProfileSourceAccessCheckRun({ id: "check-run-2" }),
      ],
      page: {
        limit: 50,
        offset: 0,
        total: 2,
      },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/profile-source-access-check-runs",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        items: [{ id: "check-run-1" }, { id: "check-run-2" }],
        page: { limit: 50, offset: 0, total: 2 },
      });
      expect(service.listProfileSourceAccessCheckRuns.calls).toEqual([
        {
          limit: 50,
          offset: 0,
        },
      ]);
    } finally {
      await server.close();
    }
  });

  it("cancels a check run", async () => {
    const { server, service } = createTestServer();
    service.cancelProfileSourceAccessCheckRun.setOutput(
      createProfileSourceAccessCheckRun({ id: "check-run-1", status: "CANCELED" }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/profile-source-access-check-runs/check-run-1/cancel",
      });

      expect(response.statusCode).toBe(200);
      expect(service.cancelProfileSourceAccessCheckRun.calls).toEqual([{ checkRunId: "check-run-1" }]);
      expect(response.json()).toMatchObject({
        profileSourceAccessCheckRun: {
          id: "check-run-1",
          status: "CANCELED",
        },
      });
    } finally {
      await server.close();
    }
  });




});

function createTestServer(): {
  server: FastifyInstance;
  service: ReturnType<typeof createFakeCollectorRuntimeHttpService>;
} {
  const service = createFakeCollectorRuntimeHttpService();
  const server = createHttpServer({
    collectorProfileManager: createUnusedCollectorProfileManagerHttpService(),
    collectorRuntime: service,
    contentManager: createFakeContentManagerHttpService(),
    sourceGroupReferences: new FakeSourceGroupReferencePort(),
    contentBuilder: createUnusedContentBuilderHttpService(),
  });

  return { server, service };
}
