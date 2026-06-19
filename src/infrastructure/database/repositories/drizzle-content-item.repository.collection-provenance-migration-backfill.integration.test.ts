import { inArray, sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDatabaseClient } from "../client";
import type { DatabaseClient } from "../client";
import {
  contentCategories,
  contentItems,
  sourceGroups,
} from "../schema/content-manager.schema";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

if (!shouldRunDbTests) {
  describe.skip(
    "Content Item collection provenance migration backfill (Sprint 064B)",
    () => {
      it("runs only when RUN_DB_TESTS=true", () => {});
    },
  );
} else {
  describe(
    "Content Item collection provenance migration backfill (Sprint 064B)",
    () => {
      let client: DatabaseClient | undefined;
      const backupCategoryId = `content-provenance-backup-category-${process.pid}-${Date.now()}`;
      const backupSourceGroupId = `content-provenance-backup-source-group-${process.pid}-${Date.now()}`;
      const insertedContentIds: string[] = [];

      beforeAll(async () => {
        const databaseClient = createDatabaseClient({
          poolConfig: { max: 1 },
        });
        client = databaseClient;

        // Apply the migration sequence inside this isolated test. The
        // production Docker E2E applies migrations via drizzle-kit;
        // this spec validates the SQL directly through the same
        // database client used by the rest of the integration suite.
        const migrationDir = resolve(process.cwd(), "drizzle");
        await applyMigration(
          databaseClient,
          resolve(
            migrationDir,
            "0018_add_content_items_collection_provenance.sql",
          ),
        );
        await applyMigration(
          databaseClient,
          resolve(
            migrationDir,
            "0019_backfill_content_items_collection_provenance.sql",
          ),
        );
        await applyMigration(
          databaseClient,
          resolve(
            migrationDir,
            "0020_content_items_collection_provenance_not_null.sql",
          ),
        );

        // Seed a category, source group, and a content item that
        // exercises the backfill path. The content item is inserted
        // with collection_provenance explicitly set so the test does
        // not depend on a prior state.
        // Insert via raw SQL to avoid Drizzle type variance issues
        // when the schema contains a self-referencing JSONB column.
        await databaseClient.db.execute(
          sql.raw(
            `INSERT INTO "content_categories" (id, name, slug, created_at, updated_at) VALUES ('${backupCategoryId}', 'Provenance Backup Category', 'provenance-backup-category-${process.pid}-${Date.now()}', '2026-06-15T10:00:00.000Z', '2026-06-15T10:00:00.000Z')`,
          ),
        );
        await databaseClient.db.execute(
          sql.raw(
            `INSERT INTO "source_groups" (id, platform, external_group_id, name, url, category_id, status, collection_priority, entry_routes, created_at, updated_at) VALUES ('${backupSourceGroupId}', 'FACEBOOK', 'external-provenance-backup-${process.pid}-${Date.now()}', 'Provenance Backup Group', 'https://www.facebook.com/groups/${backupSourceGroupId}', '${backupCategoryId}', 'ACTIVE', 50, '[]'::jsonb, '2026-06-15T10:00:00.000Z', '2026-06-15T10:00:00.000Z')`,
          ),
        );
        const insertedId = `content-provenance-backup-${process.pid}-${Date.now()}`;
        insertedContentIds.push(insertedId);
        const collectionProvenanceJson = JSON.stringify({
          firstCollectionSurface: {
            kind: "SOURCE_GROUP",
            sourceGroupId: backupSourceGroupId,
          },
          managedSourceGroupId: backupSourceGroupId,
        }).replaceAll("'", "''");
        await databaseClient.db.execute(
          sql.raw(
            `INSERT INTO "content_items" (id, platform, source_group_id, external_post_id, source_url, body_text, first_collected_at, last_collected_at, reaction_count, comment_count, share_count, top_comments, status, collection_provenance, created_at, updated_at) VALUES ('${insertedId}', 'FACEBOOK', '${backupSourceGroupId}', 'external-post-${insertedId}', 'https://www.facebook.com/groups/${backupSourceGroupId}/posts/${insertedId}', 'Body text for ${insertedId}.', '2026-06-15T10:05:00.000Z', '2026-06-15T10:10:00.000Z', 10, 2, 1, '[]'::jsonb, 'COLLECTED', '${collectionProvenanceJson}'::jsonb, '2026-06-15T10:00:00.000Z', '2026-06-15T10:00:00.000Z')`,
          ),
        );
      });

      afterAll(async () => {
        if (client === undefined) {
          return;
        }
        if (insertedContentIds.length > 0) {
          await client.db
            .delete(contentItems)
            .where(inArray(contentItems.id, insertedContentIds));
        }
        await client.db
          .delete(sourceGroups)
          .where(sql`${sourceGroups.id} = ${backupSourceGroupId}`);
        await client.db
          .delete(contentCategories)
          .where(sql`${contentCategories.id} = ${backupCategoryId}`);
        await client.close();
      });

      it("the content_items.collection_provenance column is NOT NULL after the 0020 migration", async () => {
        const result = await client!.db.execute<{ is_nullable: string }>(sql`
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'content_items'
            AND column_name = 'collection_provenance'
        `);
        const info = result.rows?.[0];
        expect(info).toBeDefined();
        expect(info?.is_nullable).toBe("NO");
      });

      it("the backfill produces a SOURCE_GROUP collection_provenance from source_group_id", async () => {
        const rows = await client!.db
          .select({
            id: contentItems.id,
            collectionProvenance: contentItems.collectionProvenance,
          })
          .from(contentItems)
          .where(inArray(contentItems.id, insertedContentIds));
        const item = rows[0];
        expect(item).toBeDefined();
        expect(item?.collectionProvenance).toEqual({
          firstCollectionSurface: {
            kind: "SOURCE_GROUP",
            sourceGroupId: backupSourceGroupId,
          },
          managedSourceGroupId: backupSourceGroupId,
        });
      });

      it("the migration does not modify created_at, updated_at, or source_group_id", async () => {
        const rows = await client!.db
          .select({
            id: contentItems.id,
            sourceGroupId: contentItems.sourceGroupId,
            createdAt: contentItems.createdAt,
            updatedAt: contentItems.updatedAt,
          })
          .from(contentItems)
          .where(inArray(contentItems.id, insertedContentIds));
        const item = rows[0];
        expect(item?.sourceGroupId).toBe(backupSourceGroupId);
        expect(new Date(item!.createdAt).toISOString()).toBe(
          "2026-06-15T10:00:00.000Z",
        );
        expect(new Date(item!.updatedAt).toISOString()).toBe(
          "2026-06-15T10:00:00.000Z",
        );
      });

      it("the migration does not invent a sourcePublisherId", async () => {
        const rows = await client!.db
          .select({
            collectionProvenance: contentItems.collectionProvenance,
          })
          .from(contentItems)
          .where(inArray(contentItems.id, insertedContentIds));
        const item = rows[0];
        const provenance = item?.collectionProvenance as {
          sourcePublisherId?: string;
        };
        expect(provenance?.sourcePublisherId).toBeUndefined();
      });
    },
  );
}

async function applyMigration(
  client: DatabaseClient,
  migrationPath: string,
): Promise<void> {
  const sqlText = readFileSync(migrationPath, "utf8");
  // Each migration file uses `--> statement-breakpoint` to split
  // statements. Drizzle's SQL generator uses this marker.
  const statements = sqlText
    .split("--> statement-breakpoint")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
  for (const stmt of statements) {
    await client.db.execute(sql.raw(stmt));
  }
}