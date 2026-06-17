import { describe, expect, it } from "vitest";
import {
  CollectionRunResponseSchema,
  CollectionRunsListResponseSchema,
  RequestCollectionRunRequestSchema,
  createCollectorRuntimeClient,
  toListCollectionRunsQueryParams,
  type CollectionRun,
  type CollectionRunResponse,
} from "@/lib/api/collector-runtime-client";
import type {
  ApiRequestOptions,
  ApiResult,
  HttpClient,
} from "@/lib/api/http-client";

const timestamp = "2026-06-15T00:00:00.000Z";

function createCollectionRun(
  overrides: Partial<CollectionRun> = {},
): CollectionRun {
  return {
    id: "run-1",
    sourceGroupId: "sg-1",
    status: "QUEUED",
    triggerType: "MANUAL_API",
    parameters: {},
    requestedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createScheduledCollectionRun(
  overrides: Partial<CollectionRun> = {},
): CollectionRun {
  return createCollectionRun({
    id: "run-scheduled",
    triggerType: "SCHEDULED",
    ...overrides,
  });
}

describe("collector runtime collection-run client", () => {
  it("uses strict collection-run response schemas", () => {
    const listWithExtraTopLevelField = CollectionRunsListResponseSchema.safeParse({
      items: [createCollectionRun()],
      page: { limit: 50, offset: 0 },
      unexpected: true,
    });
    const responseWithExtraRunField = CollectionRunResponseSchema.safeParse({
      collectionRun: {
        ...createCollectionRun(),
        unexpected: true,
      },
    });

    expect(listWithExtraTopLevelField.success).toBe(false);
    expect(responseWithExtraRunField.success).toBe(false);
  });

  it("uses strict request schemas", () => {
    const parsed = RequestCollectionRunRequestSchema.safeParse({
      sourceGroupId: "sg-1",
      maxScrolls: 0,
      unexpected: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("constructs collection-run query parameters from the production helper", () => {
    expect(
      toListCollectionRunsQueryParams({
        status: "QUEUED",
        sourceGroupId: "sg-1",
        limit: 50,
        offset: 100,
      }),
    ).toEqual({
      status: "QUEUED",
      sourceGroupId: "sg-1",
      limit: 50,
      offset: 100,
    });
  });

  it("omits absent collection-run query parameters", () => {
    expect(toListCollectionRunsQueryParams({ limit: 50 })).toEqual({
      limit: 50,
    });
  });

  it("encodes the cancellation path", async () => {
    const response: CollectionRunResponse = {
      collectionRun: createCollectionRun(),
    };
    let capturedPath = "";
    const httpClient: HttpClient = {
      async request<TResponse, TBody = unknown>(
        options: ApiRequestOptions<TResponse, TBody>,
      ): Promise<ApiResult<TResponse>> {
        capturedPath = options.path;
        return { ok: true, data: response as TResponse };
      },
    };
    const client = createCollectorRuntimeClient(httpClient);

    await client.cancelCollectionRun("run/with space");

    expect(capturedPath).toBe(
      "/collector/collection-runs/run%2Fwith%20space/cancel",
    );
  });

  it("accepts a collection-run list response containing a scheduled run", () => {
    const parsed = CollectionRunsListResponseSchema.safeParse({
      items: [
        createCollectionRun(),
        createScheduledCollectionRun(),
      ],
      page: { limit: 50, offset: 0 },
    });

    expect(parsed.success).toBe(true);
  });
});
