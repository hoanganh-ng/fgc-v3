# Sprint 064B: Provenance Persistence And Compatibility

## Goal

Persist the Sprint 064A `ContentCollectionProvenance` value object as
part of every `ContentItem`, safely backfill every existing
source-group content row, and integrate provenance creation and merge
into the current source-group ingestion flow without changing the
existing `CollectedContentInput`, HTTP request, response, route, or
DTO contracts.

## Context

Sprint 064A added the pure Content Manager
`ContentCollectionProvenance` domain model with the strict,
Zod-validated `CollectionSurface` discriminated union
(`SOURCE_GROUP` and `PROFILE_HOME_FEED`), the
`CollectedContentProvenanceInput`, the durable
`ContentCollectionProvenance` value object, the pure
`createInitialContentCollectionProvenance` and
`mergeContentCollectionProvenance` functions, and the typed
`ContentCollectionProvenanceConflictError` (code
`CONTENT_COLLECTION_PROVENANCE_CONFLICT`). Sprint 064A added no
persistence, no HTTP contract changes, and no application use cases.

The current `content_items` PostgreSQL table only persists a
`source_group_id` foreign-key column and does not persist any
collection provenance marker. Sprint 064B persists a
`collection_provenance` JSONB column on every `content_items` row,
keeps the existing `source_group_id` column required and unchanged for
backward compatibility, and derives `SOURCE_GROUP` provenance
internally from the required `sourceGroupId` so every existing and
newly ingested content row receives an initial provenance value.

This sprint is the persistence and compatibility layer for Sprint 064A.
It is intentionally narrow: it does not promote `sourceGroupId` to a
nullable column, does not introduce home-feed ingestion or execution,
does not add a `SourcePublisher` resolution flow, does not add any
HTTP DTO field, does not add any provenance index, and does not change
the external request shape of the content-item ingestion endpoint.

## Capability Summary

- A new required `collectionProvenance` field on the durable
  `ContentItem` schema. The field reuses the existing
  `ContentCollectionProvenanceSchema` from Sprint 064A and rejects
  unknown fields and `null` optional fields.
- A new PostgreSQL `content_items.collection_provenance JSONB` column.
  The column is added in a first migration, backfilled from
  `source_group_id` in a second migration, and constrained `NOT NULL`
  in a third migration.
- A safe split `0018_add_content_items_collection_provenance`,
  `0019_backfill_content_items_collection_provenance`, and
  `0020_content_items_collection_provenance_not_null` migration
  sequence that mirrors the existing
  `0011_profile_source_access_check_outcome`,
  `0012_profile_source_access_check_outcome_backfill`,
  `0013_profile_authentication_health` split pattern. The split keeps
  large backfills safe and avoids breaking the existing `NOT NULL`
  invariant on the legacy `source_group_id` column.
- The Drizzle `content_items` schema gains a
  `collection_provenance jsonb` column typed as
  `ContentCollectionProvenance`. The existing `source_group_id`
  column remains required and unchanged.
- The ContentItem mapper (`toContentItemRow` and `toContentItemDomain`)
  round-trips the new column with strict runtime validation against
  `ContentCollectionProvenanceSchema` on both sides. All persisted
  values entering or leaving the adapter pass strict runtime
  validation.
- The `IngestCollectedContentUseCase` derives the provenance input
  from the existing required `sourceGroupId` on the
  `CollectedContentInput`:
  - For a new content item the use case builds
    `createInitialContentCollectionProvenance({ collectionSurface: { kind: 'SOURCE_GROUP', sourceGroupId: input.sourceGroupId } })`
    and stores the resulting `ContentCollectionProvenance` on the
    content item. `sourcePublisherId` is not invented.
  - For an existing duplicate content item (matched by
    `platform + externalPostId`) the use case builds the same
    `SOURCE_GROUP` provenance input from the incoming
    `sourceGroupId` and calls
    `mergeContentCollectionProvenance(existing.collectionProvenance, input)`.
    A merge that throws `ContentCollectionProvenanceConflictError`
    propagates the typed error to the caller; the repository `save`
    is never called for a failed merge.
