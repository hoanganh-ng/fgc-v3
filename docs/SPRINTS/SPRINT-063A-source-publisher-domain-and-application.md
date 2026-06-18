# Sprint 063A: Source Publisher Domain And Application

## Goal

Define the Content Manager-owned `SourcePublisher` identity and pure
observation behavior for Facebook groups and pages observed while
reading a feed, and add the Content Manager application layer
(ports, use cases, in-memory repository, typed application error,
and unit tests) for that aggregate. No persistence, no HTTP, no UI,
no browser, and no feed execution. `SourcePublisher` is a durable
publishing-source identity and is not the future `Content Publisher`
pipeline module; it does not model drafts, publications, videos,
publishing schedules, or published artifacts.

## Capability Summary

- `SourcePublisher` aggregate in the Content Manager domain with the
  following fields and invariants:
  - `id` (string id, opaque).
  - `platform` (currently `FACEBOOK`).
  - `kind` (`GROUP | PAGE`).
  - `externalPublisherId` (non-empty string).
  - `displayName` (optional, non-empty when present).
  - `canonicalUrl` (optional, must be a URL when present).
  - `status` (`DISCOVERED | APPROVED | IGNORED | BLOCKED`).
  - `firstObservedAt`, `lastObservedAt` (ISO datetime strings).
  - `observationCount` (positive integer).
  - `createdAt`, `updatedAt` (ISO datetime strings).
  - Identity is `platform + kind + externalPublisherId`.
- Strict runtime schema with `zod`. Unknown fields are rejected.
  `displayName` and `canonicalUrl` cannot be `null`. `observationCount`
  must be `>= 1`. `firstObservedAt <= lastObservedAt` is enforced by a
  `superRefine` rule. Inferred TypeScript types are exported as the
  canonical types for the aggregate.
- Pure observation behavior:
  - First observation creates the aggregate with `status = DISCOVERED`
    and `observationCount = 1`. `firstObservedAt` equals
    `lastObservedAt` and equals the incoming `observedAt`. `createdAt`
    and `updatedAt` equal the supplied `updatedAt`.
  - Existing observations preserve `id`, identity, `createdAt`,
    `firstObservedAt`, and current `status`. `observationCount` is
    incremented by exactly 1. `lastObservedAt` never moves backward.
  - When the incoming observation is current or newer than the existing
    `lastObservedAt` (i.e., `observedAt >= lastObservedAt`), the
    incoming `displayName` and `canonicalUrl` (when present) replace
    the existing values. When the incoming observation is older, the
    existing metadata is preserved.
  - Omitted `displayName` or `canonicalUrl` does not clear existing
    metadata.
  - Observation never changes review `status`.
  - `applySourcePublisherObservation` / `observeSourcePublisher`
    reject an observation whose identity
    (`platform + kind + externalPublisherId`) differs from the
    existing aggregate's identity by throwing
    `SourcePublisherIdentityMismatchError`. Adapters and use cases
    cannot bypass this check; it is enforced inside the domain
    operation.
- Explicit, reversible status updates via
  `applySourcePublisherStatusUpdate`. Reapplying the current status is
  idempotent: the existing aggregate is returned unchanged and
  `updatedAt` is not bumped.
- Application-owned `SourcePublisherRepository` port with
  `save`, `findById`, `findByIdentity`, and `list`. `list` accepts
  optional `status`, `kind`, and `platform` filters plus required
  bounded `limit` (positive integer, clamped to a maximum) and
  non-negative `offset`. Ordering is `lastObservedAt` descending, then
  `id` ascending.
- Content Manager application use cases:
  - `ObserveSourcePublisherUseCase` — observes a source publisher by
    identity. Returns the resulting aggregate.
  - `GetSourcePublisherUseCase` — returns the aggregate by id or
    throws `SourcePublisherNotFoundError`.
  - `ListSourcePublishersUseCase` — returns a page of aggregates with
    filters and pagination.
  - `UpdateSourcePublisherStatusUseCase` — applies a reversible,
    idempotent status update and persists the new aggregate.
- Typed `SourcePublisherNotFoundError` application error.
- In-memory `InMemorySourcePublisherRepository` test-support
  implementation.
