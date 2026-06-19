# Sprint 063C: Source Publisher HTTP Contract And E2E

## Goal

Expose safe HTTP contracts for observing, listing, and reading Content
Manager-owned `SourcePublisher` aggregates, then prove the flow
through:

Nginx web-gateway
→ Fastify HTTP adapter
→ Content Manager application
→ PostgreSQL

Use only synthetic fixtures. `SourcePublisher` is a Content
Manager-owned durable publishing-source identity for a Facebook group
or page observed while collecting content. It is identified by
`platform + kind + externalPublisherId`, is distinct from a managed
`SourceGroup`, is distinct from the future Content Publisher pipeline
stage, and is not a video, draft, publication, publishing schedule,
or published artifact.

## Context

Sprint 063A accepted the Content Manager domain and application
behavior for `SourcePublisher`. Sprint 063B accepted PostgreSQL
persistence, the atomic observation algorithm, the durable status
update, the durable read operations, and the Content Manager
composition wiring. Sprint 063C is an HTTP interface and verification
sprint; it must not reinterpret domain rules or access persistence
directly.

This sprint adds three exact routes:

- `POST /collector/source-publishers/observations`
- `GET /collector/source-publishers`
- `GET /collector/source-publishers/:sourcePublisherId`

SourcePublisher status mutation (approve / ignore / block) is
intentionally deferred to Sprint 066. The HTTP service does not
expose `updateSourcePublisherStatus`.

## Capability Summary

- Safe HTTP request and response schemas for `SourcePublisher`
  observation, list, and get. Request schemas are strict, reject
  unknown fields, reject null optional fields, and validate enum,
  datetime, URL, and bounded pagination inputs.
- A safe `SourcePublisherDto` allowlist and a `toSourcePublisherDto`
  mapper. Optional `displayName` and `canonicalUrl` are omitted when
  absent. Server-owned fields, raw payloads, sessions, tokens,
  proxies, viewer IDs, account IDs, and diagnostic data are never
  serialized.
- A `POST /collector/source-publishers/observations` route that
  invokes `ObserveSourcePublisherUseCase` exactly once per request
  and returns HTTP 200 for both first and repeated observations.
- A `GET /collector/source-publishers` route that forwards supplied
  `status`, `kind`, and `platform` filters plus bounded `limit` and
  non-negative `offset` to `ListSourcePublishersUseCase`. Defaults
  are `limit = 50` and `offset = 0`. The response carries `items`
  and `page` and preserves the application ordering of
  `lastObservedAt DESC, id ASC`.
- A `GET /collector/source-publishers/:sourcePublisherId` route that
  invokes `GetSourcePublisherUseCase` and returns the safe DTO.
  Missing aggregates return HTTP 404 with `error.code =
  SOURCE_PUBLISHER_NOT_FOUND`.
- HTTP error mapping for `HttpRequestValidationError` → 400
  `VALIDATION_ERROR`, `ContentValidationError` → 400
  `CONTENT_VALIDATION_ERROR`, `SourcePublisherNotFoundError` → 404
  `SOURCE_PUBLISHER_NOT_FOUND`, and unexpected errors → 500
  `INTERNAL_SERVER_ERROR`. No stack traces, no Zod objects, no
  database errors, no environment values, no sensitive request
  contents are exposed.
- An extended `ContentManagerHttpService` interface that exposes
  `observeSourcePublisher`, `getSourcePublisher`, and
  `listSourcePublishers`. `updateSourcePublisherStatus` is not
  exposed during Sprint 063C.
- Stub-backed HTTP unit tests (`content-manager.server.test.ts`)
  covering the full observation, list, and get contracts plus
  negative cases for unknown fields, null optional fields, invalid
  values, and missing aggregates.
- An opt-in PostgreSQL-backed HTTP integration test
  (`content-manager.server.database.integration.test.ts`) that
  exercises the real composition root and the durable
  `SourcePublisher` repository through the HTTP surface and cleans
  up created rows.
- A Docker E2E spec (`tests/e2e/source-publisher-http.spec.ts`)
  that proves the full Nginx → API → PostgreSQL flow through the
  configured `web-gateway` baseURL using only synthetic fixtures,
  and that asserts no sensitive or unapproved keys appear in any
  response.

## Requirements

### Routes

