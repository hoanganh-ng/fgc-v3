# Content Manager

Content Manager is the accepted upstream store for home-feed normalized items,
discovered-source review (including safe review identity for ID-only Facebook
groups), and paused group promotion. The Collector operator boundary and
downstream Content Builder handoff are recorded in
[`COLLECTOR_BASELINE.md`](../COLLECTOR_BASELINE.md).

## Ownership
- Validation of normalized content ingestion input.
- Content item storage.
- Content deduplication and upsert rules (e.g. by `platform + externalPostId`).
- Content lifecycle status (review, approval, selection).
- Source group records and metadata.
- Source group entry route metadata for access paths.
- Group categories.
- Engagement counts and top comments normalization.
- `SourcePublisher` identity (`platform + kind + externalPublisherId`)
  as the durable publishing-source identity for a Facebook group or
  page observed while reading a feed.
- `SourcePublisher` pure observation behavior: first observation
  creates `status = DISCOVERED` with `observationCount = 1`;
  subsequent observations preserve `id`, identity, `createdAt`,
  `firstObservedAt`, and current review `status`; `observationCount`
  increments by exactly 1; `lastObservedAt` never moves backward;
  older observations do not overwrite metadata from newer
  observations; omitted metadata does not clear existing metadata;
  observation never changes review status.
- Explicit, reversible `SourcePublisher` status updates (idempotent
  when reapplying the current status).
- `SourcePublisher` application ports (`observeAtomically`,
  `updateStatus`, `findById`, `findByIdentity`, `list` with bounded
  `limit` and non-negative `offset`, ordered `lastObservedAt`
  descending then `id` ascending). Observation has a
  purpose-specific atomic operation, review status has a
  purpose-specific partial status operation, and there is no
  production full-row save path for `SourcePublisher`.
- `ContentCollectionProvenance` domain value object: a strict,
  Zod-validated `CollectionSurface` discriminated union with
  `SOURCE_GROUP` (with `sourceGroupId`) and `PROFILE_HOME_FEED`
  (no profile id, no source group id) branches; a
  `CollectedContentProvenanceInput` with the collection surface,
  an optional `sourcePublisherId`, and an optional
  `managedSourceGroupId` (required and equal to the surface
  `sourceGroupId` when the surface is `SOURCE_GROUP`; absent or
  present when the surface is `PROFILE_HOME_FEED`); a durable
  `ContentCollectionProvenance` with the immutable
  `firstCollectionSurface` plus the optional associations (the
  same cross-field rule applies: required and equal when the
  first surface is `SOURCE_GROUP`, absent or present when the
  first surface is `PROFILE_HOME_FEED`); pure
  `createInitialContentCollectionProvenance` and
  `mergeContentCollectionProvenance` that runtime-validate their
  inputs and outputs against the existing Zod domain schemas,
  preserve the first surface, fill absent associations later,
  are idempotent on identical observations, do not mutate inputs,
  and throw a typed `ContentCollectionProvenanceConflictError`
  (code `CONTENT_COLLECTION_PROVENANCE_CONFLICT`) on conflicting
  `sourcePublisherId` or `managedSourceGroupId`. The
  `PROFILE_HOME_FEED` surface contains no source-group
  identifier; the optional `managedSourceGroupId` association is
  a separate top-level field. Provenance is a domain value
  object; it has no profile id, collection run id, URL, entry
  route, raw publisher identity, raw payload, observation array,
  or event history, and Sprint 064A adds no persistence, HTTP,
  application, composition, runtime, extractor, browser,
  scheduler, Docker, or Web UI behavior.
- Durable `ContentItem.collectionProvenance`: the Sprint 064A
  `ContentCollectionProvenance` value object is required on every
  durable content item and is persisted through a final
  `NOT NULL content_items.collection_provenance JSONB` column.
  Provenance is derived from the required `sourceGroupId`
  internally through a `SOURCE_GROUP` collection surface and is
  not exposed through HTTP. New content items use
  `createInitialContentCollectionProvenance`; duplicate content
  items (matched by `platform + externalPostId`) use
  `mergeContentCollectionProvenance`. A merge that throws
  `ContentCollectionProvenanceConflictError` propagates the typed
  domain error and never persists. The legacy `sourceGroupId`
  field and the PostgreSQL `source_group_id` column remain
  required and unchanged for backward compatibility. A source-group
  consistency invariant guarantees that
  `collectionProvenance.firstCollectionSurface.kind === 'SOURCE_GROUP'`
  and that
  `collectionProvenance.firstCollectionSurface.sourceGroupId === sourceGroupId`
  on every persisted content item. Sprint 064B is accepted and does not introduce
  home-feed ingestion or execution, does not make `sourceGroupId`
  nullable, does not add `SourcePublisher` observation or
  resolution, does not add a new HTTP DTO field, does not add a
  provenance filter or index, and does not change the Collector
  Runtime, extractor, browser, workers, scheduler, Docker, or
  Web UI.
