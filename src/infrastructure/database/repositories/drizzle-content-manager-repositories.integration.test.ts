import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type {
  ContentCategory,
  ContentItem,
  IsoDateTime,
  SourceGroup,
  TopComment,
} from "../../../content-manager/domain";
import { createDefaultSourceGroupEntryRoute } from "../../../content-manager/domain";
import { createDatabaseClient } from "../client";
import type { DatabaseClient } from "../client";
import {
  contentCategories,
  contentItems,
  sourceGroups,
} from "../schema/content-manager.schema";
import { DrizzleContentCategoryRepository } from "./drizzle-content-category.repository";
import { DrizzleContentItemRepository } from "./drizzle-content-item.repository";
import { DrizzleSourceGroupRepository } from "./drizzle-source-group.repository";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip("Content Manager PostgreSQL repository integration", () => {
    it("runs only when RUN_DB_TESTS=true", () => {});
  });
} else {
  describe("Content Manager PostgreSQL repository integration", () => {
    let client: DatabaseClient | undefined;
    let categories: DrizzleContentCategoryRepository;
    let sourceGroupRepository: DrizzleSourceGroupRepository;
    let contentItemRepository: DrizzleContentItemRepository;
    let nextId = 0;
    const createdCategoryIds = new Set<string>();
    const createdSourceGroupIds = new Set<string>();
    const createdContentItemIds = new Set<string>();

    beforeAll(() => {
      const databaseClient = createDatabaseClient({
        poolConfig: {
          max: 1,
        },
      });
      client = databaseClient;
      categories = new DrizzleContentCategoryRepository(databaseClient.db);
      sourceGroupRepository = new DrizzleSourceGroupRepository(
        databaseClient.db,
      );
      contentItemRepository = new DrizzleContentItemRepository(
        databaseClient.db,
      );
    });

    afterEach(async () => {
      if (client === undefined) {
        return;
      }

      const contentItemIds = [...createdContentItemIds];
      const sourceGroupIds = [...createdSourceGroupIds];
      const categoryIds = [...createdCategoryIds];

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

      createdContentItemIds.clear();
      createdSourceGroupIds.clear();
      createdCategoryIds.clear();
    });

    afterAll(async () => {
      await client?.close();
    });

    it("saves categories and loads them by id, slug, and list", async () => {
      const first = trackCategory(
        createCategory(nextTestId("category-one"), {
          slug: nextTestSlug("category-one"),
          createdAt: "2026-02-01T10:00:00.000Z",
        }),
      );
      const second = trackCategory(
        createCategory(nextTestId("category-two"), {
          slug: nextTestSlug("category-two"),
          createdAt: "2026-02-01T10:01:00.000Z",
          description: "Second category.",
        }),
      );

      await categories.save(second);
      await categories.save(first);

      await expect(categories.findById(first.id)).resolves.toEqual(first);
      await expect(categories.findBySlug(second.slug)).resolves.toEqual(second);
      await expect(categories.list()).resolves.toEqual([first, second]);
    });

    it("saves source groups, supports external lookup, and filters lists", async () => {
      const categoryA = trackCategory(
        createCategory(nextTestId("category-a"), {
          slug: nextTestSlug("category-a"),
        }),
      );
      const categoryB = trackCategory(
        createCategory(nextTestId("category-b"), {
          slug: nextTestSlug("category-b"),
        }),
      );
      const activeInA = trackSourceGroup(
        createSourceGroup(nextTestId("source-active-a"), categoryA.id, {
          externalGroupId: nextTestId("external-active-a"),
          createdAt: "2026-02-01T10:00:00.000Z",
          status: "ACTIVE",
        }),
      );
      const pausedInA = trackSourceGroup(
        createSourceGroup(nextTestId("source-paused-a"), categoryA.id, {
          externalGroupId: nextTestId("external-paused-a"),
          createdAt: "2026-02-01T10:01:00.000Z",
          status: "PAUSED",
        }),
      );
      const activeInB = trackSourceGroup(
        createSourceGroup(nextTestId("source-active-b"), categoryB.id, {
          externalGroupId: nextTestId("external-active-b"),
          createdAt: "2026-02-01T10:02:00.000Z",
          status: "ACTIVE",
        }),
      );

      await categories.save(categoryA);
      await categories.save(categoryB);
      await sourceGroupRepository.save(pausedInA);
      await sourceGroupRepository.save(activeInB);
      await sourceGroupRepository.save(activeInA);

      await expect(
        sourceGroupRepository.findByPlatformAndExternalGroupId(
          activeInA.platform,
          activeInA.externalGroupId,
        ),
      ).resolves.toEqual(activeInA);
      await expect(sourceGroupRepository.findById(pausedInA.id)).resolves.toEqual(
        pausedInA,
      );
      await expect(
        sourceGroupRepository.list({ limit: 10, offset: 0 }),
      ).resolves.toEqual({
        items: [activeInA, pausedInA, activeInB],
        total: 3,
      });
      await expect(
        sourceGroupRepository.list({
          status: "ACTIVE",
          limit: 10,
          offset: 0,
        }),
      ).resolves.toMatchObject({
        items: [activeInA, activeInB],
        total: 2,
      });
      await expect(
        sourceGroupRepository.list({
          categoryId: categoryA.id,
          limit: 10,
          offset: 0,
        }),
      ).resolves.toMatchObject({
        items: [activeInA, pausedInA],
        total: 2,
      });
      await expect(
        sourceGroupRepository.list({
          status: "ACTIVE",
          categoryId: categoryA.id,
          limit: 10,
          offset: 0,
        }),
      ).resolves.toMatchObject({
        items: [activeInA],
        total: 1,
      });
    });

    it("saves content items, supports external lookup, filters lists, and round-trips JSONB fields", async () => {
      const category = trackCategory(
        createCategory(nextTestId("category"), {
          slug: nextTestSlug("category"),
        }),
      );
      const sourceGroup = trackSourceGroup(
        createSourceGroup(nextTestId("source"), category.id, {
          externalGroupId: nextTestId("external-source"),
        }),
      );
      const collected = trackContentItem(
        createContentItem(nextTestId("content-collected"), sourceGroup.id, {
          externalPostId: nextTestId("external-post-collected"),
          createdAt: "2026-02-01T10:00:00.000Z",
          status: "COLLECTED",
          topComments: [
            createTopComment({
              externalCommentId: nextTestId("comment-high"),
              reactionCount: 12,
              replyCount: 2,
            }),
          ],
          rawPayloadRef: "s3://content-payloads/collected.json",
        }),
      );
      const selected = trackContentItem(
        createContentItem(nextTestId("content-selected"), sourceGroup.id, {
          externalPostId: nextTestId("external-post-selected"),
          createdAt: "2026-02-01T10:01:00.000Z",
          status: "SELECTED",
        }),
      );

      await categories.save(category);
      await sourceGroupRepository.save(sourceGroup);
      await contentItemRepository.save(selected);
      await contentItemRepository.save(collected);

      await expect(contentItemRepository.findById(collected.id)).resolves.toEqual(
        collected,
      );
      await expect(
        contentItemRepository.findByPlatformAndExternalPostId(
          collected.platform,
          collected.externalPostId,
        ),
      ).resolves.toEqual(collected);
      await expect(
        contentItemRepository.list({ limit: 10, offset: 0 }),
      ).resolves.toEqual({
        items: [collected, selected],
        total: 2,
      });
      await expect(
        contentItemRepository.list({
          status: "SELECTED",
          limit: 10,
          offset: 0,
        }),
      ).resolves.toMatchObject({
        items: [selected],
        total: 1,
      });
      await expect(
        contentItemRepository.list({
          sourceGroupId: sourceGroup.id,
          limit: 1,
          offset: 1,
        }),
      ).resolves.toMatchObject({
        items: [selected],
        total: 2,
      });
    });

    it("updates an existing content item by id", async () => {
      const category = trackCategory(
        createCategory(nextTestId("category"), {
          slug: nextTestSlug("category"),
        }),
      );
      const sourceGroup = trackSourceGroup(
        createSourceGroup(nextTestId("source"), category.id, {
          externalGroupId: nextTestId("external-source"),
        }),
      );
      const contentItem = trackContentItem(
        createContentItem(nextTestId("content"), sourceGroup.id, {
          externalPostId: nextTestId("external-post"),
          bodyText: "Original body text.",
          reactionCount: 3,
        }),
      );
      const updatedContentItem: ContentItem = {
        ...contentItem,
        bodyText: "Updated body text.",
        reactionCount: 30,
        commentCount: 9,
        topComments: [
          createTopComment({
            externalCommentId: nextTestId("comment-updated"),
            bodyText: "Updated top comment.",
            reactionCount: 25,
          }),
        ],
        updatedAt: "2026-02-01T11:00:00.000Z",
      };

      await categories.save(category);
      await sourceGroupRepository.save(sourceGroup);
      await contentItemRepository.save(contentItem);
      await contentItemRepository.save(updatedContentItem);

      await expect(contentItemRepository.findById(contentItem.id)).resolves.toEqual(
        updatedContentItem,
      );
    });

    it("enforces unique and foreign key constraints for Content Manager tables", async () => {
      const category = trackCategory(
        createCategory(nextTestId("category"), {
          slug: nextTestSlug("category"),
        }),
      );
      const sourceGroup = trackSourceGroup(
        createSourceGroup(nextTestId("source"), category.id, {
          externalGroupId: nextTestId("external-source"),
        }),
      );
      const contentItem = trackContentItem(
        createContentItem(nextTestId("content"), sourceGroup.id, {
          externalPostId: nextTestId("external-post"),
        }),
      );

      await categories.save(category);
      await sourceGroupRepository.save(sourceGroup);
      await contentItemRepository.save(contentItem);

      await expect(
        categories.save(
          trackCategory(
            createCategory(nextTestId("duplicate-category"), {
              slug: category.slug,
            }),
          ),
        ),
      ).rejects.toThrow();
      await expect(
        sourceGroupRepository.save(
          trackSourceGroup(
            createSourceGroup(nextTestId("duplicate-source"), category.id, {
              externalGroupId: sourceGroup.externalGroupId,
            }),
          ),
        ),
      ).rejects.toThrow();
      await expect(
        contentItemRepository.save(
          trackContentItem(
            createContentItem(nextTestId("duplicate-content"), sourceGroup.id, {
              externalPostId: contentItem.externalPostId,
            }),
          ),
        ),
      ).rejects.toThrow();
      await expect(
        sourceGroupRepository.save(
          createSourceGroup(nextTestId("missing-category-source"), "missing", {
            externalGroupId: nextTestId("external-missing-category"),
          }),
        ),
      ).rejects.toThrow();
      await expect(
        contentItemRepository.save(
          createContentItem(nextTestId("missing-source-content"), "missing", {
            externalPostId: nextTestId("external-missing-source"),
          }),
        ),
      ).rejects.toThrow();
    });

    function nextTestId(label: string): string {
      nextId += 1;

      return `content-db-it-${process.pid}-${Date.now()}-${nextId}-${label}`;
    }

    function nextTestSlug(label: string): string {
      return nextTestId(label).replaceAll("_", "-");
    }

    function trackCategory(category: ContentCategory): ContentCategory {
      createdCategoryIds.add(category.id);

      return category;
    }

    function trackSourceGroup(sourceGroup: SourceGroup): SourceGroup {
      createdSourceGroupIds.add(sourceGroup.id);

      return sourceGroup;
    }

    function trackContentItem(contentItem: ContentItem): ContentItem {
      createdContentItemIds.add(contentItem.id);

      return contentItem;
    }
  });
}

