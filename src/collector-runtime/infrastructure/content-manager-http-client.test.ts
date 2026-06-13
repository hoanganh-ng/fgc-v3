import { describe, expect, it } from "vitest";
import type {
  CollectedContentSubmissionInput,
} from "../application";
import {
  ContentManagerHttpClient,
  MissingContentManagerHttpClientConfigError,
  loadContentManagerHttpClientConfig,
} from "./content-manager-http-client";
import type {
  FetchLike,
  FetchLikeRequestInit,
  FetchLikeResponse,
} from "./content-manager-http-client";

describe("ContentManagerHttpClient", () => {
  it("posts normalized candidates to /collector/content-items using the configured base URL", async () => {
    const fetch = new FakeFetch(
      createResponse(200, {
        contentItem: {
          id: "content-item-1",
        },
      }),
    );
    const client = new ContentManagerHttpClient(
      loadContentManagerHttpClientConfig({
        CONTENT_MANAGER_BASE_URL: " https://content-manager.test/api ",
      }),
      {
        fetchImplementation: fetch.fetch,
      },
    );

    const result = await client.submitCollectedContent(createSubmissionInput());

    expect(result).toEqual({
      ok: true,
      statusCode: 200,
      contentItemId: "content-item-1",
    });
    expect(fetch.calls).toHaveLength(1);
    expect(fetch.calls[0]).toMatchObject({
      input: "https://content-manager.test/api/collector/content-items",
      init: {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
      },
    });

    const requestBody = parseRequestBody(fetch);

    expect(requestBody).toMatchObject(createSubmissionInput());
  });

  it("maps 2xx responses to success", async () => {
    const fetch = new FakeFetch(
      createResponse(201, {
        contentItem: {
          id: "content-item-2",
        },
      }),
    );
    const client = createClient(fetch.fetch);

    await expect(client.submitCollectedContent(createSubmissionInput())).resolves
      .toEqual({
        ok: true,
        statusCode: 201,
        contentItemId: "content-item-2",
      });
  });

  it("maps 400, 404, and 409 responses to structured failures", async () => {
    for (const statusCode of [400, 404, 409] as const) {
      const fetch = new FakeFetch(
        createResponse(statusCode, {
          error: {
            code: "CONTENT_MANAGER_ERROR",
            message: `HTTP ${statusCode} failure.`,
          },
        }),
      );
      const client = createClient(fetch.fetch);

      await expect(client.submitCollectedContent(createSubmissionInput())).resolves
        .toEqual({
          ok: false,
          statusCode,
          errorCode: "CONTENT_MANAGER_HTTP_ERROR",
          errorMessage: `HTTP ${statusCode} failure.`,
        });
    }
  });

  it("maps 5xx responses to structured failures", async () => {
    const fetch = new FakeFetch(
      createResponse(503, {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Content Manager is unavailable.",
        },
      }),
    );
    const client = createClient(fetch.fetch);

    await expect(client.submitCollectedContent(createSubmissionInput())).resolves
      .toEqual({
        ok: false,
        statusCode: 503,
        errorCode: "CONTENT_MANAGER_HTTP_ERROR",
        errorMessage: "Content Manager is unavailable.",
      });
  });

  it("maps network failures to structured failures", async () => {
    const fetch = new FakeFetch(createResponse(200, {}));

    fetch.setError(new Error("connect ECONNREFUSED"));

    const client = createClient(fetch.fetch);

    await expect(client.submitCollectedContent(createSubmissionInput())).resolves
      .toEqual({
        ok: false,
        errorCode: "CONTENT_MANAGER_NETWORK_ERROR",
        errorMessage: "connect ECONNREFUSED",
      });
  });

  it("gets source groups by id using the safe read endpoint", async () => {
    const fetch = new FakeFetch(
      createResponse(200, {
        sourceGroup: {
          id: "source-group-1",
          platform: "FACEBOOK",
          externalGroupId: "fb-group-1",
          name: "Knowledge Group",
          url: "https://www.facebook.com/groups/fb-group-1",
          categoryId: "category-1",
          status: "ACTIVE",
          collectionPriority: 80,
          entryRoutes: [
            {
              id: "route-1",
              type: "DIRECT_GROUP_URL",
              url: "https://www.facebook.com/groups/fb-group-1",
              riskLevel: "MEDIUM",
              isDefault: true,
              createdAt: "2026-02-01T10:00:00.000Z",
              updatedAt: "2026-02-01T10:00:00.000Z",
            },
          ],
          createdAt: "2026-02-01T10:00:00.000Z",
          updatedAt: "2026-02-01T10:00:00.000Z",
        },
      }),
    );
    const client = createClient(fetch.fetch);

    await expect(client.getSourceGroup("source/group 1")).resolves.toEqual({
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "ACTIVE",
        url: "https://www.facebook.com/groups/fb-group-1",
        entryRoutes: [
          {
            id: "route-1",
            type: "DIRECT_GROUP_URL",
            url: "https://www.facebook.com/groups/fb-group-1",
            riskLevel: "MEDIUM",
            isDefault: true,
          },
        ],
      },
    });
    expect(fetch.calls).toEqual([
      {
        input:
          "https://content-manager.test/collector/source-groups/source%2Fgroup%201",
        init: {
          method: "GET",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
        },
      },
    ]);
  });

  it("preserves source group reads when entry routes are absent or malformed", async () => {
    const fetch = new FakeFetch(
      createResponse(200, {
        sourceGroup: {
          id: "source-group-1",
          platform: "FACEBOOK",
          status: "ACTIVE",
          url: "https://www.facebook.com/groups/fb-group-1",
          entryRoutes: [
            {
              id: "route-1",
              type: "DIRECT_GROUP_URL",
              url: "https://www.facebook.com/groups/fb-group-1",
              riskLevel: "MEDIUM",
            },
          ],
        },
      }),
    );
    const client = createClient(fetch.fetch);

    await expect(client.getSourceGroup("source-group-1")).resolves.toEqual({
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "ACTIVE",
        url: "https://www.facebook.com/groups/fb-group-1",
        entryRoutes: [],
      },
    });
  });

  it("maps missing source group reads to structured failures", async () => {
    const fetch = new FakeFetch(
      createResponse(404, {
        error: {
          code: "SOURCE_GROUP_NOT_FOUND",
          message: "Source group not found: missing.",
        },
      }),
    );
    const client = createClient(fetch.fetch);

    await expect(client.getSourceGroup("missing")).resolves.toEqual({
      ok: false,
      statusCode: 404,
      errorCode: "SOURCE_GROUP_NOT_FOUND",
      errorMessage: "Source group not found: missing.",
    });
  });

  it("does not include raw GraphQL payload fields in the request body", async () => {
    const fetch = new FakeFetch(createResponse(200, {}));
    const client = createClient(fetch.fetch);
    const baseInput = createSubmissionInput();
    const firstTopComment = baseInput.topComments[0];

    if (firstTopComment === undefined) {
      throw new Error("Expected one top comment fixture.");
    }

    const input = {
      ...baseInput,
      payload: {
        data: "raw payload",
      },
      rawFacebookGraphqlPayload: {
        data: "raw payload",
      },
      topComments: [
        {
          ...firstTopComment,
          rawPayload: "raw comment payload",
        },
      ],
    } as unknown as CollectedContentSubmissionInput;

    await client.submitCollectedContent(input);

    const requestBody = parseRequestBody(fetch);

    expect(requestBody).not.toHaveProperty("payload");
    expect(requestBody).not.toHaveProperty("rawFacebookGraphqlPayload");
    expect(requestBody.topComments[0]).not.toHaveProperty("rawPayload");
  });

  it("fails clearly when CONTENT_MANAGER_BASE_URL is missing", () => {
    expect(() => loadContentManagerHttpClientConfig({})).toThrow(
      MissingContentManagerHttpClientConfigError,
    );
    expect(() =>
      loadContentManagerHttpClientConfig({
        CONTENT_MANAGER_BASE_URL: " ",
      }),
    ).toThrow(
      "CONTENT_MANAGER_BASE_URL is required for Content Manager HTTP client configuration.",
    );
  });
});

