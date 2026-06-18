import { inArray } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  createContentManagerFromDatabaseClient,
} from "../../composition/content-manager";
import type {
  ContentManagerService,
} from "../../composition/content-manager";
import {
  contentCategories,
  contentItems,
  createDatabaseClient,
  sourceGroups,
  sourcePublishers,
} from "../../infrastructure/database";
import type { DatabaseClient } from "../../infrastructure/database";
import { createHttpServer } from "./server";
import {
  createUnusedCollectorProfileManagerHttpService,
} from "./test-support/collector-profile-manager-http-service";
import {
  createUnusedCollectorRuntimeHttpService,
} from "./test-support/collector-runtime-http-service";
import { FakeSourceGroupReferencePort } from "./test-support/source-group-reference-port";

const shouldRunHttpDbTests = process.env.RUN_HTTP_DB_TESTS === "true";
const databaseUrl = process.env.DATABASE_URL?.trim();

if (!shouldRunHttpDbTests) {
  describe.skip("Content Manager HTTP PostgreSQL integration", () => {
    it("runs only when RUN_HTTP_DB_TESTS=true", () => {});
  });
} else if (databaseUrl === undefined || databaseUrl === "") {
  describe("Content Manager HTTP PostgreSQL integration", () => {
    it("requires DATABASE_URL when RUN_HTTP_DB_TESTS=true", () => {
      throw new Error(
        "DATABASE_URL is required when RUN_HTTP_DB_TESTS=true.",
      );
    });
  });
} else {
  describe("Content Manager HTTP PostgreSQL integration", () => {
    let client: DatabaseClient | undefined;
    let service: ContentManagerService | undefined;
    let server: FastifyInstance | undefined;
    let nextId = 0;
    const createdCategoryIds = new Set<string>();
    const createdSourceGroupIds = new Set<string>();
    const createdContentItemIds = new Set<string>();
    const createdSourcePublisherIds = new Set<string>();

    beforeAll(() => {
      const databaseClient = createDatabaseClient({
        databaseUrl,
        poolConfig: {
          max: 1,
        },
      });
      client = databaseClient;
      service = createContentManagerFromDatabaseClient(databaseClient);
      server = createHttpServer({
        collectorProfileManager: createUnusedCollectorProfileManagerHttpService(),
        sourceGroupReferences: new FakeSourceGroupReferencePort(),
        collectorRuntime: createUnusedCollectorRuntimeHttpService(),
        contentManager: service,
      });
    });

    afterEach(async () => {
      if (client === undefined) {
        return;
      }

      const contentItemIds = [...createdContentItemIds];
      const sourceGroupIds = [...createdSourceGroupIds];
      const categoryIds = [...createdCategoryIds];
      const sourcePublisherIds = [...createdSourcePublisherIds];

      if (contentItemIds.length > 0) {
        await client.db
          .delete(contentItems)
          .where(inArray(contentItems.id, contentItemIds));
      }

      if (sourceGroupIds.length > 0) {
        await client.db
          .delete(sourceGroups)
          .where(inArray(sourceGroups.id, sourceGroupIds));
      }

      if (categoryIds.length > 0) {
        await client.db
          .delete(contentCategories)
          .where(inArray(contentCategories.id, categoryIds));
      }

      if (sourcePublisherIds.length > 0) {
        await client.db
          .delete(sourcePublishers)
          .where(inArray(sourcePublishers.id, sourcePublisherIds));
      }

      createdContentItemIds.clear();
      createdSourceGroupIds.clear();
      createdCategoryIds.clear();
      createdSourcePublisherIds.clear();
    });

    afterAll(async () => {
      await server?.close();

      if (service !== undefined) {
        await service.close();
        return;
      }

      await client?.close();
    });

    it("persists the Content Manager HTTP flow through composition, repositories, and PostgreSQL", async () => {
      const categorySlug = nextTestSlug("knowledge");
      const externalGroupId = nextTestId("external-group");
      const externalPostId = nextTestId("external-post");

      const createCategoryResponse = await getServer().inject({
        method: "POST",
        url: "/collector/content-categories",
        payload: {
          name: "HTTP DB Knowledge",
          slug: categorySlug,
          description: "HTTP DB category.",
        },
      });
      const createCategoryBody = createCategoryResponse.json() as {
        readonly category: {
          readonly id: string;
          readonly slug: string;
        };
      };
      const categoryId = trackCategoryId(createCategoryBody.category.id);

      expect(createCategoryResponse.statusCode).toBe(201);
      expect(createCategoryBody).toMatchObject({
        category: {
          id: categoryId,
          slug: categorySlug,
        },
      });

      const createSourceGroupResponse = await getServer().inject({
        method: "POST",
        url: "/collector/source-groups",
        payload: {
          platform: "FACEBOOK",
          externalGroupId,
          name: "HTTP DB Source Group",
          url: `https://facebook.test/groups/${externalGroupId}`,
          categoryId,
          collectionPriority: 70,
          notes: "HTTP DB source group.",
        },
      });
      const createSourceGroupBody = createSourceGroupResponse.json() as {
        readonly sourceGroup: {
          readonly id: string;
          readonly externalGroupId: string;
        };
      };
      const sourceGroupId = trackSourceGroupId(
        createSourceGroupBody.sourceGroup.id,
      );

      expect(createSourceGroupResponse.statusCode).toBe(201);
      expect(createSourceGroupBody).toMatchObject({
        sourceGroup: {
          id: sourceGroupId,
          externalGroupId,
          status: "ACTIVE",
          entryRoutes: [
            {
              id: "direct-group-url",
              type: "DIRECT_GROUP_URL",
              riskLevel: "MEDIUM",
              isDefault: true,
            },
          ],
        },
      });

      const addEntryRouteResponse = await getServer().inject({
        method: "POST",
        url: `/collector/source-groups/${sourceGroupId}/entry-routes`,
        payload: {
          type: "CATEGORY_ENTRY_URL",
          url: "https://facebook.test/groups/category-entry",
          label: "Category entry",
          riskLevel: "LOW",
        },
      });
      const addEntryRouteBody = addEntryRouteResponse.json() as {
        readonly sourceGroup: {
          readonly entryRoutes: readonly {
            readonly id: string;
            readonly type: string;
            readonly label?: string;
            readonly riskLevel: string;
            readonly isDefault: boolean;
          }[];
        };
      };
      const categoryEntryRoute = addEntryRouteBody.sourceGroup.entryRoutes.find(
        (route) => route.type === "CATEGORY_ENTRY_URL",
      );

      expect(addEntryRouteResponse.statusCode).toBe(201);
      expect(categoryEntryRoute).toMatchObject({
        type: "CATEGORY_ENTRY_URL",
        label: "Category entry",
        riskLevel: "LOW",
        isDefault: false,
      });

      if (categoryEntryRoute === undefined) {
        throw new Error("Expected category entry route to be returned.");
      }

      const updateEntryRouteResponse = await getServer().inject({
        method: "PATCH",
        url: `/collector/source-groups/${sourceGroupId}/entry-routes/${categoryEntryRoute.id}`,
        payload: {
          label: "Updated category entry",
          riskLevel: "MEDIUM",
        },
      });

      expect(updateEntryRouteResponse.statusCode).toBe(200);
      expect(updateEntryRouteResponse.json()).toMatchObject({
        sourceGroup: {
          entryRoutes: [
            {
              id: "direct-group-url",
              isDefault: true,
            },
            {
              id: categoryEntryRoute.id,
              label: "Updated category entry",
              riskLevel: "MEDIUM",
            },
          ],
        },
      });

      const deleteEntryRouteResponse = await getServer().inject({
        method: "DELETE",
        url: `/collector/source-groups/${sourceGroupId}/entry-routes/${categoryEntryRoute.id}`,
      });

      expect(deleteEntryRouteResponse.statusCode).toBe(200);
      expect(deleteEntryRouteResponse.json()).toMatchObject({
        sourceGroup: {
          entryRoutes: [
            {
              id: "direct-group-url",
              type: "DIRECT_GROUP_URL",
              isDefault: true,
            },
          ],
        },
      });

      const firstIngestResponse = await getServer().inject({
        method: "POST",
        url: "/collector/content-items",
        payload: createIngestPayload({
          sourceGroupId,
          externalPostId,
          reactionCount: 10,
          commentCount: 2,
          rawPayloadRef: "s3://content-payloads/http-db-first.json",
          topComments: [
            createTopCommentPayload({
              externalCommentId: nextTestId("comment-low"),
              bodyText: "Lower reaction comment.",
              reactionCount: 4,
            }),
            createTopCommentPayload({
              externalCommentId: nextTestId("comment-high"),
              bodyText: "Higher reaction comment.",
              reactionCount: 11,
            }),
          ],
        }),
      });
      const firstIngestBody = firstIngestResponse.json() as {
        readonly contentItem: {
          readonly id: string;
          readonly reactionCount: number;
          readonly commentCount: number;
          readonly topComments: readonly {
            readonly bodyText: string;
            readonly reactionCount: number;
          }[];
          readonly status: string;
        };
      };
      const contentItemId = trackContentItemId(
        firstIngestBody.contentItem.id,
      );

      expect(firstIngestResponse.statusCode).toBe(200);
      expect(firstIngestBody).toMatchObject({
        contentItem: {
          id: contentItemId,
          reactionCount: 10,
          commentCount: 2,
          status: "COLLECTED",
          topComments: [
            {
              bodyText: "Higher reaction comment.",
              reactionCount: 11,
            },
            {
              bodyText: "Lower reaction comment.",
              reactionCount: 4,
            },
          ],
        },
      });
      expectReadPayloadIsSafe(firstIngestBody);

      const getContentResponse = await getServer().inject({
        method: "GET",
        url: `/collector/content-items/${contentItemId}`,
      });
      expect(getContentResponse.statusCode).toBe(200);
      expect(getContentResponse.json()).toMatchObject({
        contentItem: {
          id: contentItemId,
          externalPostId,
          status: "COLLECTED",
        },
      });
      expectReadPayloadIsSafe(getContentResponse.json());

      const listContentResponse = await getServer().inject({
        method: "GET",
        url: `/collector/content-items?sourceGroupId=${encodeURIComponent(
          sourceGroupId,
        )}&limit=10&offset=0`,
      });
      const listContentBody = listContentResponse.json() as {
        readonly items: readonly {
          readonly id: string;
        }[];
      };

      expect(listContentResponse.statusCode).toBe(200);
      expect(
        listContentBody.items.some((item) => item.id === contentItemId),
      ).toBe(true);
      expectReadPayloadIsSafe(listContentBody);

      const updateStatusResponse = await getServer().inject({
        method: "PATCH",
        url: `/collector/content-items/${contentItemId}/status`,
        payload: {
          status: "SELECTED",
        },
      });
      expect(updateStatusResponse.statusCode).toBe(200);
      expect(updateStatusResponse.json()).toMatchObject({
        contentItem: {
          id: contentItemId,
          status: "SELECTED",
        },
      });

      const duplicateIngestResponse = await getServer().inject({
        method: "POST",
        url: "/collector/content-items",
        payload: createIngestPayload({
          sourceGroupId,
          externalPostId,
          bodyText: "Updated duplicate body text.",
          reactionCount: 31,
          commentCount: 8,
          rawPayloadRef: "s3://content-payloads/http-db-updated.json",
          topComments: [
            createTopCommentPayload({
              externalCommentId: nextTestId("comment-updated"),
              bodyText: "Updated high engagement comment.",
              reactionCount: 29,
            }),
          ],
        }),
      });
      const duplicateIngestBody = duplicateIngestResponse.json();

      expect(duplicateIngestResponse.statusCode).toBe(200);
      expect(duplicateIngestBody).toMatchObject({
        contentItem: {
          id: contentItemId,
          bodyText: "Updated duplicate body text.",
          reactionCount: 31,
          commentCount: 8,
          status: "SELECTED",
          topComments: [
            {
              bodyText: "Updated high engagement comment.",
              reactionCount: 29,
            },
          ],
        },
      });
      expectReadPayloadIsSafe(duplicateIngestBody);
    });

    function nextTestId(label: string): string {
      nextId += 1;

      return `http-db-content-${process.pid}-${Date.now()}-${nextId}-${label}`;
    }

    function nextTestSlug(label: string): string {
      return nextTestId(label).toLowerCase();
    }

    function trackCategoryId(categoryId: string): string {
      createdCategoryIds.add(categoryId);

      return categoryId;
    }

    function trackSourceGroupId(sourceGroupId: string): string {
      createdSourceGroupIds.add(sourceGroupId);

      return sourceGroupId;
    }

    function trackContentItemId(contentItemId: string): string {
      createdContentItemIds.add(contentItemId);

      return contentItemId;
    }

    function trackSourcePublisherId(sourcePublisherId: string): string {
      createdSourcePublisherIds.add(sourcePublisherId);

      return sourcePublisherId;
    }

    function getServer(): FastifyInstance {
      if (server === undefined) {
        throw new Error("HTTP server was not initialized.");
      }

      return server;
    }

    it("persists the Source Publisher HTTP flow through composition, repositories, and PostgreSQL", async () => {
      const externalPublisherId = nextTestId("external-publisher");
      const firstObservedAt = "2026-06-18T12:00:00.000Z";
      const secondObservedAt = "2026-06-18T13:30:00.000Z";

      const firstObserveResponse = await getServer().inject({
        method: "POST",
        url: "/collector/source-publishers/observations",
        payload: {
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId,
          observedAt: firstObservedAt,
          displayName: "HTTP DB Knowledge Group",
          canonicalUrl: `https://example.invalid/groups/${externalPublisherId}`,
        },
      });
      const firstObserveBody = firstObserveResponse.json() as {
        readonly sourcePublisher: {
          readonly id: string;
          readonly externalPublisherId: string;
          readonly platform: string;
          readonly kind: string;
          readonly status: string;
          readonly observationCount: number;
          readonly firstObservedAt: string;
          readonly lastObservedAt: string;
          readonly createdAt: string;
          readonly updatedAt: string;
        };
      };
      const sourcePublisherId = trackSourcePublisherId(
        firstObserveBody.sourcePublisher.id,
      );

      expect(firstObserveResponse.statusCode).toBe(200);
      expect(firstObserveBody).toMatchObject({
        sourcePublisher: {
          id: sourcePublisherId,
          externalPublisherId,
          platform: "FACEBOOK",
          kind: "GROUP",
          status: "DISCOVERED",
          observationCount: 1,
          firstObservedAt,
          lastObservedAt: firstObservedAt,
        },
      });
      expectSourcePublisherIsSafe(firstObserveBody);

      const secondObserveResponse = await getServer().inject({
        method: "POST",
        url: "/collector/source-publishers/observations",
        payload: {
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId,
          observedAt: secondObservedAt,
          displayName: "HTTP DB Knowledge Group (Updated)",
          canonicalUrl: `https://example.invalid/groups/${externalPublisherId}/v2`,
        },
      });
      const secondObserveBody = secondObserveResponse.json() as {
        readonly sourcePublisher: {
          readonly id: string;
          readonly status: string;
          readonly observationCount: number;
          readonly displayName?: string;
          readonly canonicalUrl?: string;
          readonly firstObservedAt: string;
          readonly lastObservedAt: string;
          readonly updatedAt: string;
        };
      };

      expect(secondObserveResponse.statusCode).toBe(200);
      expect(secondObserveBody).toMatchObject({
        sourcePublisher: {
          id: sourcePublisherId,
          status: "DISCOVERED",
          observationCount: 2,
          displayName: "HTTP DB Knowledge Group (Updated)",
          canonicalUrl: `https://example.invalid/groups/${externalPublisherId}/v2`,
          firstObservedAt,
          lastObservedAt: secondObservedAt,
        },
      });
      expectSourcePublisherIsSafe(secondObserveBody);

      const getResponse = await getServer().inject({
        method: "GET",
        url: `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}`,
      });
      const getBody = getResponse.json() as {
        readonly sourcePublisher: {
          readonly id: string;
          readonly externalPublisherId: string;
          readonly observationCount: number;
          readonly displayName?: string;
        };
      };

      expect(getResponse.statusCode).toBe(200);
      expect(getBody).toMatchObject({
        sourcePublisher: {
          id: sourcePublisherId,
          externalPublisherId,
          observationCount: 2,
          displayName: "HTTP DB Knowledge Group (Updated)",
        },
      });
      expectSourcePublisherIsSafe(getBody);

      const listResponse = await getServer().inject({
        method: "GET",
        url: `/collector/source-publishers?status=DISCOVERED&kind=GROUP&platform=FACEBOOK&limit=100&offset=0`,
      });
      const listBody = listResponse.json() as {
        readonly items: readonly {
          readonly id: string;
          readonly platform: string;
          readonly kind: string;
          readonly status: string;
        }[];
        readonly page: {
          readonly limit: number;
          readonly offset: number;
          readonly total: number;
        };
      };

      expect(listResponse.statusCode).toBe(200);
      expect(listBody.page).toEqual({ limit: 100, offset: 0, total: expect.any(Number) });
      expect(
        listBody.items.some(
          (item) =>
            item.id === sourcePublisherId &&
            item.platform === "FACEBOOK" &&
            item.kind === "GROUP" &&
            item.status === "DISCOVERED",
        ),
      ).toBe(true);
      expectSourcePublisherIsSafe(listBody);
    });
  });
}