- The existing `ContentItem.sourceGroupId` field and the PostgreSQL
  `source_group_id` column remain required and unchanged for
  backward compatibility. `sourceGroupId` is never made nullable in
  this sprint.
- No HTTP route, request body, response body, or JSON schema changes
  are introduced. The `ContentItemDto`, the
  `IngestCollectedContentHttpBodySchema`, the
  `contentItemIngestBodyJsonSchema`, the
  `contentItemJsonSchema`, the `getContentItemHttpRouteSchema`, the
  `listContentItemsHttpRouteSchema`, the
  `updateContentStatusHttpRouteSchema`, and the
  `ingestCollectedContentHttpRouteSchema` are unchanged. The
  `collectionProvenance` field is internal-only and is not exposed
  through HTTP DTOs or JSON schemas. Regression assertions in the
  Content Manager HTTP layer prove that `collectionProvenance` is
  never serialized over HTTP.

## Compatibility Invariants

The following invariants preserve backward compatibility:

- `CollectedContentInput` and `IngestCollectedContentHttpBodySchema`
  remain unchanged. `sourceGroupId` remains required on the request
  body.
- `ContentItem.sourceGroupId` and the PostgreSQL `source_group_id`
  column remain required and unchanged for compatibility.
- The `ContentItemDto` and the content-item response JSON schema do
  not gain a `collectionProvenance` field.
- The content-item request and response routes keep the existing
  status codes, validation behavior, and error mapping.
- A merge that throws `ContentCollectionProvenanceConflictError` is
  propagated to the caller as the typed domain error; the repository
  `save` is never called for a failed merge.
- `mergeCollectedContent` accepts a merged provenance override via
  `MergeCollectedContentOptions.collectionProvenance`. No fourth
  positional provenance parameter is supported; no declared option
  is silently ignored.

## Source-Group Provenance Validation

Sprint 064B validates that a `ContentCollectionProvenance` never
disagrees with the legacy `sourceGroupId` on the content item. The
validation runs as part of the strict Zod `ContentItemSchema` on the
domain merge path, the persistence path, and the read path:

- During merge: when a `SOURCE_GROUP` input has a `sourceGroupId`
  different from the existing item's `sourceGroupId`, the merge
  resolves `managedSourceGroupId` from the incoming
  `sourceGroupId`; the persisted item's `sourceGroupId` and
  `collectionProvenance.firstCollectionSurface.sourceGroupId`
  remain equal.
- During persistence: `toContentItemRow` validates the complete
  `ContentItem` against `ContentItemSchema`, which enforces both
  the `SOURCE_GROUP` and `PROFILE_HOME_FEED` invariant branches in a
  single schema. An invariant violation throws
  `InvalidPersistedContentManagerRecordError` carrying the real
  content item id, so corrupted rows can never enter the database.
- During read: `toContentItemDomain` runs the same complete
  `ContentItemSchema` validation after parsing the persisted JSONB
  column.

### Corrected home-feed compatibility invariant

For a `ContentItem` whose `firstCollectionSurface.kind` is
`PROFILE_HOME_FEED`:

- `collectionProvenance.managedSourceGroupId` is required.
- `collectionProvenance.managedSourceGroupId` must equal
  `ContentItem.sourceGroupId`.
- The legacy `ContentItem.sourceGroupId` field and the PostgreSQL
  `source_group_id` column remain required for compatibility.

Bare home-feed ingestion (a `ContentItem` whose first surface is
`PROFILE_HOME_FEED` and which has no `managedSourceGroupId`) is
still unsupported. The current HTTP ingestion path continues to
flow through `SOURCE_GROUP` first surfaces derived from the
required `sourceGroupId` on the request body; nothing in Sprint
064B changes the wire contract.

## Migration Sequence

The migration follows the existing add-column → backfill →
set-NOT-NULL split pattern used for the Sprint 054B outcome
column.

`0018_add_content_items_collection_provenance.sql`:

