# Sprint 066: Source Publisher Status Mutation HTTP Contract

## Goal

Expose a safe HTTP contract for mutating Content Manager-owned
`SourcePublisher.status` through the existing application use case:

`PATCH /collector/source-publishers/:sourcePublisherId/status`

The route delegates to the already-wired
`UpdateSourcePublisherStatusUseCase` and reuses the safe
`SourcePublisherDto` allowlist introduced by Sprint 063C. Status
mutation (approve / ignore / block / discover) is the narrow capability
Sprint 063C explicitly deferred to Sprint 066.

## Context

Sprint 063A accepted the Content Manager domain and application
behavior for `SourcePublisher`. Sprint 063B accepted PostgreSQL
persistence, the atomic observation algorithm, the durable status
update, the durable read operations, and the Content Manager
composition wiring (including the `UpdateSourcePublisherStatusUseCase`
binding and a container test that asserts it is instantiated).
Sprint 063C exposed the read-side HTTP surface
(`POST /collector/source-publishers/observations`,
`GET /collector/source-publishers`,
`GET /collector/source-publishers/:sourcePublisherId`) and proved the
flow through Nginx web-gateway → Fastify → Content Manager
application → PostgreSQL using only synthetic fixtures. Sprint 063C
deferred status mutation to Sprint 066.

Sprints 065A / 065B / 065C1 / 065C2 / 065C3 added a separate
fixture-driven home-feed extractor, a profile-bound run lifecycle,
home-feed ingestion through `POST /collector/content-items/home-feed`,
and a bounded operator-invoked runner. None of these sprints exposed
status mutation for `SourcePublisher`.

Sprint 066 surfaces the existing `UpdateSourcePublisherStatusUseCase`
as a single safe HTTP route and adds the matching unit, PostgreSQL-backed
integration, and Playwright E2E coverage plus sprint documentation.
It does not add Web UI, SourceGroup promotion, bulk actions,
deletion, migrations, repository changes, status-transition rules,
browser behavior, schedulers, workers, Docker services, Collector
Runtime HTTP client changes, or Content Builder / Content Publisher
behavior.

## Capability Summary

- Strict zod body schema
  `UpdateSourcePublisherStatusHttpBodySchema` whose only field is
  `status: "DISCOVERED" | "APPROVED" | "IGNORED" | "BLOCKED"` and
  which rejects unknown fields and `null` values.
- Matching `as const` JSON-schema body
  `sourcePublisherStatusBodyJsonSchema` wired into the new route
  schema `updateSourcePublisherStatusHttpRouteSchema` so Fastify's
  pre-handler rejects malformed bodies with HTTP 400 before the
  handler runs.
- Reuse of the existing `SourcePublisherIdHttpParamsSchema` for the
  path parameter and of the existing `sourcePublisherJsonSchema` for
  the response envelope. The handler returns
  `{ sourcePublisher: toSourcePublisherDto(sourcePublisher) }` so
  optional `displayName` and `canonicalUrl` continue to be omitted
  when absent (never emitted as `null`).
- `ContentManagerHttpService` interface extended with a new
  `updateSourcePublisherStatus: ExecutableUseCase<UpdateSourcePublisherStatusInput, SourcePublisher>`
  field. The existing Content Manager container already instantiates
  the use case, so no container change is required.
- Stub-backed unit tests cover the happy path (every status value),
  strict-body rejection of unknown fields, strict-body rejection of
  empty body, strict-body rejection of `null` status, validation
  rejection of an invalid status string, mapping of a missing
  publisher to HTTP 404 `SOURCE_PUBLISHER_NOT_FOUND`, and the safe
  DTO contract (optional fields omitted when absent, no sensitive
  keys leak).
- PostgreSQL-backed HTTP integration coverage (gated by
  `RUN_HTTP_DB_TESTS=true`) follows the existing Sprint 063C
  observe → PATCH → GET round-trip and confirms the new status is
  durably persisted.