- Content Manager domain and application unit tests covering the
  aggregate schema, observation rules, status-update rules, identity
  comparison, use case flows, error mapping, list filtering and
  pagination, and repository-output validation.

`SourcePublisher` is a Content Manager-owned publishing-source
identity and remains distinct from `SourceGroup`. A `SourcePublisher`
becomes a managed `SourceGroup` only through explicit promotion in a
later sprint; Sprint 063A does not promote, configure, or schedule
anything.

## Architecture

```
Content Manager (domain)
  SourcePublisher aggregate
    schemas, identity, observation rules, status-update rules
  strict zod runtime schema (inferred types are the canonical types)

Content Manager (application)
  SourcePublisherRepository port
  ObserveSourcePublisherUseCase
  GetSourcePublisherUseCase
  ListSourcePublishersUseCase
  UpdateSourcePublisherStatusUseCase
  SourcePublisherNotFoundError
  InMemorySourcePublisherRepository (test support)
```

## Invariants

- `SourcePublisher` is the Content Manager-owned durable publishing
  source identity. It is not the future Content Publisher pipeline
  stage and does not model drafts, publications, videos, publishing
  schedules, or published artifacts.
- `SourcePublisher` is not a managed `SourceGroup` and Sprint 063A
  does not promote, configure, schedule, or join anything.
- Identity is `platform + kind + externalPublisherId`. A re-observation
  for an existing identity reuses the existing aggregate's `id`,
  `createdAt`, `firstObservedAt`, and current `status`.
- `observationCount` always increases by exactly 1 on every
  observation, including the first observation.
- `lastObservedAt` is monotonic: an incoming observation may move it
  forward but never backward.
- Observation never changes `status`. Status changes only happen
  through the explicit status update path.
- Reapplying the current `status` is idempotent: the aggregate is
  returned unchanged and `updatedAt` is not bumped.
- `displayName` and `canonicalUrl` are optional but, when present,
  must be non-empty string and URL respectively. They cannot be
  `null`. Unknown fields are rejected.
- `findByIdentity` may return `null`. When `findByIdentity` returns
  `null`, this is the first observation for that identity and a new
  `DISCOVERED` aggregate is created.
- `findById` may return `null`. When `findById` returns `null`, use
  cases that look up by id raise `SourcePublisherNotFoundError`.
- Domain and application layers do not depend on HTTP, Fastify,
  PostgreSQL, Drizzle, browser automation, queues, or React.

## Decisions Log

- **Identity tuple**: `platform + kind + externalPublisherId`. The
  domain exposes `sourcePublishersShareIdentity` and the repository
  port exposes `findByIdentity` so the application can resolve an
  existing aggregate by identity without a separate id-keyed
  lookup-and-insert race.
- **Status review separation**: observation never changes status, and
  the status update path never changes observation counts or
  observation timestamps. The two flows are independent and the
  aggregate invariants hold under both.
- **Metadata update rule**: incoming `displayName` and `canonicalUrl`
  only replace existing values when the incoming observation is
  current or newer than the existing `lastObservedAt`
  (`observedAt >= lastObservedAt`). Omitted metadata is preserved.
  This matches the sprint's "older observations cannot overwrite
  metadata from newer observations" and "omitted metadata does not
  clear existing metadata" rules.
- **List ordering**: `lastObservedAt` descending, then `id` ascending.
  This makes recently observed publishers appear first while keeping
  the ordering deterministic when observation timestamps tie.
- **Strict schema**: unknown fields are rejected. `displayName` and
  `canonicalUrl` cannot be `null`. `observationCount` must be `>= 1`.
  `firstObservedAt <= lastObservedAt` is enforced by `superRefine`.
- **Pagination**: required bounded `limit` (positive integer, clamped
  to `MAX_SOURCE_PUBLISHER_LIST_LIMIT`) and non-negative `offset`.
- **In-memory repository**: kept inside Content Manager
  `application/test-support/` alongside the other in-memory
  repositories and is the only repository implementation Sprint 063A
  ships. PostgreSQL persistence, mapper, atomic upsert, and
  concurrency guarantees are deferred to Sprint 063B.

## File Manifest

