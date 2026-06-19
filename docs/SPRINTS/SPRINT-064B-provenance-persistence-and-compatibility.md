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

## Source-Group Provenance Validation

Sprint 064B validates that a `SOURCE_GROUP` `ContentCollectionProvenance`
never disagrees with the legacy `sourceGroupId` on the content item.
The validation runs on both the domain merge path and the persistence
path:

- During merge: when a `SOURCE_GROUP` input has a `sourceGroupId`
  different from the existing item's `sourceGroupId`, the merge
  resolves `managedSourceGroupId` from the incoming
  `sourceGroupId`; the persisted item's `sourceGroupId` and
  `collectionProvenance.firstCollectionSurface.sourceGroupId`
  remain equal.
- During persistence: the `toContentItemRow` mapper validates that
  `collectionProvenance.firstCollectionSurface.kind === 'SOURCE_GROUP'`
  and that `firstCollectionSurface.sourceGroupId === sourceGroupId`,
  and that `managedSourceGroupId` either equals `sourceGroupId` or is
  absent. An invariant violation throws
  `InvalidPersistedContentManagerRecordError` so corrupted rows can
  never enter the database.
- During read: the `toContentItemDomain` mapper applies the same
  validation after parsing the persisted JSONB column.

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

## Architecture

```
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
  add `collection_provenance` to `toContentItemRow` and
  `toContentItemDomain` with strict runtime validation and a
  source-group consistency invariant.
- `src/infrastructure/database/repositories/drizzle-content-item.repository.ts` —
  include `collectionProvenance` in the upsert and select paths.
- `drizzle/meta/_journal.json` — append entries `0018`, `0019`,
  `0020` with strictly increasing `idx` and `when` values.
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

- `mergeCollectedContent` round-trips an existing
  `collectionProvenance` when present, and the new item always has a
  schema-valid `ContentCollectionProvenance` matching the legacy
  `sourceGroupId`.
- `mergeCollectedContent` on an item without
  `collectionProvenance` is rejected by strict Zod validation in the
  updated `ContentItemSchema`.

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

- `toContentItemRow` round-trips `collectionProvenance` for both
  `SOURCE_GROUP` and `PROFILE_HOME_FEED` surfaces with strict
  runtime validation.
- `toContentItemRow` rejects an item whose
  `collectionProvenance.firstCollectionSurface.sourceGroupId` does
  not equal `sourceGroupId`.
- `toContentItemRow` rejects a `ContentItem` that lacks
  `collectionProvenance` with an
  `InvalidPersistedContentManagerRecordError`.
- `toContentItemDomain` round-trips a persisted row whose
  `collection_provenance` is a `SOURCE_GROUP` object.
- `toContentItemDomain` rejects a row whose
  `collection_provenance` is structurally invalid with an
  `InvalidPersistedContentManagerRecordError`.

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
- An updated content item with a different
  `sourceGroupId` keeps the legacy `source_group_id` column
  consistent with `collection_provenance.firstCollectionSurface.sourceGroupId`.
- A `collection_provenance` row that violates the source-group
  consistency invariant is rejected by strict runtime validation on
  read.

`pnpm test:db src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance-migration-backfill.integration.test.ts`
covers:

- After running the `0018` → `0019` → `0020` migration sequence,
  every existing content row has a `collection_provenance` JSONB
  value built from its `source_group_id`.
- The `content_items.collection_provenance` column is `NOT NULL`
  after migration `0020`.
- The migration backfill does not modify `created_at`,
  `updated_at`, `first_collected_at`, `last_collected_at`, or the
  legacy `source_group_id`.
- `psql` `\d content_items` confirms the column type, the NOT NULL
  constraint, and the absence of any invented `sourcePublisherId`.

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
pnpm test src/interfaces/http/content-manager.server.collection-provenance-compatibility.test.ts
pnpm test src/content-manager/domain
pnpm test src/content-manager/application
pnpm typecheck
pnpm test
pnpm test:db src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance.integration.test.ts
pnpm test:db src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance-migration-backfill.integration.test.ts
pnpm test:http:db src/interfaces/http/content-manager.server.database.integration.test.ts
pnpm test:e2e:docker
git diff --check
```

## Security

Sprint 064B persists only safe provenance markers and IDs:

- The persisted `collection_provenance` JSONB contains the
  `CollectionSurface` (with `SOURCE_GROUP` carrying
  `sourceGroupId` only, and `PROFILE_HOME_FEED` carrying no
  identifier), an optional `sourcePublisherId` (omitted for
  backfilled rows; never invented), and an optional
  `managedSourceGroupId` (equal to the surface `sourceGroupId`
  for `SOURCE_GROUP`).
- No profile IDs, collection run IDs, URLs, entry routes, raw
  payloads, sessions, tokens, proxy credentials, raw HTML, or
  screenshots are persisted.

## Acceptance Gates

Sprint 064B is a persistence, migration, and concurrency
compatibility sprint. It requires Layer 1 (unit), Layer 2 (database
integration including the migration backfill spec), and the existing
HTTP integration coverage to remain green. No Layer 4 (Docker E2E)
spec is required.

## Status

Sprint 064B is **active and authorized**. Sprint 064A is accepted.
Sprint 064B is not accepted and is not complete. Sprint 065A,
Sprint 065B, and Sprint 065C remain future work.