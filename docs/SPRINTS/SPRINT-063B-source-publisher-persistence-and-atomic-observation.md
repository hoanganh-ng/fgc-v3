# Sprint 063B: Source Publisher Persistence And Atomic Observation

## Goal

Persist the Content Manager-owned `SourcePublisher` aggregate in
PostgreSQL and make `SourcePublisher` observation atomic and
concurrency-safe. Concurrent observations of the same identity must:

- Produce exactly one durable row.
- Increment `observationCount` exactly once per accepted observation.
- Never move `lastObservedAt` backward.
- Prevent older observations from replacing metadata supplied by
  newer observations.
- Preserve omitted metadata rather than clearing it.
- Preserve review status.
- Preserve the durable `id`, identity, `createdAt`, and
  `firstObservedAt`.

Add Content Manager composition wiring for the existing
`SourcePublisher` use cases. No HTTP routes, DTOs, Web UI, browser
execution, feed execution, Docker E2E, or `SourceGroup` promotion.

`SourcePublisher` means a Content Manager-owned publishing-source
identity (such as a Facebook group or page observed while reading a
feed). It is not the future Content Publisher pipeline stage and does
not model videos, drafts, publications, schedules, or published
artifacts.

## Context

Sprint 063A defined the Content Manager domain and application
foundation for `SourcePublisher`. The aggregate, identity, observation
rules, status-update rules, runtime schema, use cases, typed
application error, and in-memory repository are accepted. Sprint 063B
adds PostgreSQL persistence, the Drizzle schema and migration, the
durable repository implementation, the atomic observation algorithm,
the durable read operations, and the composition wiring. The
application-level find-by-identity → domain merge → generic save path
is replaced by a purpose-specific atomic observation port and a
purpose-specific status port.

## Capability Summary

- A new `source_publishers` table in the Content Manager Drizzle
  schema with the required columns, enums, unique identity index,
  check constraints, and supporting indexes.
- A new Drizzle migration (`0017_curious_dust.sql`) creating the
  table, the two new enums, the unique identity index, the check
  constraints, and the supporting indexes. The migration is
  generated alongside an updated Drizzle snapshot and journal entry.
- `DrizzleSourcePublisherRepository` under
  `src/infrastructure/database/repositories/`. It implements the
  refined `SourcePublisherRepository` port:
  - `observeAtomically` owns one PostgreSQL transaction. It
    constructs and validates the initial candidate using the existing
    `observeSourcePublisher` domain function, attempts an
    `INSERT ... ON CONFLICT DO NOTHING` on the unique identity, and
    on a conflict selects the existing row with `SELECT ... FOR
    UPDATE`. It maps the locked row through the runtime schema,
    applies the existing `observeSourcePublisher` domain function to
    the locked aggregate and the incoming observation, updates only
    the observation-owned fields with `RETURNING`, and maps and
    validates the result. The metadata precedence and timestamp rules
    live in the domain function — the SQL does not duplicate them.
  - `updateStatus` updates only `status` and `updated_at` with
    `RETURNING`. It never touches the observation-owned fields, the
    identity, `displayName`, `canonicalUrl`, `firstObservedAt`,
    `lastObservedAt`, `observationCount`, or `createdAt`. It returns
    `null` when the row does not exist.
  - `findById` and `findByIdentity` return validated aggregates or
    `null`.
  - `list` accepts optional `status`, `kind`, and `platform` filters
    with bounded `limit` and non-negative `offset`, orders by
    `lastObservedAt DESC, id ASC`, and returns the total count plus
    the mapped and validated page.
- A refined application `SourcePublisherRepository` port with
  purpose-specific operations: `observeAtomically` and `updateStatus`
  replace the old `save`. The production port exposes no generic
  full-row write path for `SourcePublisher`.
- A refactored `ObserveSourcePublisherUseCase` that strictly
  validates input first, then obtains `updatedAt` from the application
  clock, generates a candidate id, calls
  `repository.observeAtomically`, validates the returned aggregate,
  and returns it. The application-level find-by-identity → domain
  merge → save sequence is removed.
- A refactored `UpdateSourcePublisherStatusUseCase` that loads and
  validates the existing aggregate, applies
  `applySourcePublisherStatusUpdate`, returns the existing aggregate
  without a write when the status is unchanged, and otherwise calls
  `repository.updateStatus` with only `sourcePublisherId`, the new
  status, and `updatedAt`. A `null` result from `updateStatus` raises
  `SourcePublisherNotFoundError`.
