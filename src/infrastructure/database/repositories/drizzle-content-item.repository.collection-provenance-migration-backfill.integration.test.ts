import { sql } from "drizzle-orm";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  extractDatabaseName,
  resolveIsolatedSprint064BDatabaseUrl,
  Sprint064BIsolatedDatabaseGuardError,
} from "./sprint-064b-isolated-database.guard";
import { createDatabaseClient } from "../client";
import type { DatabaseClient } from "../client";

const shouldRunDbTests = process.env.RUN_DB_TESTS === "true";

interface MigrationSequence {
  readonly tag: string;
  readonly path: string;
}

const MIGRATIONS: readonly MigrationSequence[] = [
  {
    tag: "0000_steep_screwball",
    path: "0000_steep_screwball.sql",
  },
  {
    tag: "0001_colossal_jack_murdock",
    path: "0001_colossal_jack_murdock.sql",
  },
  {
    tag: "0002_nice_zombie",
    path: "0002_nice_zombie.sql",
  },
  {
    tag: "0003_legal_leo",
    path: "0003_legal_leo.sql",
  },
  {
    tag: "0004_opposite_squadron_sinister",
    path: "0004_opposite_squadron_sinister.sql",
  },
  {
    tag: "0005_green_pestilence",
    path: "0005_green_pestilence.sql",
  },
  {
    tag: "0006_safe_sleepwalker",
    path: "0006_safe_sleepwalker.sql",
  },
  {
    tag: "0007_mixed_blindfold",
    path: "0007_mixed_blindfold.sql",
  },
  {
    tag: "0008_gorgeous_black_crow",
    path: "0008_gorgeous_black_crow.sql",
  },
  {
    tag: "0009_sharp_nighthawk",
    path: "0009_sharp_nighthawk.sql",
  },
  {
    tag: "0010_free_thaddeus_ross",
    path: "0010_free_thaddeus_ross.sql",
  },
  {
    tag: "0011_profile_source_access_check_outcome",
    path: "0011_profile_source_access_check_outcome.sql",
  },
  {
    tag: "0012_profile_source_access_check_outcome_backfill",
    path: "0012_profile_source_access_check_outcome_backfill.sql",
  },
  {
    tag: "0013_profile_authentication_health",
    path: "0013_profile_authentication_health.sql",
  },
  {
    tag: "0014_collector_profiles_authentication_health_index",
    path: "0014_collector_profiles_authentication_health_index.sql",
  },
  {
    tag: "0015_magical_princess_powerful",
    path: "0015_magical_princess_powerful.sql",
  },
  {
    tag: "0016_collection_run_trigger_scheduled",
    path: "0016_collection_run_trigger_scheduled.sql",
  },
  {
    tag: "0017_curious_dust",
    path: "0017_curious_dust.sql",
  },
];

const SPRINT_064B_MIGRATIONS: readonly MigrationSequence[] = [
  {
    tag: "0018_add_content_items_collection_provenance",
    path: "0018_add_content_items_collection_provenance.sql",
  },
  {
    tag: "0019_backfill_content_items_collection_provenance",
    path: "0019_backfill_content_items_collection_provenance.sql",
  },
  {
    tag: "0020_content_items_collection_provenance_not_null",
    path: "0020_content_items_collection_provenance_not_null.sql",
  },
];

