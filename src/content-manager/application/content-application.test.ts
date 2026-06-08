import { describe, expect, it } from "vitest";
import {
  ContentCategoryAlreadyExistsError,
  ContentCategoryNotFoundError,
  ContentItemNotFoundError,
  CreateContentCategoryUseCase,
  CreateSourceGroupUseCase,
  GetContentItemUseCase,
  IngestCollectedContentUseCase,
  InvalidContentStatusTransitionError,
  ListContentCategoriesUseCase,
  ListContentItemsUseCase,
  ListSourceGroupsUseCase,
  MAX_CONTENT_ITEM_LIST_LIMIT,
  MAX_SOURCE_GROUP_LIST_LIMIT,
  SourceGroupAlreadyExistsError,
  SourceGroupNotFoundError,
  UpdateContentStatusUseCase,
  UpdateSourceGroupStatusUseCase,
} from "./index";
import type { Clock, IdGenerator } from "./index";
import {
  InMemoryContentCategoryRepository,
  InMemoryContentItemRepository,
  InMemorySourceGroupRepository,
} from "./test-support/in-memory-repositories";
import type {
  CollectedContentInput,
  ContentCategory,
  ContentItem,
  ContentStatus,
  SourceGroup,
  TopComment,
} from "../domain";

const createdAt = "2026-02-01T10:00:00.000Z";
const updatedAt = "2026-02-01T11:00:00.000Z";
const firstCollectedAt = "2026-02-01T12:00:00.000Z";
const latestCollectedAt = "2026-02-02T12:00:00.000Z";