```sql
ALTER TABLE "content_items" ADD COLUMN "collection_provenance" jsonb;--> statement-breakpoint
```

`0019_backfill_content_items_collection_provenance.sql`:

```sql
UPDATE "content_items"
SET "collection_provenance" = jsonb_build_object(
  'firstCollectionSurface',
  jsonb_build_object(
    'kind', 'SOURCE_GROUP',
    'sourceGroupId', "source_group_id"
  ),
  'managedSourceGroupId', "source_group_id"
)
WHERE "collection_provenance" IS NULL;--> statement-breakpoint
```

`0020_content_items_collection_provenance_not_null.sql`:

```sql
ALTER TABLE "content_items"
  ALTER COLUMN "collection_provenance" SET NOT NULL;--> statement-breakpoint
```

The migrations never invent a `sourcePublisherId`, never modify
`created_at` or `updated_at` or `first_collected_at` or
`last_collected_at`, and never modify the existing
`source_group_id` column.

## Drizzle Snapshot

A single authoritative final snapshot
`drizzle/meta/0020_snapshot.json` records the post-0020 schema. The
snapshot is chained from the `0017` snapshot id and adds
`collection_provenance` to `content_items` as a `jsonb` column with
`notNull: true`, no default, and no index. Drizzle does not
generate a per-step snapshot for `0018`, `0019`, or `0020`. The
snapshot is the migration story's authoritative destination, not
each step.

Running `pnpm db:generate` after the snapshot lands must not
propose adding `collection_provenance` again, since the snapshot
already records it. The verification commands assert this.

## Architecture

```text
Content Manager (domain)
  content.ts
    ContentItem gained collectionProvenance
  content.schemas.ts
    ContentItemSchema gained collectionProvenance (reuses
      ContentCollectionProvenanceSchema from Sprint 064A)
  content-collection-provenance.ts (unchanged)
  content-collection-provenance.schemas.ts (unchanged)
  validation.ts
    validateContentItemForApplication uses the updated schema

Content Manager (application)
  use-cases/ingest-collected-content.use-case.ts
    derives SOURCE_GROUP provenance from input.sourceGroupId
    uses createInitialContentCollectionProvenance for new items
    uses mergeContentCollectionProvenance for duplicates
    propagates ContentCollectionProvenanceConflictError

Drizzle schema
  src/infrastructure/database/schema/content-manager.schema.ts
    contentItems gained collection_provenance jsonb

Drizzle migrations (split)
  drizzle/0018_add_content_items_collection_provenance.sql
  drizzle/0019_backfill_content_items_collection_provenance.sql
  drizzle/0020_content_items_collection_provenance_not_null.sql
  drizzle/meta/_journal.json
    new idx 18, 19, 20 entries with strictly increasing idx/when

Mapper
  src/infrastructure/database/mappers/content-manager.mapper.ts
    toContentItemRow round-trips collection_provenance with
      strict runtime validation and source-group consistency
    toContentItemDomain round-trips collection_provenance with
      strict runtime validation

Drizzle repository
  src/infrastructure/database/repositories/drizzle-content-item.repository.ts
    save persists collection_provenance
    findById and findByPlatformAndExternalPostId return the
      full ContentItem including collection_provenance

HTTP adapter (unchanged)
  src/interfaces/http/routes/content-manager.routes.ts
  src/interfaces/http/schemas/content-manager.http-schemas.ts
  The DTO and JSON schemas are unchanged; collectionProvenance is
  not exposed through HTTP. Compatibility regression assertions
  prove that no HTTP DTO or JSON schema exposes
  collectionProvenance.
```

## Out Of Scope

- Home-feed ingestion, execution, or scheduling.
- Making `sourceGroupId` nullable.
- `SourcePublisher` observation, resolution, or
  `sourcePublisherId` persistence.
- Provenance filters, indexes, or query API.
- New HTTP routes, request fields, response fields, or DTO fields.
- Collector Runtime, extractor, browser, workers, scheduler, Docker
  service definitions, or Web UI behavior.
- Broad refactoring of the existing ingestion or merge code paths.
- Content Builder or Content Publisher work.