- `InMemorySourcePublisherRepository` updated to the refined port
  and a test-only `seedForTest` helper for fixtures. The in-memory
  implementation does not simulate PostgreSQL locking; it matches the
  application contract so the use cases see the same behavior.
- Content Manager composition wiring:
  - `ContentManagerDependencies` and `ContentManagerContainer` now
    accept and expose a `SourcePublisherRepository` and the four
    `SourcePublisher` use cases
    (`ObserveSourcePublisherUseCase`,
    `GetSourcePublisherUseCase`,
    `ListSourcePublishersUseCase`, and
    `UpdateSourcePublisherStatusUseCase`).
  - `createContentManagerFromDatabaseClient` instantiates
    `DrizzleSourcePublisherRepository` using the database client and
    passes it into the Content Manager container.
- Content Manager mapper extensions in
  `src/infrastructure/database/mappers/content-manager.mapper.ts`:
  `SourcePublisherRow`, `SourcePublisherInsert`,
  `toSourcePublisherRow`, and `toSourcePublisherDomain`. Omitted
  optional fields round-trip through PostgreSQL `null`. Every
  reconstructed row passes through the `SourcePublisher` runtime
  schema. The `InvalidPersistedContentManagerRecordError` record
  type union gains `"source publisher"`.

## Architecture

```
Content Manager (domain)
  SourcePublisher aggregate
    schemas, identity, observation rules, status-update rules
  strict zod runtime schema (inferred types are the canonical types)

Content Manager (application)
  SourcePublisherRepository port
    observeAtomically(input)  -> SourcePublisher
    updateStatus(input)       -> SourcePublisher | null
    findById / findByIdentity -> SourcePublisher | null
    list(query)               -> SourcePublisherListResult
  ObserveSourcePublisherUseCase
  GetSourcePublisherUseCase
  ListSourcePublishersUseCase
  UpdateSourcePublisherStatusUseCase
  SourcePublisherNotFoundError
  InMemorySourcePublisherRepository (test support, includes a
    test-only seedForTest helper that is not part of the port)

Content Manager (composition)
  ContentManagerDependencies (now requires sourcePublishers)
  ContentManagerContainer (now exposes the four SourcePublisher
    use cases)
  createContentManagerFromDatabaseClient (now constructs the
    Drizzle adapter)

Infrastructure
  schema/content-manager.schema.ts
    source_publishers table
    source_publisher_kind enum
    source_publisher_status enum
  mappers/content-manager.mapper.ts
    SourcePublisherRow, SourcePublisherInsert,
    toSourcePublisherRow, toSourcePublisherDomain
  repositories/drizzle-source-publisher.repository.ts
    DrizzleSourcePublisherRepository
  drizzle/0017_curious_dust.sql
  drizzle/meta/0017_snapshot.json
  drizzle/meta/_journal.json (entry idx 17)
```

## Invariants

- `SourcePublisher` is the Content Manager-owned durable
  publishing-source identity. It is not the future Content Publisher
  pipeline stage and does not model drafts, publications, videos,
  publishing schedules, or published artifacts.
- `SourcePublisher` is not a managed `SourceGroup` and Sprint 063B
  does not promote, configure, schedule, or join anything.
- `source_publishers` does not reference `source_groups` by foreign
  key. The table is independent and has no cross-module foreign key
  to the Content Manager `SourceGroup` aggregate.
- The atomic observation path is the only observation write path.
  There is no production `SourcePublisher.save(...)` operation on the
  application port. The in-memory test seed helper is the only
  test-only write helper.
- Observation metadata rules and timestamp rules live exclusively in
  the existing `observeSourcePublisher` domain function. SQL does not
  re-implement them with `CASE` expressions, separate upsert
  algorithms, or duplicate the metadata precedence rules.
- Observation never changes `status`. Status writes never change
  observation fields. The two flows are operationally separate.
- `displayName` and `canonicalUrl` are optional. They round-trip
  through PostgreSQL `null` and the domain layer never returns
  `displayName: null` or `canonicalUrl: null`.
- All records entering or leaving persistence pass through the
  `SourcePublisher` runtime schema.
- Domain and application layers do not depend on PostgreSQL, Drizzle,
  HTTP, browser automation, queues, or React.

## Atomic Observation Algorithm

