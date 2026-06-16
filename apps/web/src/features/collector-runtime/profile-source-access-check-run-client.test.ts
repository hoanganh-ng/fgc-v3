import { describe, expect, it } from "vitest";
import {
  ProfileSourceAccessCheckRunResponseSchema,
  ProfileSourceAccessCheckRunsListResponseSchema,
  RequestProfileSourceAccessCheckRunRequestSchema,
  createCollectorRuntimeClient,
  toListProfileSourceAccessCheckRunsQueryParams,
  type ProfileSourceAccessCheckRun,
  type ProfileSourceAccessCheckRunResponse,
} from "@/lib/api/collector-runtime-client";
import type {
  ApiRequestOptions,
  ApiResult,
  HttpClient,
} from "@/lib/api/http-client";

const timestamp = "2026-06-15T00:00:00.000Z";

function createCheckRun(
  overrides: Partial<ProfileSourceAccessCheckRun> = {},
): ProfileSourceAccessCheckRun {
  return {
    id: "check-run-1",
    profileId: "profile-1",
    sourceGroupId: "source-group-1",
    triggerType: "MANUAL",
    status: "QUEUED",
    accountStageAtRequest: "NEW_ACCOUNT",
    target: {
      platform: "FACEBOOK",
      routeType: "DIRECT_GROUP_URL",
      url: "https://www.facebook.com/groups/test-group",
    },
    requestedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("collector runtime profile-source-access-check-run client", () => {
  it("uses strict profile-source-access-check-run response schemas", () => {
    const listWithExtraTopLevelField =
      ProfileSourceAccessCheckRunsListResponseSchema.safeParse({
        items: [createCheckRun()],
        page: { limit: 50, offset: 0 },
        unexpected: true,
      });
    const responseWithExtraRunField = ProfileSourceAccessCheckRunResponseSchema.safeParse({
      profileSourceAccessCheckRun: {
        ...createCheckRun(),
        unexpected: true,
      },
    });

    expect(listWithExtraTopLevelField.success).toBe(false);
    expect(responseWithExtraRunField.success).toBe(false);
  });

  it("enforces lifecycle invariants during schema parsing", () => {
    // QUEUED containing outcome is invalid
    const queuedWithOutcome = ProfileSourceAccessCheckRunResponseSchema.safeParse({
      profileSourceAccessCheckRun: createCheckRun({
        status: "QUEUED",
        outcome: "PUBLIC_ACCESSIBLE",
      }),
    });
    expect(queuedWithOutcome.success).toBe(false);

    // QUEUED containing failureReason is invalid
    const queuedWithFailure = ProfileSourceAccessCheckRunResponseSchema.safeParse({
      profileSourceAccessCheckRun: createCheckRun({
        status: "QUEUED",
        failureReason: { code: "ERROR", message: "Failed" },
      }),
    });
    expect(queuedWithFailure.success).toBe(false);

    // SUCCEEDED without outcome is invalid
    const succeededWithoutOutcome = ProfileSourceAccessCheckRunResponseSchema.safeParse({
      profileSourceAccessCheckRun: createCheckRun({
        status: "SUCCEEDED",
      }),
    });
    expect(succeededWithoutOutcome.success).toBe(false);

    // SUCCEEDED with outcome is valid
    const succeededWithOutcome = ProfileSourceAccessCheckRunResponseSchema.safeParse({
      profileSourceAccessCheckRun: createCheckRun({
        status: "SUCCEEDED",
        outcome: "PUBLIC_ACCESSIBLE",
      }),
    });
    expect(succeededWithOutcome.success).toBe(true);

    // SUCCEEDED with failureReason is invalid
    const succeededWithFailure = ProfileSourceAccessCheckRunResponseSchema.safeParse({
      profileSourceAccessCheckRun: createCheckRun({
        status: "SUCCEEDED",
        outcome: "PUBLIC_ACCESSIBLE",
        failureReason: { code: "ERROR", message: "Failed" },
      }),
    });
    expect(succeededWithFailure.success).toBe(false);

    // FAILED without failureReason is invalid
    const failedWithoutFailure = ProfileSourceAccessCheckRunResponseSchema.safeParse({
      profileSourceAccessCheckRun: createCheckRun({
        status: "FAILED",
      }),
    });
    expect(failedWithoutFailure.success).toBe(false);

    // FAILED with failureReason is valid
    const failedWithFailure = ProfileSourceAccessCheckRunResponseSchema.safeParse({
      profileSourceAccessCheckRun: createCheckRun({
        status: "FAILED",
        failureReason: { code: "ERROR", message: "Failed" },
      }),
    });
    expect(failedWithFailure.success).toBe(true);

    // FAILED with outcome is invalid
    const failedWithOutcome = ProfileSourceAccessCheckRunResponseSchema.safeParse({
      profileSourceAccessCheckRun: createCheckRun({
        status: "FAILED",
        outcome: "PUBLIC_ACCESSIBLE",
        failureReason: { code: "ERROR", message: "Failed" },
      }),
    });
    expect(failedWithOutcome.success).toBe(false);
  });

  it("uses strict request schemas", () => {
    const parsed = RequestProfileSourceAccessCheckRunRequestSchema.safeParse({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      unexpected: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("constructs query parameters correctly", () => {
    expect(
      toListProfileSourceAccessCheckRunsQueryParams({
        status: "QUEUED",
        profileId: "profile-1",
        sourceGroupId: "source-group-1",
        limit: 50,
        offset: 100,
      }),
    ).toEqual({
      status: "QUEUED",
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
      limit: 50,
      offset: 100,
    });
  });

  it("omits absent query parameters", () => {
    expect(toListProfileSourceAccessCheckRunsQueryParams({ limit: 50 })).toEqual({
      limit: 50,
    });
  });

  it("encodes detail and cancellation paths", async () => {
    const response: ProfileSourceAccessCheckRunResponse = {
      profileSourceAccessCheckRun: createCheckRun(),
    };
    const capturedPaths: string[] = [];
    const httpClient: HttpClient = {
      async request<TResponse, TBody = unknown>(
        options: ApiRequestOptions<TResponse, TBody>,
      ): Promise<ApiResult<TResponse>> {
        capturedPaths.push(options.path);
        return { ok: true, data: response as TResponse };
      },
    };
    const client = createCollectorRuntimeClient(httpClient);

    await client.getProfileSourceAccessCheckRun("check/with space");
    await client.cancelProfileSourceAccessCheckRun("check/with space");

    expect(capturedPaths).toEqual([
      "/collector/profile-source-access-check-runs/check%2Fwith%20space",
      "/collector/profile-source-access-check-runs/check%2Fwith%20space/cancel",
    ]);
  });

  it("sends request body without modification", async () => {
    let capturedBody: unknown;
    const response: ProfileSourceAccessCheckRunResponse = {
      profileSourceAccessCheckRun: createCheckRun(),
    };
    const httpClient: HttpClient = {
      async request<TResponse, TBody = unknown>(
        options: ApiRequestOptions<TResponse, TBody>,
      ): Promise<ApiResult<TResponse>> {
        capturedBody = options.body;
        return { ok: true, data: response as TResponse };
      },
    };
    const client = createCollectorRuntimeClient(httpClient);

    await client.requestProfileSourceAccessCheckRun({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });

    expect(capturedBody).toEqual({
      profileId: "profile-1",
      sourceGroupId: "source-group-1",
    });
  });
});