## File Manifest

### Create

- `docs/SPRINTS/SPRINT-064B-provenance-persistence-and-compatibility.md`
- `drizzle/0018_add_content_items_collection_provenance.sql`
- `drizzle/0019_backfill_content_items_collection_provenance.sql`
- `drizzle/0020_content_items_collection_provenance_not_null.sql`
- `src/content-manager/domain/content-collection-provenance.test.merge.test.ts`
- `src/content-manager/application/content-collection-provenance-persistence.test.ts`
- `src/infrastructure/database/mappers/content-manager.mapper.collection-provenance.test.ts`
- `src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance.integration.test.ts`
- `src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance-migration-backfill.integration.test.ts`
- `src/interfaces/http/content-manager.server.collection-provenance-compatibility.test.ts`

### Modify

- `src/content-manager/domain/content.schemas.ts` — add
  `collectionProvenance: ContentCollectionProvenanceSchema` to
  `ContentItemSchema`.
- `src/content-manager/application/use-cases/ingest-collected-content.use-case.ts` —
  derive `SOURCE_GROUP` provenance from
  `input.sourceGroupId`, call
  `createInitialContentCollectionProvenance` for new items, call
  `mergeContentCollectionProvenance` for duplicates, propagate the
  typed conflict error, never save after a failed merge.
- `src/infrastructure/database/schema/content-manager.schema.ts` —
  add `collection_provenance jsonb` column on `contentItems`.
- `src/infrastructure/database/mappers/content-manager.mapper.ts` —
  mechanically map `collection_provenance` on write and read; rely
  on the complete `ContentItemSchema` (with the
  corrected home-feed-first branch) for every cross-field
  invariant. Persisted validation errors must report the real
  content item id.
- `src/infrastructure/database/repositories/drizzle-content-item.repository.ts` —
  include `collectionProvenance` in the upsert and select paths.
- `drizzle/meta/_journal.json` — append entries `0018`, `0019`,
  `0020` with strictly increasing `idx` and `when` values.
- `drizzle/meta/0020_snapshot.json` — single authoritative final
  snapshot chained from `0017`, adding `collection_provenance` to
  `content_items` as `jsonb NOT NULL` with no default and no index.
- `src/content-manager/domain/shared-identifier.schemas.ts` —
  narrow shared Content Manager identifier schemas owning
  `SourceGroupIdSchema` and `SourcePublisherIdSchema`. The
  existing schema modules re-export them for compatibility; the
  private duplicated definitions in
  `content-collection-provenance.schemas.ts` are removed.
- `src/content-manager/domain/content.ts` — `mergeCollectedContent`
  accepts a merged provenance override via
  `MergeCollectedContentOptions.collectionProvenance`; the
  separate fourth positional parameter is removed.
- `src/content-manager/application/use-cases/ingest-collected-content.use-case.ts`
  — the caller passes the merged provenance through
  `options.collectionProvenance`; no option is silently ignored.
- `src/infrastructure/database/repositories/sprint-064b-isolated-database.guard.ts`
  — refuses to run the migration-backfill integration test unless
  `SPRINT_064B_DATABASE_URL` targets an isolated database whose
  name is `sprint_064b_isolated` or starts with `sprint_064b_`.
- `src/infrastructure/database/repositories/sprint-064b-isolated-database.guard.test.ts`
  — unit tests for the guard, covering unparseable URLs, shared
  database rejection, accepted isolated names, and credential
  scrubbing in error messages.
- `src/infrastructure/database/schema/content-manager.schema.test.ts` —
  add the `collection_provenance` column metadata assertion.
- `src/infrastructure/database/migration-journal.test.ts` — no change
  required; the existing journal tests already assert strictly
  increasing `idx` and `when` values and the existence of every
  `.sql` file referenced by the journal.
- `docs/SPRINTS/active.md` — record Sprint 064A as accepted and
  Sprint 064B as active and authorized. Do not mark Sprint 064B
  complete or accepted.
