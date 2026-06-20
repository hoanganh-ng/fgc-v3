import { describe, expect, it } from "vitest";
import type {
  CollectedContentSubmissionInput,
  HomeFeedContentSubmissionInput,
  SourcePublisherObservationInput,
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
        categoryId: "category-1",
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

  it("rejects source group reads when entry routes are absent or malformed", async () => {
    // Case 1: Malformed entryRoute (missing isDefault)
    const fetchMalformed = new FakeFetch(
      createResponse(200, {
        sourceGroup: {
          id: "source-group-1",
          platform: "FACEBOOK",
          status: "ACTIVE",
          url: "https://www.facebook.com/groups/fb-group-1",
          categoryId: "category-1",
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
    const clientMalformed = createClient(fetchMalformed.fetch);
    await expect(clientMalformed.getSourceGroup("source-group-1")).resolves.toEqual({
      ok: false,
      statusCode: 200,
      errorCode: "CONTENT_MANAGER_RESPONSE_ERROR",
      errorMessage: "Content Manager source group response is invalid.",
    });

    // Case 2: Absent entryRoutes
    const fetchAbsent = new FakeFetch(
      createResponse(200, {
        sourceGroup: {
          id: "source-group-1",
          platform: "FACEBOOK",
          status: "ACTIVE",
          url: "https://www.facebook.com/groups/fb-group-1",
          categoryId: "category-1",
        },
      }),
    );
    const clientAbsent = createClient(fetchAbsent.fetch);
    await expect(clientAbsent.getSourceGroup("source-group-1")).resolves.toEqual({
      ok: false,
      statusCode: 200,
      errorCode: "CONTENT_MANAGER_RESPONSE_ERROR",
      errorMessage: "Content Manager source group response is invalid.",
    });

    // Case 3: Valid empty entryRoutes array should succeed
    const fetchEmpty = new FakeFetch(
      createResponse(200, {
        sourceGroup: {
          id: "source-group-1",
          platform: "FACEBOOK",
          status: "ACTIVE",
          url: "https://www.facebook.com/groups/fb-group-1",
          categoryId: "category-1",
          entryRoutes: [],
        },
      }),
    );
    const clientEmpty = createClient(fetchEmpty.fetch);
    await expect(clientEmpty.getSourceGroup("source-group-1")).resolves.toEqual({
      ok: true,
      statusCode: 200,
      sourceGroup: {
        id: "source-group-1",
        platform: "FACEBOOK",
        status: "ACTIVE",
        url: "https://www.facebook.com/groups/fb-group-1",
        categoryId: "category-1",
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

  describe("observeSourcePublisher", () => {
    it("posts to /collector/source-publishers/observations and returns the validated id", async () => {
      const input = createObservationInput();
      const fetch = new FakeFetch(
        createResponse(200, {
          sourcePublisher: {
            id: "sp-123",
            platform: input.platform,
            kind: input.kind,
            externalPublisherId: input.externalPublisherId,
            status: "OBSERVED",
            firstObservedAt: input.observedAt,
            lastObservedAt: input.observedAt,
            observationCount: 1,
            createdAt: input.observedAt,
            updatedAt: input.observedAt,
          },
        }),
      );
      const client = createClient(fetch.fetch);

      const result = await client.observeSourcePublisher(input);

      expect(result).toEqual({ ok: true, sourcePublisherId: "sp-123" });
      expect(fetch.calls[0]?.input).toBe(
        "https://content-manager.test/collector/source-publishers/observations",
      );
      expect(fetch.calls[0]?.init?.method).toBe("POST");
    });

    it("maps an identity mismatch to CONTENT_MANAGER_RESPONSE_ERROR", async () => {
      const input = createObservationInput();
      const fetch = new FakeFetch(
        createResponse(200, {
          sourcePublisher: {
            id: "sp-mismatch",
            platform: input.platform,
            kind: input.kind === "GROUP" ? "PAGE" : "GROUP",
            externalPublisherId: input.externalPublisherId,
            status: "OBSERVED",
            firstObservedAt: input.observedAt,
            lastObservedAt: input.observedAt,
            observationCount: 1,
            createdAt: input.observedAt,
            updatedAt: input.observedAt,
          },
        }),
      );
      const client = createClient(fetch.fetch);

      const result = await client.observeSourcePublisher(input);

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorCode).toBe("CONTENT_MANAGER_RESPONSE_ERROR");
        expect(result.errorMessage).toBe(
          "Content Manager source publisher observation response is invalid.",
        );
      }
    });

    it("maps HTTP 4xx and 5xx to structured failures", async () => {
      for (const statusCode of [400, 409, 503] as const) {
        const fetch = new FakeFetch(
          createResponse(statusCode, {
            error: {
              code: "SOURCE_PUBLISHER_VALIDATION_FAILED",
              message: "Validation failed.",
            },
          }),
        );
        const client = createClient(fetch.fetch);

        const result = await client.observeSourcePublisher(
          createObservationInput(),
        );

        expect(result.ok).toBe(false);
        if (result.ok === false) {
          expect(result.statusCode).toBe(statusCode);
          expect(result.errorCode).toBe("SOURCE_PUBLISHER_VALIDATION_FAILED");
        }
      }
    });

    it("maps a network error to CONTENT_MANAGER_NETWORK_ERROR", async () => {
      const fetch = new FakeFetch(createResponse(200, {}));
      fetch.setError(new Error("network refused"));
      const client = createClient(fetch.fetch);

      const result = await client.observeSourcePublisher(
        createObservationInput(),
      );

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorCode).toBe("CONTENT_MANAGER_NETWORK_ERROR");
      }
    });

    it("maps a response missing sourcePublisher.id to CONTENT_MANAGER_RESPONSE_ERROR", async () => {
      const input = createObservationInput();
      const fetch = new FakeFetch(
        createResponse(200, {
          sourcePublisher: {
            platform: input.platform,
            kind: input.kind,
            externalPublisherId: input.externalPublisherId,
          },
        }),
      );
      const client = createClient(fetch.fetch);

      const result = await client.observeSourcePublisher(input);

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorCode).toBe("CONTENT_MANAGER_RESPONSE_ERROR");
      }
    });
  });

  describe("submitHomeFeedCollectedContent", () => {
    it("posts to /collector/content-items/home-feed and returns the contentItemId on success", async () => {
      const fetch = new FakeFetch(
        createResponse(200, {
          contentItem: { id: "content-item-home-1" },
        }),
      );
      const client = createClient(fetch.fetch);

      const result = await client.submitHomeFeedCollectedContent(
        createHomeFeedSubmissionInput(),
      );

      expect(result).toEqual({
        ok: true,
        contentItemId: "content-item-home-1",
      });
      expect(fetch.calls[0]?.input).toBe(
        "https://content-manager.test/collector/content-items/home-feed",
      );
      expect(fetch.calls[0]?.init?.method).toBe("POST");

      const sentBody = JSON.parse(
        fetch.calls[0]?.init?.body ?? "{}",
      ) as HomeFeedContentSubmissionInput;
      expect(sentBody).toMatchObject({
        sourcePublisherId: "sp-1",
        externalPostId: "post-home-1",
        sourceUrl: "https://www.facebook.com/post-home-1",
      });
      expect((sentBody as unknown as Record<string, unknown>).sourceGroupId).toBeUndefined();
    });

    it("maps HTTP error responses to structured failures", async () => {
      const fetch = new FakeFetch(
        createResponse(409, {
          error: {
            code: "HOME_FEED_INGESTION_CONFLICT",
            message: "Conflict.",
          },
        }),
      );
      const client = createClient(fetch.fetch);

      const result = await client.submitHomeFeedCollectedContent(
        createHomeFeedSubmissionInput(),
      );

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.statusCode).toBe(409);
        expect(result.errorCode).toBe("HOME_FEED_INGESTION_CONFLICT");
      }
    });

    it("maps a network error to CONTENT_MANAGER_NETWORK_ERROR", async () => {
      const fetch = new FakeFetch(createResponse(200, {}));
      fetch.setError(new Error("network down"));
      const client = createClient(fetch.fetch);

      const result = await client.submitHomeFeedCollectedContent(
        createHomeFeedSubmissionInput(),
      );

      expect(result.ok).toBe(false);
      if (result.ok === false) {
        expect(result.errorCode).toBe("CONTENT_MANAGER_NETWORK_ERROR");
      }
    });

    it("returns CONTENT_MANAGER_RESPONSE_ERROR when the 2xx response omits the contentItem id", async () => {
      const fetch = new FakeFetch(createResponse(204, {}));
      const client = createClient(fetch.fetch);

      const result = await client.submitHomeFeedCollectedContent(
        createHomeFeedSubmissionInput(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorCode).toBe("CONTENT_MANAGER_RESPONSE_ERROR");
      }
    });

    it("returns CONTENT_MANAGER_RESPONSE_ERROR when the contentItem.id is blank", async () => {
      const fetch = new FakeFetch(
        createResponse(200, { contentItem: { id: "   " } }),
      );
      const client = createClient(fetch.fetch);

      const result = await client.submitHomeFeedCollectedContent(
        createHomeFeedSubmissionInput(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorCode).toBe("CONTENT_MANAGER_RESPONSE_ERROR");
      }
    });

    it("returns CONTENT_MANAGER_RESPONSE_ERROR when the response body is malformed JSON", async () => {
      const fetch = new FakeFetch({
        status: 200,
        async json() {
          throw new Error("not json");
        },
        async text() {
          return "{not json";
        },
      });
      const client = createClient(fetch.fetch);

      const result = await client.submitHomeFeedCollectedContent(
        createHomeFeedSubmissionInput(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorCode).toBe("CONTENT_MANAGER_RESPONSE_ERROR");
      }
    });

    it("returns CONTENT_MANAGER_RESPONSE_ERROR when the response body is empty", async () => {
      const fetch = new FakeFetch({
        status: 200,
        async json() {
          return undefined;
        },
        async text() {
          return "";
        },
      });
      const client = createClient(fetch.fetch);

      const result = await client.submitHomeFeedCollectedContent(
        createHomeFeedSubmissionInput(),
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorCode).toBe("CONTENT_MANAGER_RESPONSE_ERROR");
      }
    });
  });
});

function createObservationInput(): SourcePublisherObservationInput {
  return {
    platform: "FACEBOOK",
    kind: "GROUP",
    externalPublisherId: "publisher-abc",
    observedAt: "2026-06-19T10:00:00.000Z",
    displayName: "Synthetic Publisher",
    canonicalUrl: "https://www.facebook.com/groups/publisher-abc",
  };
}

function createHomeFeedSubmissionInput(): HomeFeedContentSubmissionInput {
  return {
    sourcePublisherId: "sp-1",
    platform: "FACEBOOK",
    externalPostId: "post-home-1",
    sourceUrl: "https://www.facebook.com/post-home-1",
    bodyText: "synthetic body",
    collectedAt: "2026-06-19T10:00:00.000Z",
    reactionCount: 1,
    commentCount: 0,
    topComments: [],
  };
}

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
