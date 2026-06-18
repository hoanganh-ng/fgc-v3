# Content Manager

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
- `SourcePublisher` application ports
  (`observeAtomically`, `updateStatus`, `findById`,
  `findByIdentity`, `list` with bounded `limit` and non-negative
  `offset`, ordered `lastObservedAt` descending then `id` ascending).
  Observation has a purpose-specific atomic operation, review
  status has a purpose-specific partial status operation, and there
  is no production full-row save path for `SourcePublisher`.
- Safe read APIs for content and sources.
- Future handoff shape for Content Builder.

## Does Not Own
- Profile or session management.
- Profile-source access state for individual profiles.
- Browser automation or network payload capture.
- Raw Facebook GraphQL parsing or scraping strategy.
- Platform-specific extraction rules.
- Promotion of a `SourcePublisher` into a managed `SourceGroup`,
  `SourceGroup` configuration, scheduling, or any social action.
- `Content Publisher` pipeline behavior. `SourcePublisher` is the
  Content Manager-owned durable publishing-source identity, not the
  future Content Publisher pipeline module, and it does not model
  drafts, publications, videos, publishing schedules, or published
  artifacts.

## Important Source Paths
- `src/content-manager/domain/`
  - `source-publisher.ts`, `source-publisher-kind.ts`,
    `source-publisher-status.ts`, `source-publisher.schemas.ts`
- `src/content-manager/application/`
  - `ports/source-publisher-repository.port.ts`
  - `use-cases/observe-source-publisher.use-case.ts`
  - `use-cases/get-source-publisher.use-case.ts`
  - `use-cases/list-source-publishers.use-case.ts`
  - `use-cases/update-source-publisher-status.use-case.ts`
  - `test-support/in-memory-repositories.ts`
    (`InMemorySourcePublisherRepository`)
- `src/infrastructure/database/`
  - `schema/content-manager.schema.ts` (`source_publishers` table,
    `source_publisher_kind` enum, `source_publisher_status` enum)
  - `mappers/content-manager.mapper.ts` (`SourcePublisherRow`,
    `SourcePublisherInsert`, `toSourcePublisherRow`,
    `toSourcePublisherDomain`)
  - `repositories/drizzle-source-publisher.repository.ts`
- `src/composition/content-manager/`
  - `content-manager.container.ts` (exposes
    `observeSourcePublisher`, `getSourcePublisher`,
    `listSourcePublishers`, `updateSourcePublisherStatus`)
  - `create-content-manager.ts` (instantiates
    `DrizzleSourcePublisherRepository`)
- `src/content-manager/infrastructure/`
- `src/content-manager/interface/`

## Important Entrypoints
- `Fastify API`: `src/content-manager/interface/http/` (e.g. `/content/items`, `/content/source-groups`)
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