- Playwright E2E spec asserts observe → PATCH → GET through the
  Nginx web-gateway baseURL with synthetic fixtures only.

## Routes

| Method | Path                                                 | Handler                                  | Response |
| ------ | ---------------------------------------------------- | ---------------------------------------- | -------- |
| PATCH  | `/collector/source-publishers/:sourcePublisherId/status` | `UpdateSourcePublisherStatusUseCase`     | 200 `{ sourcePublisher: SourcePublisherDto }` |

## Request Schema

Strict zod body:

```ts
const UpdateSourcePublisherStatusHttpBodySchema = z
  .object({
    status: SourcePublisherStatusSchema,
  })
  .strict();
```

Strict JSON-schema body:

```json
{
  "type": "object",
  "required": ["status"],
  "additionalProperties": false,
  "properties": {
    "status": {
      "type": "string",
      "enum": ["DISCOVERED", "APPROVED", "IGNORED", "BLOCKED"]
    }
  }
}
```

The path parameter `:sourcePublisherId` is validated by the existing
`SourcePublisherIdHttpParamsSchema` (`SourcePublisherIdSchema`,
non-empty string). The body MUST be exactly `{ "status": "..." }`;
unknown fields, missing `status`, and `null` status all map to HTTP
400 `VALIDATION_ERROR`.

## Response Schema

The 200 response is the existing safe `SourcePublisherDto` envelope:

```json
{
  "type": "object",
  "required": ["sourcePublisher"],
  "additionalProperties": false,
  "properties": {
    "sourcePublisher": { /* sourcePublisherJsonSchema */ }
  }
}
```

`sourcePublisherJsonSchema` declares the full safe allowlist
(`id`, `platform`, `kind`, `externalPublisherId`, optional
`displayName`, optional `canonicalUrl`, `status`, `firstObservedAt`,
`lastObservedAt`, `observationCount`, `createdAt`, `updatedAt`) and
omits server-owned fields, raw payloads, sessions, tokens, proxies,
viewer IDs, account IDs, and diagnostic data. Optional fields are
omitted (never emitted as `null`) when absent on the persisted
aggregate.

## Error Mapping

| Application / HTTP error                                  | HTTP status | `error.code`                  |
| --------------------------------------------------------- | ----------- | ----------------------------- |
| `HttpRequestValidationError` (zod strict, Fastify pre-handler) | 400         | `VALIDATION_ERROR`            |
| `ContentValidationError` (zod body)                       | 400         | `CONTENT_VALIDATION_ERROR`    |
| `SourcePublisherNotFoundError`                            | 404         | `SOURCE_PUBLISHER_NOT_FOUND`  |
| Any other unexpected error                                 | 500         | `INTERNAL_SERVER_ERROR`       |

The mapping is fully provided by the existing Content Manager error
mapper. Sprint 066 does not introduce new error codes or new mapping
rules. Stack traces, database errors, and sensitive payloads are
never serialized into HTTP responses.

## Constraints

Sprint 066 does NOT add:

- Web UI work.
- Bulk status actions.
- `SourcePublisher` deletion.
- `SourcePublisher` promotion to `SourceGroup`.
- Creating `SourceGroup` instances from publishers.
- Home-feed execution changes.
- Collector Runtime HTTP client changes.
- Browser automation.
- Workers or schedulers.
- New Docker services.
- Live Facebook validation.
- New status transition rules.
- Migrations.
- Repository redesign.
- Unrelated refactors.
- Any new error-mapping rules.

The Content Manager use case enforces no HTTP-level transition
rules, and Sprint 066 does not add any. The same status is safely
idempotent (the use case returns the existing aggregate without a DB
write when the new status equals the persisted one).

## Verification Commands

```bash
pnpm exec vitest run \
  src/interfaces/http/content-manager.server.test.ts \
  src/interfaces/http/content-manager.server.database.integration.test.ts \
  src/composition/content-manager/content-manager.container.test.ts

pnpm typecheck
pnpm test

pnpm test:e2e:docker

git diff --check
git status --short
```