- Sprint 065C1 (accepted) makes
  `ContentItem.sourceGroupId` optional in the domain schema and DTOs
  and `NULL`-tolerant in PostgreSQL while preserving the existing
  `sourceGroupId`-required source-group ingestion contract.
  `SOURCE_GROUP` first surfaces still require `sourceGroupId` and a
  matching `managedSourceGroupId`. `PROFILE_HOME_FEED` first surfaces
  may omit both `sourceGroupId` and `managedSourceGroupId`; when
  either is present both must be present and equal. Generic PROFILE_HOME_FEED
  provenance permits an absent `sourcePublisherId`; the dedicated
  `IngestHomeFeedCollectedContentUseCase` boundary still requires it.
  The use case accepts an input carrying only `sourcePublisherId` and
  normalized safe content, verifies the publisher exists and its
  platform matches, and persists the item with
  `firstCollectionSurface.kind = "PROFILE_HOME_FEED"`, no
  `sourceGroupId`, no `managedSourceGroupId`, and no fake Home Feed
  `SourceGroup`. The use case preserves the immutable first surface
  on duplicates, fills absent associations on later merges, is
  idempotent for identical associations, and rejects conflicting
  associations through the existing typed
  `ContentCollectionProvenanceConflictError`. The existing
  `IngestCollectedContentUseCase` is extended so a later source-group
  collection can fill `sourceGroupId` and `managedSourceGroupId` on
  a home-feed-first item while preserving its `PROFILE_HOME_FEED`
  first surface. The new `POST /collector/content-items/home-feed`
  route uses a strict allowlist body schema;
  `ContentItemDto.sourceGroupId` is optional and omitted when
  absent; `collectionProvenance` remains internal and is not exposed
  through HTTP. The Web UI `ContentItem` schema and the list/detail
  pages render "No managed source group" safely when `sourceGroupId`
  is omitted. Sprint 065C1 does not add browser execution, Facebook
  navigation, capture, extractor orchestration, Collector Runtime
  HTTP client changes, workers, schedulers, Docker service changes,
  live-Facebook validation, `SourcePublisher` review or status
  mutation, source-group promotion, Content Builder, or Content
  Publisher behavior.
- Safe read APIs for content and sources.
- Safe `SourcePublisher` HTTP observation, list, get, and status
  mutation contracts served through Nginx → Fastify → Content
  Manager application → PostgreSQL. The safe `SourcePublisherDto`
  allowlist explicitly enumerates every response field; optional
  `displayName` and `canonicalUrl` are omitted when absent and
  never serialized as `null`. The status mutation contract is
  `PATCH /collector/source-publishers/:sourcePublisherId/status`
  with a strict body schema that accepts exactly `{ status }`
  where `status` is one of `DISCOVERED`, `APPROVED`, `IGNORED`,
  `BLOCKED`; unknown fields, missing fields, and `null` are
  rejected with HTTP 400 `VALIDATION_ERROR`, and a missing
  publisher maps to the existing HTTP 404
  `SOURCE_PUBLISHER_NOT_FOUND`.
