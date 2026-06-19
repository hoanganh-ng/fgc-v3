import { describe, expect, it, vi } from "vitest";
import {
  ContentCollectionProvenanceConflictError,
  type ContentCollectionProvenance,
  type CollectedContentInput,
  type ContentItem,
  type SourceGroup,
  type TopComment,
  validateContentItem,
  createDefaultSourceGroupEntryRoute,
} from "../domain";
import type { Clock } from "./ports/clock.port";
import type { IdGenerator } from "./ports/id-generator.port";
import { IngestCollectedContentUseCase } from "./use-cases/ingest-collected-content.use-case";
import {
  InMemoryContentItemRepository,
  InMemorySourceGroupRepository,
} from "./test-support/in-memory-repositories";

const createdAt = "2026-05-01T10:00:00.000Z";
const updatedAt = "2026-05-01T11:00:00.000Z";
const firstCollectedAt = "2026-05-01T12:00:00.000Z";
const lastCollectedAt = "2026-05-02T12:00:00.000Z";

interface TestContext {
  readonly sourceGroups: InMemorySourceGroupRepository;
  readonly contentItems: InMemoryContentItemRepository;
  readonly ids: FakeIdGenerator;
  readonly clock: FixedClock;
}

function createTestContext(ids: readonly string[] = []): TestContext {
  return {
    sourceGroups: new InMemorySourceGroupRepository(),
    contentItems: new InMemoryContentItemRepository(),
    ids: new FakeIdGenerator(ids),
    clock: new FixedClock(createdAt),
  };
}

