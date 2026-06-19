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
const sprint064BDatabaseUrl = process.env.SPRINT_064B_DATABASE_URL ?? "";
const hasSprint064BDatabaseUrl = sprint064BDatabaseUrl.trim() !== "";

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

interface LegacyRowSnapshot extends Record<string, unknown> {
  readonly id: string;
  readonly platform: string;
  readonly source_group_id: string;
  readonly external_post_id: string;
  readonly source_url: string;
  readonly title: string | null;
  readonly body_text: string;
  readonly author_display_name: string | null;
  readonly author_external_id: string | null;
  readonly posted_at: string | null;
  readonly first_collected_at: string;
  readonly last_collected_at: string;
  readonly reaction_count: number;
  readonly comment_count: number;
  readonly share_count: number | null;
  readonly top_comments: unknown;
  readonly status: string;
  readonly raw_payload_ref: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

const FULL_LEGACY_FIELDS = [
  "id",
  "platform",
  "source_group_id",
  "external_post_id",
  "source_url",
  "title",
  "body_text",
  "author_display_name",
  "author_external_id",
  "posted_at",
  "first_collected_at",
  "last_collected_at",
  "reaction_count",
  "comment_count",
  "share_count",
  "top_comments",
  "status",
  "raw_payload_ref",
  "created_at",
  "updated_at",
] as const;

const LEGACY_FIELDS_SQL = FULL_LEGACY_FIELDS.map((f) => `"${f}"`).join(", ");

if (!shouldRunDbTests || !hasSprint064BDatabaseUrl) {
  describe.skip(
    "Content Item collection provenance migration backfill (Sprint 064B)",
    () => {
      it("runs only when RUN_DB_TESTS=true and SPRINT_064B_DATABASE_URL is set", () => {});
    },
  );
} else {
  describe(
    "Content Item collection provenance migration backfill (Sprint 064B, isolated)",
    () => {
      let client: DatabaseClient | undefined;
      let resolvedDatabaseUrl: string;
      let legacyRowExistsAfterChain: boolean;

      const backupCategoryId = `sprint-064b-cat-${process.pid}-${Date.now()}`;
      const backupSourceGroupId = `sprint-064b-sg-${process.pid}-${Date.now()}`;
      const legacyContentItemId = `sprint-064b-content-legacy-${process.pid}-${Date.now()}`;
      const createdAt = "2026-06-15T10:00:00.000Z";
      const postedAt = "2026-06-15T09:30:00.000Z";
      const collectedAt = "2026-06-15T10:05:00.000Z";

      const topComments = [
        {
          externalCommentId: `sprint-064b-comment-${process.pid}-${Date.now()}-1`,
          bodyText: "Top comment one.",
          authorDisplayName: "Commenter One",
          authorExternalId: "commenter-ext-1",
          reactionCount: 7,
          replyCount: 1,
          postedAt,
          collectedAt,
        },
        {
          externalCommentId: `sprint-064b-comment-${process.pid}-${Date.now()}-2`,
          bodyText: "Top comment two.",
          authorDisplayName: "Commenter Two",
          authorExternalId: "commenter-ext-2",
          reactionCount: 4,
          replyCount: 0,
          postedAt,
          collectedAt,
        },
      ];

      const legacySnapshot: { before?: LegacyRowSnapshot } = {};
      const postProvenance: { value?: unknown } = {};

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

        // Insert a synthetic legacy row with every practical field
        // populated. The legacy shape has no `collection_provenance`
        // column (because migration 0018 has not been applied yet).
        // This represents a row that existed in production before
        // Sprint 064B. The fixture inserts are wrapped in a
        // transaction so either all three rows are present or none
        // are.
        const topCommentsJson = JSON.stringify(topComments).replaceAll(
          "'",
          "''",
        );

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
              `INSERT INTO "content_items" (${LEGACY_FIELDS_SQL}) VALUES (` +
                `'${legacyContentItemId}', ` +
                `'FACEBOOK', ` +
                `'${backupSourceGroupId}', ` +
                `'sprint-064b-legacy-post-${process.pid}-${Date.now()}', ` +
                `'https://www.facebook.com/groups/${backupSourceGroupId}/posts/${legacyContentItemId}', ` +
                `'Sprint 064B Legacy Title', ` +
                `'Legacy body text for ${legacyContentItemId}.', ` +
                `'Sprint 064B Legacy Author', ` +
                `'sprint-064b-legacy-author-ext-${process.pid}-${Date.now()}', ` +
                `'${postedAt}', ` +
                `'${collectedAt}', ` +
                `'${collectedAt}', ` +
                `42, ` +
                `8, ` +
                `3, ` +
                `'${topCommentsJson}'::jsonb, ` +
                `'COLLECTED', ` +
                `'sprint-064b-legacy-payload-${process.pid}-${Date.now()}', ` +
                `'${createdAt}', ` +
                `'${createdAt}'` +
                `)`,
            ),
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

        // Capture the complete legacy row before migration 0018
        // runs. The pre-0018 table has no `collection_provenance`
        // column, so the snapshot intentionally excludes it. This
        // snapshot is the data-preservation baseline used after the
        // migration chain runs.
        const pre0018Rows = await databaseClient.db.execute<LegacyRowSnapshot>(
          sql.raw(
            `SELECT ${LEGACY_FIELDS_SQL} FROM "content_items" WHERE id = '${legacyContentItemId}'`,
          ),
        );
        const pre0018Row = (pre0018Rows.rows ?? [])[0];
        expect(pre0018Row).toBeDefined();
        legacySnapshot.before = pre0018Row as LegacyRowSnapshot;

        // Apply migration 0018 (add column, nullable). The legacy
        // row's `collection_provenance` is now a NULL jsonb because
        // 0019 (the backfill) has not run yet.
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
        const pre0019Provenance = (pre0019Rows.rows ?? []).find(
          (row) => row.id === legacyContentItemId,
        )?.collection_provenance;
        expect(pre0019Provenance).toBeNull();

        // Apply migration 0019 (backfill) and 0020 (set NOT NULL).
        for (const migration of SPRINT_064B_MIGRATIONS.slice(1)) {
          await applyMigration(databaseClient, migration.path);
        }

        // Capture the post-chain state for use in the assertions
        // below. The provenance value is stored separately because
        // it is excluded from the data-preservation equality
        // comparison.
        const postRows = await databaseClient.db.execute<{
          id: string;
          collection_provenance: unknown;
        }>(sql`
          SELECT id, collection_provenance
          FROM "content_items"
          WHERE id = ${legacyContentItemId}
        `);
        const postRow = (postRows.rows ?? [])[0];
        legacyRowExistsAfterChain = postRow?.id === legacyContentItemId;
        postProvenance.value = postRow?.collection_provenance;
      });