interface CategoryOptions {
  readonly slug?: string;
  readonly description?: string;
  readonly createdAt?: IsoDateTime;
  readonly updatedAt?: IsoDateTime;
}

interface SourceGroupOptions {
  readonly externalGroupId?: string;
  readonly status?: SourceGroup["status"];
  readonly entryRoutes?: SourceGroup["entryRoutes"];
  readonly createdAt?: IsoDateTime;
  readonly updatedAt?: IsoDateTime;
}

interface ContentItemOptions {
  readonly externalPostId?: string;
  readonly bodyText?: string;
  readonly status?: ContentItem["status"];
  readonly createdAt?: IsoDateTime;
  readonly updatedAt?: IsoDateTime;
  readonly reactionCount?: number;
  readonly commentCount?: number;
  readonly topComments?: readonly TopComment[];
  readonly rawPayloadRef?: string;
}

const defaultCreatedAt = "2026-02-01T10:00:00.000Z";

function createCategory(
  id: string,
  options: CategoryOptions = {},
): ContentCategory {
  return {
    id,
    name: `Category ${id}`,
    slug: options.slug ?? `category-${id}`,
    ...(options.description === undefined
      ? {}
      : { description: options.description }),
    createdAt: options.createdAt ?? defaultCreatedAt,
    updatedAt: options.updatedAt ?? options.createdAt ?? defaultCreatedAt,
  };
}