- `docs/PROJECT_SNAPSHOT.md` — record the durable
  `collection_provenance` capability and the safe migration
  sequence.
- `docs/modules/content-manager.md` — record the durable
  `collectionProvenance` ownership boundary and the source-group
  consistency invariant.
- `docs/MODULE_BOUNDARIES.md` — record the durable
  `collectionProvenance` ownership boundary.

### Do not touch

- Collector Runtime, extractor, browser, scheduler, Docker, Web UI.
- Existing ingestion, persistence, HTTP routes, DTOs, JSON schemas,
  composition wiring, or application use cases beyond the additive
  ingest use-case integration.
- `tests/e2e/`, `docker-compose.e2e.yml`, Playwright config, or the
  Docker E2E harness.
- The `source_group_id` column and the `ContentItem.sourceGroupId`
  field.

## Testing Layers

### Layer 1 — Unit (Vitest)

`pnpm test src/content-manager/domain/content-collection-provenance.test.merge.test.ts`
covers:

- A `ContentItem` with a `SOURCE_GROUP` `firstCollectionSurface`
  round-trips through `validateContentItem`.
- A `ContentItem` with a `PROFILE_HOME_FEED` first surface and a
  `managedSourceGroupId` equal to the legacy `sourceGroupId`
  round-trips through `validateContentItem`.
- A `ContentItem` whose `SOURCE_GROUP` `firstCollectionSurface`
  carries a `sourceGroupId` different from `sourceGroupId` is
  rejected by `validateContentItem`.
- A `ContentItem` whose `PROFILE_HOME_FEED` first surface has no
  `managedSourceGroupId` (bare home feed) is rejected.
- A `ContentItem` whose `PROFILE_HOME_FEED` first surface has a
  `managedSourceGroupId` different from `sourceGroupId` is
  rejected.
- A `ContentItem` missing `collectionProvenance` is rejected.
- `mergeCollectedContent` accepts a merged provenance override via
  `MergeCollectedContentOptions.collectionProvenance`.
- `mergeCollectedContent` keeps the existing provenance when no
  override is supplied.
- `mergeCollectedContent` accepts a home-feed-first provenance
  with a managed group via `options.collectionProvenance`.
- The merged result is strict-schema-valid against
  `ContentItemSchema`.

`pnpm test src/content-manager/application/content-collection-provenance-persistence.test.ts`
covers:

- `IngestCollectedContentUseCase` builds a
  `SOURCE_GROUP` `ContentCollectionProvenance` derived from the
  required `sourceGroupId` for a new item and stores it.
- `IngestCollectedContentUseCase` merges the incoming provenance
  with the existing provenance on a duplicate match and preserves
  `createdAt`, `firstCollectedAt`, status, and identity fields.
- `IngestCollectedContentUseCase` does not invent a
  `sourcePublisherId`.
- A merge that throws `ContentCollectionProvenanceConflictError`
  is propagated without calling `contentItems.save`.
- The ingested `ContentItem` is strict-schema-valid for the updated
  `ContentItemSchema`.

`pnpm test src/infrastructure/database/mappers/content-manager.mapper.collection-provenance.test.ts`
covers:

- `toContentItemRow` round-trips a `SOURCE_GROUP`
  `collectionProvenance`.
- `toContentItemRow` round-trips a valid `PROFILE_HOME_FEED` first
  surface with a managed group equal to `sourceGroupId`.
- `toContentItemRow` rejects an item whose
  `collectionProvenance.firstCollectionSurface.sourceGroupId` does
  not equal `sourceGroupId`.
- `toContentItemRow` rejects a `PROFILE_HOME_FEED` first surface
  whose `managedSourceGroupId` does not equal `sourceGroupId`.
- `toContentItemRow` rejects a `ContentItem` that lacks
  `collectionProvenance` with an
  `InvalidPersistedContentManagerRecordError`.
- `toContentItemRow` and `toContentItemDomain` report the real
  content item id when persistence validation fails.
- `toContentItemDomain` rejects a row whose
  `collection_provenance` is structurally invalid.
