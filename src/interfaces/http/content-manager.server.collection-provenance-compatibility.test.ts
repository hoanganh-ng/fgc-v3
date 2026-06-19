import { describe, expect, it } from "vitest";
import { IngestCollectedContentHttpBodySchema } from "./schemas/content-manager.http-schemas";
import {
  getContentItemHttpRouteSchema,
  ingestCollectedContentHttpRouteSchema,
  listContentItemsHttpRouteSchema,
  updateContentStatusHttpRouteSchema,
} from "./schemas/content-manager.http-schemas";
import { toContentItemDto } from "./routes/content-manager.routes";
import type { ContentItemDto } from "./routes/content-manager.routes";
import { createContentItem } from "./test-support/content-manager-http-service";
import type { ContentItem } from "../../content-manager/domain";

describe("HTTP compatibility — collectionProvenance is never exposed (Sprint 064B)", () => {
  it("toContentItemDto does not serialize collectionProvenance", () => {
    const item: ContentItem = createContentItem();

    const dto: ContentItemDto = toContentItemDto(item);

    expect(
      Object.prototype.hasOwnProperty.call(dto, "collectionProvenance"),
    ).toBe(false);
    expect(
      (dto as unknown as { collectionProvenance?: unknown })
        .collectionProvenance,
    ).toBeUndefined();
  });

  it("the ingested ContentItemDto has the same property allowlist as before Sprint 064B", () => {
    // Build a content item with every optional field populated so
    // the DTO includes every allowed key.
    const item: ContentItem = createContentItem({
      title: "Title",
      authorDisplayName: "Author",
      authorExternalId: "author-1",
      postedAt: "2026-06-01T09:00:00.000Z",
      shareCount: 1,
    });

    const dto: ContentItemDto = toContentItemDto(item);

    const allowedKeys = [
      "id",
      "platform",
      "sourceGroupId",
      "externalPostId",
      "sourceUrl",
      "title",
      "bodyText",
      "authorDisplayName",
      "authorExternalId",
      "postedAt",
      "firstCollectedAt",
      "lastCollectedAt",
      "reactionCount",
      "commentCount",
      "shareCount",
      "topComments",
      "status",
      "createdAt",
      "updatedAt",
    ].sort();
    expect([...Object.keys(dto)].sort()).toEqual(allowedKeys);
  });

  it("the ingest HTTP body schema rejects a collectionProvenance field", () => {
    const parsed = IngestCollectedContentHttpBodySchema.safeParse({
      platform: "FACEBOOK",
      sourceGroupId: "source-group-1",
      externalPostId: "fb-post-1",
      sourceUrl: "https://facebook.test/posts/fb-post-1",
      bodyText: "Body",
      collectedAt: "2026-06-01T10:00:00.000Z",
      reactionCount: 1,
      commentCount: 0,
      topComments: [],
      collectionProvenance: {
        firstCollectionSurface: {
          kind: "SOURCE_GROUP",
          sourceGroupId: "source-group-1",
        },
      },
    });

    expect(parsed.success).toBe(false);
  });

  function getContentItemProperties(
    schema: { properties?: Record<string, unknown> },
  ): Record<string, unknown> {
    return (
      (
        schema.properties as
          | Record<string, { properties?: Record<string, unknown> }>
          | undefined
      )?.contentItem?.properties ?? {}
    );
  }

  function getListItemsProperties(
    schema: { properties?: Record<string, unknown> },
  ): Record<string, unknown> {
    const itemsSchema = (
      schema.properties as
        | Record<string, { items?: { properties?: Record<string, unknown> } }>
        | undefined
    )?.items;
    return itemsSchema?.items?.properties ?? {};
  }

  it("the ingest route schema does not expose collectionProvenance on the response", () => {
    const props = getContentItemProperties(
      ingestCollectedContentHttpRouteSchema.response[200] as unknown as {
        properties?: Record<string, unknown>;
      },
    );
    expect(
      Object.prototype.hasOwnProperty.call(props, "collectionProvenance"),
    ).toBe(false);
  });

  it("the get content item route schema does not expose collectionProvenance on the response", () => {
    const props = getContentItemProperties(
      getContentItemHttpRouteSchema.response[200] as unknown as {
        properties?: Record<string, unknown>;
      },
    );
    expect(
      Object.prototype.hasOwnProperty.call(props, "collectionProvenance"),
    ).toBe(false);
  });

  it("the list content items route schema does not expose collectionProvenance on the response items", () => {
    const props = getListItemsProperties(
      listContentItemsHttpRouteSchema.response[200] as unknown as {
        properties?: Record<string, unknown>;
      },
    );
    expect(
      Object.prototype.hasOwnProperty.call(props, "collectionProvenance"),
    ).toBe(false);
  });

  it("the update content status route schema does not expose collectionProvenance on the response", () => {
    const props = getContentItemProperties(
      updateContentStatusHttpRouteSchema.response[200] as unknown as {
        properties?: Record<string, unknown>;
      },
    );
    expect(
      Object.prototype.hasOwnProperty.call(props, "collectionProvenance"),
    ).toBe(false);
  });
});