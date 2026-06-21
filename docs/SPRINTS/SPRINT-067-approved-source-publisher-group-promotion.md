# Sprint 067: Approved Source Publisher Group Promotion

## Goal

Expose a safe Content Manager HTTP contract that promotes an
already `APPROVED` Facebook `GROUP` `SourcePublisher` into a managed
`PAUSED` `SourceGroup`:

`POST /collector/source-publishers/:sourcePublisherId/promote-to-source-group`

The route delegates to a new Content Manager application use case,
`PromoteSourcePublisherToSourceGroupUseCase`, and reuses the existing
safe `SourceGroupDto` allowlist. The route never mutates the
`SourcePublisher.status`, never activates the new `SourceGroup`, never
schedules it, never joins it, and never executes a browser.

## Context

Sprint 063A accepted the Content Manager domain and application
behavior for `SourcePublisher`. Sprint 063B accepted PostgreSQL
persistence and the atomic observation algorithm. Sprint 063C exposed
the read-side HTTP surface (`POST .../observations`, `GET ...`,
`GET .../:sourcePublisherId`) and Sprint 066 exposed the status
mutation HTTP contract (`PATCH .../:sourcePublisherId/status`).

Sprint 067 closes the gap between the reviewed `APPROVED`
`SourcePublisher` identity and a managed `SourceGroup` record by
adding an explicit, narrow promotion path. The promotion flow:

- runs entirely through the existing Content Manager application
  layer,
- enforces the `platform === "FACEBOOK"`, `kind === "GROUP"`, and
  `status === "APPROVED"` preconditions on the durable
  `SourcePublisher`,
- resolves the new `SourceGroup` fields from the persisted publisher
  plus the HTTP body without inventing a Facebook URL,
- persists a `PAUSED` `SourceGroup` (with the standard default
  `DIRECT_GROUP_URL` entry route) and reuses the existing
  `SourceGroupRepository.findByPlatformAndExternalGroupId` to
  short-circuit when one already exists, and
- never mutates the durable `SourcePublisher` review status or
  observation counts.

Sprint 067 does not add Web UI, scheduler, worker, browser behavior,
automatic group join, activation, scheduling, or Content Builder /
Content Publisher behavior. `SourcePublisher` remains the
Content Manager-owned durable publishing-source identity and is
distinct from the future `Content Publisher` pipeline stage.

## Capability Summary

- A new Content Manager application use case
  `PromoteSourcePublisherToSourceGroupUseCase` with input:
  - `sourcePublisherId`
  - `categoryId`
  - `collectionPriority` (integer `0..100`)
  - optional `name`
  - optional `url`
  - optional `notes`

  The use case returns a discriminated result:

  ```ts
  interface PromoteSourcePublisherToSourceGroupResult {
    readonly sourceGroup: SourceGroup;
    readonly outcome: "CREATED" | "ALREADY_EXISTS";
  }
  ```

- Preconditions enforced inside the use case:
  - `platform === "FACEBOOK"` (else
    `SourcePublisherNotPromotableError(reason = "NOT_FACEBOOK")`).
  - `kind === "GROUP"` (else
    `SourcePublisherNotPromotableError(reason = "NOT_GROUP")`).
  - `status === "APPROVED"` (else
    `SourcePublisherNotPromotableError(reason = "NOT_APPROVED")`).
  - `SourcePublisherRepository.findById` returning `null` raises
    `SourcePublisherNotFoundError`.
  - `ContentCategoryRepository.findById` returning `null` raises
    `ContentCategoryNotFoundError`.
  - Missing URL (neither input nor `canonicalUrl`) raises
    `SourcePublisherNotPromotableError(reason = "MISSING_URL")` so
    the new `SourceGroup` is never persisted without an entry-route
    URL. The missing-URL failure is a promotion precondition, not
    a missing publisher.

- `SourceGroup` fields are resolved deterministically:

  | Field                | Source                                                   |
  | -------------------- | -------------------------------------------------------- |
  | `platform`           | `sourcePublisher.platform`                               |
  | `externalGroupId`    | `sourcePublisher.externalPublisherId`                    |
  | `name`               | `input.name ?? sourcePublisher.displayName ?? sourcePublisher.externalPublisherId` |
  | `url`                | `input.url ?? sourcePublisher.canonicalUrl`              |
  | `categoryId`         | `input.categoryId`                                       |
  | `status`             | `"PAUSED"`                                               |
  | `collectionPriority` | `input.collectionPriority`                               |
  | `notes`              | `input.notes` (omitted when absent)                      |
  | `entryRoutes`        | `[createDefaultSourceGroupEntryRoute({ url, createdAt, updatedAt })]` |

