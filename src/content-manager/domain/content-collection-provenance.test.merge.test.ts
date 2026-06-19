import { describe, expect, it } from "vitest";
import {
  ContentCollectionProvenanceSchema,
  ContentItemSchema,
  type CollectedContentInput,
  type ContentCollectionProvenance,
  type ContentItem,
  type TopComment,
  mergeCollectedContent,
  validateContentItem,
} from "./index";

const createdAt = "2026-04-01T10:00:00.000Z";
const updatedAt = "2026-04-01T11:00:00.000Z";
const firstCollectedAt = "2026-04-01T12:00:00.000Z";
const lastCollectedAt = "2026-04-01T12:05:00.000Z";
const laterUpdatedAt = "2026-04-02T11:00:00.000Z";

function createProvenance(
  sourceGroupId: string,
): ContentCollectionProvenance {
  return {
    firstCollectionSurface: {
      kind: "SOURCE_GROUP",
      sourceGroupId,
    },
    managedSourceGroupId: sourceGroupId,
  };
}

function createContentItem(
  overrides: Partial<ContentItem> = {},
): ContentItem {
  const sourceGroupId = overrides.sourceGroupId ?? "source-group-1";
  const provenance = createProvenance(sourceGroupId);

  return {
    id: "content-1",
    platform: "FACEBOOK",
    sourceGroupId,
    externalPostId: "post-1",
    sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-1",
    title: "Useful post",
    bodyText: "A useful knowledge-rich post.",
    authorDisplayName: "Post Author",
    authorExternalId: "post-author-1",
    postedAt: firstCollectedAt,
    firstCollectedAt,
    lastCollectedAt,
    reactionCount: 100,
    commentCount: 20,
    shareCount: 5,
    topComments: [createTopComment()],
    status: "COLLECTED",
    rawPayloadRef: "payload-ref-1",
    collectionProvenance: provenance,
    createdAt,
    updatedAt,
    ...overrides,
  };
}

function createTopComment(overrides: Partial<TopComment> = {}): TopComment {
  return {
    externalCommentId: "comment-1",
    bodyText: "Useful comment.",
    authorDisplayName: "Comment Author",
    authorExternalId: "author-1",
    reactionCount: 10,
    replyCount: 2,
    postedAt: firstCollectedAt,
    collectedAt: lastCollectedAt,
    ...overrides,
  };
}

function createCollectedContentInput(
  overrides: Partial<CollectedContentInput> = {},
): CollectedContentInput {
  return {
    platform: "FACEBOOK",
    sourceGroupId: "source-group-1",
    externalPostId: "post-1",
    sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-1",
    title: "Useful post",
    bodyText: "A useful knowledge-rich post.",
    authorDisplayName: "Post Author",
    authorExternalId: "post-author-1",
    postedAt: firstCollectedAt,
    collectedAt: lastCollectedAt,
    reactionCount: 150,
    commentCount: 25,
    shareCount: 7,
    topComments: [createTopComment()],
    rawPayloadRef: "payload-ref-2",
    ...overrides,
  };
}

describe("ContentItem with collectionProvenance (Sprint 064B)", () => {
  it("round-trips a content item with a SOURCE_GROUP collectionProvenance", () => {
    const item = createContentItem();

    const result = validateContentItem(item);

    expect(result.valid).toBe(true);
    if (!result.valid) {
      return;
    }
    expect(result.value.collectionProvenance.firstCollectionSurface.kind).toBe(
      "SOURCE_GROUP",
    );
    expect(
      result.value.collectionProvenance.firstCollectionSurface,
    ).toEqual({ kind: "SOURCE_GROUP", sourceGroupId: "source-group-1" });
    expect(result.value.collectionProvenance.managedSourceGroupId).toBe(
      "source-group-1",
    );
    expect(result.value.collectionProvenance.sourcePublisherId).toBeUndefined();
  });

  it("rejects a content item missing collectionProvenance", () => {
    const { collectionProvenance: _provenance, ...withoutProvenance } =
      createContentItem();

    const result = ContentItemSchema.safeParse(withoutProvenance);

    expect(result.success).toBe(false);
  });

  it("rejects a content item whose collectionProvenance disagrees with sourceGroupId", () => {
    const item = createContentItem({
      collectionProvenance: {
        firstCollectionSurface: {
          kind: "SOURCE_GROUP",
          sourceGroupId: "different-source-group",
        },
        managedSourceGroupId: "different-source-group",
      },
    });

    const result = validateContentItem(item);

    expect(result.valid).toBe(false);
    if (result.valid) {
      return;
    }
    const paths = result.issues.map((issue) => issue.path);
    expect(
      paths.some((path) =>
        path.startsWith("collectionProvenance.firstCollectionSurface"),
      ),
    ).toBe(true);
  });

  it("rejects a content item with a PROFILE_HOME_FEED first surface", () => {
    const item = createContentItem({
      collectionProvenance: {
        firstCollectionSurface: { kind: "PROFILE_HOME_FEED" },
      } as ContentCollectionProvenance,
    });

    const result = validateContentItem(item);

    expect(result.valid).toBe(false);
    if (result.valid) {
      return;
    }
    const paths = result.issues.map((issue) => issue.path);
    expect(
      paths.some((path) =>
        path.startsWith("collectionProvenance.firstCollectionSurface.kind"),
      ),
    ).toBe(true);
  });

  it("mergeCollectedContent preserves the merged provenance override", () => {
    const existing = createContentItem();
    const merged = mergeCollectedContent(
      existing,
      createCollectedContentInput(),
      { updatedAt: laterUpdatedAt },
      {
        firstCollectionSurface: {
          kind: "SOURCE_GROUP",
          sourceGroupId: "source-group-1",
        },
        managedSourceGroupId: "source-group-1",
      },
    );

    expect(merged.collectionProvenance).toEqual({
      firstCollectionSurface: {
        kind: "SOURCE_GROUP",
        sourceGroupId: "source-group-1",
      },
      managedSourceGroupId: "source-group-1",
    });
    expect(merged.updatedAt).toBe(laterUpdatedAt);
    expect(
      ContentCollectionProvenanceSchema.safeParse(merged.collectionProvenance)
        .success,
    ).toBe(true);
  });

  it("mergeCollectedContent keeps the existing provenance when no override is supplied", () => {
    const existing = createContentItem();

    const merged = mergeCollectedContent(
      existing,
      createCollectedContentInput(),
      { updatedAt: laterUpdatedAt },
    );

    expect(merged.collectionProvenance).toEqual(
      existing.collectionProvenance,
    );
  });

  it("the merged result is strict-schema-valid against ContentItemSchema", () => {
    const existing = createContentItem();

    const merged = mergeCollectedContent(
      existing,
      createCollectedContentInput(),
      { updatedAt: laterUpdatedAt },
    );

    const result = validateContentItem(merged);

    expect(result.valid).toBe(true);
  });
});