describe("content manager application use cases", () => {
  it("creates a valid content category", async () => {
    const context = createTestContext(["category-created"]);
    const category = await new CreateContentCategoryUseCase(
      context.categories,
      context.ids,
      context.clock,
    ).execute({
      name: "Knowledge Groups",
      slug: "knowledge-groups",
      description: "High-signal knowledge groups.",
    });

    expect(category).toEqual({
      id: "category-created",
      name: "Knowledge Groups",
      slug: "knowledge-groups",
      description: "High-signal knowledge groups.",
      createdAt,
      updatedAt: createdAt,
    });
    await expect(
      context.categories.findById("category-created"),
    ).resolves.toEqual(category);
  });

  it("rejects duplicate content category slugs", async () => {
    const context = createTestContext(["category-new"]);

    await seedCategory(context, { slug: "knowledge-groups" });

    await expect(
      new CreateContentCategoryUseCase(
        context.categories,
        context.ids,
        context.clock,
      ).execute({
        name: "Duplicate Knowledge Groups",
        slug: "knowledge-groups",
      }),
    ).rejects.toThrow(ContentCategoryAlreadyExistsError);
  });

  it("creates a source group when the category exists", async () => {
    const context = createTestContext(["source-group-created"]);

    await seedCategory(context);

    const sourceGroup = await new CreateSourceGroupUseCase(
      context.sourceGroups,
      context.categories,
      context.ids,
      context.clock,
    ).execute({
      platform: "FACEBOOK",
      externalGroupId: "facebook-group-created",
      name: "Knowledge Group",
      url: "https://www.facebook.com/groups/knowledge",
      categoryId: "category-1",
      collectionPriority: 80,
    });

    expect(sourceGroup).toEqual({
      id: "source-group-created",
      platform: "FACEBOOK",
      externalGroupId: "facebook-group-created",
      name: "Knowledge Group",
      url: "https://www.facebook.com/groups/knowledge",
      categoryId: "category-1",
      status: "ACTIVE",
      collectionPriority: 80,
      createdAt,
      updatedAt: createdAt,
    });
    await expect(
      context.sourceGroups.findById("source-group-created"),
    ).resolves.toEqual(sourceGroup);
  });

  it("rejects source group creation when the category is missing", async () => {
    const context = createTestContext(["source-group-created"]);

    await expect(
      new CreateSourceGroupUseCase(
        context.sourceGroups,
        context.categories,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        externalGroupId: "facebook-group-created",
        name: "Knowledge Group",
        url: "https://www.facebook.com/groups/knowledge",
        categoryId: "missing-category",
        collectionPriority: 80,
      }),
    ).rejects.toThrow(ContentCategoryNotFoundError);
  });

  it("rejects duplicate source groups by platform and external group id", async () => {
    const context = createTestContext(["source-group-created"]);

    await seedCategory(context);
    await seedSourceGroup(context, {
      platform: "FACEBOOK",
      externalGroupId: "facebook-group-1",
    });

    await expect(
      new CreateSourceGroupUseCase(
        context.sourceGroups,
        context.categories,
        context.ids,
        context.clock,
      ).execute({
        platform: "FACEBOOK",
        externalGroupId: "facebook-group-1",
        name: "Duplicate Group",
        url: "https://www.facebook.com/groups/duplicate",
        categoryId: "category-1",
        collectionPriority: 50,
      }),
    ).rejects.toThrow(SourceGroupAlreadyExistsError);
  });

  it("updates source group status and updatedAt", async () => {
    const context = createTestContext();

    await seedSourceGroup(context, { status: "ACTIVE", updatedAt: createdAt });
    context.clock.setNow(updatedAt);

    const sourceGroup = await new UpdateSourceGroupStatusUseCase(
      context.sourceGroups,
      context.clock,
    ).execute({
      sourceGroupId: "source-group-1",
      status: "PAUSED",
    });

    expect(sourceGroup.status).toBe("PAUSED");
    expect(sourceGroup.updatedAt).toBe(updatedAt);
    await expect(context.sourceGroups.findById("source-group-1")).resolves.toEqual(
      sourceGroup,
    );
  });

  it("creates a new COLLECTED content item from normalized input", async () => {
    const context = createTestContext(["content-created"]);

    await seedSourceGroup(context);

    const contentItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(
      createCollectedContentInput({
        topComments: [
          createTopComment({
            externalCommentId: "comment-low",
            reactionCount: 2,
          }),
          createTopComment({
            externalCommentId: "comment-high",
            reactionCount: 8,
          }),
        ],
      }),
    );

    expect(contentItem.id).toBe("content-created");
    expect(contentItem.status).toBe("COLLECTED");
    expect(contentItem.firstCollectedAt).toBe(latestCollectedAt);
    expect(contentItem.lastCollectedAt).toBe(latestCollectedAt);
    expect(contentItem.createdAt).toBe(createdAt);
    expect(contentItem.updatedAt).toBe(createdAt);
    expect(contentItem.topComments.map((comment) => comment.externalCommentId))
      .toEqual(["comment-high", "comment-low"]);
    await expect(context.contentItems.findById("content-created")).resolves.toEqual(
      contentItem,
    );
  });

  it("rejects collected content when the source group is missing", async () => {
    const context = createTestContext(["content-created"]);

    await expect(
      new IngestCollectedContentUseCase(
        context.contentItems,
        context.sourceGroups,
        context.ids,
        context.clock,
      ).execute(createCollectedContentInput()),
    ).rejects.toThrow(SourceGroupNotFoundError);
  });

  it("updates existing duplicate content by platform and external post id", async () => {
    const context = createTestContext();

    await seedSourceGroup(context);
    await seedContentItem(context, {
      platform: "FACEBOOK",
      externalPostId: "post-1",
      bodyText: "Old body text.",
      reactionCount: 10,
    });
    context.clock.setNow(updatedAt);

    const contentItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(
      createCollectedContentInput({
        externalPostId: "post-1",
        sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-1-new",
        title: "Latest post title",
        bodyText: "Latest body text.",
        reactionCount: 200,
      }),
    );

    expect(contentItem.id).toBe("content-1");
    expect(contentItem.sourceUrl).toBe(
      "https://www.facebook.com/groups/group-1/posts/post-1-new",
    );
    expect(contentItem.title).toBe("Latest post title");
    expect(contentItem.bodyText).toBe("Latest body text.");
    expect(contentItem.reactionCount).toBe(200);
    expect(contentItem.updatedAt).toBe(updatedAt);
  });

  it("preserves existing content status during duplicate merge", async () => {
    const context = createTestContext();

    await seedSourceGroup(context);
    await seedContentItem(context, { status: "SELECTED" });

    const contentItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(createCollectedContentInput());

    expect(contentItem.status).toBe("SELECTED");
  });

  it("preserves createdAt and firstCollectedAt during duplicate merge", async () => {
    const context = createTestContext();

    await seedSourceGroup(context);
    await seedContentItem(context, {
      createdAt: "2026-01-01T00:00:00.000Z",
      firstCollectedAt,
    });
    context.clock.setNow(updatedAt);

    const contentItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(createCollectedContentInput());

    expect(contentItem.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(contentItem.firstCollectedAt).toBe(firstCollectedAt);
    expect(contentItem.lastCollectedAt).toBe(latestCollectedAt);
    expect(contentItem.updatedAt).toBe(updatedAt);
  });

  it("updates engagement counts and top comments during duplicate merge", async () => {
    const context = createTestContext();

    await seedSourceGroup(context);
    await seedContentItem(context, {
      reactionCount: 1,
      commentCount: 1,
      shareCount: 1,
      topComments: [
        createTopComment({
          externalCommentId: "comment-old",
          reactionCount: 100,
        }),
      ],
    });

    const contentItem = await new IngestCollectedContentUseCase(
      context.contentItems,
      context.sourceGroups,
      context.ids,
      context.clock,
    ).execute(
      createCollectedContentInput({
        reactionCount: 300,
        commentCount: 40,
        shareCount: 12,
        topComments: [
          createTopComment({
            externalCommentId: "comment-low",
            reactionCount: 3,
          }),
          createTopComment({
            externalCommentId: "comment-high",
            reactionCount: 9,
          }),
        ],
      }),
    );

    expect(contentItem.reactionCount).toBe(300);
    expect(contentItem.commentCount).toBe(40);
    expect(contentItem.shareCount).toBe(12);
    expect(contentItem.topComments.map((comment) => comment.externalCommentId))
      .toEqual(["comment-high", "comment-low"]);
  });

  it("allows valid content status transitions", async () => {
    const context = createTestContext();

    await seedContentItem(context, { status: "COLLECTED", updatedAt: createdAt });
    context.clock.setNow(updatedAt);

    const contentItem = await new UpdateContentStatusUseCase(
      context.contentItems,
      context.clock,
    ).execute({
      contentId: "content-1",
      status: "SELECTED",
    });

    expect(contentItem.status).toBe("SELECTED");
    expect(contentItem.updatedAt).toBe(updatedAt);
  });

  it("rejects invalid content status transitions", async () => {
    const context = createTestContext();

    await seedContentItem(context, { status: "COLLECTED" });

    await expect(
      new UpdateContentStatusUseCase(
        context.contentItems,
        context.clock,
      ).execute({
        contentId: "content-1",
        status: "USED",
      }),
    ).rejects.toThrow(InvalidContentStatusTransitionError);
  });

  it("rejects content status transitions from USED", async () => {
    const context = createTestContext();

    await seedContentItem(context, { status: "USED" });

    await expect(
      new UpdateContentStatusUseCase(
        context.contentItems,
        context.clock,
      ).execute({
        contentId: "content-1",
        status: "SELECTED",
      }),
    ).rejects.toThrow(InvalidContentStatusTransitionError);
  });

  it("gets an existing content item", async () => {
    const context = createTestContext();
    const contentItem = await seedContentItem(context);

    await expect(
      new GetContentItemUseCase(context.contentItems).execute({
        contentId: "content-1",
      }),
    ).resolves.toEqual(contentItem);
  });

  it("returns not found for a missing content item", async () => {
    const context = createTestContext();

    await expect(
      new GetContentItemUseCase(context.contentItems).execute({
        contentId: "missing-content",
      }),
    ).rejects.toThrow(ContentItemNotFoundError);
  });

  it("lists content items with status, source group filters, and pagination", async () => {
    const context = createTestContext();

    await seedContentItem(context, {
      id: "content-1",
      status: "COLLECTED",
      sourceGroupId: "source-group-1",
      createdAt: "2026-02-01T10:00:00.000Z",
    });
    await seedContentItem(context, {
      id: "content-2",
      status: "REJECTED",
      sourceGroupId: "source-group-1",
      createdAt: "2026-02-01T10:01:00.000Z",
    });
    await seedContentItem(context, {
      id: "content-3",
      status: "COLLECTED",
      sourceGroupId: "source-group-2",
      createdAt: "2026-02-01T10:02:00.000Z",
    });
    await seedContentItem(context, {
      id: "content-4",
      status: "COLLECTED",
      sourceGroupId: "source-group-1",
      createdAt: "2026-02-01T10:03:00.000Z",
    });

    const output = await new ListContentItemsUseCase(
      context.contentItems,
    ).execute({
      status: "COLLECTED",
      sourceGroupId: "source-group-1",
      limit: 1,
      offset: 1,
    });

    expect(output.items.map((item) => item.id)).toEqual(["content-4"]);
    expect(output.page).toEqual({
      limit: 1,
      offset: 1,
      total: 2,
    });

    const clampedOutput = await new ListContentItemsUseCase(
      context.contentItems,
    ).execute({
      limit: MAX_CONTENT_ITEM_LIST_LIMIT + 1,
    });

    expect(clampedOutput.page.limit).toBe(MAX_CONTENT_ITEM_LIST_LIMIT);
  });

  it("lists source groups with status, category filters, and pagination", async () => {
    const context = createTestContext();

    await seedSourceGroup(context, {
      id: "source-group-1",
      status: "ACTIVE",
      categoryId: "category-1",
      createdAt: "2026-02-01T10:00:00.000Z",
    });
    await seedSourceGroup(context, {
      id: "source-group-2",
      status: "PAUSED",
      categoryId: "category-1",
      createdAt: "2026-02-01T10:01:00.000Z",
    });
    await seedSourceGroup(context, {
      id: "source-group-3",
      status: "ACTIVE",
      categoryId: "category-2",
      createdAt: "2026-02-01T10:02:00.000Z",
    });
    await seedSourceGroup(context, {
      id: "source-group-4",
      status: "ACTIVE",
      categoryId: "category-1",
      createdAt: "2026-02-01T10:03:00.000Z",
    });

    const output = await new ListSourceGroupsUseCase(
      context.sourceGroups,
    ).execute({
      status: "ACTIVE",
      categoryId: "category-1",
      limit: 1,
      offset: 1,
    });

    expect(output.items.map((group) => group.id)).toEqual(["source-group-4"]);
    expect(output.page).toEqual({
      limit: 1,
      offset: 1,
      total: 2,
    });

    const clampedOutput = await new ListSourceGroupsUseCase(
      context.sourceGroups,
    ).execute({
      limit: MAX_SOURCE_GROUP_LIST_LIMIT + 1,
    });

    expect(clampedOutput.page.limit).toBe(MAX_SOURCE_GROUP_LIST_LIMIT);
  });

  it("lists content categories", async () => {
    const context = createTestContext();

    await seedCategory(context, {
      id: "category-1",
      slug: "knowledge-groups",
      createdAt: "2026-02-01T10:00:00.000Z",
    });
    await seedCategory(context, {
      id: "category-2",
      slug: "productivity-groups",
      createdAt: "2026-02-01T10:01:00.000Z",
    });

    const categories = await new ListContentCategoriesUseCase(
      context.categories,
    ).execute();

    expect(categories.map((category) => category.id)).toEqual([
      "category-1",
      "category-2",
    ]);
  });
});