interface CreateIngestPayloadOptions {
  readonly sourceGroupId: string;
  readonly externalPostId: string;
  readonly bodyText?: string;
  readonly reactionCount: number;
  readonly commentCount: number;
  readonly rawPayloadRef: string;
  readonly topComments: readonly ReturnType<typeof createTopCommentPayload>[];
}

function createIngestPayload(options: CreateIngestPayloadOptions) {
  return {
    platform: "FACEBOOK",
    sourceGroupId: options.sourceGroupId,
    externalPostId: options.externalPostId,
    sourceUrl: `https://facebook.test/posts/${options.externalPostId}`,
    title: "HTTP DB content item",
    bodyText: options.bodyText ?? "Original collected body text.",
    authorDisplayName: "Source Author",
    authorExternalId: "author-1",
    postedAt: "2026-02-01T09:00:00.000Z",
    collectedAt: "2026-02-01T10:00:00.000Z",
    reactionCount: options.reactionCount,
    commentCount: options.commentCount,
    shareCount: 1,
    topComments: options.topComments,
    rawPayloadRef: options.rawPayloadRef,
  };
}

interface CreateTopCommentPayloadOptions {
  readonly externalCommentId: string;
  readonly bodyText: string;
  readonly reactionCount: number;
}

function createTopCommentPayload(options: CreateTopCommentPayloadOptions) {
  return {
    externalCommentId: options.externalCommentId,
    bodyText: options.bodyText,
    authorDisplayName: "Comment Author",
    authorExternalId: "comment-author-1",
    reactionCount: options.reactionCount,
    replyCount: 1,
    postedAt: "2026-02-01T09:30:00.000Z",
    collectedAt: "2026-02-01T10:00:00.000Z",
  };
}

function expectReadPayloadIsSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("rawPayloadRef");
  expect(serialized).not.toContain("s3://content-payloads");
  expect(serialized).not.toContain("rawFacebookGraphqlPayload");
}

const SENSITIVE_SOURCE_PUBLISHER_KEYS = [
  "rawPayload",
  "rawPayloadRef",
  "cookies",
  "localStorage",
  "token",
  "tokens",
  "tokenHash",
  "authorization",
  "authorizationHeader",
  "headers",
  "viewerId",
  "accountId",
  "session",
  "proxy",
  "proxyCredentials",
  "fingerprint",
  "screenshot",
  "diagnostics",
] as const;

function expectSourcePublisherIsSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);

  for (const key of SENSITIVE_SOURCE_PUBLISHER_KEYS) {
    expect(serialized).not.toContain(`"${key}"`);
  }
}