- `toContentItemDomain` rejects a row whose
  `collection_provenance` surface disagrees with `source_group_id`.

`pnpm test src/infrastructure/database/repositories/sprint-064b-isolated-database.guard.test.ts`
covers the isolated-database guard behaviour: rejects missing or
empty `SPRINT_064B_DATABASE_URL`, rejects shared database names,
rejects unparseable URLs, accepts `sprint_064b_isolated` and
disposable names beginning with `sprint_064b_`, and never includes
credentials or the full connection URL in error messages.

`pnpm test src/interfaces/http/content-manager.server.collection-provenance-compatibility.test.ts`
covers:

- `toContentItemDto` does not expose `collectionProvenance` on the
  resulting `ContentItemDto` object (the property is absent, never
  serialized as `null`).
- The existing
  `contentItemJsonSchema`,
  `contentItemIngestBodyJsonSchema`,
  `ingestCollectedContentHttpRouteSchema`,
  `getContentItemHttpRouteSchema`,
  `listContentItemsHttpRouteSchema`, and
  `updateContentStatusHttpRouteSchema` schemas do not accept or
  expose a `collectionProvenance` field. The Fastify
  `additionalProperties: false` rules and the DTO allowlists are
  unchanged.

The full Content Manager domain suite is exercised by
`pnpm test src/content-manager/domain` and must remain green. The
full Content Manager application suite is exercised by
`pnpm test src/content-manager/application` and must remain green.

### Layer 2 — Database Integration (opt-in)

`pnpm test:db src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance.integration.test.ts`
covers:

- A new content item persisted through the
  `DrizzleContentItemRepository` round-trips the
  `collectionProvenance` JSONB column.
- The persisted `content_items.collection_provenance` column is
  `jsonb NOT NULL`.
- The migration files `0018`, `0019`, and `0020` exist with the
  expected SQL fragments.

The migration-backfill integration test is isolated from this
suite and runs against a dedicated disposable database.

`pnpm test:db src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance-migration-backfill.integration.test.ts`
runs only when both `RUN_DB_TESTS=true` and
`SPRINT_064B_DATABASE_URL` are set. The
`resolveIsolatedSprint064BDatabaseUrl` guard refuses to run if the
URL targets a shared database, is unparseable, or names a database
that is not `sprint_064b_isolated` or beginning with
`sprint_064b_`. The test then:

1. Resets the public schema in the isolated database.
2. Replays every committed migration from `0000` through `0017`,
   producing the pre-0018 schema.
3. Inserts a synthetic legacy content row inside a single
   transaction so either all three fixture rows are present or
   none are.
4. Asserts that the pre-0018 `content_items` table does not yet
   carry a `collection_provenance` column and captures the
   pre-0019 `collection_provenance` value as `null`.
5. Executes the actual `0018`, `0019`, and `0020` SQL files in
   sequence against the same database.
6. Asserts that:
   - the legacy row's `collection_provenance` is now populated
     from its `source_group_id`;
   - no content row has a `null` `collection_provenance`;
   - the `collection_provenance` column is `jsonb NOT NULL`;
   - `created_at`, `updated_at`, `first_collected_at`,
     `last_collected_at`, and `source_group_id` are unchanged on
     the legacy row;
   - the migration does not invent a `sourcePublisherId`.
7. Drops the public schema in `afterAll` so the next run starts
   from a blank state.

### Layer 3 — HTTP Integration (opt-in)

The existing HTTP integration tests
(`pnpm test:http:db src/interfaces/http/content-manager.server.database.integration.test.ts`)
must remain green. The compatibility regression assertions in
`src/interfaces/http/content-manager.server.collection-provenance-compatibility.test.ts`
prove that no HTTP DTO or JSON schema exposes `collectionProvenance`.

### Layer 4 — Docker End-to-End

No new Layer 4 spec is required: Sprint 064B does not add or change a
top-level flow that crosses Nginx → API → database. The HTTP contract
is unchanged. The existing `pnpm test:e2e:docker` harness continues
to assert the production-like stack.

### Layer 5 — Manual Live-Facebook Validation

