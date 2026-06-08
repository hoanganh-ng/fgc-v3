import { inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Clock, IdGenerator } from "../../content-manager/application";
import { createContentManagerFromDatabaseClient } from "../../composition/content-manager";
import { createDatabaseClient } from "./client";
import type { DatabaseClient } from "./client";
import {
  contentCategories,
  contentItems,
  sourceGroups,
} from "./schema/content-manager.schema";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip("Content Manager composition database integration", () => {
    it("runs only when RUN_DB_TESTS=true", () => {});
  });
} else {
  describe("Content Manager composition database integration", () => {
    let client: DatabaseClient | undefined;
    const createdCategoryIds = new Set<string>();
    const createdSourceGroupIds = new Set<string>();
    const createdContentItemIds = new Set<string>();

    beforeAll(() => {
      client = createDatabaseClient({
        poolConfig: {
          max: 1,
        },
      });
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

    it("runs a content ingestion flow through composition wiring", async () => {
      if (client === undefined) {
        throw new Error("Database client was not initialized.");
      }

      const idPrefix = `content-composition-it-${process.pid}-${Date.now()}`;
      const clock = new MutableClock("2026-03-01T10:00:00.000Z");
      const services = createContentManagerFromDatabaseClient(client, {
        clock,
        idGenerator: new SequentialIdGenerator(idPrefix),
      });
      const category = await services.createContentCategory.execute({
        name: "Knowledge Groups",
        slug: `${idPrefix}-knowledge-groups`,
        description: "Groups with high-signal posts.",
      });
      createdCategoryIds.add(category.id);

      const sourceGroup = await services.createSourceGroup.execute({
        platform: "FACEBOOK",
        externalGroupId: `${idPrefix}-facebook-group`,
        name: "Knowledge Group",
        url: "https://www.facebook.com/groups/knowledge",
        categoryId: category.id,
        collectionPriority: 80,
      });
      createdSourceGroupIds.add(sourceGroup.id);

      const firstIngested = await services.ingestCollectedContent.execute({
        platform: "FACEBOOK",
        sourceGroupId: sourceGroup.id,
        externalPostId: `${idPrefix}-post`,
        sourceUrl: "https://www.facebook.com/groups/knowledge/posts/one",
        title: "Useful post",
        bodyText: "First body text.",
        authorDisplayName: "Post Author",
        authorExternalId: `${idPrefix}-author`,
        postedAt: "2026-03-01T09:00:00.000Z",
        collectedAt: "2026-03-01T10:05:00.000Z",
        reactionCount: 10,
        commentCount: 2,
        shareCount: 1,
        topComments: [
          {
            externalCommentId: `${idPrefix}-comment`,
            bodyText: "Useful comment.",
            authorDisplayName: "Comment Author",
            authorExternalId: `${idPrefix}-comment-author`,
            reactionCount: 5,
            collectedAt: "2026-03-01T10:05:00.000Z",
          },
        ],
        rawPayloadRef: `${idPrefix}-payload-1`,
      });
      createdContentItemIds.add(firstIngested.id);

      await expect(
        services.getContentItem.execute({ contentId: firstIngested.id }),
      ).resolves.toEqual(firstIngested);

      const selected = await services.updateContentStatus.execute({
        contentId: firstIngested.id,
        status: "SELECTED",
      });
      clock.setNow("2026-03-01T11:00:00.000Z");

      const duplicateIngested = await services.ingestCollectedContent.execute({
        platform: "FACEBOOK",
        sourceGroupId: sourceGroup.id,
        externalPostId: `${idPrefix}-post`,
        sourceUrl: "https://www.facebook.com/groups/knowledge/posts/one",
        title: "Updated useful post",
        bodyText: "Updated body text.",
        authorDisplayName: "Post Author",
        authorExternalId: `${idPrefix}-author`,
        postedAt: "2026-03-01T09:00:00.000Z",
        collectedAt: "2026-03-01T11:05:00.000Z",
        reactionCount: 25,
        commentCount: 4,
        shareCount: 2,
        topComments: [
          {
            externalCommentId: `${idPrefix}-comment-updated`,
            bodyText: "More useful comment.",
            authorDisplayName: "Comment Author",
            authorExternalId: `${idPrefix}-comment-author`,
            reactionCount: 15,
            collectedAt: "2026-03-01T11:05:00.000Z",
          },
        ],
        rawPayloadRef: `${idPrefix}-payload-2`,
      });

      expect(duplicateIngested.id).toBe(firstIngested.id);
      expect(duplicateIngested.status).toBe(selected.status);
      expect(duplicateIngested.bodyText).toBe("Updated body text.");
      expect(duplicateIngested.reactionCount).toBe(25);
      expect(duplicateIngested.firstCollectedAt).toBe(
        firstIngested.firstCollectedAt,
      );
      expect(duplicateIngested.lastCollectedAt).toBe(
        "2026-03-01T11:05:00.000Z",
      );
    });
  });
}

class MutableClock implements Clock {
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

class SequentialIdGenerator implements IdGenerator {
  private nextId = 0;

  public constructor(private readonly prefix: string) {}

  public async generateId(): Promise<string> {
    this.nextId += 1;

    return `${this.prefix}-${this.nextId}`;
  }
}
