import { describe, expect, it } from "vitest";
import {
  ContentItemResponseSchema,
  ContentItemSchema,
  ContentItemsListResponseSchema,
  PromoteSourcePublisherToSourceGroupRequestSchema,
  SourcePublisherResponseSchema,
  SourcePublisherSchema,
  SourcePublishersListResponseSchema,
  toListSourcePublishersQueryParams,
} from "@/lib/api/content-manager-client";

const now = "2026-06-18T10:00:00.000Z";

function makeTopComment(): Record<string, unknown> {
  return {
    externalCommentId: "comment-1",
    bodyText: "Useful comment.",
    reactionCount: 9,
    collectedAt: now,
  };
}

function makeSourceGroupBackedItem(): Record<string, unknown> {
  return {
    id: "content-1",
    platform: "FACEBOOK",
    sourceGroupId: "source-group-1",
    externalPostId: "post-1",
    sourceUrl: "https://facebook.test/posts/post-1",
    title: "Title",
    bodyText: "Body text",
    authorDisplayName: "Author",
    authorExternalId: "author-1",
    postedAt: now,
    firstCollectedAt: now,
    lastCollectedAt: now,
    reactionCount: 12,
    commentCount: 3,
    shareCount: 1,
    topComments: [makeTopComment()],
    status: "COLLECTED",
    createdAt: now,
    updatedAt: now,
  };
}

describe("ContentItem API schema (Sprint 065C1)", () => {
  it("parses a ContentItem response with omitted sourceGroupId", () => {
    // Sprint 065C1 makes sourceGroupId optional on the ContentItem
    // DTO; the API contract must accept an absent sourceGroupId and
    // never a `null` value.
    const result = ContentItemSchema.safeParse({
      ...makeSourceGroupBackedItem(),
      sourceGroupId: undefined,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceGroupId).toBeUndefined();
    }
  });

  it("rejects a ContentItem response that serializes sourceGroupId as null", () => {
    // Sprint 065C1 contract: sourceGroupId must be omitted when
    // absent, never serialized as `null`. The Web UI schema enforces
    // this so a misbehaving backend is caught at the boundary.
    const result = ContentItemSchema.safeParse({
      ...makeSourceGroupBackedItem(),
      sourceGroupId: null,
    });

    expect(result.success).toBe(false);
  });

  it("parses a ContentItem response with a present sourceGroupId (legacy path)", () => {
    const result = ContentItemSchema.safeParse(makeSourceGroupBackedItem());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sourceGroupId).toBe("source-group-1");
    }
  });

  it("parses a ContentItemResponse envelope with omitted sourceGroupId", () => {
    const result = ContentItemResponseSchema.safeParse({
      contentItem: {
        ...makeSourceGroupBackedItem(),
        sourceGroupId: undefined,
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.contentItem.sourceGroupId).toBeUndefined();
    }
  });

  it("parses a ContentItemsListResponse with both home-feed-first and source-group-backed items", () => {
    const result = ContentItemsListResponseSchema.safeParse({
      items: [
        { ...makeSourceGroupBackedItem(), id: "content-1", sourceGroupId: "source-group-1" },
        { ...makeSourceGroupBackedItem(), id: "content-2", sourceGroupId: undefined },
      ],
      page: { limit: 50, offset: 0, total: 2 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items[0]?.sourceGroupId).toBe("source-group-1");
      expect(result.data.items[1]?.sourceGroupId).toBeUndefined();
    }
  });
});

function makeSourcePublisher(): Record<string, unknown> {
  return {
    id: "source-publisher-1",
    platform: "FACEBOOK",
    kind: "GROUP",
    externalPublisherId: "fb-group-1",
    displayName: "Publisher Group",
    canonicalUrl: "https://facebook.test/groups/fb-group-1",
    status: "DISCOVERED",
    firstObservedAt: now,
    lastObservedAt: now,
    observationCount: 2,
    createdAt: now,
    updatedAt: now,
  };
}

describe("SourcePublisher API schema (Sprint 069)", () => {
  it("parses the safe SourcePublisher DTO allowlist", () => {
    const result = SourcePublisherSchema.safeParse(makeSourcePublisher());

    expect(result.success).toBe(true);
  });

  it("accepts omitted optional displayName, canonicalUrl, and reviewUrl", () => {
    const result = SourcePublisherSchema.safeParse({
      ...makeSourcePublisher(),
      displayName: undefined,
      canonicalUrl: undefined,
      reviewUrl: undefined,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayName).toBeUndefined();
      expect(result.data.canonicalUrl).toBeUndefined();
      expect(result.data.reviewUrl).toBeUndefined();
    }
  });

  it("accepts a safe reviewUrl on the SourcePublisher DTO", () => {
    const result = SourcePublisherSchema.safeParse({
      ...makeSourcePublisher(),
      reviewUrl: "https://www.facebook.com/groups/fb-group-1/",
    });

    expect(result.success).toBe(true);
  });

  it("rejects null optional SourcePublisher fields", () => {
    const result = SourcePublisherSchema.safeParse({
      ...makeSourcePublisher(),
      displayName: null,
      canonicalUrl: null,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unsafe extra SourcePublisher fields", () => {
    const result = SourcePublisherSchema.safeParse({
      ...makeSourcePublisher(),
      accountId: "account-1",
      rawPayload: { value: true },
    });

    expect(result.success).toBe(false);
  });

  it("parses list and detail envelopes", () => {
    expect(
      SourcePublisherResponseSchema.safeParse({
        sourcePublisher: makeSourcePublisher(),
      }).success,
    ).toBe(true);
    expect(
      SourcePublishersListResponseSchema.safeParse({
        items: [makeSourcePublisher()],
        page: { limit: 100, offset: 0, total: 1 },
      }).success,
    ).toBe(true);
  });

  it("validates the strict promotion request body", () => {
    const result = PromoteSourcePublisherToSourceGroupRequestSchema.safeParse({
      categoryId: "category-1",
      collectionPriority: 50,
      name: "Publisher Group",
      url: "https://facebook.test/groups/fb-group-1",
      notes: "Reviewed by operator.",
    });

    expect(result.success).toBe(true);
    expect(
      PromoteSourcePublisherToSourceGroupRequestSchema.safeParse({
        categoryId: "category-1",
        collectionPriority: 101,
      }).success,
    ).toBe(false);
    expect(
      PromoteSourcePublisherToSourceGroupRequestSchema.safeParse({
        categoryId: "category-1",
        collectionPriority: 50,
        notes: null,
      }).success,
    ).toBe(false);
  });

  it("builds source publisher list query params without undefined filters", () => {
    expect(
      toListSourcePublishersQueryParams({
        status: "DISCOVERED",
        kind: "GROUP",
        platform: "FACEBOOK",
        limit: 100,
        offset: 0,
      }),
    ).toEqual({
      status: "DISCOVERED",
      kind: "GROUP",
      platform: "FACEBOOK",
      limit: 100,
      offset: 0,
    });

    expect(toListSourcePublishersQueryParams({ limit: 100, offset: 0 })).toEqual(
      {
        limit: 100,
        offset: 0,
      },
    );
  });
});