async function seedSourceGroup(
  context: TestContext,
  overrides: Partial<SourceGroup> = {},
): Promise<SourceGroup> {
  const sourceGroup: SourceGroup = {
    id: "source-group-1",
    platform: "FACEBOOK",
    externalGroupId: "facebook-group-1",
    name: "Knowledge Group 1",
    url: "https://www.facebook.com/groups/group-1",
    categoryId: "category-1",
    status: "ACTIVE",
    collectionPriority: 80,
    notes: "High-signal group.",
    createdAt: overrides.createdAt ?? createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    entryRoutes: overrides.entryRoutes ?? [
      createDefaultSourceGroupEntryRoute({
        url: "https://www.facebook.com/groups/group-1",
        createdAt: overrides.createdAt ?? createdAt,
        updatedAt: overrides.updatedAt ?? createdAt,
      }),
    ],
    ...overrides,
  };

  await context.sourceGroups.save(sourceGroup);

  return sourceGroup;
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

function createContentItem(
  overrides: Partial<ContentItem> = {},
): ContentItem {
  const sourceGroupId = overrides.sourceGroupId ?? "source-group-1";
  const provenance: ContentCollectionProvenance = {
    firstCollectionSurface: {
      kind: "SOURCE_GROUP",
      sourceGroupId,
    },
    managedSourceGroupId: sourceGroupId,
  };

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

class FakeIdGenerator implements IdGenerator {
  private nextIdIndex = 0;

  public constructor(private readonly ids: readonly string[]) {}

  public async generateId(): Promise<string> {
    const id = this.ids[this.nextIdIndex];
    this.nextIdIndex += 1;

    return id ?? `generated-id-${this.nextIdIndex}`;
  }
}

class FixedClock implements Clock {
  private current: Date;

  public constructor(isoDateTime: string) {
    this.current = new Date(isoDateTime);
  }

  public now(): Date {
    return new Date(this.current.getTime());
  }

  public setNow(isoDateTime: string): void {
    this.current = new Date(isoDateTime);
  }
}

describe("IngestCollectedContentUseCase — Sprint 064B collection provenance", () => {
  it("derives a SOURCE_GROUP collectionProvenance for a new content item", async () => {
    const context = createTestContext(["content-new"]);
    await seedSourceGroup(context);

    const contentItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(createCollectedContentInput());

    expect(contentItem.collectionProvenance).toEqual({
      firstCollectionSurface: {
        kind: "SOURCE_GROUP",
        sourceGroupId: "source-group-1",
      },
      managedSourceGroupId: "source-group-1",
    });
    expect(contentItem.collectionProvenance.sourcePublisherId).toBeUndefined();
  });

  it("does not invent a sourcePublisherId for a new content item", async () => {
    const context = createTestContext(["content-new"]);
    await seedSourceGroup(context);

    const contentItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(createCollectedContentInput());

    expect(
      Object.prototype.hasOwnProperty.call(
        contentItem.collectionProvenance,
        "sourcePublisherId",
      ),
    ).toBe(false);
  });

  it("merges the incoming SOURCE_GROUP provenance with the existing one on a duplicate match", async () => {
    const context = createTestContext();
    await seedSourceGroup(context);
    await context.contentItems.save(
      createContentItem({
        id: "content-1",
        externalPostId: "post-1",
        collectionProvenance: {
          firstCollectionSurface: {
            kind: "SOURCE_GROUP",
            sourceGroupId: "source-group-1",
          },
          managedSourceGroupId: "source-group-1",
        },
      }),
    );
    context.clock.setNow(updatedAt);

    const contentItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(createCollectedContentInput());

    expect(contentItem.collectionProvenance).toEqual({
      firstCollectionSurface: {
        kind: "SOURCE_GROUP",
        sourceGroupId: "source-group-1",
      },
      managedSourceGroupId: "source-group-1",
    });
    expect(contentItem.id).toBe("content-1");
    expect(contentItem.createdAt).toBe(createdAt);
    expect(contentItem.firstCollectedAt).toBe(firstCollectedAt);
    expect(contentItem.updatedAt).toBe(updatedAt);
  });

  it("preserves the existing first surface when a duplicate observation uses the same surface", async () => {
    const context = createTestContext();
    await seedSourceGroup(context);
    await context.contentItems.save(
      createContentItem({
        id: "content-1",
        externalPostId: "post-1",
        collectionProvenance: {
          firstCollectionSurface: {
            kind: "SOURCE_GROUP",
            sourceGroupId: "source-group-1",
          },
          managedSourceGroupId: "source-group-1",
        },
      }),
    );

    const contentItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(createCollectedContentInput());

    expect(
      contentItem.collectionProvenance.firstCollectionSurface,
    ).toEqual({
      kind: "SOURCE_GROUP",
      sourceGroupId: "source-group-1",
    });
  });

  it("propagates ContentCollectionProvenanceConflictError without saving on a failed merge", async () => {
    const context = createTestContext();
    await seedSourceGroup(context);
    await seedSourceGroup(context, {
      id: "source-group-2",
      externalGroupId: "facebook-group-2",
      url: "https://www.facebook.com/groups/group-2",
    });

    // Seed a content item that already has managedSourceGroupId tied to
    // source-group-1. The next ingest call targets the same
    // (platform, externalPostId) but a different sourceGroupId, which
    // must produce a conflict on managedSourceGroupId.
    await context.contentItems.save(
      createContentItem({
        id: "content-conflict",
        externalPostId: "post-1",
        sourceGroupId: "source-group-1",
        collectionProvenance: {
          firstCollectionSurface: {
            kind: "SOURCE_GROUP",
            sourceGroupId: "source-group-1",
          },
          managedSourceGroupId: "source-group-1",
        },
      }),
    );

    const saveSpy = vi.spyOn(context.contentItems, "save");

    await expect(
      new IngestCollectedContentUseCase(
        context.contentItems,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute(createCollectedContentInput({ sourceGroupId: "source-group-2" })),
    ).rejects.toBeInstanceOf(ContentCollectionProvenanceConflictError);

    expect(saveSpy).not.toHaveBeenCalled();

    const stored = await context.contentItems.findById("content-conflict");
    expect(stored?.collectionProvenance.managedSourceGroupId).toBe(
      "source-group-1",
    );
  });

  it("returns a strict-schema-valid ContentItem for both new and merged paths", async () => {
    const context = createTestContext(["content-new"]);
    await seedSourceGroup(context);

    const newItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(createCollectedContentInput());

    expect(validateContentItem(newItem).valid).toBe(true);

    await context.contentItems.save({
      ...createContentItem({
        id: "content-merged",
        externalPostId: "post-2",
      }),
    });

    const merged = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(
      createCollectedContentInput({
        externalPostId: "post-2",
        bodyText: "Latest body text.",
        reactionCount: 200,
      }),
    );

    expect(validateContentItem(merged).valid).toBe(true);
  });
});