Not required: Sprint 064B does not change browser provider behavior or
real Facebook interaction.

## Verification Commands

```bash
pnpm test src/content-manager/domain/content-collection-provenance.test.merge.test.ts
pnpm test src/content-manager/application/content-collection-provenance-persistence.test.ts
pnpm test src/infrastructure/database/mappers/content-manager.mapper.collection-provenance.test.ts
pnpm test src/infrastructure/database/repositories/sprint-064b-isolated-database.guard.test.ts
pnpm test src/interfaces/http/content-manager.server.collection-provenance-compatibility.test.ts
pnpm test src/content-manager/domain
pnpm test src/content-manager/application
pnpm test src/infrastructure/database/migration-journal.test.ts
pnpm typecheck
pnpm test
RUN_DB_TESTS=true DATABASE_URL=… \
  pnpm test:db src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance.integration.test.ts
pnpm test:db:provenance:isolated
pnpm test:http:db
pnpm test:e2e:docker
pnpm db:generate
git diff --check
```

`pnpm test:db:provenance:isolated` expands to:

```bash
RUN_DB_TESTS=true \
  SPRINT_064B_DATABASE_URL=${SPRINT_064B_DATABASE_URL:?SPRINT_064B_DATABASE_URL must be set to a sprint_064b_isolated database} \
  vitest run src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance-migration-backfill.integration.test.ts
```

The script fails fast when `SPRINT_064B_DATABASE_URL` is unset, and
the test itself fails fast via
`resolveIsolatedSprint064BDatabaseUrl` when the URL targets a shared
or non-Sprint 064B-prefixed database. The general
`pnpm test:db` (`vitest run src/infrastructure`) does not require
`SPRINT_064B_DATABASE_URL`; the migration-backfill suite is skipped
unless both `RUN_DB_TESTS=true` and `SPRINT_064B_DATABASE_URL` are
set, so existing general DB verification is unaffected.

The `pnpm db:generate` step must not propose a new migration that
adds `collection_provenance` again; the snapshot chain already
records the column on `content_items`. As of the verification run,
`pnpm db:generate` proposes only an unrelated
`source_publishers_last_observed_at_id_idx` re-order migration,
which is captured and deleted before acceptance.

## Security

Sprint 064B persists only safe provenance markers and IDs:

- The persisted `collection_provenance` JSONB contains the
  `CollectionSurface` (with `SOURCE_GROUP` carrying
  `sourceGroupId` only, and `PROFILE_HOME_FEED` carrying no
  identifier), an optional `sourcePublisherId` (omitted for
  backfilled rows; never invented), and an optional
  `managedSourceGroupId` (equal to the surface `sourceGroupId`
  for `SOURCE_GROUP`, or equal to the legacy `sourceGroupId` for
  `PROFILE_HOME_FEED`).
- No profile IDs, collection run IDs, URLs, entry routes, raw
  payloads, sessions, tokens, proxy credentials, raw HTML, or
  screenshots are persisted.

## Acceptance Gates

Sprint 064B is a persistence, migration, and concurrency
compatibility sprint. It requires Layer 1 (unit), Layer 2 (database
integration including the isolated migration backfill spec), and
the existing HTTP integration coverage to remain green. No Layer 4
(Docker E2E) spec is required.

## Status

Sprint 064B is **active and authorized**. Sprint 064A is accepted.
Sprint 064B is not accepted and is not complete. Sprint 065A,
Sprint 065B, and Sprint 065C remain future work.

## Verification Results

Verification results are recorded in the Builder's session output.
Claims in this document are limited to commands the Builder
actually ran. Any verification not yet executed is recorded as
"not executed in this session" with the exact command to run.

### Corrective Verification Run (current session)

- `pnpm typecheck` — exit `0` (clean).
- `pnpm test src/content-manager/domain/content-collection-provenance.test.merge.test.ts`
  — 10 / 10 tests passed.
- `pnpm test src/content-manager/application/content-collection-provenance-persistence.test.ts`
  — 6 / 6 tests passed.