| Method | Path                                          | Use case                  | Status |
| ------ | --------------------------------------------- | ------------------------- | ------ |
| POST   | `/collector/source-publishers/observations`   | Observe identity         | 200    |
| GET    | `/collector/source-publishers`                | List (filters + page)    | 200    |
| GET    | `/collector/source-publishers/:sourcePublisherId` | Read by id            | 200    |

Missing aggregate on GET by id returns 404 with
`error.code = SOURCE_PUBLISHER_NOT_FOUND`. No status mutation route
exists in Sprint 063C.

### Observation Semantics

- Each successful request invokes `ObserveSourcePublisherUseCase`
  exactly once.
- HTTP 200 is returned for both first and repeated observations.
  HTTP 201 is intentionally not returned because the operation may
  create or update the durable identity.
- Every successful observation increments `observationCount` by
  exactly one on the durable aggregate.
- The durable `id`, identity, `createdAt`, and `firstObservedAt` are
  preserved across re-observations.

### Safe DTO Contract

The `SourcePublisherDto` allowlist is exactly:

- `id`
- `platform`
- `kind`
- `externalPublisherId`
- `displayName` (optional, omitted when absent)
- `canonicalUrl` (optional, omitted when absent)
- `status`
- `firstObservedAt`
- `lastObservedAt`
- `observationCount`
- `createdAt`
- `updatedAt`

DTO construction is explicit and never spreads the aggregate. The
mapper omits `displayName` and `canonicalUrl` when the aggregate
does not define them; `null` is never emitted.

### Validation Rules

- Strict request objects; unknown fields are rejected.
- Optional fields reject `null`.
- `externalPublisherId` is non-empty after trimming.
- `displayName` is non-empty after trimming.
- `canonicalUrl` is a valid URL.
- `observedAt` is a valid ISO datetime.
- `platform`, `kind`, and `status` use accepted enum values.
- `limit` is an integer from 1 to 100; `offset` is a non-negative
  integer.
- JSON response schemas use `additionalProperties: false`.
- Required response properties exactly match the DTO contract.
- Optional DTO fields are not required on responses.

Malformed transport input returns HTTP 400 with
`error.code = VALIDATION_ERROR`. No permissive fallback parsing is
added.

### Error Handling

| Error                                     | Status | Code                           |
| ----------------------------------------- | ------ | ------------------------------ |
| `HttpRequestValidationError`              | 400    | `VALIDATION_ERROR`             |
| `ContentValidationError`                  | 400    | `CONTENT_VALIDATION_ERROR`     |
| `SourcePublisherNotFoundError`            | 404    | `SOURCE_PUBLISHER_NOT_FOUND`   |
| Unexpected error                          | 500    | `INTERNAL_SERVER_ERROR`        |

No new application error class is added during Sprint 063C.

## Architecture

```
Content Manager (domain)
  SourcePublisher aggregate, schemas, identity, observation rules
  (unchanged; no domain changes in Sprint 063C)

Content Manager (application)
  ObserveSourcePublisherUseCase
  GetSourcePublisherUseCase
  ListSourcePublishersUseCase
  SourcePublisherNotFoundError
  (unchanged; no application behavior changes in Sprint 063C)

Interfaces (HTTP adapter)
  src/interfaces/http/routes/content-manager.routes.ts
    registerContentManagerRoutes:
      POST /collector/source-publishers/observations
      GET  /collector/source-publishers
      GET  /collector/source-publishers/:sourcePublisherId
    toSourcePublisherDto mapper
  src/interfaces/http/schemas/content-manager.http-schemas.ts
    ObserveSourcePublisherHttpBodySchema
    SourcePublisherIdHttpParamsSchema
    ListSourcePublishersHttpQuerySchema
    observeSourcePublisherHttpRouteSchema
    listSourcePublishersHttpRouteSchema
    getSourcePublisherHttpRouteSchema
    SourcePublisher response JSON schema
  src/interfaces/http/test-support/content-manager-http-service.ts
    FakeContentManagerHttpService stubs
    createSourcePublisher fixture helper
  src/interfaces/http/content-manager.server.test.ts
    stub-backed HTTP unit coverage
  src/interfaces/http/content-manager.server.database.integration.test.ts
    PostgreSQL-backed HTTP integration coverage
  src/interfaces/http/errors/http-error-mapper.ts
    no change required; SOURCE_PUBLISHER_NOT_FOUND already mapped

Composition
  src/composition/content-manager/content-manager.container.ts
    exposes observeSourcePublisher, getSourcePublisher,
    listSourcePublishers (already wired in Sprint 063B)
  src/composition/content-manager/create-content-manager.ts
    no change required

Docker E2E
  tests/e2e/fixtures/synthetic-payloads.ts
    buildSourcePublisherObservationFixture
    buildSourcePublisherSecondObservationFixture
  tests/e2e/source-publisher-http.spec.ts
    observation + get + list flow through web-gateway
```

