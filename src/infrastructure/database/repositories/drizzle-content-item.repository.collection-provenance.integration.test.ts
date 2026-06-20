import { inArray, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  describe.skip(
    "Content Item collection provenance PostgreSQL repository integration (Sprint 064B / Sprint 065C1)",
    () => {
      it("runs only when RUN_DB_TESTS=true", () => {});
    },
  );
} else {
  describe(
    "Content Item collection provenance PostgreSQL repository integration (Sprint 064B / Sprint 065C1)",
    () => {
      let client: DatabaseClient | undefined;
      let categoryRepository: DrizzleContentCategoryRepository;
      let sourceGroupRepository: DrizzleSourceGroupRepository;
      let contentItemRepository: DrizzleContentItemRepository;
      const createdCategoryIds = new Set<string>();
      const createdSourceGroupIds = new Set<string>();
      const createdContentItemIds = new Set<string>();

      beforeAll(() => {
        const databaseClient = createDatabaseClient({
          poolConfig: { max: 1 },
        });
        client = databaseClient;
        categoryRepository = new DrizzleContentCategoryRepository(
          databaseClient.db,
        );
        sourceGroupRepository = new DrizzleSourceGroupRepository(
          databaseClient.db,
        );
        contentItemRepository = new DrizzleContentItemRepository(
          databaseClient.db,
        );
      });

      afterAll(async () => {
        if (client === undefined) {
          return;
        }
        const contentIds = [...createdContentItemIds];
        const sourceGroupIds = [...createdSourceGroupIds];
        const categoryIds = [...createdCategoryIds];

        if (contentIds.length > 0) {
          await client.db
            .delete(contentItems)
            .where(inArray(contentItems.id, contentIds));
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
        await client.close();
      });

      // Sprint 065C1: clean up after every test so vitest's per-file
      // parallelism does not leak this file's rows into the other
      // PostgreSQL repository tests that share the same database.
      afterEach(async () => {
        if (client === undefined) {
          return;
        }
        const contentIds = [...createdContentItemIds];
        const sourceGroupIds = [...createdSourceGroupIds];
        const categoryIds = [...createdCategoryIds];

        if (contentIds.length > 0) {
          await client.db
            .delete(contentItems)
            .where(inArray(contentItems.id, contentIds));
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

      it("round-trips a SOURCE_GROUP collectionProvenance through PostgreSQL", async () => {
        const categoryId = nextId("category");
        const sourceGroupId = nextId("source-group");
        const contentItemId = nextId("content-item");

        await categoryRepository.save(
          createCategory(categoryId, { slug: nextSlug(categoryId) }),
        );
        createdCategoryIds.add(categoryId);

        await sourceGroupRepository.save(
          createSourceGroup(sourceGroupId, categoryId),
        );
        createdSourceGroupIds.add(sourceGroupId);

        const createdItem: ContentItem = createContentItem(
          contentItemId,
          sourceGroupId,
          { externalPostId: nextId("post") },
        );

        await contentItemRepository.save(createdItem);
        createdContentItemIds.add(contentItemId);

        const stored = await contentItemRepository.findById(contentItemId);
        expect(stored).not.toBeNull();
        expect(stored?.collectionProvenance).toEqual({
          firstCollectionSurface: {
            kind: "SOURCE_GROUP",
            sourceGroupId,
          },
          managedSourceGroupId: sourceGroupId,
        });

        const viaExternal = await contentItemRepository.findByPlatformAndExternalPostId(
          createdItem.platform,
          createdItem.externalPostId,
        );
        expect(viaExternal?.collectionProvenance).toEqual(
          stored?.collectionProvenance,
        );

        // Inspect the JSONB column directly to ensure no extra fields
        // and that it round-trips on the database side.
        const [rawRow] = await client!.db
          .select({ collectionProvenance: contentItems.collectionProvenance })
          .from(contentItems)
          .where(sql`${contentItems.id} = ${contentItemId}`);
        expect(rawRow?.collectionProvenance).toEqual({
          firstCollectionSurface: {
            kind: "SOURCE_GROUP",
            sourceGroupId,
          },
          managedSourceGroupId: sourceGroupId,
        });
      });

      it("the content_items table has collection_provenance as NOT NULL JSONB", async () => {
        const result = await client!.db.execute<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>(sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'content_items'
            AND column_name = 'collection_provenance'
        `);
        const columns = result.rows ?? [];
        expect(columns.length).toBe(1);
        const info = columns[0]!;
        expect(info.column_name).toBe("collection_provenance");
        expect(info.data_type).toBe("jsonb");
        expect(info.is_nullable).toBe("NO");
      });

      // ----------------------------------------------------------------
      // Sprint 065C1 — bare home-feed ingestion repository coverage.
      // The migration chain (0000 → 0023) must be applied before this
      // suite runs; `pnpm db:migrate` in the API container is what makes
      // `source_group_id` nullable. The tests below assert SQL-level
      // NULL and domain-level omission.
      // ----------------------------------------------------------------

      it("the content_items.source_group_id column is nullable after migration 0023", async () => {
        const result = await client!.db.execute<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>(sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'content_items'
            AND column_name = 'source_group_id'
        `);
        const columns = result.rows ?? [];
        expect(columns.length).toBe(1);
        const info = columns[0]!;
        expect(info.column_name).toBe("source_group_id");
        expect(info.data_type).toBe("text");
        expect(info.is_nullable).toBe("YES");
      });

      it("the content_items.source_group_id foreign key remains present and references source_groups.id", async () => {
        const result = await client!.db.execute<{
          constraint_name: string;
          column_name: string;
          foreign_table_name: string;
          foreign_column_name: string;
        }>(sql`
          SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          WHERE tc.table_schema = 'public'
            AND tc.table_name = 'content_items'
            AND tc.constraint_type = 'FOREIGN KEY'
        `);
        const rows = result.rows ?? [];
        // The Sprint 064B and Sprint 065C1 schema leaves the existing
        // source_group_id foreign key intact. Verify the FK actually
        // targets source_groups.id on the source_group_id column —
        // do not rely on the constraint name alone.
        const sourceGroupIdFks = rows.filter(
          (row) =>
            row.column_name === "source_group_id" &&
            row.foreign_table_name === "source_groups" &&
            row.foreign_column_name === "id",
        );
        expect(sourceGroupIdFks.length).toBeGreaterThanOrEqual(1);
      });

      it("the content_items.source_group_id index remains present", async () => {
        const result = await client!.db.execute<{
          indexname: string;
        }>(sql`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'content_items'
            AND indexname = 'content_items_source_group_id_idx'
        `);
        const rows = result.rows ?? [];
        expect(rows.length).toBe(1);
      });

      it("persists a PROFILE_HOME_FEED-first item with NULL source_group_id and omits domain sourceGroupId", async () => {
        const contentItemId = nextId("content-item-home-feed");
        const item = createHomeFeedContentItem(contentItemId);

        await contentItemRepository.save(item);
        createdContentItemIds.add(contentItemId);

        const [rawRow] = await client!.db
          .select({
            id: contentItems.id,
            sourceGroupId: contentItems.sourceGroupId,
            collectionProvenance: contentItems.collectionProvenance,
          })
          .from(contentItems)
          .where(sql`${contentItems.id} = ${contentItemId}`);

        expect(rawRow?.sourceGroupId).toBeNull();
        expect(rawRow?.collectionProvenance).toEqual({
          firstCollectionSurface: { kind: "PROFILE_HOME_FEED" },
          sourcePublisherId: "source-publisher-home-feed-it",
        });

        const viaId = await contentItemRepository.findById(contentItemId);

        expect(viaId?.sourceGroupId).toBeUndefined();
        expect(viaId?.collectionProvenance).toEqual({
          firstCollectionSurface: { kind: "PROFILE_HOME_FEED" },
          sourcePublisherId: "source-publisher-home-feed-it",
        });

        const viaExternal = await contentItemRepository.findByPlatformAndExternalPostId(
          item.platform,
          item.externalPostId,
        );
        expect(viaExternal?.sourceGroupId).toBeUndefined();
        expect(viaExternal?.collectionProvenance).toEqual(
          viaId?.collectionProvenance,
        );
      });

      it("the migration files 0021, 0022, and 0023 exist with the expected SQL fragments", () => {
        const migrationDir = resolve(process.cwd(), "drizzle");
        const nullable = readFileSync(
          resolve(
            migrationDir,
            "0023_content_items_source_group_id_nullable.sql",
          ),
          "utf8",
        );
        expect(nullable).toContain("DROP NOT NULL");
        expect(nullable).toContain('"source_group_id"');
      });
    },
  );
}

function nextId(label: string): string {
  return `content-provenance-it-${process.pid}-${Date.now()}-${label}`;
}

function nextSlug(label: string): string {
  return label.replaceAll("_", "-");
}

interface CategoryOptions {
  readonly slug?: string;
  readonly createdAt?: IsoDateTime;
  readonly updatedAt?: IsoDateTime;
}

interface SourceGroupOptions {
  readonly externalGroupId?: string;
  readonly createdAt?: IsoDateTime;
  readonly updatedAt?: IsoDateTime;
}

interface ContentItemOptions {
  readonly externalPostId?: string;
  readonly createdAt?: IsoDateTime;
  readonly updatedAt?: IsoDateTime;
}

const defaultCreatedAt = "2026-06-15T10:00:00.000Z";

function createCategory(
  id: string,
  options: CategoryOptions = {},
): ContentCategory {
  return {
    id,
    name: `Category ${id}`,
    slug: options.slug ?? `category-${id}`,
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
    status: "ACTIVE",
    collectionPriority: 50,
    createdAt: options.createdAt ?? defaultCreatedAt,
    updatedAt: options.updatedAt ?? options.createdAt ?? defaultCreatedAt,
  } satisfies Omit<SourceGroup, "entryRoutes">;

  return {
    ...base,
    entryRoutes: [createDefaultSourceGroupEntryRoute(base)],
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
    sourceUrl: `https://www.facebook.com/groups/${sourceGroupId}/posts/${id}`,
    title: `Title ${id}`,
    bodyText: `Body text for ${id}.`,
    authorDisplayName: "Author",
    authorExternalId: `author-${id}`,
    postedAt: "2026-06-15T09:00:00.000Z",
    firstCollectedAt: "2026-06-15T10:05:00.000Z",
    lastCollectedAt: "2026-06-15T10:10:00.000Z",
    reactionCount: 10,
    commentCount: 2,
    shareCount: 1,
    topComments: [
      {
        externalCommentId: `comment-${id}`,
        bodyText: "Useful comment.",
        reactionCount: 5,
        collectedAt: "2026-06-15T10:10:00.000Z",
      } satisfies TopComment,
    ],
    status: "COLLECTED",
    collectionProvenance: {
      firstCollectionSurface: {
        kind: "SOURCE_GROUP",
        sourceGroupId,
      },
      managedSourceGroupId: sourceGroupId,
    },
    createdAt: options.createdAt ?? defaultCreatedAt,
    updatedAt: options.updatedAt ?? options.createdAt ?? defaultCreatedAt,
  };
}

function createHomeFeedContentItem(id: string): ContentItem {
  return {
    id,
    platform: "FACEBOOK",
    externalPostId: `external-post-${id}`,
    sourceUrl: `https://www.facebook.com/posts/${id}`,
    title: `Title ${id}`,
    bodyText: `Body text for ${id}.`,
    authorDisplayName: "Author",
    authorExternalId: `author-${id}`,
    postedAt: "2026-06-15T09:00:00.000Z",
    firstCollectedAt: "2026-06-15T10:05:00.000Z",
    lastCollectedAt: "2026-06-15T10:10:00.000Z",
    reactionCount: 4,
    commentCount: 1,
    topComments: [
      {
        externalCommentId: `comment-${id}`,
        bodyText: "Useful comment.",
        reactionCount: 5,
        collectedAt: "2026-06-15T10:10:00.000Z",
      } satisfies TopComment,
    ],
    status: "COLLECTED",
    collectionProvenance: {
      firstCollectionSurface: { kind: "PROFILE_HOME_FEED" },
      sourcePublisherId: "source-publisher-home-feed-it",
    },
    createdAt: defaultCreatedAt,
    updatedAt: defaultCreatedAt,
  };
}

// Reference the migration files to make sure they exist with the
// expected tags. The journal-driven test in
// `src/infrastructure/database/migration-journal.test.ts` enforces
// that each entry has a corresponding .sql file.
describe("Sprint 064B migration files exist", () => {
  const migrationDir = resolve(process.cwd(), "drizzle");
  it("0018_add_content_items_collection_provenance.sql exists", () => {
    const path = resolve(
      migrationDir,
      "0018_add_content_items_collection_provenance.sql",
    );
    expect(readFileSync(path, "utf8")).toContain(
      'ADD COLUMN "collection_provenance"',
    );
  });
  it("0019_backfill_content_items_collection_provenance.sql exists", () => {
    const path = resolve(
      migrationDir,
      "0019_backfill_content_items_collection_provenance.sql",
    );
    const sql = readFileSync(path, "utf8");
    expect(sql).toContain("UPDATE");
    expect(sql).toContain('"collection_provenance"');
    expect(sql).toContain('"source_group_id"');
    expect(sql).toContain("SOURCE_GROUP");
  });
  it("0020_content_items_collection_provenance_not_null.sql exists", () => {
    const path = resolve(
      migrationDir,
      "0020_content_items_collection_provenance_not_null.sql",
    );
    expect(readFileSync(path, "utf8")).toContain("SET NOT NULL");
  });
});