function createSourceGroup(
  id: string,
  categoryId: string,
  options: SourceGroupOptions = {},
): SourceGroup {
  const base = {
    id,
    platform: "FACEBOOK",
    externalGroupId: options.externalGroupId ?? `external-group-${id}`,
    name: `Source Group ${id}`,
    url: `https://www.facebook.com/groups/${id}`,
    categoryId,
    status: options.status ?? "ACTIVE",
    collectionPriority: 50,
    notes: `Notes for ${id}`,
    createdAt: options.createdAt ?? defaultCreatedAt,
    updatedAt: options.updatedAt ?? options.createdAt ?? defaultCreatedAt,
  } satisfies Omit<SourceGroup, "entryRoutes">;

  return {
    ...base,
    entryRoutes:
      options.entryRoutes ?? [createDefaultSourceGroupEntryRoute(base)],
  };
}

function createContentItem(
  id: string,
  sourceGroupId: string,
  options: ContentItemOptions = {},
): ContentItem {
  return {
    id,
    platform: "FACEBOOK",
    sourceGroupId,
    externalPostId: options.externalPostId ?? `external-post-${id}`,
    sourceUrl: `https://www.facebook.com/groups/group/posts/${id}`,
    title: `Title ${id}`,
    bodyText: options.bodyText ?? `Body text for ${id}.`,
    authorDisplayName: "Test Author",
    authorExternalId: `author-${id}`,
    postedAt: "2026-02-01T09:00:00.000Z",
    firstCollectedAt: "2026-02-01T10:05:00.000Z",
    lastCollectedAt: "2026-02-01T10:10:00.000Z",
    reactionCount: options.reactionCount ?? 10,
    commentCount: options.commentCount ?? 2,
    shareCount: 1,
    topComments: [
      ...(options.topComments ?? [
        createTopComment({
          externalCommentId: `comment-${id}`,
        }),
      ]),
    ],
    status: options.status ?? "COLLECTED",
    ...(options.rawPayloadRef === undefined
      ? {}
      : { rawPayloadRef: options.rawPayloadRef }),
    createdAt: options.createdAt ?? defaultCreatedAt,
    updatedAt: options.updatedAt ?? options.createdAt ?? defaultCreatedAt,
  };
}

interface TopCommentOptions {
  readonly externalCommentId: string;
  readonly bodyText?: string;
  readonly reactionCount?: number;
  readonly replyCount?: number;
}

function createTopComment(options: TopCommentOptions): TopComment {
  return {
    externalCommentId: options.externalCommentId,
    bodyText: options.bodyText ?? "Useful comment.",
    authorDisplayName: "Comment Author",
    authorExternalId: `comment-author-${options.externalCommentId}`,
    reactionCount: options.reactionCount ?? 5,
    ...(options.replyCount === undefined ? {} : { replyCount: options.replyCount }),
    postedAt: "2026-02-01T09:30:00.000Z",
    collectedAt: "2026-02-01T10:10:00.000Z",
  };
}