if (!shouldRunDbTests) {
  describe.skip(
    "Content Item collection provenance migration backfill (Sprint 064B)",
    () => {
      it("runs only when RUN_DB_TESTS=true", () => {});
    },
  );
} else {
  describe(
    "Content Item collection provenance migration backfill (Sprint 064B, isolated)",
    () => {
      let client: DatabaseClient | undefined;
      let resolvedDatabaseUrl: string;
      let legacyRowPre0018: boolean;
      let legacyRowPost0019: boolean;

      const backupCategoryId = `sprint-064b-cat-${process.pid}-${Date.now()}`;
      const backupSourceGroupId = `sprint-064b-sg-${process.pid}-${Date.now()}`;
      const legacyContentItemId = `sprint-064b-content-legacy-${process.pid}-${Date.now()}`;
      const createdAt = "2026-06-15T10:00:00.000Z";
      const collectedAt = "2026-06-15T10:05:00.000Z";

      beforeAll(async () => {
        resolvedDatabaseUrl = resolveIsolatedSprint064BDatabaseUrl();
        // Defensive log so a misconfigured run is visible. The URL is
        // the one the guard already validated.
        const databaseName = extractDatabaseName(resolvedDatabaseUrl);
        expect(databaseName).not.toBeNull();
        expect(
          databaseName === "sprint_064b_isolated" ||
            (databaseName?.startsWith("sprint_064b_") ?? false),
        ).toBe(true);

        const databaseClient = createDatabaseClient({
          databaseUrl: resolvedDatabaseUrl,
          poolConfig: { max: 1 },
        });
        client = databaseClient;

        // Reset the schema by dropping every public table before
        // replaying the migration chain. The guard guarantees this
        // database is a dedicated disposable target, so this is
        // safe.
        await resetPublicSchema(databaseClient);

        // Apply every committed migration up to and including 0017.
        for (const migration of MIGRATIONS) {
          await applyMigration(databaseClient, migration.path);
        }

        // Insert a synthetic legacy row before the 0018 → 0019 → 0020
        // sequence runs. The legacy shape has no `collection_provenance`
        // column (because column 0018 has not been applied yet). This
        // represents a row that existed in production before Sprint
        // 064B. The fixture inserts are wrapped in a transaction so
        // either all three rows are present or none are.
        await databaseClient.db.transaction(async (tx) => {
          await tx.execute(
            sql.raw(
              `INSERT INTO "content_categories" (id, name, slug, created_at, updated_at) VALUES ('${backupCategoryId}', 'Sprint 064B Legacy Category', 'sprint-064b-legacy-cat-${process.pid}-${Date.now()}', '${createdAt}', '${createdAt}')`,
            ),
          );
          await tx.execute(
            sql.raw(
              `INSERT INTO "source_groups" (id, platform, external_group_id, name, url, category_id, status, collection_priority, entry_routes, created_at, updated_at) VALUES ('${backupSourceGroupId}', 'FACEBOOK', 'sprint-064b-legacy-ext-${process.pid}-${Date.now()}', 'Sprint 064B Legacy Group', 'https://www.facebook.com/groups/${backupSourceGroupId}', '${backupCategoryId}', 'ACTIVE', 50, '[]'::jsonb, '${createdAt}', '${createdAt}')`,
            ),
          );
          await tx.execute(
            sql.raw(
              `INSERT INTO "content_items" (id, platform, source_group_id, external_post_id, source_url, body_text, first_collected_at, last_collected_at, reaction_count, comment_count, share_count, top_comments, status, created_at, updated_at) VALUES ('${legacyContentItemId}', 'FACEBOOK', '${backupSourceGroupId}', 'sprint-064b-legacy-post-${process.pid}-${Date.now()}', 'https://www.facebook.com/groups/${backupSourceGroupId}/posts/${legacyContentItemId}', 'Legacy body text for ${legacyContentItemId}.', '${collectedAt}', '${collectedAt}', 10, 2, 1, '[]'::jsonb, 'COLLECTED', '${createdAt}', '${createdAt}')`,
            ),
          );
          const inserted = await tx.execute<{ id: string }>(sql`
            SELECT id FROM "content_items" WHERE id = ${legacyContentItemId}
          `);
          legacyRowPre0018 = (inserted.rows ?? []).some(
            (row) => row.id === legacyContentItemId,
          );
        });

        // Prove the row exists in the pre-0018 shape: no
        // collection_provenance column on the table yet, so the
        // inserted row has no provenance field at all.
        const preColumns = await databaseClient.db.execute<{
          column_name: string;
        }>(sql`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'content_items'
        `);
        const preColumnNames = (preColumns.rows ?? []).map(
          (row) => row.column_name,
        );
        expect(preColumnNames).not.toContain("collection_provenance");

        // Capture the legacy-row existence flag at the moment
        // immediately before migration 0018 runs. The pre-0018
        // table does not have `collection_provenance` yet, so we
        // select only the primary key here and assert existence
        // separately from any pre/post provenance shape.
        const preBackfillRows = await databaseClient.db.execute<{
          id: string;
        }>(sql`
          SELECT id FROM "content_items" WHERE id = ${legacyContentItemId}
        `);
        legacyRowPre0018 = (preBackfillRows.rows ?? []).some(
          (row) => row.id === legacyContentItemId,
        );

        // Apply migration 0018 (add column, nullable) so we can
        // capture the legacy-row pre-0019 NULL provenance.
        await applyMigration(
          databaseClient,
          SPRINT_064B_MIGRATIONS[0]!.path,
        );

        const pre0019Rows = await databaseClient.db.execute<{
          id: string;
          collection_provenance: unknown;
        }>(sql`
          SELECT id, collection_provenance
          FROM "content_items"
          WHERE id = ${legacyContentItemId}
        `);
        const legacyPreProvenance = (pre0019Rows.rows ?? []).find(
          (row) => row.id === legacyContentItemId,
        )?.collection_provenance;

        // Apply migration 0019 (backfill) and 0020 (set NOT NULL).
        for (const migration of SPRINT_064B_MIGRATIONS.slice(1)) {
          await applyMigration(databaseClient, migration.path);
        }

        // Capture the post-0019 state of the legacy row.
        const postRows = await databaseClient.db.execute<{
          id: string;
          collection_provenance: unknown;
        }>(sql`
          SELECT id, collection_provenance
          FROM "content_items"
          WHERE id = ${legacyContentItemId}
        `);
        legacyRowPost0019 = (postRows.rows ?? []).some(
          (row) => row.id === legacyContentItemId,
        );
        // Capture for later use as proof of pre/post provenance shape.
        (globalThis as { __sprint064bPreProvenance?: unknown }).__sprint064bPreProvenance =
          legacyPreProvenance;
      });

      afterAll(async () => {
        if (client === undefined) {
          return;
        }
        // Clean up: drop the public schema so the next run starts
        // from a blank state. PostgreSQL DDL is auto-committed, so
        // we cannot roll back the migration chain inside a
        // transaction; the schema reset is the equivalent
        // cleanup. The guard guarantees this database is an isolated
        // disposable target.
        await resetPublicSchema(client);
        await client.close();
      });

      it("the legacy content row exists before migration 0019 runs", () => {
        expect(legacyRowPre0018).toBe(true);
      });

      it("the legacy row had a null collection_provenance before migration 0019 ran", () => {
        const preProvenance = (
          globalThis as { __sprint064bPreProvenance?: unknown }
        ).__sprint064bPreProvenance;
        // After 0018 (nullable) and before 0019 (backfill), the
        // legacy row's collection_provenance column is NULL.
        expect(preProvenance).toBeNull();
      });

      it("the legacy row survives the migration chain", () => {
        expect(legacyRowPost0019).toBe(true);
      });

      it("the legacy row is populated from source_group_id by migration 0019", async () => {
        const rows = await client!.db.execute<{
          collection_provenance: {
            firstCollectionSurface: { kind: string; sourceGroupId: string };
            managedSourceGroupId?: string;
          };
        }>(sql`
          SELECT collection_provenance
          FROM "content_items"
          WHERE id = ${legacyContentItemId}
        `);
        const row = rows.rows?.[0];
        expect(row).toBeDefined();
        expect(row?.collection_provenance.firstCollectionSurface).toEqual({
          kind: "SOURCE_GROUP",
          sourceGroupId: backupSourceGroupId,
        });
        expect(row?.collection_provenance.managedSourceGroupId).toBe(
          backupSourceGroupId,
        );
      });

      it("no content row has a null collection_provenance after the migration sequence", async () => {
        const rows = await client!.db.execute<{ id: string }>(sql`
          SELECT id FROM "content_items" WHERE collection_provenance IS NULL
        `);
        const ids = (rows.rows ?? []).map((row) => row.id);
        expect(ids).toEqual([]);
      });

      it("the collection_provenance column is JSONB and NOT NULL after migration 0020", async () => {
        const result = await client!.db.execute<{
          data_type: string;
          is_nullable: string;
        }>(sql`
          SELECT data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'content_items'
            AND column_name = 'collection_provenance'
        `);
        const info = result.rows?.[0];
        expect(info).toBeDefined();
        expect(info?.data_type).toBe("jsonb");
        expect(info?.is_nullable).toBe("NO");
      });

      it("the migration does not modify created_at, updated_at, first_collected_at, last_collected_at, or source_group_id on the legacy row", async () => {
        const rows = await client!.db.execute<{
          source_group_id: string;
          first_collected_at: string;
          last_collected_at: string;
          created_at: string;
          updated_at: string;
        }>(sql`
          SELECT source_group_id, first_collected_at, last_collected_at, created_at, updated_at
          FROM "content_items"
          WHERE id = ${legacyContentItemId}
        `);
        const row = rows.rows?.[0];
        expect(row).toBeDefined();
        expect(row?.source_group_id).toBe(backupSourceGroupId);
        expect(new Date(row!.first_collected_at).toISOString()).toBe(
          collectedAt,
        );
        expect(new Date(row!.last_collected_at).toISOString()).toBe(
          collectedAt,
        );
        expect(new Date(row!.created_at).toISOString()).toBe(createdAt);
        expect(new Date(row!.updated_at).toISOString()).toBe(createdAt);
      });

      it("the migration does not invent a sourcePublisherId on the backfilled row", async () => {
        const rows = await client!.db.execute<{
          collection_provenance: { sourcePublisherId?: string };
        }>(sql`
          SELECT collection_provenance
          FROM "content_items"
          WHERE id = ${legacyContentItemId}
        `);
        const row = rows.rows?.[0];
        expect(row?.collection_provenance.sourcePublisherId).toBeUndefined();
      });

      it("the migration guard rejects unparseable database URLs", () => {
        expect(() =>
          resolveIsolatedSprint064BDatabaseUrl({
            env: { SPRINT_064B_DATABASE_URL: "not a url" },
          }),
        ).toThrow(Sprint064BIsolatedDatabaseGuardError);
      });
    },
  );
}

async function resetPublicSchema(client: DatabaseClient): Promise<void> {
  await client.db.execute(
    sql.raw(`DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;`),
  );
}

async function applyMigration(
  client: DatabaseClient,
  migrationPath: string,
): Promise<void> {
  const fullPath = resolve(process.cwd(), "drizzle", migrationPath);
  const sqlText = readFileSync(fullPath, "utf8");
  const statements = sqlText
    .split("--> statement-breakpoint")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);
  for (const stmt of statements) {
    await client.db.execute(sql.raw(stmt));
  }
}