Route handlers invoke application use cases and map outputs through
the safe DTO. They do not import repositories, Drizzle, tables, or
database clients. They do not re-implement observation behavior.
They do not catch application errors; the shared server error
handler maps known errors to HTTP responses.

## Out Of Scope

- `PATCH /collector/source-publishers/:id/status` and any other
  approve, ignore, or block endpoint.
- SourcePublisher review API beyond list and get.
- SourcePublisher Web UI or navigation changes.
- SourcePublisher deletion or promotion to `SourceGroup`.
- Collector Runtime HTTP client or home-feed integration.
- Content Builder or Content Publisher work.
- Domain, application, repository, persistence, schema, or
  migration changes.
- Composition redesign or new dependencies.
- Dev or preview Compose changes.

## File Manifest

### Create

- `docs/SPRINTS/SPRINT-063C-source-publisher-http-contract-and-e2e.md`
- `tests/e2e/source-publisher-http.spec.ts`

### Modify

- `src/interfaces/http/routes/content-manager.routes.ts` —
  register the three routes; add `SourcePublisherDto` and the
  `toSourcePublisherDto` mapper; extend `ContentManagerHttpService`.
- `src/interfaces/http/schemas/content-manager.http-schemas.ts` —
  add `ObserveSourcePublisherHttpBodySchema`,
  `SourcePublisherIdHttpParamsSchema`,
  `ListSourcePublishersHttpQuerySchema`, the inferred HTTP types,
  the JSON response schema, and the three route schemas.
- `src/interfaces/http/test-support/content-manager-http-service.ts`
  — extend `FakeContentManagerHttpService` with `observeSourcePublisher`,
  `getSourcePublisher`, and `listSourcePublishers` stubs; add
  `createSourcePublisher` fixture helper.
- `src/interfaces/http/content-manager.server.test.ts` — add
  observation, list, get, and DTO mapper coverage.
- `src/interfaces/http/content-manager.server.database.integration.test.ts`
  — add the PostgreSQL-backed Source Publisher HTTP flow with row
  cleanup.
- `tests/e2e/fixtures/synthetic-payloads.ts` — add
  `buildSourcePublisherObservationFixture` and
  `buildSourcePublisherSecondObservationFixture` builders.
- `docs/SPRINTS/active.md` — record Sprint 063C as accepted.
- `docs/PROJECT_SNAPSHOT.md` — record the Sprint 063C HTTP and E2E
  capability; correct any Sprint 063B “awaiting review” wording.
- `docs/modules/content-manager.md` — record the new HTTP routes
  and the safe DTO contract.
- `docs/MODULE_BOUNDARIES.md` — correct the `SourcePublisher` port
  wording to enumerate `observeAtomically`, `updateStatus`,
  `findById`, `findByIdentity`, and `list`.
- `docs/TESTING_STRATEGY.md` — record the Sprint 063C Layer 3 and
  Layer 4 coverage additions.

### Do not touch

- `docker-compose.e2e.yml`
- `tests/e2e/playwright.config.ts`
- `scripts/test-e2e-docker.sh`
- `scripts/run-e2e-runner-container.sh`
- Domain, application, persistence, schema, or migration files
  beyond typing-required adapter surface changes (none required in
  Sprint 063C).
- Collector Profile Manager, Collector Runtime, Web UI, browser,
  scheduler, or worker code.

## Testing Layers

### Layer 1 — Unit (stub-backed)

`pnpm test src/interfaces/http/content-manager.server.test.ts`
covers:

- Full valid observation body is forwarded exactly to
  `ObserveSourcePublisherUseCase`.
- Successful observation returns HTTP 200 with the safe DTO.
- Omitted `displayName` remains omitted on observation response.
- Omitted `canonicalUrl` remains omitted on observation response.
- Unknown fields, `displayName: null`, `canonicalUrl: null`,
  invalid `observedAt`, invalid `canonicalUrl`, invalid `platform`,
  invalid `kind`, blank `externalPublisherId`, and blank
  `displayName` return HTTP 400 without invoking
  `ObserveSourcePublisherUseCase`.