- `pnpm test src/infrastructure/database/mappers/content-manager.mapper.collection-provenance.test.ts`
  — 10 / 10 tests passed.
- `pnpm test src/infrastructure/database/repositories/sprint-064b-isolated-database.guard.test.ts`
  — 21 / 21 tests passed.
- `pnpm test src/interfaces/http/content-manager.server.collection-provenance-compatibility.test.ts`
  — 7 / 7 tests passed.
- `pnpm test src/content-manager` — 180 / 180 tests passed across
  6 test files.
- `pnpm test src/infrastructure/database/migration-journal.test.ts`
  — 4 / 4 tests passed; the journal chain still ends at
  `0020_content_items_collection_provenance_not_null`.
- `pnpm test` — 1460 / 1460 functional tests passed, 14 / 14
  intentionally skipped. Two HTTP tests in
  `src/interfaces/http/content-manager.server.test.ts`
  (`rejects invalid observedAt, canonicalUrl, platform, and kind`
  and `rejects invalid source publisher list filters without
  invocation`) intermittently exceed the 5000 ms default vitest
  timeout only when the full backend suite runs concurrently; both
  pass deterministically when the file is run in isolation
  (`pnpm test src/interfaces/http/content-manager.server.test.ts`,
  34 / 34 tests passed, slowest test ≈ 4.6 s). These timeouts are
  pre-existing parallel-execution flakes, are not caused by Sprint
  064B changes, and remain to be hardened outside the Sprint 064B
  scope.
- `RUN_DB_TESTS=true pnpm vitest run src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance-migration-backfill.integration.test.ts`
  (without `SPRINT_064B_DATABASE_URL`) — 1 / 1 file skipped
  (`describe.skip`); the gating is correct.
- `pnpm test:db:provenance:isolated` without
  `SPRINT_064B_DATABASE_URL` — `sh: 1: SPRINT_064B_DATABASE_URL:
  SPRINT_064B_DATABASE_URL must be set to a sprint_064b_isolated
  database`. Script fails fast as required.
- `RUN_DB_TESTS=true SPRINT_064B_DATABASE_URL=postgres://user:secret@host:5432/content_pipeline pnpm test:db:provenance:isolated`
  — `Sprint064BIsolatedDatabaseGuardError: SPRINT_064B_DATABASE_URL
  targets the shared database "content_pipeline"...`. No
  credentials or full URL in the error message; guard refuses
  shared databases as required.
- `RUN_DB_TESTS=true pnpm vitest run src/infrastructure` without
  `SPRINT_064B_DATABASE_URL` — 14 files passed, 1 file skipped, 11
  files failed for an unrelated reason: `DATABASE_URL is required
  to create the database client`. No Sprint 064B guard errors
  fired, confirming general DB verification does not unexpectedly
  require a Sprint 064B disposable database merely because
  `RUN_DB_TESTS=true`.
- Focused provenance repository integration, full
  `drizzle-content-manager-repositories.integration.test.ts`, and
  PostgreSQL-backed HTTP integration on a clean database —
  not executed in this session; the disposable
  `sprint_064b_isolated` database was not provisioned in this
  sandbox. The exact commands to run on a fresh disposable
  database are recorded in `Verification Commands` above.
- `pnpm db:generate` — produces no `collection_provenance`
  migration; the snapshot chain at `0020` already records the
  column on `content_items`. Drizzle still proposes an unrelated
  `source_publishers_last_observed_at_id_idx` reorder migration
  (full SQL:
  `DROP INDEX "source_publishers_last_observed_at_id_idx"; CREATE INDEX "source_publishers_last_observed_at_id_idx" ON "source_publishers" USING btree ("last_observed_at" desc,"id" asc);`).
  The proposed file, its snapshot, and the journal entry are
  deleted before Sprint 064B acceptance; the migration is outside
  Sprint 064B scope.
- `git diff --check` — exit `0` (clean).
- `pnpm test:e2e:docker` — not executed in this session; Docker
  daemon availability was not verified. This is not a Sprint 064B
  acceptance spec.