class FakeFetch {
  public readonly calls: Array<{
    readonly input: string;
    readonly init?: FetchLikeRequestInit;
  }> = [];
  private error: unknown;

  public constructor(private readonly response: FetchLikeResponse) {}

  public readonly fetch: FetchLike = async (input, init) => {
    this.calls.push({
      input,
      ...(init !== undefined ? { init } : {}),
    });

    if (this.error !== undefined) {
      throw this.error;
    }

    return this.response;
  };

  public setError(error: unknown): void {
    this.error = error;
  }
}

function createClient(fetchImplementation: FetchLike): ContentManagerHttpClient {
  return new ContentManagerHttpClient(
    {
      baseUrl: "https://content-manager.test",
    },
    {
      fetchImplementation,
    },
  );
}

function createResponse(status: number, body: unknown): FetchLikeResponse {
  const responseText = JSON.stringify(body);

  return {
    status,
    async json() {
      return JSON.parse(responseText);
    },
    async text() {
      return responseText;
    },
  };
}

function createSubmissionInput(): CollectedContentSubmissionInput {
  return {
    platform: "FACEBOOK",
    sourceGroupId: "source-group-1",
    externalPostId: "post-123",
    sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-123/",
    title: "Useful automation note",
    bodyText: "A practical idea for organizing collected knowledge posts.",
    authorDisplayName: "Synthetic Author",
    authorExternalId: "author-123",
    postedAt: "2026-02-03T10:15:00.000Z",
    collectedAt: "2026-03-01T12:00:00.000Z",
    reactionCount: 42,
    commentCount: 5,
    shareCount: 2,
    topComments: [
      {
        externalCommentId: "comment-1",
        bodyText: "This is immediately useful.",
        authorDisplayName: "Synthetic Commenter One",
        authorExternalId: "comment-author-1",
        reactionCount: 9,
        replyCount: 1,
        postedAt: "2026-02-03T10:20:00.000Z",
        collectedAt: "2026-03-01T12:00:00.000Z",
      },
    ],
  };
}

function parseRequestBody(
  fetch: FakeFetch,
): CollectedContentSubmissionInput {
  const firstCall = fetch.calls[0];

  if (firstCall?.init?.body === undefined) {
    throw new Error("Expected a JSON request body.");
  }

  return JSON.parse(firstCall.init.body) as CollectedContentSubmissionInput;
}