- Safe `SourcePublisher` → `SourceGroup` promotion contract
  served through the same Nginx → Fastify → Content Manager
  application → PostgreSQL path. The promotion route
  `POST /collector/source-publishers/:sourcePublisherId/promote-to-source-group`
  delegates to the new
  `PromoteSourcePublisherToSourceGroupUseCase`. The strict body
  carries only `categoryId`, `collectionPriority` (integer
  `0..100`), and the optional `name`, `url`, and `notes`;
  unknown fields, missing required fields, blank strings, `null`
  values, and an out-of-range priority map to HTTP 400
  `VALIDATION_ERROR`. The use case enforces the
  `platform === "FACEBOOK"`, `kind === "GROUP"`,
  `status === "APPROVED"` preconditions on the durable
  `SourcePublisher`; `PAGE` publishers, unapproved statuses, and
  a missing URL each raise `SourcePublisherNotPromotableError`
  (`SOURCE_PUBLISHER_NOT_PROMOTABLE`); a missing publisher raises
  `SourcePublisherNotFoundError` (`SOURCE_PUBLISHER_NOT_FOUND`);
  a missing category raises `ContentCategoryNotFoundError`
  (`CONTENT_CATEGORY_NOT_FOUND`).
  Promotion resolves the new `SourceGroup` fields from the
  publisher plus the body without inventing a Facebook URL,
  short-circuits on
  `SourceGroupRepository.findByPlatformAndExternalGroupId` with
  `outcome = "ALREADY_EXISTS"`, and otherwise persists a new
  `PAUSED` `SourceGroup` with the default `DIRECT_GROUP_URL`
  entry route and returns `outcome = "CREATED"`. The 200
  response reuses the existing safe `SourceGroupDto` allowlist
  plus a typed
  `promotion: { outcome: "CREATED" | "ALREADY_EXISTS" }` block.
  Promotion never mutates the durable `SourcePublisher` review
  status or observation counts.
- Source Publisher operator Web UI surface at `/source-publishers`
  (Sprint 069, safe review identity from Sprint 076B). The Web UI
  consumes only the existing safe Content Manager HTTP contracts for
  list/get, status mutation, and approved Facebook group promotion. It
  defaults the review list to `DISCOVERED`, supports
  status/kind/platform filters, exposes safe **Open on Facebook**
  links from computed `reviewUrl` when present (unsafe persisted
  `canonicalUrl` values are neither clickable nor promotion defaults),
  exposes explicit `Approve`, `Ignore`, `Block`, and `Reset to
  discovered` actions, and gates promotion to
  `platform === "FACEBOOK"`, `kind === "GROUP"`,
  `status === "APPROVED"` with an existing content category. Approval
  fails closed when no safe review destination exists. The promotion
  panel is hidden for non-group publishers; unapproved Facebook groups
  render a disabled panel with an approval explanation. Promotion
  bodies include `categoryId` and integer `collectionPriority`
  (`0..100`). The URL field defaults from `reviewUrl` when present;
  when `reviewUrl` is absent, the UI requires an operator-entered URL
  before submit. Empty optional `name`, `url`, and `notes` fields are
  omitted only when allowed, and populated optional fields are
  trimmed. The UI shows only the typed `CREATED` / `ALREADY_EXISTS`
  outcome and does not expose raw payloads, cookies, sessions, tokens,
  proxies, viewer IDs, account IDs, screenshots, diagnostics, stack
  traces, or backend internals.
- Future handoff shape for Content Builder.

## Does Not Own
- Profile or session management.
- Profile-source access state for individual profiles.
- Browser automation or network payload capture.
- Raw Facebook GraphQL parsing or scraping strategy.
- Platform-specific extraction rules.
- Promotion of a `SourcePublisher` into a managed `SourceGroup`,
  `SourceGroup` configuration, scheduling, or any social action,
  with the single narrow exception of the
  `POST /collector/source-publishers/:sourcePublisherId/promote-to-source-group`
  HTTP route introduced by Sprint 067. Sprint 067 only promotes
  already `APPROVED` Facebook `GROUP` `SourcePublisher` records
  into `PAUSED` managed `SourceGroup` records. It does not
  activate, schedule, join, or perform any other social action,
  and it does not promote `PAGE` publishers.
- `Content Publisher` pipeline behavior. `SourcePublisher` is the
  Content Manager-owned durable publishing-source identity, not the
  future Content Publisher pipeline module, and it does not model
  drafts, publications, videos, publishing schedules, or published
  artifacts.

## Important Source Paths
- `src/content-manager/domain/`
  - `source-publisher.ts`, `source-publisher-kind.ts`,
    `source-publisher-status.ts`, `source-publisher.schemas.ts`
  - `content-collection-provenance.ts`,
    `content-collection-provenance.schemas.ts` (Sprint 064A)
- `src/content-manager/application/`
  - `ports/source-publisher-repository.port.ts`
  - `use-cases/observe-source-publisher.use-case.ts`
  - `use-cases/get-source-publisher.use-case.ts`
  - `use-cases/list-source-publishers.use-case.ts`
  - `use-cases/update-source-publisher-status.use-case.ts`
  - `use-cases/promote-source-publisher-to-source-group.use-case.ts`
    (Sprint 067)
  - `use-cases/ingest-collected-content.use-case.ts` (Sprint 064B
    integrates provenance creation and merge)
  - `test-support/in-memory-repositories.ts`
    (`InMemorySourcePublisherRepository`)