- Server-owned fields such as `status`, `observationCount`,
  `firstObservedAt`, `lastObservedAt`, `createdAt`, `updatedAt`,
  `id`, and sensitive unapproved properties are rejected.
- List forwards supplied `status`, `kind`, and `platform` filters
  plus `limit` and `offset`. Defaults are `limit = 50` and
  `offset = 0`. Invalid `status`, `kind`, `platform`, `limit`,
  `offset`, and unknown query parameters return HTTP 400 without
  invocation.
- Get forwards `sourcePublisherId` exactly and returns the safe DTO.
  `SourcePublisherNotFoundError` maps to HTTP 404 with
  `error.code = SOURCE_PUBLISHER_NOT_FOUND`.
- `toSourcePublisherDto` explicitly omits absent `displayName` and
  `canonicalUrl`.

The reused `expectSourcePublisherIsSafe` helper checks that no
sensitive key (raw payload, raw payload reference, cookies,
localStorage, token, tokens, token hash, authorization, headers,
viewer id, account id, session, proxy, proxy credentials,
fingerprint, screenshot, diagnostics) appears in serialized
responses.

### Layer 3 — HTTP integration (opt-in)

`pnpm test:http:db` runs the PostgreSQL-backed
`Content Manager HTTP PostgreSQL integration` suite. The new
spec exercises a full observation, re-observation, get-by-id, and
list flow against the real composition root and durable
`SourcePublisher` repository. Created rows are tracked and removed
in `afterEach`.

### Layer 4 — Docker E2E

`pnpm test:e2e:docker` runs the new
`tests/e2e/source-publisher-http.spec.ts` and the existing
`tests/e2e/stack-baseline.spec.ts` against the production-like
stack. The new spec creates its own fixtures from
`buildRunStamp()` and `buildSourcePublisherObservationFixture`,
addresses the gateway through the configured baseURL, asserts HTTP
200 responses for observation and list, asserts durable identity,
and asserts that all responses are safe allowlists. The spec does
not depend on any other spec's variables or records.

## Verification Commands

```bash
pnpm typecheck
pnpm test
pnpm exec tsc -p tests/tsconfig.json --noEmit
git diff --check
pnpm db:migrate
pnpm test:http:db
pnpm test:e2e:docker
```

## Verification Results

Recorded at Sprint 063C acceptance:

- `pnpm typecheck` exited 0.
- `pnpm exec tsc -p tests/tsconfig.json --noEmit` exited 0.
- `git diff --check` exited 0.
- `pnpm test` exited 0:
  - Test Files: 98 passed, 12 skipped, 110 total.
  - Tests: 1348 passed, 12 skipped, 1360 total.
- `pnpm db:migrate` exited 0 against an isolated PostgreSQL 16
  instance.
- `pnpm test:http:db` (`RUN_HTTP_DB_TESTS=true`) exited 0:
  - Test Files: 7 passed.
  - Tests: 154 passed.
  - The Content Manager PostgreSQL HTTP suite ran rather than
    skipped.
  - The Source Publisher observation, re-observation, get, and
    list flow passed.
- `pnpm test:e2e:docker` exited 0:
  - 8 tests passed.
  - The seven existing stack-baseline tests passed.
  - The new `source-publisher-http.spec.ts` test passed.
  - All traffic used `web-gateway`.
  - No host port was published.
  - Cleanup removed the E2E containers, network, and volume.
  - No sensitive environment values were logged.

The PostgreSQL verification used an isolated local container and
volume and did not touch dev, preview, shared, or existing project
databases. Credentials and connection URLs were never recorded in
this document or committed to the repository.

## Assumptions and Deviations

None recorded. The HTTP adapter, DTO mapper, schemas, test
support, stub tests, PostgreSQL-backed HTTP integration test, E2E
fixture, E2E spec, sprint document, and supporting documentation
were all added as the sprint defined without requiring domain,
application, persistence, schema, migration, composition, or
dependency changes.

The `updateSourcePublisherStatus` use case is intentionally not
exposed through `ContentManagerHttpService` during Sprint 063C and
is reserved for Sprint 066 (review UI).

## Status

Sprint 063C is **accepted**. Sprint 063B remains accepted;
Sprint 064A is not active or authorized.