`DrizzleSourcePublisherRepository.observeAtomically` owns one
PostgreSQL transaction:

1. Build the initial candidate aggregate by calling the existing
   `observeSourcePublisher(null, candidateInput, options)` domain
   function. This materializes a `DISCOVERED` aggregate with
   `observationCount = 1`, the candidate `id`, and the application
   `updatedAt`.
2. Convert the candidate to a row with `toSourcePublisherRow`
   (validating the aggregate through the runtime schema and mapping
   omitted optional fields to `null`).
3. Attempt `INSERT ... ON CONFLICT (platform, kind,
   external_publisher_id) DO NOTHING RETURNING *`.
4. If the insert returns a row, map and validate it through
   `toSourcePublisherDomain` and return it as the observation result.
5. If the insert returns no rows (the unique identity already
   exists), execute
   `SELECT ... FOR UPDATE` against the existing row inside the same
   transaction.
6. If the locked row is unexpectedly empty, throw
   `SourcePublisherRowVanishedError` — the durable adapter never
   silently inserts a second identity row.
7. Map and validate the locked row through
   `toSourcePublisherDomain` so the in-memory domain invariant
   (`firstObservedAt <= lastObservedAt`, `observationCount >= 1`,
   identity comparison) holds before the merge.
8. Call the existing `observeSourcePublisher(locked, incoming, options)`
   domain function. The domain function performs the identity
   comparison, applies the metadata precedence rule
   (`observedAt >= lastObservedAt` replaces supplied metadata;
   `observedAt < lastObservedAt` preserves existing metadata), never
   changes review status, increments `observationCount` by exactly
   one, and never moves `lastObservedAt` backward.
9. Update only the observation-owned columns:
   `display_name`, `canonical_url`, `last_observed_at`,
   `observation_count`, `updated_at`, with `RETURNING *`.
10. If the `RETURNING` result is empty (the row vanished inside the
    transaction), throw `SourcePublisherRowVanishedError`.
11. Map and validate the returned row through
    `toSourcePublisherDomain` and return it.

The application use case always generates a candidate id and passes
it through. The durable adapter preserves the existing durable `id`
when the insert is a conflict and discards the unused candidate id.

## Field Ownership Between Observation And Status Updates

| Field | Observation path | Status path |
| --- | --- | --- |
| `id` | preserved | preserved |
| `platform` | preserved | preserved |
| `kind` | preserved | preserved |
| `external_publisher_id` | preserved | preserved |
| `display_name` | updated when `observedAt >= lastObservedAt`; omitted preserves existing | preserved |
| `canonical_url` | updated when `observedAt >= lastObservedAt`; omitted preserves existing | preserved |
| `status` | preserved | updated |
| `first_observed_at` | preserved | preserved |
| `last_observed_at` | monotonic; updated when `observedAt >= lastObservedAt` | preserved |
| `observation_count` | incremented by exactly 1 | preserved |
| `created_at` | preserved | preserved |
| `updated_at` | updated | updated |

## File Manifest

### Create

- `src/infrastructure/database/repositories/drizzle-source-publisher.repository.ts`
- `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts`
- `src/infrastructure/database/repositories/drizzle-source-publisher.repository.concurrency.integration.test.ts`
- `src/infrastructure/database/mappers/content-manager.mapper.test.ts`
- `drizzle/0017_curious_dust.sql`
- `drizzle/meta/0017_snapshot.json`
- `docs/SPRINTS/SPRINT-063B-source-publisher-persistence-and-atomic-observation.md`

### Modify

- `src/content-manager/application/ports/source-publisher-repository.port.ts`
  — replace `save` with `observeAtomically` and `updateStatus`; add
  `AtomicSourcePublisherObservationInput` and
  `SourcePublisherStatusPersistenceInput`.
- `src/content-manager/application/use-cases/observe-source-publisher.use-case.ts`
  — strictly validate input first, obtain `updatedAt` from the
  application clock, generate a candidate id, call
  `repository.observeAtomically`, validate the returned aggregate,
  return it. The application-level find-by-identity → domain merge
  → save sequence is removed.
- `src/content-manager/application/use-cases/update-source-publisher-status.use-case.ts`
  — load and validate the existing aggregate, apply
  `applySourcePublisherStatusUpdate`, skip the write on idempotent
  no-change, call `repository.updateStatus` with only
  `sourcePublisherId`, new status, and `updatedAt`. A `null` result
  raises `SourcePublisherNotFoundError`.
