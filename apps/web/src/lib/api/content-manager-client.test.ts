import { describe, expect, it } from "vitest";
import {
  ContentItemResponseSchema,
  ContentItemSchema,
  ContentItemsListResponseSchema,
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