### Create

- `src/content-manager/domain/source-publisher.ts`
- `src/content-manager/domain/source-publisher-kind.ts`
- `src/content-manager/domain/source-publisher-status.ts`
- `src/content-manager/domain/source-publisher.schemas.ts`
- `src/content-manager/application/ports/source-publisher-repository.port.ts`
- `src/content-manager/application/use-cases/observe-source-publisher.use-case.ts`
- `src/content-manager/application/use-cases/get-source-publisher.use-case.ts`
- `src/content-manager/application/use-cases/list-source-publishers.use-case.ts`
- `src/content-manager/application/use-cases/update-source-publisher-status.use-case.ts`
- `src/content-manager/application/source-publisher-application.test.ts`
- `docs/SPRINTS/SPRINT-063A-source-publisher-domain-and-application.md`

### Modify

- `src/content-manager/domain/content-errors.ts` — add
  `SourcePublisherIdentityMismatchError` (the source of the new
  409 mapping in the generic HTTP error mapper).
- `src/content-manager/domain/index.ts` — re-export the new domain
  modules.
- `src/content-manager/domain/validation.ts` — add
  `validateSourcePublisher`, `parseSourcePublisher`,
  `validateObserveSourcePublisherInput`, and
  `parseObserveSourcePublisherInput` validators.
- `src/content-manager/domain/source-publisher.schemas.ts` — add
  `ObserveSourcePublisherInputSchema` (strict Zod) and the inferred
  `ObserveSourcePublisherApplicationInput` TypeScript type.
- `src/content-manager/application/index.ts` — re-export the new
  application modules.
- `src/content-manager/application/application-errors.ts` — add the
  `SOURCE_PUBLISHER_NOT_FOUND` error code and
  `SourcePublisherNotFoundError`.
- `src/content-manager/application/content-validation.ts` — add
  `loadValidatedSourcePublisherById`,
  `loadValidatedSourcePublisherByIdentity`,
  `validateSourcePublisherForApplication`, and
  `validateObserveSourcePublisherInputForApplication`. The identity
  lookup revalidates the non-null `findByIdentity` output before
  returning it to the use case.
- `src/content-manager/application/use-cases/observe-source-publisher.use-case.ts`
  — call `validateObserveSourcePublisherInputForApplication` as the
  first statement of `execute()`, before `clock.now()`,
  `findByIdentity`, `generateId`, the domain observation, or
  `save`. The validated value is used for all subsequent work. The
  use case input type is the inferred
  `ObserveSourcePublisherApplicationInput`.
- `src/content-manager/application/test-support/in-memory-repositories.ts`
  — add `InMemorySourcePublisherRepository`.
- `src/content-manager/domain/content-domain.test.ts` — extend with
  SourcePublisher validation, observation, status update, identity
  comparison, identity-mismatch non-mutation, and equal-timestamp
  metadata behavior tests.
- `src/content-manager/application/source-publisher-application.test.ts`
  — extend with strict observation-input validation tests (invalid
  `observedAt`, blank `displayName`, invalid `canonicalUrl`, unknown
  fields, null optional metadata) and regression coverage proving
  that, when an existing publisher is present, invalid input does
  not increment `observationCount`, does not call `save`, and is
  rejected before `findByIdentity`. Also exercises the idempotent
  status-update skipping `save` path through a counting repository.
- `src/interfaces/http/errors/http-error-mapper.ts` — map
  `SOURCE_PUBLISHER_NOT_FOUND` to HTTP 404 and
  `SOURCE_PUBLISHER_IDENTITY_MISMATCH` to HTTP 409 so the future
  HTTP layer has typed statuses for the new error codes.
- `docs/SPRINTS/active.md` — record Sprint 063A as active and update
  the awaiting-definition note.
- `docs/PROJECT_SNAPSHOT.md` — record the new `SourcePublisher`
  domain and application capability, the active sprint, and the
  verification commands.
- `docs/MODULE_BOUNDARIES.md` — record that Content Manager owns
  `SourcePublisher` identity and observation rules and that
  `SourcePublisher` is distinct from `SourceGroup`.