- `src/content-manager/application/test-support/in-memory-repositories.ts`
  — implement the refined `SourcePublisherRepository` port and add
  a `seedForTest` helper for fixtures.
- `src/content-manager/application/source-publisher-application.test.ts`
  — update for the refined port: strict input validation before
  any repository call, candidate id only used for first creation,
  idempotent status skips `updateStatus`, real status change calls
  `updateStatus` exactly once, missing row during status persistence
  maps to `SourcePublisherNotFoundError`, and `seedForTest` replaces
  any production `save` for fixture seeding.
- `src/infrastructure/database/schema/content-manager.schema.ts` —
  add the `source_publishers` table, the `source_publisher_kind` and
  `source_publisher_status` enums, the unique identity index, the
  check constraints, and the supporting indexes. Reuse the existing
  `content_platform` enum.
- `src/infrastructure/database/mappers/content-manager.mapper.ts`
  — add `SourcePublisherRow`, `SourcePublisherInsert`,
  `toSourcePublisherRow`, and `toSourcePublisherDomain`. Extend
  `InvalidPersistedContentManagerRecordError` with the
  `"source publisher"` record type. Preserve the existing mapper
  error style and issue details.
- `src/infrastructure/database/index.ts` — export
  `drizzle-source-publisher.repository`.
- `src/composition/content-manager/content-manager.container.ts` —
  require `sourcePublishers` in `ContentManagerDependencies` and
  expose the four `SourcePublisher` use cases in
  `ContentManagerContainer`. Construct the use cases with the new
  repository.
- `src/composition/content-manager/create-content-manager.ts` —
  instantiate `DrizzleSourcePublisherRepository` from the database
  client and pass it into the container.
- `src/composition/content-manager/content-manager.container.test.ts`
  — supply a `InMemorySourcePublisherRepository` to
  `createContentManager` and assert that the four `SourcePublisher`
  use cases are constructed from both the in-memory and database
  wiring paths.
- `drizzle/meta/_journal.json` — add the `0017_curious_dust` entry.
- `docs/SPRINTS/active.md` — record Sprint 063B as implemented,
  awaiting review, and update the awaiting-definition note.
- `docs/PROJECT_SNAPSHOT.md` — record the new durable
  `SourcePublisher` capability and the active sprint.
- `docs/ROADMAP.md` — correct the Sprint 063B / Sprint 063C split
  (persistence, atomic observation, and composition wiring live in
  063B; safe HTTP contracts and Docker E2E live in 063C).
- `docs/modules/content-manager.md` — record the durable
  `SourcePublisher` capability and the new paths.

### Do not touch

- HTTP route registration, request/response DTOs, HTTP integration
  tests, or the `ContentManager` HTTP surface. Sprint 063B does not
  add HTTP routes.
- `docker-compose.e2e.yml`, `scripts/test-e2e-docker.sh`,
  `tests/e2e/**`, or any Sprint 062 E2E harness surface.
- Web UI, source-groups page, content-categories page, or any
  operator tools.
- Collector Profile Manager, Collector Runtime, or any worker or
  scheduler surface.
- Existing `SourceGroup` domain, application, or persistence
  behavior.
- Previous Drizzle migrations, journal entries, or snapshot files.
  Sprint 063B only adds new files at the end of the migration
  sequence.

## Test Matrix

### Domain and application

| Requirement | Test file |
| --- | --- |
| `SourcePublisher` runtime schema rejects unknown fields | `src/content-manager/domain/content-domain.test.ts` (Sprint 063A) |
| `SourcePublisher` strict observation input validation | `src/content-manager/application/source-publisher-application.test.ts` |
| First observation creates `DISCOVERED` with `observationCount = 1` | `src/content-manager/application/source-publisher-application.test.ts` |
| Subsequent observations preserve `id`, identity, `createdAt`, `firstObservedAt`, status | `src/content-manager/application/source-publisher-application.test.ts` |
| `lastObservedAt` never moves backward | `src/content-manager/application/source-publisher-application.test.ts` |
| Older observations do not overwrite metadata | `src/content-manager/application/source-publisher-application.test.ts` |
| Equal-timestamp observation replaces metadata and increments count | `src/content-manager/application/source-publisher-application.test.ts` |
| Omitted metadata does not clear existing metadata | `src/content-manager/application/source-publisher-application.test.ts` |
| Observation never changes review status | `src/content-manager/application/source-publisher-application.test.ts` |
| Candidate id is used only for first creation | `src/content-manager/application/source-publisher-application.test.ts` |
| Strict input validation before any repository call | `src/content-manager/application/source-publisher-application.test.ts` |
| Status update is idempotent and skips `updateStatus` | `src/content-manager/application/source-publisher-application.test.ts` |
| Real status change calls `updateStatus` exactly once | `src/content-manager/application/source-publisher-application.test.ts` |
| Missing row during status persistence maps to `SourcePublisherNotFoundError` | `src/content-manager/application/source-publisher-application.test.ts` |
| Test seeding no longer depends on a production `save` | `src/content-manager/application/source-publisher-application.test.ts` |
| List filter and pagination ordering | `src/content-manager/application/source-publisher-application.test.ts` (Sprint 063A) |

