import { inArray, sql } from "drizzle-orm";
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
import {
  createUnusedContentBuilderHttpService,
} from "./test-support/content-builder-http-service";
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
        contentBuilder: createUnusedContentBuilderHttpService(),
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

    // --------------------------------------------------------------
    // Sprint 066 — Source Publisher status mutation HTTP integration
    // through composition → repositories → PostgreSQL with safe DTO
    // assertions and a final GET round-trip confirming durable
    // persistence.
    // --------------------------------------------------------------
    it("persists a Source Publisher status mutation through composition, repositories, and PostgreSQL", async () => {
      const externalPublisherId = nextTestId("external-publisher-status");

      // 1. Observe a fresh SourcePublisher through the existing route.
      const observeResponse = await getServer().inject({
        method: "POST",
        url: "/collector/source-publishers/observations",
        payload: {
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId,
          observedAt: "2026-06-18T12:00:00.000Z",
          displayName: "HTTP DB Status Group",
          canonicalUrl: `https://example.invalid/groups/${externalPublisherId}`,
        },
      });
      const observeBody = observeResponse.json() as {
        readonly sourcePublisher: { readonly id: string; readonly status: string };
      };
      const sourcePublisherId = trackSourcePublisherId(
        observeBody.sourcePublisher.id,
      );

      expect(observeResponse.statusCode).toBe(200);
      expect(observeBody.sourcePublisher.status).toBe("DISCOVERED");

      // 2. PATCH the status to APPROVED.
      const patchResponse = await getServer().inject({
        method: "PATCH",
        url: `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}/status`,
        payload: { status: "APPROVED" },
      });
      const patchBody = patchResponse.json() as {
        readonly sourcePublisher: {
          readonly id: string;
          readonly status: string;
          readonly updatedAt: string;
        };
      };

      expect(patchResponse.statusCode).toBe(200);
      expect(patchBody.sourcePublisher.id).toBe(sourcePublisherId);
      expect(patchBody.sourcePublisher.status).toBe("APPROVED");
      expectSourcePublisherIsSafe(patchBody);

      // 3. GET back to confirm the status was durably persisted.
      const getResponse = await getServer().inject({
        method: "GET",
        url: `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}`,
      });
      const getBody = getResponse.json() as {
        readonly sourcePublisher: { readonly status: string };
      };

      expect(getResponse.statusCode).toBe(200);
      expect(getBody.sourcePublisher.status).toBe("APPROVED");
      expectSourcePublisherIsSafe(getBody);
    });

    // --------------------------------------------------------------
    // Sprint 067 — promote an APPROVED Facebook GROUP
    // SourcePublisher into a managed PAUSED SourceGroup through
    // composition → repositories → PostgreSQL.
    // --------------------------------------------------------------
    it("promotes an APPROVED FACEBOOK GROUP publisher into a PAUSED SourceGroup through composition, repositories, and PostgreSQL", async () => {
      const externalPublisherId = nextTestId(
        "external-publisher-promote-create",
      );
      const categorySlug = nextTestSlug("promote-create-category");

      // 1. Seed a category through the existing HTTP boundary.
      const categoryResponse = await getServer().inject({
        method: "POST",
        url: "/collector/content-categories",
        payload: {
          name: "Promote Create Category",
          slug: categorySlug,
        },
      });
      const categoryId = trackCategoryId(
        (
          categoryResponse.json() as {
            readonly category: { readonly id: string };
          }
        ).category.id,
      );

      expect(categoryResponse.statusCode).toBe(201);

      // 2. Observe a fresh APPROVED Facebook GROUP publisher through
      // the existing route. The promote flow requires an APPROVED
      // publisher, so seed the publisher and patch its status to
      // APPROVED before promoting.
      const observeResponse = await getServer().inject({
        method: "POST",
        url: "/collector/source-publishers/observations",
        payload: {
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId,
          observedAt: "2026-06-18T12:00:00.000Z",
          displayName: "HTTP DB Promote Group",
          canonicalUrl: `https://example.invalid/groups/${externalPublisherId}`,
        },
      });
      const observeBody = observeResponse.json() as {
        readonly sourcePublisher: { readonly id: string };
      };
      const sourcePublisherId = trackSourcePublisherId(
        observeBody.sourcePublisher.id,
      );

      expect(observeResponse.statusCode).toBe(200);

      const patchResponse = await getServer().inject({
        method: "PATCH",
        url: `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}/status`,
        payload: { status: "APPROVED" },
      });
      const patchBody = patchResponse.json() as {
        readonly sourcePublisher: { readonly status: string };
      };

      expect(patchResponse.statusCode).toBe(200);
      expect(patchBody.sourcePublisher.status).toBe("APPROVED");

      // 3. POST the new promote endpoint. The first call should
      // return CREATED and a PAUSED SourceGroup.
      const promoteResponse = await getServer().inject({
        method: "POST",
        url: `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}/promote-to-source-group`,
        payload: {
          categoryId,
          collectionPriority: 75,
          notes: "Promoted via Sprint 067 integration test.",
        },
      });
      const promoteBody = promoteResponse.json() as {
        readonly sourceGroup: {
          readonly id: string;
          readonly platform: string;
          readonly externalGroupId: string;
          readonly status: string;
          readonly collectionPriority: number;
          readonly categoryId: string;
          readonly entryRoutes: readonly { readonly isDefault: boolean }[];
        };
        readonly promotion: { readonly outcome: "CREATED" | "ALREADY_EXISTS" };
      };
      const promotedSourceGroupId = trackSourceGroupId(
        promoteBody.sourceGroup.id,
      );

      expect(promoteResponse.statusCode).toBe(200);
      expect(promoteBody.promotion).toEqual({ outcome: "CREATED" });
      expect(promoteBody.sourceGroup).toMatchObject({
        id: promotedSourceGroupId,
        platform: "FACEBOOK",
        externalGroupId: externalPublisherId,
        status: "PAUSED",
        collectionPriority: 75,
        categoryId,
      });
      expect(
        promoteBody.sourceGroup.entryRoutes.some((route) => route.isDefault),
      ).toBe(true);
      expectReadPayloadIsSafe(promoteBody);

      // 4. Re-promote the same publisher. Outcome must be
      // ALREADY_EXISTS and the same SourceGroup id must come back.
      const rePromoteResponse = await getServer().inject({
        method: "POST",
        url: `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}/promote-to-source-group`,
        payload: {
          categoryId,
          collectionPriority: 90,
        },
      });
      const rePromoteBody = rePromoteResponse.json() as {
        readonly sourceGroup: { readonly id: string };
        readonly promotion: { readonly outcome: "CREATED" | "ALREADY_EXISTS" };
      };

      expect(rePromoteResponse.statusCode).toBe(200);
      expect(rePromoteBody.promotion).toEqual({ outcome: "ALREADY_EXISTS" });
      expect(rePromoteBody.sourceGroup.id).toBe(promotedSourceGroupId);
      expectReadPayloadIsSafe(rePromoteBody);

      // 5. Inspect the persisted SourceGroup row and confirm the
      // PAUSED status, the category id, and the entry-route JSONB.
      const [persistedRow] = await client!.db
        .select({
          id: sourceGroups.id,
          platform: sourceGroups.platform,
          externalGroupId: sourceGroups.externalGroupId,
          status: sourceGroups.status,
          categoryId: sourceGroups.categoryId,
          collectionPriority: sourceGroups.collectionPriority,
          entryRoutes: sourceGroups.entryRoutes,
        })
        .from(sourceGroups)
        .where(sql`${sourceGroups.id} = ${promotedSourceGroupId}`);
      expect(persistedRow).toMatchObject({
        id: promotedSourceGroupId,
        platform: "FACEBOOK",
        externalGroupId: externalPublisherId,
        status: "PAUSED",
        categoryId,
        collectionPriority: 75,
      });
      expect(persistedRow?.entryRoutes).toEqual([
        expect.objectContaining({
          id: "direct-group-url",
          type: "DIRECT_GROUP_URL",
          isDefault: true,
        }),
      ]);

      // 6. The SourcePublisher status must remain APPROVED. Promotion
      // never mutates the publisher review status.
      const publisherAfterResponse = await getServer().inject({
        method: "GET",
        url: `/collector/source-publishers/${encodeURIComponent(sourcePublisherId)}`,
      });
      const publisherAfterBody = publisherAfterResponse.json() as {
        readonly sourcePublisher: { readonly status: string };
      };

      expect(publisherAfterResponse.statusCode).toBe(200);
      expect(publisherAfterBody.sourcePublisher.status).toBe("APPROVED");
    });

    // --------------------------------------------------------------
    // Sprint 065C1 — bare home-feed HTTP integration through
    // composition → repositories → PostgreSQL with end-to-end
    // safe DTO assertions and a final source-group follow-up that
    // preserves the PROFILE_HOME_FEED first surface.
    // --------------------------------------------------------------
    it("ingests a home-feed candidate, persists SQL NULL on source_group_id, and exposes a safe DTO", async () => {
      const externalPublisherId = nextTestId("external-publisher-home-feed");
      const externalPostId = nextTestId("external-post-home-feed");

      // 1. Create or observe a synthetic SourcePublisher through the
      // existing HTTP boundary.
      const observeResponse = await getServer().inject({
        method: "POST",
        url: "/collector/source-publishers/observations",
        payload: {
          platform: "FACEBOOK",
          kind: "PAGE",
          externalPublisherId,
          observedAt: "2026-06-18T12:00:00.000Z",
          displayName: "Synthetic Home Feed Publisher",
          canonicalUrl: `https://example.invalid/pages/${externalPublisherId}`,
        },
      });
      const observeBody = observeResponse.json() as {
        readonly sourcePublisher: { readonly id: string };
      };
      const sourcePublisherId = trackSourcePublisherId(
        observeBody.sourcePublisher.id,
      );

      expect(observeResponse.statusCode).toBe(200);

      // 2. POST /collector/content-items/home-feed using the returned
      // publisher id and normalized synthetic content.
      const ingestResponse = await getServer().inject({
        method: "POST",
        url: "/collector/content-items/home-feed",
        payload: {
          sourcePublisherId,
          platform: "FACEBOOK",
          externalPostId,
          sourceUrl: `https://facebook.test/posts/${externalPostId}`,
          title: "Home-feed candidate",
          bodyText: "A normalized home-feed candidate body.",
          authorDisplayName: "Home Author",
          authorExternalId: "home-author-1",
          postedAt: "2026-02-01T09:00:00.000Z",
          collectedAt: "2026-02-01T10:00:00.000Z",
          reactionCount: 12,
          commentCount: 3,
          topComments: [
            {
              externalCommentId: nextTestId("home-comment"),
              bodyText: "Top home-feed comment.",
              reactionCount: 9,
              collectedAt: "2026-02-01T10:00:00.000Z",
            },
          ],
        },
      });
      const ingestBody = ingestResponse.json() as {
        readonly contentItem: {
          readonly id: string;
          readonly platform: string;
          readonly status: string;
          readonly sourceGroupId?: string;
        };
      };
      const contentItemId = trackContentItemId(ingestBody.contentItem.id);

      // 3. Response asserts safe envelope + omission of sourceGroupId.
      expect(ingestResponse.statusCode).toBe(200);
      expect(ingestBody.contentItem).not.toHaveProperty("sourceGroupId");
      expect(ingestBody.contentItem).toMatchObject({
        id: contentItemId,
        platform: "FACEBOOK",
        status: "COLLECTED",
      });
      expect(JSON.stringify(ingestBody)).not.toContain("collectionProvenance");
      expect(JSON.stringify(ingestBody)).not.toContain("sourcePublisherId");
      expectHomeFeedResponseIsSafe(ingestBody);

      // 4. GET the item and confirm the same safe response behavior.
      const getResponse = await getServer().inject({
        method: "GET",
        url: `/collector/content-items/${contentItemId}`,
      });
      const getBody = getResponse.json() as {
        readonly contentItem: Record<string, unknown>;
      };

      expect(getResponse.statusCode).toBe(200);
      expect(getBody.contentItem).not.toHaveProperty("sourceGroupId");
      expect(JSON.stringify(getBody)).not.toContain("collectionProvenance");
      expect(JSON.stringify(getBody)).not.toContain("sourcePublisherId");
      expectHomeFeedResponseIsSafe(getBody);

      // 5. List content items and confirm the item is returned safely.
      const listResponse = await getServer().inject({
        method: "GET",
        url: "/collector/content-items?limit=100&offset=0",
      });
      const listBody = listResponse.json() as {
        readonly items: readonly { readonly id: string }[];
      };

      expect(listResponse.statusCode).toBe(200);
      expect(
        listBody.items.some((item) => item.id === contentItemId),
      ).toBe(true);
      expectHomeFeedResponseIsSafe(listBody);

      // 6. Inspect persistence through the database seam and confirm
      // source_group_id is SQL NULL. We must NOT use the public DTO
      // to perform this assertion — collectionProvenance is internal.
      const [persistedRow] = await client!.db
        .select({
          sourceGroupId: contentItems.sourceGroupId,
          collectionProvenance: contentItems.collectionProvenance,
        })
        .from(contentItems)
        .where(sql`${contentItems.id} = ${contentItemId}`);
      expect(persistedRow?.sourceGroupId).toBeNull();
      expect(persistedRow?.collectionProvenance).toEqual({
        firstCollectionSurface: { kind: "PROFILE_HOME_FEED" },
        sourcePublisherId,
      });

      // 7. Create a synthetic Category and SourceGroup, then submit
      // the same platform + externalPostId through the legacy
      // source-group endpoint. The follow-up must fill
      // `managedSourceGroupId` while preserving PROFILE_HOME_FEED as
      // the first surface.
      const categorySlug = nextTestSlug("home-feed-category");
      const categoryId = trackCategoryId(
        (
          (await getServer().inject({
            method: "POST",
            url: "/collector/content-categories",
            payload: {
              name: "Home Feed Category",
              slug: categorySlug,
            },
          })).json() as { readonly category: { readonly id: string } }
        ).category.id,
      );

      const sourceGroupId = trackSourceGroupId(
        (
          (await getServer().inject({
            method: "POST",
            url: "/collector/source-groups",
            payload: {
              platform: "FACEBOOK",
              externalGroupId: nextTestId("external-group-home-feed"),
              name: "Home Feed Source Group",
              url: `https://facebook.test/groups/home-feed-${categoryId}`,
              categoryId,
              collectionPriority: 50,
            },
          })).json() as { readonly sourceGroup: { readonly id: string } }
        ).sourceGroup.id,
      );

      const followUpResponse = await getServer().inject({
        method: "POST",
        url: "/collector/content-items",
        payload: createIngestPayload({
          sourceGroupId,
          externalPostId,
          reactionCount: 25,
          commentCount: 5,
          rawPayloadRef: "s3://content-payloads/home-feed-followup.json",
          topComments: [
            createTopCommentPayload({
              externalCommentId: nextTestId("home-feed-followup-comment"),
              bodyText: "Follow-up high engagement comment.",
              reactionCount: 21,
            }),
          ],
        }),
      });
      const followUpBody = followUpResponse.json() as {
        readonly contentItem: {
          readonly id: string;
          readonly sourceGroupId?: string;
          readonly status: string;
        };
      };

      // 9. Public DTO now returns sourceGroupId.
      expect(followUpResponse.statusCode).toBe(200);
      expect(followUpBody.contentItem).toMatchObject({
        id: contentItemId,
        sourceGroupId,
      });

      // 10. Internal provenance still preserves PROFILE_HOME_FEED and
      // carries sourcePublisherId + managedSourceGroupId.
      const [followUpRow] = await client!.db
        .select({
          sourceGroupId: contentItems.sourceGroupId,
          collectionProvenance: contentItems.collectionProvenance,
        })
        .from(contentItems)
        .where(sql`${contentItems.id} = ${contentItemId}`);
      expect(followUpRow?.sourceGroupId).toBe(sourceGroupId);
      expect(followUpRow?.collectionProvenance).toEqual({
        firstCollectionSurface: { kind: "PROFILE_HOME_FEED" },
        sourcePublisherId,
        managedSourceGroupId: sourceGroupId,
      });

      // 11. Duplicate follow-up must not persist changes. Re-submit the
      // same platform + externalPostId with a NEW (different)
      // sourceGroupId through the legacy endpoint — the merge must
      // throw ContentCollectionProvenanceConflictError because the
      // existing item already carries `managedSourceGroupId`.
      const conflictSourceGroupId = trackSourceGroupId(
        (
          (await getServer().inject({
            method: "POST",
            url: "/collector/source-groups",
            payload: {
              platform: "FACEBOOK",
              externalGroupId: nextTestId("external-group-conflict"),
              name: "Conflict Source Group",
              url: `https://facebook.test/groups/conflict-${categoryId}`,
              categoryId,
              collectionPriority: 25,
            },
          })).json() as { readonly sourceGroup: { readonly id: string } }
        ).sourceGroup.id,
      );

      const duplicateResponse = await getServer().inject({
        method: "POST",
        url: "/collector/content-items",
        payload: createIngestPayload({
          sourceGroupId: conflictSourceGroupId,
          externalPostId,
          reactionCount: 999,
          commentCount: 999,
          rawPayloadRef: "s3://content-payloads/conflicting.json",
          topComments: [],
        }),
      });

      expect(duplicateResponse.statusCode).toBe(409);
      expect(duplicateResponse.json()).toMatchObject({
        error: {
          code: "CONTENT_COLLECTION_PROVENANCE_CONFLICT",
        },
      });

      const [afterConflictRow] = await client!.db
        .select({
          reactionCount: contentItems.reactionCount,
          commentCount: contentItems.commentCount,
          sourceGroupId: contentItems.sourceGroupId,
        })
        .from(contentItems)
        .where(sql`${contentItems.id} = ${contentItemId}`);
      expect(afterConflictRow?.reactionCount).toBe(25);
      expect(afterConflictRow?.commentCount).toBe(5);
      expect(afterConflictRow?.sourceGroupId).toBe(sourceGroupId);
    });
  });
}

function expectHomeFeedResponseIsSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("rawPayload");
  expect(serialized).not.toContain("rawPayloadRef");
  expect(serialized).not.toContain("rawFacebookGraphqlPayload");
  expect(serialized).not.toContain("s3://content-payloads");
  expect(serialized).not.toContain("collectionProvenance");
  expect(serialized).not.toContain("cookies");
  expect(serialized).not.toContain("localStorage");
  expect(serialized).not.toContain("token");
  expect(serialized).not.toContain("authorization");
  expect(serialized).not.toContain("proxy");
  expect(serialized).not.toContain("viewerId");
  expect(serialized).not.toContain("accountId");
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