- `docs/modules/content-manager.md` — record `SourcePublisher`
  identity and observation rules under Content Manager ownership
  and update the important source paths.

### Do not touch

- `docker-compose.e2e.yml`, `scripts/test-e2e-docker.sh`,
  `tests/e2e/**`, `docs/TESTING_STRATEGY.md`, or any Sprint 062 E2E
  harness surface.
- Drizzle schema, drizzle config, or any database migration.
- HTTP route registration, route handlers, or DTO mappers for
  `SourcePublisher`. Sprint 063A does not add HTTP routes.
- Composition wiring (`src/content-manager/composition/**`) or
  infrastructure repositories (`src/content-manager/infrastructure/**`).
- Web UI, source-groups page, content-categories page, or any
  operator tools.
- Collector Profile Manager, Collector Runtime, or any worker or
  scheduler surface.
- Existing `SourceGroup` domain and application behavior.
- `docs/ROADMAP.md` wording (the Sprint 063A–068 sequence and the
  retained long-term Content Builder / Content Publisher pipeline
  stages are already correct; Sprint 063A is one sprint within that
  sequence).

## Test Matrix

| Requirement                                                          | Test file                                                                              |
|----------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| Strict runtime schema rejects unknown fields                         | `src/content-manager/domain/content-domain.test.ts`                                    |
| Strict runtime schema rejects `null` optional metadata               | `src/content-manager/domain/content-domain.test.ts`                                    |
| `observationCount >= 1` enforced                                     | `src/content-manager/domain/content-domain.test.ts`                                    |
| `firstObservedAt <= lastObservedAt` enforced                         | `src/content-manager/domain/content-domain.test.ts`                                    |
| First observation creates `DISCOVERED` with `observationCount = 1`   | `src/content-manager/domain/content-domain.test.ts`                                    |
| Subsequent observations preserve id, identity, `createdAt`, `firstObservedAt`, status | `src/content-manager/domain/content-domain.test.ts`                       |
| `lastObservedAt` never moves backward                                | `src/content-manager/domain/content-domain.test.ts`                                    |
| Older observations do not overwrite metadata                         | `src/content-manager/domain/content-domain.test.ts`                                    |
| Equal-timestamp observation replaces metadata and increments count   | `src/content-manager/domain/content-domain.test.ts`                                    |
| Omitted metadata does not clear existing metadata                    | `src/content-manager/domain/content-domain.test.ts`                                    |
| Observation never changes review status                              | `src/content-manager/domain/content-domain.test.ts`                                    |
| Status update applies new status and bumps `updatedAt`               | `src/content-manager/domain/content-domain.test.ts`                                    |
| Reapplying current status is idempotent                              | `src/content-manager/domain/content-domain.test.ts`                                    |
| Identity comparison matches on `platform + kind + externalPublisherId` | `src/content-manager/domain/content-domain.test.ts`                                    |
| Identity mismatch is rejected and the existing aggregate is not mutated | `src/content-manager/domain/content-domain.test.ts`                                  |
| `ObserveSourcePublisherUseCase` creates and merges correctly          | `src/content-manager/application/source-publisher-application.test.ts`                 |
| `ObserveSourcePublisherUseCase` validates input strictly before any side effect | `src/content-manager/application/source-publisher-application.test.ts`        |
| Invalid observation `observedAt` rejects without `save` or count bump | `src/content-manager/application/source-publisher-application.test.ts`                |
| Older observation with invalid `canonicalUrl` is rejected            | `src/content-manager/application/source-publisher-application.test.ts`                 |
| Older observation with blank `displayName` is rejected               | `src/content-manager/application/source-publisher-application.test.ts`                 |
| Unknown observation-input field is rejected (strict schema)          | `src/content-manager/application/source-publisher-application.test.ts`                 |
| Null optional observation metadata is rejected (omission only)       | `src/content-manager/application/source-publisher-application.test.ts`                 |
| Equal-timestamp observation replaces metadata and increments count (application) | `src/content-manager/application/source-publisher-application.test.ts`        |
| `GetSourcePublisherUseCase` raises `SourcePublisherNotFoundError`    | `src/content-manager/application/source-publisher-application.test.ts`                 |
| `ListSourcePublishersUseCase` applies filters and pagination         | `src/content-manager/application/source-publisher-application.test.ts`                 |
| `ListSourcePublishersUseCase` orders by `lastObservedAt` desc, `id` asc | `src/content-manager/application/source-publisher-application.test.ts`              |
| Invalid list-filter (status/kind/platform) is rejected               | `src/content-manager/application/source-publisher-application.test.ts`                 |
| `UpdateSourcePublisherStatusUseCase` is idempotent on same status    | `src/content-manager/application/source-publisher-application.test.ts`                 |
| Idempotent status update skips `save`                                | `src/content-manager/application/source-publisher-application.test.ts`                 |
| Repository outputs are validated through the runtime schema          | `src/content-manager/application/source-publisher-application.test.ts`                 |
| Malformed `findByIdentity` output is rejected before save            | `src/content-manager/application/source-publisher-application.test.ts`                 |
| In-memory repository supports `findByIdentity` and list ordering     | `src/content-manager/application/source-publisher-application.test.ts`                 |

