import { describe, expect, it } from "vitest";
import {
  ProfileHomeFeedCollectionRunResponseSchema,
  ProfileHomeFeedCollectionRunsListResponseSchema,
  RequestProfileHomeFeedCollectionRunRequestSchema,
  createCollectorRuntimeClient,
  toListProfileHomeFeedCollectionRunsQueryParams,
  type ProfileHomeFeedCollectionRun,
  type ProfileHomeFeedCollectionRunResponse,
} from "@/lib/api/collector-runtime-client";
import type {
  ApiRequestOptions,
  ApiResult,
  HttpClient,
} from "@/lib/api/http-client";

const timestamp = "2026-06-15T12:30:00.000Z";

function createRun(
  overrides: Partial<ProfileHomeFeedCollectionRun> = {},
): ProfileHomeFeedCollectionRun {
  return {
    id: "home-feed-run-1",
    profileId: "profile-1",
    triggerType: "MANUAL_API",
    status: "QUEUED",
    accountStageAtRequest: "COLLECTION_READY",
    target: {
      platform: "FACEBOOK",
      surface: "PROFILE_HOME_FEED",
    },
    parameters: {},
    requestedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

describe("collector runtime profile-home-feed collection-run client", () => {
  it("uses strict response schemas", () => {
    const listWithExtraTopLevelField =
      ProfileHomeFeedCollectionRunsListResponseSchema.safeParse({
        items: [createRun()],
        page: { limit: 50, offset: 0 },
        unexpected: true,
      });
    const responseWithExtraRunField =
      ProfileHomeFeedCollectionRunResponseSchema.safeParse({
        profileHomeFeedCollectionRun: {
          ...createRun(),
          unexpected: true,
        },
      });

    expect(listWithExtraTopLevelField.success).toBe(false);
    expect(responseWithExtraRunField.success).toBe(false);
  });

  it("rejects null optional response fields and unknown nested fields", () => {
    const nullOptional = ProfileHomeFeedCollectionRunResponseSchema.safeParse({
      profileHomeFeedCollectionRun: {
        ...createRun(),
        summary: null,
      },
    });
    const unknownSummaryField =
      ProfileHomeFeedCollectionRunResponseSchema.safeParse({
        profileHomeFeedCollectionRun: {
          ...createRun({
            status: "SUCCEEDED",
            startedAt: timestamp,
            finishedAt: timestamp,
            summary: {
              capturedPayloads: 1,
            },
          }),
          summary: {
            capturedPayloads: 1,
            rawPayload: "{}",
          },
        },
      });

    expect(nullOptional.success).toBe(false);
    expect(unknownSummaryField.success).toBe(false);
  });

  it("uses a strict request schema and rejects null optionals", () => {
    const withExtra = RequestProfileHomeFeedCollectionRunRequestSchema.safeParse({
      profileId: "profile-1",
      maxScrolls: 0,
      unexpected: true,
    });
    const withNull = RequestProfileHomeFeedCollectionRunRequestSchema.safeParse({
      profileId: "profile-1",
      maxDurationMs: null,
    });

    expect(withExtra.success).toBe(false);
    expect(withNull.success).toBe(false);
  });

  it("constructs list query parameters and omits absent fields", () => {
    expect(
      toListProfileHomeFeedCollectionRunsQueryParams({
        status: "QUEUED",
        profileId: "profile-1",
        limit: 50,
        offset: 100,
      }),
    ).toEqual({
      status: "QUEUED",
      profileId: "profile-1",
      limit: 50,
      offset: 100,
    });

    expect(
      toListProfileHomeFeedCollectionRunsQueryParams({
        limit: 50,
      }),
    ).toEqual({ limit: 50 });
  });

  it("encodes detail and cancellation paths", async () => {
    const response: ProfileHomeFeedCollectionRunResponse = {
      profileHomeFeedCollectionRun: createRun(),
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

    await client.getProfileHomeFeedCollectionRun("run/with space");
    await client.cancelProfileHomeFeedCollectionRun("run/with space");

    expect(capturedPaths).toEqual([
      "/collector/profile-home-feed-collection-runs/run%2Fwith%20space",
      "/collector/profile-home-feed-collection-runs/run%2Fwith%20space/cancel",
    ]);
  });
});