- `src/infrastructure/database/`
  - `schema/content-manager.schema.ts` (`source_publishers` table,
    `source_publisher_kind` enum, `source_publisher_status` enum;
    `content_items` gains `collection_provenance` JSONB in
    Sprint 064B)
  - `mappers/content-manager.mapper.ts` (`SourcePublisherRow`,
    `SourcePublisherInsert`, `toSourcePublisherRow`,
    `toSourcePublisherDomain`, and the Sprint 064B
    `collection_provenance` round-trip on
    `toContentItemRow`/`toContentItemDomain`)
  - `repositories/drizzle-source-publisher.repository.ts`
- `src/composition/content-manager/`
  - `content-manager.container.ts` (exposes
    `observeSourcePublisher`, `getSourcePublisher`,
    `listSourcePublishers`, `updateSourcePublisherStatus`)
  - `create-content-manager.ts` (instantiates
    `DrizzleSourcePublisherRepository`)
- `src/content-manager/infrastructure/`
- `src/content-manager/interface/`
- `src/interfaces/http/`
  - `routes/content-manager.routes.ts` (registers the
    `SourcePublisher` observation, list, and get routes and exposes
    the `toSourcePublisherDto` mapper)
  - `schemas/content-manager.http-schemas.ts` (`ObserveSourcePublisherHttpBodySchema`,
    `SourcePublisherIdHttpParamsSchema`,
    `ListSourcePublishersHttpQuerySchema`, and the response JSON
    schema)
  - `content-manager.server.test.ts` (stub-backed HTTP coverage)
  - `content-manager.server.database.integration.test.ts`
    (opt-in PostgreSQL-backed HTTP coverage)
  - `test-support/content-manager-http-service.ts`
    (`FakeContentManagerHttpService` stubs and `createSourcePublisher`
    fixture helper)
- `tests/e2e/`
  - `fixtures/synthetic-payloads.ts`
    (`buildSourcePublisherObservationFixture` and
    `buildSourcePublisherSecondObservationFixture` builders)
  - `source-publisher-http.spec.ts` (Docker E2E flow through
    `web-gateway`)
- `apps/web/src/pages/source-publishers-page.tsx` (Sprint 069
  operator review and promotion UI)
- `apps/web/src/features/content-manager/source-publisher-review-view-model.ts`
  (Sprint 069 filter, display, gating, and promotion request mapping)
- `apps/web/src/lib/api/content-manager-client.ts` (Web UI client
  schemas and methods for SourcePublisher list/get/status/promotion)

## Important Entrypoints
- `Fastify API`: `src/content-manager/interface/http/` (e.g. `/content/items`, `/content/source-groups`)
- `HTTP Adapter (SourcePublisher)`: `src/interfaces/http/routes/content-manager.routes.ts`
  registers `POST /collector/source-publishers/observations`,
  `GET /collector/source-publishers`,
  `GET /collector/source-publishers/:sourcePublisherId`,
  `PATCH /collector/source-publishers/:sourcePublisherId/status`,
  and (Sprint 067)
  `POST /collector/source-publishers/:sourcePublisherId/promote-to-source-group`.
- `Composition Root`: `src/content-manager/composition/root.ts`

## Critical Invariants
- Must validate data upon ingestion and return structured failures.
- Duplicate content items must retain originally assigned IDs, timestamps, and manual review status while updating changing metrics.
- `SourcePublisher` identity is `platform + kind + externalPublisherId`; identity is the only basis for merging a re-observation with an existing aggregate.
- `SourcePublisher` observation never changes review status and never moves `lastObservedAt` backward.
- `SourcePublisher` is distinct from `SourceGroup` and is not the future Content Publisher pipeline stage.

## Cross-Module Communication
- Acts as the receiving end of the Collector Runtime submission pipeline via HTTP API boundaries.
- Provides explicit validation of source group references to Collector Profile Manager.

## Sensitive Data Rules
- Canonical content model must not expose raw diagnostic payloads (like full Facebook GraphQL trees) by default on safe reads.
- `SourcePublisher` does not introduce any new storage of raw payloads, cookies, tokens, viewer IDs, profiles, sessions, localStorage, authorization headers, proxy details, screenshots, or private platform data.

## Relevant Verification Commands
```bash
pnpm test src/content-manager
pnpm test:db src/content-manager
pnpm test:http:db src/content-manager
```
