import { describe, expect, it } from "vitest";
import {
  ContentCategoryAlreadyExistsError,
  ContentCategoryNotFoundError,
  ContentItemNotFoundError,
  InvalidContentStatusTransitionError,
  SourceGroupNotFoundError,
  SourcePublisherNotFoundError,
} from "../../content-manager/application";
import { toSourcePublisherDto } from "./routes/content-manager.routes";
import { createHttpServer } from "./server";
import {
  createUnusedCollectorProfileManagerHttpService,
} from "./test-support/collector-profile-manager-http-service";
import {
  createUnusedCollectorRuntimeHttpService,
} from "./test-support/collector-runtime-http-service";
import {
  createCollectedContentInput,
  createContentCategory,
  createContentItem,
  createFakeContentManagerHttpService,
  createHomeFeedCollectedContentInput,
  createSourceGroup,
  createSourcePublisher,
  createTopComment,
} from "./test-support/content-manager-http-service";
import { FakeSourceGroupReferencePort } from "./test-support/source-group-reference-port";

describe("Content Manager HTTP routes", () => {
  it("creates content categories", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-categories",
        payload: {
          name: "Knowledge",
          slug: "knowledge",
          description: "Useful source groups.",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(service.createContentCategory.calls).toEqual([
        {
          name: "Knowledge",
          slug: "knowledge",
          description: "Useful source groups.",
        },
      ]);
      expect(response.json()).toMatchObject({
        category: {
          id: "category-1",
          name: "Knowledge",
          slug: "knowledge",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps duplicate content categories to 409", async () => {
    const { server, service } = createTestServer();

    service.createContentCategory.setError(
      new ContentCategoryAlreadyExistsError("slug", "knowledge"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-categories",
        payload: {
          name: "Knowledge",
          slug: "knowledge",
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: {
          code: "CONTENT_CATEGORY_ALREADY_EXISTS",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("lists content categories", async () => {
    const { server, service } = createTestServer();

    service.listContentCategories.setOutput([
      createContentCategory(),
      createContentCategory({
        id: "category-2",
        name: "Productivity",
        slug: "productivity",
      }),
    ]);

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/content-categories",
      });

      expect(response.statusCode).toBe(200);
      expect(service.listContentCategories.calls).toBe(1);
      expect(response.json()).toMatchObject({
        items: [
          {
            id: "category-1",
            slug: "knowledge",
          },
          {
            id: "category-2",
            slug: "productivity",
          },
        ],
      });
    } finally {
      await server.close();
    }
  });

  it("creates source groups", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/source-groups",
        payload: {
          platform: "FACEBOOK",
          externalGroupId: "fb-group-1",
          name: "Facebook Knowledge Group",
          url: "https://facebook.test/groups/fb-group-1",
          categoryId: "category-1",
          status: "ACTIVE",
          collectionPriority: 80,
          notes: "Primary group.",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(service.createSourceGroup.calls).toEqual([
        {
          platform: "FACEBOOK",
          externalGroupId: "fb-group-1",
          name: "Facebook Knowledge Group",
          url: "https://facebook.test/groups/fb-group-1",
          categoryId: "category-1",
          status: "ACTIVE",
          collectionPriority: 80,
          notes: "Primary group.",
        },
      ]);
      expect(response.json()).toMatchObject({
        sourceGroup: {
          id: "source-group-1",
          platform: "FACEBOOK",
          categoryId: "category-1",
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
    } finally {
      await server.close();
    }
  });

  it("maps missing categories when creating source groups to 404", async () => {
    const { server, service } = createTestServer();

    service.createSourceGroup.setError(
      new ContentCategoryNotFoundError("category-missing"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/source-groups",
        payload: {
          platform: "FACEBOOK",
          externalGroupId: "fb-group-1",
          name: "Facebook Knowledge Group",
          url: "https://facebook.test/groups/fb-group-1",
          categoryId: "category-missing",
          collectionPriority: 80,
        },
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: {
          code: "CONTENT_CATEGORY_NOT_FOUND",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("lists source groups with filters and pagination", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/source-groups?status=ACTIVE&categoryId=category-1&limit=10&offset=5",
      });

      expect(response.statusCode).toBe(200);
      expect(service.listSourceGroups.calls).toEqual([
        {
          status: "ACTIVE",
          categoryId: "category-1",
          limit: 10,
          offset: 5,
        },
      ]);
      expect(response.json()).toMatchObject({
        items: [
          {
            id: "source-group-1",
            entryRoutes: [
              {
                id: "direct-group-url",
                isDefault: true,
              },
            ],
          },
        ],
        page: {
          limit: 50,
          offset: 0,
          total: 1,
        },
      });
    } finally {
      await server.close();
    }
  });

  it("gets one source group", async () => {
    const { server, service } = createTestServer();

    service.getSourceGroup.setOutput(
      createSourceGroup({
        notes: "Operator-visible note.",
      }),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/source-groups/source-group-1",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.getSourceGroup.calls).toEqual([
        {
          sourceGroupId: "source-group-1",
        },
      ]);
      expect(body).toMatchObject({
        sourceGroup: {
          id: "source-group-1",
          platform: "FACEBOOK",
          url: "https://facebook.test/groups/fb-group-1",
          status: "ACTIVE",
          entryRoutes: [
            {
              id: "direct-group-url",
              type: "DIRECT_GROUP_URL",
              url: "https://facebook.test/groups/fb-group-1",
              riskLevel: "MEDIUM",
              isDefault: true,
            },
          ],
        },
      });
      expect(body.sourceGroup).not.toHaveProperty("rawPayloadRef");
      expect(body.sourceGroup).not.toHaveProperty("cookies");
      expect(body.sourceGroup).not.toHaveProperty("localStorage");
    } finally {
      await server.close();
    }
  });

  it("adds source group entry routes", async () => {
    const { server, service } = createTestServer();

    service.addSourceGroupEntryRoute.setOutput(
      createSourceGroup({
        entryRoutes: [
          createSourceGroup().entryRoutes[0]!,
          {
            id: "entry-route-2",
            type: "CATEGORY_ENTRY_URL",
            url: "https://facebook.test/groups/category-entry",
            label: "Category entry",
            notes: "Use as a lower-risk entry point.",
            riskLevel: "LOW",
            isDefault: false,
            createdAt: "2026-02-01T10:05:00.000Z",
            updatedAt: "2026-02-01T10:05:00.000Z",
          },
        ],
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/source-groups/source-group-1/entry-routes",
        payload: {
          type: "CATEGORY_ENTRY_URL",
          url: "https://facebook.test/groups/category-entry",
          label: "Category entry",
          notes: "Use as a lower-risk entry point.",
          riskLevel: "LOW",
        },
      });

      expect(response.statusCode).toBe(201);
      expect(service.addSourceGroupEntryRoute.calls).toEqual([
        {
          sourceGroupId: "source-group-1",
          type: "CATEGORY_ENTRY_URL",
          url: "https://facebook.test/groups/category-entry",
          label: "Category entry",
          notes: "Use as a lower-risk entry point.",
          riskLevel: "LOW",
        },
      ]);
      expect(response.json()).toMatchObject({
        sourceGroup: {
          entryRoutes: [
            {
              id: "direct-group-url",
              isDefault: true,
            },
            {
              id: "entry-route-2",
              type: "CATEGORY_ENTRY_URL",
              riskLevel: "LOW",
              isDefault: false,
            },
          ],
        },
      });
    } finally {
      await server.close();
    }
  });

  it("rejects invalid source group entry route create requests", async () => {
    const invalidPayloads = [
      {
        type: "UNKNOWN",
        url: "https://facebook.test/groups/category-entry",
        riskLevel: "LOW",
      },
      {
        type: "CATEGORY_ENTRY_URL",
        url: "not-a-url",
        riskLevel: "LOW",
      },
      {
        type: "CATEGORY_ENTRY_URL",
        url: "https://facebook.test/groups/category-entry",
        riskLevel: "UNKNOWN",
      },
    ];

    for (const payload of invalidPayloads) {
      const { server, service } = createTestServer();

      try {
        const response = await server.inject({
          method: "POST",
          url: "/collector/source-groups/source-group-1/entry-routes",
          payload,
        });

        expect(response.statusCode).toBe(400);
        expect(service.addSourceGroupEntryRoute.calls).toEqual([]);
      } finally {
        await server.close();
      }
    }
  });

  it("updates source group entry routes", async () => {
    const { server, service } = createTestServer();

    service.updateSourceGroupEntryRoute.setOutput(
      createSourceGroup({
        entryRoutes: [
          {
            ...createSourceGroup().entryRoutes[0]!,
            isDefault: false,
          },
          {
            id: "entry-route-2",
            type: "PUBLIC_PAGE_THEN_GROUP",
            url: "https://facebook.test/public-page",
            label: "Public page",
            riskLevel: "LOW",
            isDefault: true,
            createdAt: "2026-02-01T10:05:00.000Z",
            updatedAt: "2026-02-01T10:06:00.000Z",
          },
        ],
      }),
    );

    try {
      const response = await server.inject({
        method: "PATCH",
        url: "/collector/source-groups/source-group-1/entry-routes/entry-route-2",
        payload: {
          type: "PUBLIC_PAGE_THEN_GROUP",
          url: "https://facebook.test/public-page",
          label: "Public page",
          notes: null,
          riskLevel: "LOW",
          isDefault: true,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(service.updateSourceGroupEntryRoute.calls).toEqual([
        {
          sourceGroupId: "source-group-1",
          entryRouteId: "entry-route-2",
          type: "PUBLIC_PAGE_THEN_GROUP",
          url: "https://facebook.test/public-page",
          label: "Public page",
          notes: null,
          riskLevel: "LOW",
          isDefault: true,
        },
      ]);
      expect(response.json()).toMatchObject({
        sourceGroup: {
          entryRoutes: [
            {
              id: "direct-group-url",
              isDefault: false,
            },
            {
              id: "entry-route-2",
              isDefault: true,
            },
          ],
        },
      });
    } finally {
      await server.close();
    }
  });

  it("deletes source group entry routes", async () => {
    const { server, service } = createTestServer();

    service.removeSourceGroupEntryRoute.setOutput(createSourceGroup());

    try {
      const response = await server.inject({
        method: "DELETE",
        url: "/collector/source-groups/source-group-1/entry-routes/entry-route-2",
      });

      expect(response.statusCode).toBe(200);
      expect(service.removeSourceGroupEntryRoute.calls).toEqual([
        {
          sourceGroupId: "source-group-1",
          entryRouteId: "entry-route-2",
        },
      ]);
      expect(response.json()).toMatchObject({
        sourceGroup: {
          id: "source-group-1",
          entryRoutes: [
            {
              id: "direct-group-url",
              isDefault: true,
            },
          ],
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps missing source group reads to 404", async () => {
    const { server, service } = createTestServer();

    service.getSourceGroup.setError(
      new SourceGroupNotFoundError("source-group-missing"),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/source-groups/source-group-missing",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: {
          code: "SOURCE_GROUP_NOT_FOUND",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("updates source group status", async () => {
    const { server, service } = createTestServer();

    service.updateSourceGroupStatus.setOutput(
      createSourceGroup({ status: "PAUSED" }),
    );

    try {
      const response = await server.inject({
        method: "PATCH",
        url: "/collector/source-groups/source-group-1/status",
        payload: {
          status: "PAUSED",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(service.updateSourceGroupStatus.calls).toEqual([
        {
          sourceGroupId: "source-group-1",
          status: "PAUSED",
        },
      ]);
      expect(response.json()).toMatchObject({
        sourceGroup: {
          id: "source-group-1",
          status: "PAUSED",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("ingests normalized collected content", async () => {
    const { server, service } = createTestServer();
    const payload = createCollectedContentInput({
      rawPayloadRef: "s3://content-payloads/payload-1.json",
    });

    service.ingestCollectedContent.setOutput(
      createContentItem({
        rawPayloadRef: "s3://content-payloads/payload-1.json",
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-items",
        payload,
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.ingestCollectedContent.calls).toEqual([payload]);
      expect(body).toMatchObject({
        contentItem: {
          id: "content-item-1",
          platform: "FACEBOOK",
          sourceGroupId: "source-group-1",
          status: "COLLECTED",
        },
      });
      expect(body.contentItem).not.toHaveProperty("rawPayloadRef");
    } finally {
      await server.close();
    }
  });

  it("rejects raw GraphQL payload fields on content ingestion", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-items",
        payload: {
          ...createCollectedContentInput(),
          rawFacebookGraphqlPayload: {
            data: {
              feedback: "raw platform payload",
            },
          },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: {
          code: "VALIDATION_ERROR",
        },
      });
      expect(service.ingestCollectedContent.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("maps missing source groups during content ingestion to 404", async () => {
    const { server, service } = createTestServer();

    service.ingestCollectedContent.setError(
      new SourceGroupNotFoundError("source-group-missing"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-items",
        payload: createCollectedContentInput({
          sourceGroupId: "source-group-missing",
        }),
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: {
          code: "SOURCE_GROUP_NOT_FOUND",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("lists content items with filters and pagination", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/content-items?status=COLLECTED&sourceGroupId=source-group-1&limit=20&offset=4",
      });

      expect(response.statusCode).toBe(200);
      expect(service.listContentItems.calls).toEqual([
        {
          status: "COLLECTED",
          sourceGroupId: "source-group-1",
          limit: 20,
          offset: 4,
        },
      ]);
      expect(response.json()).toMatchObject({
        items: [
          {
            id: "content-item-1",
          },
        ],
        page: {
          limit: 50,
          offset: 0,
          total: 1,
        },
      });
    } finally {
      await server.close();
    }
  });

  it("gets one content item", async () => {
    const { server, service } = createTestServer();

    service.getContentItem.setOutput(
      createContentItem({
        rawPayloadRef: "s3://content-payloads/payload-1.json",
      }),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/content-items/content-item-1",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.getContentItem.calls).toEqual([
        {
          contentId: "content-item-1",
        },
      ]);
      expect(body).toMatchObject({
        contentItem: {
          id: "content-item-1",
          topComments: [
            {
              externalCommentId: "comment-1",
            },
          ],
        },
      });
      expectReadPayloadIsSafe(body);
    } finally {
      await server.close();
    }
  });

  it("maps missing content items to 404", async () => {
    const { server, service } = createTestServer();

    service.getContentItem.setError(
      new ContentItemNotFoundError("content-item-missing"),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/content-items/content-item-missing",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: {
          code: "CONTENT_ITEM_NOT_FOUND",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("updates content item status", async () => {
    const { server, service } = createTestServer();

    service.updateContentStatus.setOutput(
      createContentItem({ status: "SELECTED" }),
    );

    try {
      const response = await server.inject({
        method: "PATCH",
        url: "/collector/content-items/content-item-1/status",
        payload: {
          status: "SELECTED",
        },
      });

      expect(response.statusCode).toBe(200);
      expect(service.updateContentStatus.calls).toEqual([
        {
          contentId: "content-item-1",
          status: "SELECTED",
        },
      ]);
      expect(response.json()).toMatchObject({
        contentItem: {
          id: "content-item-1",
          status: "SELECTED",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("maps invalid content status transitions to 409", async () => {
    const { server, service } = createTestServer();

    service.updateContentStatus.setError(
      new InvalidContentStatusTransitionError("REJECTED", "SELECTED"),
    );

    try {
      const response = await server.inject({
        method: "PATCH",
        url: "/collector/content-items/content-item-1/status",
        payload: {
          status: "SELECTED",
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({
        error: {
          code: "INVALID_CONTENT_STATUS_TRANSITION",
        },
      });
    } finally {
      await server.close();
    }
  });

  it("omits raw payload references from content item read DTOs", async () => {
    const { server, service } = createTestServer();

    service.listContentItems.setOutput({
      items: [
        createContentItem({
          rawPayloadRef: "s3://content-payloads/raw-facebook-payload.json",
          topComments: [
            createTopComment({
              externalCommentId: "comment-raw-check",
            }),
          ],
        }),
      ],
      page: {
        limit: 50,
        offset: 0,
        total: 1,
      },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/content-items",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.listContentItems.calls).toEqual([
        {
          limit: 50,
          offset: 0,
        },
      ]);
      expectReadPayloadIsSafe(body);
    } finally {
      await server.close();
    }
  });

  it("observes a source publisher and returns the safe DTO", async () => {
    const { server, service } = createTestServer();

    service.observeSourcePublisher.setOutput(
      createSourcePublisher({
        observationCount: 1,
        externalPublisherId: "synthetic-group-123",
        displayName: "Synthetic Knowledge Group",
        canonicalUrl:
          "https://example.invalid/groups/synthetic-group-123",
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/source-publishers/observations",
        payload: {
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "synthetic-group-123",
          observedAt: "2026-06-18T12:00:00.000Z",
          displayName: "Synthetic Knowledge Group",
          canonicalUrl: "https://example.invalid/groups/synthetic-group-123",
        },
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.observeSourcePublisher.calls).toEqual([
        {
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "synthetic-group-123",
          observedAt: "2026-06-18T12:00:00.000Z",
          displayName: "Synthetic Knowledge Group",
          canonicalUrl: "https://example.invalid/groups/synthetic-group-123",
        },
      ]);
      expect(body).toMatchObject({
        sourcePublisher: {
          id: "source-publisher-1",
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "synthetic-group-123",
          displayName: "Synthetic Knowledge Group",
          canonicalUrl:
            "https://example.invalid/groups/synthetic-group-123",
          status: "DISCOVERED",
          observationCount: 1,
        },
      });
      expectSourcePublisherIsSafe(body);
    } finally {
      await server.close();
    }
  });

  it("keeps omitted displayName and canonicalUrl omitted on observation", async () => {
    const { server, service } = createTestServer();

    service.observeSourcePublisher.setOutput(
      createSourcePublisher({
        externalPublisherId: "synthetic-page-456",
        kind: "PAGE",
        displayName: undefined,
        canonicalUrl: undefined,
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/source-publishers/observations",
        payload: {
          platform: "FACEBOOK",
          kind: "PAGE",
          externalPublisherId: "synthetic-page-456",
          observedAt: "2026-06-18T13:00:00.000Z",
        },
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.observeSourcePublisher.calls).toEqual([
        {
          platform: "FACEBOOK",
          kind: "PAGE",
          externalPublisherId: "synthetic-page-456",
          observedAt: "2026-06-18T13:00:00.000Z",
        },
      ]);
      expect(body).toMatchObject({
        sourcePublisher: {
          platform: "FACEBOOK",
          kind: "PAGE",
          externalPublisherId: "synthetic-page-456",
        },
      });
      expect(body.sourcePublisher).not.toHaveProperty("displayName");
      expect(body.sourcePublisher).not.toHaveProperty("canonicalUrl");
    } finally {
      await server.close();
    }
  });

  it("rejects unknown fields on source publisher observation", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/source-publishers/observations",
        payload: {
          platform: "FACEBOOK",
          kind: "GROUP",
          externalPublisherId: "synthetic-group-123",
          observedAt: "2026-06-18T12:00:00.000Z",
          displayName: "Synthetic Knowledge Group",
          status: "APPROVED",
          observationCount: 99,
          firstObservedAt: "2026-06-18T12:00:00.000Z",
          lastObservedAt: "2026-06-18T12:00:00.000Z",
          createdAt: "2026-06-18T12:00:01.000Z",
          updatedAt: "2026-06-18T12:00:01.000Z",
          id: "source-publisher-x",
          rawPayload: { data: "raw" },
          rawPayloadRef: "s3://content-payloads/x.json",
          cookies: "session=abc",
          localStorage: { key: "value" },
          token: "secret",
          authorization: "Bearer secret",
          proxy: "http://proxy.invalid",
          viewerId: "viewer-1",
          accountId: "account-1",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({
        error: { code: "VALIDATION_ERROR" },
      });
      expect(service.observeSourcePublisher.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("rejects null optional fields on source publisher observation", async () => {
    const { server, service } = createTestServer();

    const payloads = [
      {
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "synthetic-group-123",
        observedAt: "2026-06-18T12:00:00.000Z",
        displayName: null,
      },
      {
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "synthetic-group-123",
        observedAt: "2026-06-18T12:00:00.000Z",
        canonicalUrl: null,
      },
    ];

    for (const payload of payloads) {
      const local = createTestServer();
      try {
        const response = await local.server.inject({
          method: "POST",
          url: "/collector/source-publishers/observations",
          payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
          error: { code: "VALIDATION_ERROR" },
        });
        expect(local.service.observeSourcePublisher.calls).toEqual([]);
      } finally {
        await local.server.close();
      }
    }

    // ensure outer service untouched
    expect(service.observeSourcePublisher.calls).toEqual([]);
  });

  it("rejects invalid observedAt, canonicalUrl, platform, and kind", async () => {
    const { server, service } = createTestServer();

    const invalidPayloads = [
      {
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "synthetic-group-123",
        observedAt: "not-a-datetime",
      },
      {
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "synthetic-group-123",
        observedAt: "2026-06-18T12:00:00.000Z",
        canonicalUrl: "not-a-url",
      },
      {
        platform: "TWITTER",
        kind: "GROUP",
        externalPublisherId: "synthetic-group-123",
        observedAt: "2026-06-18T12:00:00.000Z",
      },
      {
        platform: "FACEBOOK",
        kind: "CHANNEL",
        externalPublisherId: "synthetic-group-123",
        observedAt: "2026-06-18T12:00:00.000Z",
      },
      {
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "   ",
        observedAt: "2026-06-18T12:00:00.000Z",
      },
      {
        platform: "FACEBOOK",
        kind: "GROUP",
        externalPublisherId: "synthetic-group-123",
        observedAt: "2026-06-18T12:00:00.000Z",
        displayName: "",
      },
    ];

    for (const payload of invalidPayloads) {
      const local = createTestServer();
      try {
        const response = await local.server.inject({
          method: "POST",
          url: "/collector/source-publishers/observations",
          payload,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
          error: { code: "VALIDATION_ERROR" },
        });
        expect(local.service.observeSourcePublisher.calls).toEqual([]);
      } finally {
        await local.server.close();
      }
    }

    expect(service.observeSourcePublisher.calls).toEqual([]);
  });

  it("lists source publishers with filters and pagination", async () => {
    const { server, service } = createTestServer();

    service.listSourcePublishers.setOutput({
      items: [createSourcePublisher()],
      page: { limit: 25, offset: 5, total: 1 },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/source-publishers?status=DISCOVERED&kind=GROUP&platform=FACEBOOK&limit=25&offset=5",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.listSourcePublishers.calls).toEqual([
        {
          status: "DISCOVERED",
          kind: "GROUP",
          platform: "FACEBOOK",
          limit: 25,
          offset: 5,
        },
      ]);
      expect(body).toMatchObject({
        items: [
          {
            id: "source-publisher-1",
            platform: "FACEBOOK",
            kind: "GROUP",
            status: "DISCOVERED",
          },
        ],
        page: { limit: 25, offset: 5, total: 1 },
      });
      expectSourcePublisherIsSafe(body);
    } finally {
      await server.close();
    }
  });

  it("applies default limit 50 and offset 0 to source publisher list", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/source-publishers",
      });

      expect(response.statusCode).toBe(200);
      expect(service.listSourcePublishers.calls).toEqual([
        {
          limit: 50,
          offset: 0,
        },
      ]);
    } finally {
      await server.close();
    }
  });

  it("rejects invalid source publisher list filters without invocation", async () => {
    const { server, service } = createTestServer();

    const invalidUrls = [
      "/collector/source-publishers?status=REJECTED",
      "/collector/source-publishers?kind=CHANNEL",
      "/collector/source-publishers?platform=TWITTER",
      "/collector/source-publishers?limit=0",
      "/collector/source-publishers?limit=200",
      "/collector/source-publishers?limit=-1",
      "/collector/source-publishers?offset=-1",
      "/collector/source-publishers?unexpected=1",
    ];

    for (const url of invalidUrls) {
      const local = createTestServer();
      try {
        const response = await local.server.inject({
          method: "GET",
          url,
        });

        expect(response.statusCode).toBe(400);
        expect(response.json()).toMatchObject({
          error: { code: "VALIDATION_ERROR" },
        });
        expect(local.service.listSourcePublishers.calls).toEqual([]);
      } finally {
        await local.server.close();
      }
    }

    expect(service.listSourcePublishers.calls).toEqual([]);
  });

  it("keeps omitted metadata omitted on list response", async () => {
    const { server, service } = createTestServer();

    service.listSourcePublishers.setOutput({
      items: [createSourcePublisher({
        displayName: undefined,
        canonicalUrl: undefined,
      })],
      page: { limit: 50, offset: 0, total: 1 },
    });

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/source-publishers",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(body.items[0]).not.toHaveProperty("displayName");
      expect(body.items[0]).not.toHaveProperty("canonicalUrl");
    } finally {
      await server.close();
    }
  });

  it("gets one source publisher by id", async () => {
    const { server, service } = createTestServer();

    service.getSourcePublisher.setOutput(
      createSourcePublisher({
        displayName: "Synthetic Knowledge Group",
        canonicalUrl:
          "https://example.invalid/groups/synthetic-group-123",
        observationCount: 2,
        externalPublisherId: "synthetic-group-123",
      }),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/source-publishers/source-publisher-1",
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.getSourcePublisher.calls).toEqual([
        { sourcePublisherId: "source-publisher-1" },
      ]);
      expect(body).toMatchObject({
        sourcePublisher: {
          id: "source-publisher-1",
          observationCount: 2,
          displayName: "Synthetic Knowledge Group",
          canonicalUrl:
            "https://example.invalid/groups/synthetic-group-123",
          externalPublisherId: "synthetic-group-123",
        },
      });
      expectSourcePublisherIsSafe(body);
    } finally {
      await server.close();
    }
  });

  it("maps missing source publishers to 404 SOURCE_PUBLISHER_NOT_FOUND", async () => {
    const { server, service } = createTestServer();

    service.getSourcePublisher.setError(
      new SourcePublisherNotFoundError("source-publisher-missing"),
    );

    try {
      const response = await server.inject({
        method: "GET",
        url: "/collector/source-publishers/source-publisher-missing",
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({
        error: { code: "SOURCE_PUBLISHER_NOT_FOUND" },
      });
    } finally {
      await server.close();
    }
  });

  it("toSourcePublisherDto omits displayName and canonicalUrl when absent", async () => {
    const dto = toSourcePublisherDto(
      createSourcePublisher({
        displayName: undefined,
        canonicalUrl: undefined,
      }),
    );

    expect(dto).not.toHaveProperty("displayName");
    expect(dto).not.toHaveProperty("canonicalUrl");
    expect(dto.id).toBe("source-publisher-1");
    expect(dto.observationCount).toBe(1);
  });
});

function createTestServer(): {
  readonly server: ReturnType<typeof createHttpServer>;
  readonly service: ReturnType<typeof createFakeContentManagerHttpService>;
} {
  const service = createFakeContentManagerHttpService();

  return {
    server: createHttpServer({
      collectorProfileManager: createUnusedCollectorProfileManagerHttpService(),
      sourceGroupReferences: new FakeSourceGroupReferencePort(),
      collectorRuntime: createUnusedCollectorRuntimeHttpService(),
      contentManager: service,
    }),
    service,
  };
}

function expectReadPayloadIsSafe(payload: unknown): void {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("rawPayloadRef");
  expect(serialized).not.toContain("rawFacebookGraphqlPayload");
  expect(serialized).not.toContain("GraphQL");
  expect(serialized).not.toContain("s3://content-payloads");
}

const SENSITIVE_KEYS = [
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

  for (const key of SENSITIVE_KEYS) {
    expect(serialized).not.toContain(`"${key}"`);
  }
}

describe("Content Manager HTTP routes — home-feed ingestion", () => {
  it("ingests a home-feed candidate and omits sourceGroupId in the response", async () => {
    const { server, service } = createTestServer();
    const payload = createHomeFeedCollectedContentInput();

    service.ingestHomeFeedCollectedContent.setOutput(
      createContentItem({
        sourceGroupId: undefined,
        collectionProvenance: {
          firstCollectionSurface: { kind: "PROFILE_HOME_FEED" },
          sourcePublisherId: "source-publisher-1",
        },
      }),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-items/home-feed",
        payload,
      });
      const body = response.json();

      expect(response.statusCode).toBe(200);
      expect(service.ingestHomeFeedCollectedContent.calls).toEqual([payload]);
      expect(body).toMatchObject({
        contentItem: {
          id: "content-item-1",
          platform: "FACEBOOK",
          status: "COLLECTED",
        },
      });
      expect(body.contentItem).not.toHaveProperty("sourceGroupId");
      expect(body.contentItem).not.toHaveProperty("sourceGroupId:null");
    } finally {
      await server.close();
    }
  });

  it("rejects unknown fields on the home-feed ingestion body", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-items/home-feed",
        payload: {
          ...createHomeFeedCollectedContentInput(),
          rawFacebookGraphqlPayload: { data: { feedback: "leak" } },
        },
      });

      expect(response.statusCode).toBe(400);
      expect(service.ingestHomeFeedCollectedContent.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("rejects sourceGroupId on the home-feed ingestion body", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-items/home-feed",
        payload: {
          ...createHomeFeedCollectedContentInput(),
          sourceGroupId: "source-group-1",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(service.ingestHomeFeedCollectedContent.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("maps missing source publishers to 404 on home-feed ingestion", async () => {
    const { server, service } = createTestServer();

    service.ingestHomeFeedCollectedContent.setError(
      new SourcePublisherNotFoundError("source-publisher-missing"),
    );

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-items/home-feed",
        payload: createHomeFeedCollectedContentInput(),
      });

      expect(response.statusCode).toBe(404);
    } finally {
      await server.close();
    }
  });

  it("keeps POST /collector/content-items requiring sourceGroupId", async () => {
    const { server, service } = createTestServer();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-items",
        payload: {
          platform: "FACEBOOK",
          externalPostId: "post-1",
          sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-1",
          bodyText: "A useful post.",
          collectedAt: "2026-02-01T12:00:00.000Z",
          reactionCount: 0,
          commentCount: 0,
          topComments: [],
        },
      });

      expect(response.statusCode).toBe(400);
      expect(service.ingestCollectedContent.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });

  it("rejects a home-feed ingestion body that omits sourcePublisherId", async () => {
    const { server, service } = createTestServer();
    const { sourcePublisherId: _omitted, ...payloadWithoutPublisherId } =
      createHomeFeedCollectedContentInput();

    try {
      const response = await server.inject({
        method: "POST",
        url: "/collector/content-items/home-feed",
        payload: payloadWithoutPublisherId,
      });

      expect(response.statusCode).toBe(400);
      expect(service.ingestHomeFeedCollectedContent.calls).toEqual([]);
    } finally {
      await server.close();
    }
  });
});
