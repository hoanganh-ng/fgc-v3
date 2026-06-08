import { describe, expect, it } from "vitest";
import {
  ContentCategoryAlreadyExistsError,
  ContentCategoryNotFoundError,
  ContentItemNotFoundError,
  InvalidContentStatusTransitionError,
  SourceGroupNotFoundError,
} from "../../content-manager/application";
import { createHttpServer } from "./server";
import {
  createUnusedCollectorProfileManagerHttpService,
} from "./test-support/collector-profile-manager-http-service";
import {
  createCollectedContentInput,
  createContentCategory,
  createContentItem,
  createFakeContentManagerHttpService,
  createSourceGroup,
  createTopComment,
} from "./test-support/content-manager-http-service";

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
});

function createTestServer(): {
  readonly server: ReturnType<typeof createHttpServer>;
  readonly service: ReturnType<typeof createFakeContentManagerHttpService>;
} {
  const service = createFakeContentManagerHttpService();

  return {
    server: createHttpServer({
      collectorProfileManager: createUnusedCollectorProfileManagerHttpService(),
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