### Mapper

| Requirement | Test file |
| --- | --- |
| Complete aggregate round trip | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| Omitted `displayName` round trip | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| Omitted `canonicalUrl` round trip | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| PostgreSQL null converted to omission | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| `displayName` and `canonicalUrl` are never null on the domain | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| Date/string timestamps normalized to canonical ISO datetimes | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| Invalid `observationCount` rejected | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| `firstObservedAt` later than `lastObservedAt` rejected | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| Invalid status enum rejected | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| Invalid kind enum rejected | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |
| `InvalidPersistedContentManagerRecordError` reports `source publisher` | `src/infrastructure/database/mappers/content-manager.mapper.test.ts` |

### Database integration (opt-in, `RUN_DB_TESTS=true`)

| Requirement | Test file |
| --- | --- |
| Insert and round trip | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| Find by id | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| Find by identity | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| Omitted metadata round trip | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| Newer observation replaces metadata and increments count | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| Older observation does not replace metadata | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| Omitted observation metadata preserves persisted metadata | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| Observation preserves an existing non-DISCOVERED status | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| `updateStatus` changes only `status` and `updatedAt` | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| `updateStatus` returns `null` for a missing id | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| List filters, total, and `lastObservedAt DESC, id ASC` ordering | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| Unique identity enforcement | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| `observation_count >= 1` check constraint | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |
| `first_observed_at <= last_observed_at` check constraint | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts` |

### Real PostgreSQL concurrency (opt-in, `RUN_DB_TESTS=true`)

| Requirement | Test file |
| --- | --- |
| Concurrent first observations: exactly one row, converged count, no unique-constraint error leaks | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.concurrency.integration.test.ts` |
| Concurrent re-observations: no lost increments | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.concurrency.integration.test.ts` |
| Monotonic `lastObservedAt` under mixed-age observations | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.concurrency.integration.test.ts` |
| Metadata precedence: a uniquely newest observation wins regardless of lock order | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.concurrency.integration.test.ts` |
| Status preservation under concurrent observations | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.concurrency.integration.test.ts` |
| Observation/status isolation: status update and observations do not overwrite each other | `src/infrastructure/database/repositories/drizzle-source-publisher.repository.concurrency.integration.test.ts` |

## Out Of Scope

- HTTP routes, request/response DTOs, HTTP integration tests.
- Docker E2E coverage.
- Web UI review queue, approve/ignore/block buttons.
- `SourcePublisher` to `SourceGroup` promotion.
- Category assignment.
- Facebook home-feed extraction.
- Browser execution, Collector Runtime changes, or any
  Collector Profile Manager change.
- Content provenance, sponsored-content filtering, personal-profile
  filtering, home-feed run models, or scheduling.
- CAPTCHA or checkpoint handling, credential automation, or any
  social action.
- `SourcePublisher` deletion.
- Broad repository refactors.
- Content Builder or future Content Publisher pipeline work.
- Marking Sprint 063B accepted, advancing to Sprint 063C, or
  committing or pushing changes.

## Verification

```bash
pnpm typecheck
pnpm test
git diff --check
pnpm db:migrate
pnpm test:db
```

`pnpm typecheck` must exit 0. `pnpm test` must report all Content
Manager source-publisher tests as passing and no other Content
Manager test as failing. `pnpm test:db` is the opt-in
`RUN_DB_TESTS=true` Vitest run for the Content Manager source
publisher integration and concurrency tests; it requires a
developer-managed `DATABASE_URL`.

## Verification Results

Recorded at Sprint 063B acceptance:

- `pnpm typecheck` exited 0.
- `pnpm test` exited 0.
  - Test Files: 98 passed, 12 skipped, 110 total.
  - Tests: 1336 passed, 12 skipped, 1348 total.
- `git diff --check` exited 0.
- `pnpm db:migrate` exited 0 against an isolated PostgreSQL 16
  instance. The new migration
  (`drizzle/0017_curious_dust.sql`) created the `source_publishers`
  table, the two new enums, the unique identity index, the
  supporting indexes, and the check constraints; the
  `source_publishers_last_observed_at_id_idx` index is defined as
  `btree (last_observed_at DESC, id)` to match the application
  ordering.
- `pnpm test:db` (`RUN_DB_TESTS=true`) exited 0.
  - Test Files: 22 passed.
  - Tests: 147 passed.
- Both Source Publisher PostgreSQL suites ran rather than being
  skipped:
  - `src/infrastructure/database/repositories/drizzle-source-publisher.repository.integration.test.ts (12 tests)`
  - `src/infrastructure/database/repositories/drizzle-source-publisher.repository.concurrency.integration.test.ts (6 tests)`
- The six real concurrency scenarios all passed: concurrent first
  observations (exactly one durable row with a converged
  `observationCount` and the winning candidate's `observedAt` and
  `updatedAt` preserved as `firstObservedAt` and `createdAt`),
  concurrent re-observations (no lost count increments), monotonic
  `lastObservedAt` under mixed-age observations, metadata precedence
  (the uniquely newest observation wins regardless of lock order),
  status preservation under observations, and observation / status
  isolation (a concurrent `BLOCKED` `updateStatus` survived a flood
  of observations while observations still updated their owned
  metadata and timestamps and neither flow overwrote the other
  flow's owned fields).
- The isolated database used a dedicated local-only container, role,
  database, port (`localhost:5499`), and named Docker volume
  (`fgc_sprint_063b_pg_data`). It did not touch dev, preview,
  shared, or existing project databases (including the
  `content_pipeline_postgres` instance). The container was started
  with `--rm` and removed after verification, and the dedicated
  volume was deleted.
- Credentials and the connection URL were supplied only via local
  `DATABASE_URL` / `SPRINT_058_DATABASE_URL` environment variables
  and were not committed or written to repository files.

## Real PostgreSQL Concurrency Evidence

The opt-in real PostgreSQL concurrency tests
(`src/infrastructure/database/repositories/drizzle-source-publisher.repository.concurrency.integration.test.ts`)
ran successfully against an isolated PostgreSQL 16 instance during
verification (see "Verification Results" above). All six scenarios
required by Sprint 063B passed: concurrent first observations,
concurrent re-observations, monotonic `lastObservedAt`, metadata
precedence, status preservation under observations, and
observation / status isolation.

## Assumptions and Deviations

- The Drizzle migration name and number were generated by
  `pnpm db:generate` against the current schema and were renamed
  to `0017_curious_dust.sql` so the migration sits at the end of the
  existing sequence. The accompanying snapshot and journal entry
  were synchronized. The migration is the next migration after
  `0016_collection_run_trigger_scheduled.sql`.
- The composition container test now provides an
  `InMemorySourcePublisherRepository` to the in-memory composition
  path so the four new use cases can be asserted alongside the
  existing use cases without touching the database.
- The mapper test exercises `toSourcePublisherRow` and
  `toSourcePublisherDomain` against synthetic
  `SourcePublisherRow`/`SourcePublisher` values, including
  `displayName: null`, `canonicalUrl: null`, invalid `observationCount`,
  `firstObservedAt` after `lastObservedAt`, and invalid status/kind
  enums.

## Sprint Status

Sprint 063B is **accepted**. It adds PostgreSQL persistence for the
Content Manager `SourcePublisher` aggregate, the atomic observation
algorithm, the durable status update, the durable read operations,
the Content Manager composition wiring, and the unit, mapper,
integration, and real PostgreSQL concurrency test coverage.

Durable architectural outcome:

- `SourcePublisher` persistence is PostgreSQL-backed.
- Observation is atomic and concurrency-safe.
- Observation and status writes own separate fields.
- Domain rules remain the source of truth.
- No HTTP, UI, browser, feed execution, or `SourceGroup` promotion
  was added.

Sprint 063B does not advance to Sprint 063C. Sprint 063C remains
awaiting definition.