interface TestContext {
  readonly categories: InMemoryContentCategoryRepository;
  readonly sourceGroups: InMemorySourceGroupRepository;
  readonly contentItems: InMemoryContentItemRepository;
  readonly ids: FakeIdGenerator;
  readonly clock: FixedClock;
}

function createTestContext(ids: readonly string[] = []): TestContext {
  return {
    categories: new InMemoryContentCategoryRepository(),
    sourceGroups: new InMemorySourceGroupRepository(),
    contentItems: new InMemoryContentItemRepository(),
    ids: new FakeIdGenerator(ids),
    clock: new FixedClock(createdAt),
  };
}

async function seedCategory(
  context: TestContext,
  overrides: Partial<ContentCategory> = {},
): Promise<ContentCategory> {
  const category = createContentCategory(overrides);

  await context.categories.save(category);

  return category;
}

async function seedSourceGroup(
  context: TestContext,
  overrides: Partial<SourceGroup> = {},
): Promise<SourceGroup> {
  const sourceGroup = createSourceGroup(overrides);

  await context.sourceGroups.save(sourceGroup);

  return sourceGroup;
}

async function seedContentItem(
  context: TestContext,
  overrides: Partial<ContentItem> = {},
): Promise<ContentItem> {
  const contentItem = createContentItem(overrides);

  await context.contentItems.save(contentItem);

  return contentItem;
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

function createContentCategory(
  overrides: Partial<ContentCategory> = {},
): ContentCategory {
  return {
    id: "category-1",
    name: "Knowledge Groups",
    slug: "knowledge-groups",
    description: "Groups that produce knowledge-rich text posts.",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createSourceGroup(overrides: Partial<SourceGroup> = {}): SourceGroup {
  return {
    id: "source-group-1",
    platform: "FACEBOOK",
    externalGroupId: "facebook-group-1",
    name: "Knowledge Group 1",
    url: "https://www.facebook.com/groups/group-1",
    categoryId: "category-1",
    status: "ACTIVE",
    collectionPriority: 80,
    notes: "High-signal group.",
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  };
}

function createContentItem(overrides: Partial<ContentItem> = {}): ContentItem {
  const status: ContentStatus = overrides.status ?? "COLLECTED";

  return {
    id: "content-1",
    platform: "FACEBOOK",
    sourceGroupId: "source-group-1",
    externalPostId: "post-1",
    sourceUrl: "https://www.facebook.com/groups/group-1/posts/post-1",
    title: "Useful post",
    bodyText: "A useful knowledge-rich post.",
    authorDisplayName: "Post Author",
    authorExternalId: "post-author-1",
    postedAt: firstCollectedAt,
    firstCollectedAt,
    lastCollectedAt: firstCollectedAt,
    reactionCount: 100,
    commentCount: 20,
    shareCount: 5,
    topComments: [createTopComment()],
    status,
    rawPayloadRef: "payload-ref-1",
    createdAt,
    updatedAt: createdAt,
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
    collectedAt: latestCollectedAt,
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
    collectedAt: latestCollectedAt,
    ...overrides,
  };
}