## Out Of Scope

- PostgreSQL, Drizzle, migrations, atomic upsert, and concurrency
  guarantees. (Sprint 063B.)
- Composition wiring for `SourcePublisher`. (Sprint 063B or 063C.)
- HTTP routes, DTOs, or request/response schemas for `SourcePublisher`.
  (Sprint 063C.)
- Docker E2E coverage for `SourcePublisher`. (Sprint 063C.)
- Web UI review surface, approve/ignore/block buttons, or
  `SourceGroup` promotion. (Sprints 066 and 067.)
- Extractor or browser behavior. (Sprints 065A–065C.)
- Content provenance, video publishing, or the future Content
  Builder / Content Publisher pipeline stages.
- SourceGroup promotion, categories, automatic approval, or any
  social action.
- Commits, pushes, marking Sprint 063A accepted, or advancing to
  Sprint 063B.

## Verification

```bash
pnpm typecheck
pnpm test
```

`pnpm typecheck` must exit 0 and `pnpm test` must report all Source
Publisher tests as passing and no other Content Manager test as
failing. Database integration and HTTP integration suites are opt-in
and may legitimately be skipped by the default `pnpm test` invocation;
this is expected and does not indicate a defect in Sprint 063A.

## Verification Results

Recorded at Sprint 063A acceptance:

- `pnpm typecheck` exited 0.
- `pnpm test` exited 0. The Content Manager source-publisher test
  suite (`src/content-manager/application/source-publisher-application.test.ts`)
  and the Content Manager domain test suite
  (`src/content-manager/domain/content-domain.test.ts`) both passed.
  No Source Publisher test was failing and no other Content Manager
  test regressed. Database integration and HTTP integration suites
  were skipped, as expected by the default `pnpm test` invocation;
  this is not a defect in Sprint 063A.

## Sprint Status

Sprint 063A is implemented in this branch as the Content Manager
domain and application foundation for `SourcePublisher`. It defines
the aggregate, identity, observation rules, status-update rules,
runtime schema, use cases, typed application error, and in-memory
repository, and ships the domain and application unit tests. It does
not add persistence, HTTP, UI, browser execution, or feed execution,
and it does not promote, configure, schedule, or join anything.

Sprint 063A is **accepted**. The final correction added strict
runtime validation for the observation application input and
expanded regression coverage proving that invalid input is rejected
before any use-case side effect and before `findByIdentity`, and
that invalid metadata on an older observation is rejected rather
than silently ignored.

Sprint 063B — Source Publisher Persistence and Atomic Observation
remains **awaiting definition**. It is not active and is not
authorized for implementation. Its scope, when defined, will cover
PostgreSQL persistence, the Drizzle schema and migration, the
durable repository implementation, the atomic upsert and
concurrency guarantees for re-observation, and composition wiring
for `SourcePublisher`. HTTP routes, DTOs, Docker E2E coverage, the
Web UI review surface, `SourceGroup` promotion, the extractor and
browser behavior, and the future Content Builder / Content
Publisher pipeline stages remain out of scope and are not part of
Sprint 063B. `SourcePublisher` continues to be distinct from the
future Content Publisher pipeline stage.
