# Sprint 065C1: Bare Home-Feed Content Ingestion

## Goal

Close the gap between Sprint 065A's normalized Facebook home-feed
candidates (which carry a required `publisherObservation` and no
`sourceGroupId`) and Content Manager ingestion (which still requires
`sourceGroupId`). Allow Content Manager to ingest a home-feed
candidate with `sourcePublisherId` only, persist it without a managed
`SourceGroup`, and accept a later source-group collection that fills
`sourceGroupId` and `managedSourceGroupId` while preserving the
original `PROFILE_HOME_FEED` first surface. Preserve the existing
source-group ingestion contract unchanged.

Sprint 065C1 does not execute a browser, navigate Facebook, capture
payloads, invoke the home-feed extractor, change the Collector
Runtime HTTP client, add workers or schedulers, change Docker, add
`SourcePublisher` review / status mutation / promotion, add source
group promotion, or add Content Builder / Content Publisher behavior.
It makes no live-Facebook validation claim.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/SPRINTS/SPRINT-064A-content-collection-provenance-model.md`
- `docs/SPRINTS/SPRINT-064B-provenance-persistence-and-compatibility.md`
- `docs/SPRINTS/SPRINT-065A-facebook-home-feed-extractor-fixtures.md`
- `docs/SPRINTS/SPRINT-065B-profile-bound-home-feed-run-model.md`
- `src/content-manager/domain/content*`
- `src/content-manager/domain/content-collection-provenance*`
- `src/content-manager/domain/source-publisher*`
- `src/content-manager/application/use-cases/ingest-collected-content.use-case.ts`
- `src/content-manager/application/use-cases/ingest-home-feed-collected-content.use-case.ts`
- `src/content-manager/application/content-validation.ts`
- `src/content-manager/application/ports/source-publisher-repository.port.ts`
- `src/content-manager/application/application-errors.ts`
- `src/content-manager/application/test-support/in-memory-repositories.ts`
- `src/infrastructure/database/schema/content-manager.schema.ts`
- `src/infrastructure/database/mappers/content-manager.mapper.ts`
- `src/infrastructure/database/repositories/drizzle-content-item.repository.ts`
- `src/interfaces/http/routes/content-manager.routes.ts`
- `src/interfaces/http/schemas/content-manager.http-schemas.ts`
- `src/interfaces/http/test-support/content-manager-http-service.ts`
- `src/composition/content-manager/**`
- `apps/web/src/lib/api/content-manager-client.ts`
- `apps/web/src/pages/content-items-page.tsx`
- `apps/web/src/pages/content-item-detail-page.tsx`
- Relevant nearby tests for the files above
- `drizzle/0023_content_items_source_group_id_nullable.sql`
- `drizzle/meta/_journal.json`
- `drizzle/meta/0023_snapshot.json`

## Capability Summary

- `ContentItem.sourceGroupId` is **optional** in the domain schema
  and DTO contracts (omission, never `null`). It is mapped to
  `NULL` in PostgreSQL and back via the existing `optional()`
  mapper helper.
- `SOURCE_GROUP` first surfaces still require `sourceGroupId` and a
  matching `managedSourceGroupId`.
- `PROFILE_HOME_FEED` first surfaces may omit both `sourceGroupId`
  and `managedSourceGroupId`. When either is present both must be
  present and equal.
- `CollectionProvenance` does not gain `profileId`, `runId`, URLs,
  raw payloads, or event history. Generic PROFILE_HOME_FEED
  provenance allows an absent `sourcePublisherId`; the dedicated
  home-feed ingestion boundary still requires it.
- A dedicated `IngestHomeFeedCollectedContentUseCase` ingests a
  home-feed candidate carrying only `sourcePublisherId` and
  normalized safe content. The use case verifies the publisher
  exists and its platform matches, persists the item with
  `firstCollectionSurface.kind = "PROFILE_HOME_FEED"`, no
  `sourceGroupId`, no `managedSourceGroupId`, and no fake Home Feed
  `SourceGroup`. It preserves the immutable first surface on
  duplicates, fills absent associations on later merges, is
  idempotent for identical associations, and rejects conflicting
  associations through the existing typed
  `ContentCollectionProvenanceConflictError`.
- The existing `IngestCollectedContentUseCase` is extended so a
  later source-group collection can fill `sourceGroupId` and
  `managedSourceGroupId` on a home-feed-first item while preserving
  its `PROFILE_HOME_FEED` first surface. Its request contract is
  unchanged.

## HTTP Surface

- New operator / collector route:
  `POST /collector/content-items/home-feed`
- Strict body schema (additional fields are rejected with HTTP 400):
  `sourcePublisherId`, `platform`, `externalPostId`, `sourceUrl`,
  `bodyText`, `collectedAt`, `reactionCount`, `commentCount`,
  `topComments`, optional `title`, `authorDisplayName`,
  `authorExternalId`, `postedAt`, `shareCount`. No `sourceGroupId`,
  `managedSourceGroupId`, `profileId`, `runId`,
  `collectionProvenance`, `firstCollectionSurface`,
  `rawPayloadRef`, `rawPayload`, cookies, localStorage, tokens,
  headers, proxy details, or viewer data.
- Response uses the existing `contentItem` envelope; the DTO's
  `sourceGroupId` is optional and omitted when absent (no
  `sourceGroupId: null` is ever emitted). `collectionProvenance`
  remains internal and is not exposed through HTTP.
- `POST /collector/content-items` (legacy source-group ingestion)
  is unchanged and `sourceGroupId`-required.

## Persistence

- Migration `drizzle/0023_content_items_source_group_id_nullable.sql`:
  ```sql
  ALTER TABLE "content_items"
    ALTER COLUMN "source_group_id" DROP NOT NULL;
  ```
  The foreign key and indexes remain intact.
- The Drizzle schema's `source_group_id` column drops `.notNull()`.
- The mapper maps domain omission to `NULL` and `NULL` to domain
  omission via the existing `optional()` helper; both mapper
  directions strictly validate.
- The Drizzle journal entry and the authoritative latest snapshot
  are updated to reflect the new migration.

## Security

No cookies, localStorage, tokens, authorization headers, proxy
credentials, fingerprint secrets, raw Facebook payloads, raw HTML,
private screenshots, or viewer data are added to the run model,
DTOs, logs, docs, tests, or migration. The home-feed ingestion body
allowlist is strict and rejects unknown fields.

## Out Of Scope

- Profile Manager checkout or lease changes.
- Browser execution or Facebook navigation.
- Payload capture or extraction.
- Home-feed extractor orchestration.
- Collector Runtime HTTP client changes.
- Workers or schedulers.
- Docker service changes.
- Live-Facebook validation.
- `SourcePublisher` review, status mutation, or promotion.
- `SourceGroup` promotion.
- Content Builder.
- Content Publisher.
- Generalizing existing collection / run abstractions.
- Unrelated refactoring.

## Verification Commands

```bash
pnpm exec vitest run \
  src/content-manager/domain/content-domain.test.ts \
  src/content-manager/domain/content-collection-provenance.test.ts \
  src/content-manager/domain/content-collection-provenance.test.merge.test.ts \
  src/content-manager/application/content-application.test.ts \
  src/infrastructure/database/mappers/content-manager.mapper.test.ts \
  src/infrastructure/database/mappers/content-manager.mapper.collection-provenance.test.ts \
  src/interfaces/http/content-manager.server.test.ts \
  src/composition/content-manager/content-manager.container.test.ts

pnpm exec vitest run \
  apps/web/src/lib/api/content-manager-client.test.ts \
  apps/web/src/pages/content-items-page.test.tsx \
  apps/web/src/pages/content-item-detail-page.test.tsx

pnpm typecheck
pnpm test
pnpm web:typecheck
pnpm web:build

compose="docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml"
$compose down -v --remove-orphans
$compose build api
$compose up -d --wait postgres
$compose run --rm --no-deps api sh -lc '
  pnpm db:migrate &&
  RUN_DB_TESTS=true pnpm exec vitest run \
    src/infrastructure/database/repositories/drizzle-content-item.repository.collection-provenance.integration.test.ts \
    src/infrastructure/database/repositories/drizzle-content-manager-repositories.integration.test.ts
'
$compose run --rm --no-deps api sh -lc 'pnpm test:db'
$compose run --rm --no-deps api sh -lc 'pnpm test:http:db'
$compose down -v --remove-orphans

pnpm test:e2e:docker
git diff --check
git status --short
```

`test:db`, `test:http:db`, and `test:e2e:docker` are mandatory and
must run through the Docker-backed Compose project `fgc-v3-e2e`. The
focused Sprint 065C1 PostgreSQL repository integration test
extends the existing Sprint 064B file
`drizzle-content-item.repository.collection-provenance.integration.test.ts`
with bare home-feed coverage. The focused PostgreSQL-backed HTTP
integration test extends the existing
`content-manager.server.database.integration.test.ts`. The focused
Docker E2E spec is
`tests/e2e/home-feed-content-ingestion.spec.ts`.

## Status

Sprint 065A was accepted at
`28906556bffa2b4052cd429b0bf5634cf74de875`.

Sprint 065B was accepted at
`b9d84cad6d48f4ef94efb5be037550a7409afa05`.

Sprint 065C1 is **active and authorized**. It is not accepted.

Sprint 065C2 and Sprint 065C3 remain **inactive and unauthorized**
by Sprint 065C1.

Sprint 065C1 makes no live-Facebook validation claim.