- Existing-source matching happens before save through
  `SourceGroupRepository.findByPlatformAndExternalGroupId`. When a
  matching `SourceGroup` is found the use case returns it with
  `outcome = "ALREADY_EXISTS"`. When none is found a new `PAUSED`
  `SourceGroup` is saved and the use case returns
  `outcome = "CREATED"`. The same identity check is repeated
  immediately before save as a best-effort duplicate short-circuit;
  the tested interleaving returns `ALREADY_EXISTS` instead of
  double-persisting, but the use case does not implement a full
  concurrency-safe duplicate-save handler.

- The `SourcePublisher` review status and observation counts are
  never mutated by the use case. Promotion is review-status neutral.

- The Content Manager composition container now exposes
  `promoteSourcePublisherToSourceGroup` alongside the existing
  use cases. No migration, no Drizzle schema change, no repository
  change, and no status-transition rule is introduced.

- A new strict zod body schema
  `PromoteSourcePublisherToSourceGroupHttpBodySchema` whose only
  required fields are `categoryId` and `collectionPriority
  (0..100)`, and whose optional fields are `name`, `url`, `notes`.
  The schema rejects unknown fields, missing required fields, blank
  strings, `null` values, and out-of-range `collectionPriority`.

- A matching `as const` JSON-schema body
  `promoteSourcePublisherToSourceGroupBodyJsonSchema` and route
  schema
  `promoteSourcePublisherToSourceGroupHttpRouteSchema` are wired into
  the new route so Fastify's pre-handler rejects malformed bodies
  with HTTP 400 before the handler runs.

- The new route
  `POST /collector/source-publishers/:sourcePublisherId/promote-to-source-group`
  is registered next to the existing
  `PATCH .../status` route. The 200 response reuses the existing
  safe `toSourceGroupDto` mapping and adds a typed
  `promotion: { outcome: "CREATED" | "ALREADY_EXISTS" }` field:

  ```json
  {
    "sourceGroup": { /* sourceGroupJsonSchema allowlist */ },
    "promotion": { "outcome": "CREATED" }
  }
  ```

- A new typed application error
  `SourcePublisherNotPromotableError` (code
  `SOURCE_PUBLISHER_NOT_PROMOTABLE`) and a new mapping to HTTP 409
  in `interfaces/http/errors/http-error-mapper.ts`. The four
  `reason` values (`NOT_FACEBOOK`, `NOT_GROUP`, `NOT_APPROVED`,
  `MISSING_URL`) are surfaced on the typed error only and are not
  leaked into the HTTP body.

- Stub-backed HTTP coverage, a focused
  `PromoteSourcePublisherToSourceGroupUseCase` application test
  suite, and an opt-in PostgreSQL-backed HTTP integration test
  (`RUN_HTTP_DB_TESTS=true`) prove the round trip through
  composition → repositories → PostgreSQL and assert the durable
  `PAUSED` status, the `DIRECT_GROUP_URL` default entry route, the
  `ALREADY_EXISTS` short-circuit, the unchanged `SourcePublisher`
  review status, and that no sensitive payload, cookie, token,
  authorization header, viewer id, account id, screenshot, or
  proxy credential ever appears in any response.

## Routes

| Method | Path                                                                          | Handler                                              | Response |
| ------ | ----------------------------------------------------------------------------- | ---------------------------------------------------- | -------- |
| POST   | `/collector/source-publishers/:sourcePublisherId/promote-to-source-group` | `PromoteSourcePublisherToSourceGroupUseCase`         | 200 `{ sourceGroup: SourceGroupDto, promotion: { outcome: "CREATED" \| "ALREADY_EXISTS" } }` |

## Request Schema

Strict zod body:

```ts
const PromoteSourcePublisherToSourceGroupHttpBodySchema = z
  .object({
    categoryId: ContentCategoryIdSchema,
    collectionPriority: z.number().int().min(0).max(100),
    name: NonEmptyStringHttpSchema.optional(),
    url: NonEmptyStringHttpSchema.optional(),
    notes: NonEmptyStringHttpSchema.optional(),
  })
  .strict();
```

Strict JSON-schema body:

```json
{
  "type": "object",
  "required": ["categoryId", "collectionPriority"],
  "additionalProperties": false,
  "properties": {
    "categoryId": { "type": "string", "minLength": 1 },
    "collectionPriority": { "type": "integer", "minimum": 0, "maximum": 100 },
    "name": { "type": "string", "minLength": 1 },
    "url": { "type": "string", "minLength": 1 },
    "notes": { "type": "string", "minLength": 1 }
  }
}
```