      afterAll(async () => {
        if (client === undefined) {
          return;
        }
        // Clean up: drop the public schema so the next run starts
        // from a blank state. This test executes the migration SQL
        // files directly via `client.db.execute` without wrapping
        // them in a single outer transaction, so the migration
        // statements cannot be rolled back at the end of the
        // suite. The schema reset is therefore the equivalent
        // cleanup mechanism. The guard guarantees this database is
        // an isolated disposable target.
        await resetPublicSchema(client);
        await client.close();
      });

      it("the legacy content row exists before migration 0019 runs", () => {
        expect(legacySnapshot.before).toBeDefined();
      });

      it("the legacy row survives the migration chain", () => {
        expect(legacyRowExistsAfterChain).toBe(true);
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
          column_default: string | null;
        }>(sql`
          SELECT data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'content_items'
            AND column_name = 'collection_provenance'
        `);
        const info = result.rows?.[0];
        expect(info).toBeDefined();
        expect(info?.data_type).toBe("jsonb");
        expect(info?.is_nullable).toBe("NO");
        expect(info?.column_default).toBeNull();
      });

      it("no index exists on collection_provenance", async () => {
        const result = await client!.db.execute<{
          indexname: string;
        }>(sql`
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND tablename = 'content_items'
            AND indexname LIKE '%collection_provenance%'
        `);
        const names = (result.rows ?? []).map((row) => row.indexname);
        expect(names).toEqual([]);
      });

      it("every original field on the legacy row is preserved across the migration chain", async () => {
        const rows = await client!.db.execute<LegacyRowSnapshot>(
          sql.raw(
            `SELECT ${LEGACY_FIELDS_SQL} FROM "content_items" WHERE id = '${legacyContentItemId}'`,
          ),
        );
        const after = (rows.rows ?? [])[0] as LegacyRowSnapshot | undefined;
        const before = legacySnapshot.before;
        expect(before).toBeDefined();
        expect(after).toBeDefined();
        if (before === undefined || after === undefined) {
          return;
        }

        // Compare every original field except the post-migration
        // `collection_provenance` JSONB column, which by design is
        // newly added and backfilled.
        expect(after.id).toBe(before.id);
        expect(after.platform).toBe(before.platform);
        expect(after.source_group_id).toBe(before.source_group_id);
        expect(after.external_post_id).toBe(before.external_post_id);
        expect(after.source_url).toBe(before.source_url);
        expect(after.title).toBe(before.title);
        expect(after.body_text).toBe(before.body_text);
        expect(after.author_display_name).toBe(before.author_display_name);
        expect(after.author_external_id).toBe(before.author_external_id);
        expect(after.posted_at).toBe(before.posted_at);
        expect(
          new Date(after.first_collected_at).toISOString(),
        ).toBe(new Date(before.first_collected_at).toISOString());
        expect(
          new Date(after.last_collected_at).toISOString(),
        ).toBe(new Date(before.last_collected_at).toISOString());
        expect(after.reaction_count).toBe(before.reaction_count);
        expect(after.comment_count).toBe(before.comment_count);
        expect(after.share_count).toBe(before.share_count);
        expect(after.top_comments).toEqual(before.top_comments);
        expect(after.status).toBe(before.status);
        expect(after.raw_payload_ref).toBe(before.raw_payload_ref);
        expect(new Date(after.created_at).toISOString()).toBe(
          new Date(before.created_at).toISOString(),
        );
        expect(new Date(after.updated_at).toISOString()).toBe(
          new Date(before.updated_at).toISOString(),
        );

        // Non-empty top_comments survives byte-for-byte.
        expect(Array.isArray(after.top_comments)).toBe(true);
        expect((after.top_comments as unknown[]).length).toBe(2);
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

      it("the captured post-0019 provenance equals the currently persisted value", () => {
        const persisted = postProvenance.value as
          | {
              firstCollectionSurface: { kind: string; sourceGroupId: string };
              managedSourceGroupId?: string;
            }
          | undefined;
        expect(persisted).toEqual({
          firstCollectionSurface: {
            kind: "SOURCE_GROUP",
            sourceGroupId: backupSourceGroupId,
          },
          managedSourceGroupId: backupSourceGroupId,
        });
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