The path parameter `:sourcePublisherId` is validated by the
existing `SourcePublisherIdHttpParamsSchema`
(`SourcePublisherIdSchema`, non-empty string). The body MUST carry
`categoryId` and `collectionPriority`; unknown fields, missing
required fields, blank strings, `null` values, and an
out-of-range `collectionPriority` all map to HTTP 400
`VALIDATION_ERROR`.

## Response Schema

The 200 response reuses the existing safe `sourceGroupJsonSchema`
envelope plus the discriminated `promotion` block:

```json
{
  "type": "object",
  "required": ["sourceGroup", "promotion"],
  "additionalProperties": false,
  "properties": {
    "sourceGroup": { /* sourceGroupJsonSchema */ },
    "promotion": {
      "type": "object",
      "required": ["outcome"],
      "additionalProperties": false,
      "properties": {
        "outcome": { "type": "string", "enum": ["CREATED", "ALREADY_EXISTS"] }
      }
    }
  }
}
```

`sourceGroupJsonSchema` continues to be the existing safe allowlist
(id, platform, externalGroupId, name, url, categoryId, status,
collectionPriority, optional notes, entryRoutes, createdAt,
updatedAt) and omits server-owned fields, raw payloads, sessions,
tokens, proxies, viewer IDs, account IDs, and diagnostic data.
Optional `notes` is omitted (never emitted as `null`) when absent on
the persisted aggregate. The new `promotion` block carries only the
typed `outcome` value.

## Error Mapping

| Application / HTTP error                          | HTTP status | `error.code`                          |
| ------------------------------------------------- | ----------- | ------------------------------------- |
| `HttpRequestValidationError` (zod strict, Fastify pre-handler) | 400 | `VALIDATION_ERROR`                    |
| `ContentValidationError` (zod body)               | 400         | `CONTENT_VALIDATION_ERROR`            |
| `SourcePublisherNotFoundError`                    | 404         | `SOURCE_PUBLISHER_NOT_FOUND`          |
| `ContentCategoryNotFoundError`                    | 404         | `CONTENT_CATEGORY_NOT_FOUND`          |
| `SourcePublisherNotPromotableError`               | 409         | `SOURCE_PUBLISHER_NOT_PROMOTABLE`     |
| `SourceGroupAlreadyExistsError`                   | 409         | `SOURCE_GROUP_ALREADY_EXISTS`         |
| Any other unexpected error                         | 500         | `INTERNAL_SERVER_ERROR`               |

`SOURCE_PUBLISHER_NOT_PROMOTABLE` is a new mapping rule. The typed
`reason` field is held on the application error object only; it is
not serialized into the HTTP body. When neither the input URL nor
the publisher `canonicalUrl` can supply the new `SourceGroup` URL
the use case raises
`SourcePublisherNotPromotableError(reason = "MISSING_URL")` and the
HTTP route maps it to HTTP 409 `SOURCE_PUBLISHER_NOT_PROMOTABLE`, so
a missing URL never silently produces a `SourceGroup` without an
entry route. The mapping is otherwise fully provided by the existing
Content Manager error mapper. Stack traces, database errors, and
sensitive payloads are never serialized into HTTP responses.

## Constraints

Sprint 067 does NOT add:

- Web UI work.
- Bulk promotion of multiple `SourcePublisher` records.
- `PAGE` promotion.
- Automatic group join, activation, scheduling, or profile-source
  access changes.
- Browser automation or live Facebook validation.
- Workers, schedulers, or Docker service changes.
- Migrations, Drizzle schema changes, or repository redesign.
- New status transition rules.
- Any new error-mapping rule beyond the single
  `SOURCE_PUBLISHER_NOT_PROMOTABLE → 409` mapping.
- A promotion history table.
- Content Builder / Content Publisher behavior.
- Any change to the future Content Builder / Content Publisher
  pipeline meaning.

`SourcePublisher` continues to be distinct from
`SourceGroup` and from the future Content Publisher pipeline
stage. Promotion never changes the durable `SourcePublisher`
review status or observation counts.

## Verification Commands

```bash
pnpm exec vitest run \
  src/content-manager/application/source-publisher-application.test.ts \
  src/interfaces/http/content-manager.server.test.ts

RUN_HTTP_DB_TESTS=true pnpm exec vitest run \
  src/interfaces/http/content-manager.server.database.integration.test.ts

pnpm typecheck
pnpm test

pnpm test:e2e:docker

git diff --check
git status --short
```
