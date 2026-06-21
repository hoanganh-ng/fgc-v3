# Sprint 068A: Profile Home-Feed Schedule Foundation

## Goal

Add a durable Collector Runtime-owned schedule model and safe operator HTTP API
for profile-bound Facebook home-feed collection schedules.

This sprint configures schedules only. It does not dispatch due schedules,
execute browser collection, wire the Sprint 059 scheduler poller, add Docker
services, or change the one-shot home-feed executor.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/ROADMAP.md`
- `docs/modules/collector-runtime.md`
- `docs/SPRINTS/SPRINT-058-atomic-scheduled-collection-dispatch.md`
- `docs/SPRINTS/SPRINT-059-scheduled-collection-dispatch-poller.md`
- `docs/SPRINTS/SPRINT-065B-profile-bound-home-feed-run-model.md`
- `docs/SPRINTS/SPRINT-065C3-bounded-facebook-home-feed-execution.md`
- `src/collector-runtime/domain/profile-home-feed-collection-run*`
- `src/collector-runtime/application/profile-home-feed-collection-run-validation.ts`
- `src/collector-runtime/application/use-cases/request-profile-home-feed-collection-run.use-case.ts`
- `src/collector-runtime/application/ports/profile-home-feed-collection-run-repository.port.ts`
- `src/collector-runtime/application/ports/profile-reference.port.ts`
- `src/collector-runtime/domain/collection-schedule*`
- `src/collector-runtime/application/collection-schedule-validation.ts`
- `src/infrastructure/database/schema/collector-runtime.schema.ts`
- `src/infrastructure/database/mappers/collector-runtime.mapper.ts`
- `src/infrastructure/database/repositories/*collection-schedule*`
- `src/infrastructure/database/repositories/*profile-home-feed-collection-run*`
- `src/interfaces/http/routes/collector-runtime.routes.ts`
- `src/interfaces/http/schemas/collector-runtime.http-schemas.ts`
- `src/composition/collector-runtime/collector-runtime.container.ts`
- Nearby tests for the files above

## Capability Summary

- Adds a separate `ProfileHomeFeedCollectionSchedule` aggregate owned by
  Collector Runtime.
- Enforces one schedule per `profileId`, with `profileId` as the durable row
  identity.
- Validates schedule fields strictly:
  - `profileId` must be non-empty.
  - `intervalMinutes` must be an integer from `1..10080`.
  - `nextRunAt`, `createdAt`, and `updatedAt` must be ISO datetimes with an
    offset.
  - `parameters` reuse the existing profile home-feed run parameter validation
    for `maxScrolls`, `maxDurationMs`, and `maxPosts`.
- Keeps optional parameter omission as omission. `null` is not accepted as a
  substitute for an omitted parameter.
- Adds application use cases:
  - `CreateOrUpdateProfileHomeFeedCollectionScheduleUseCase`
  - `GetProfileHomeFeedCollectionScheduleUseCase`
  - `ListProfileHomeFeedCollectionSchedulesUseCase`
- Create/update validates profile existence through the existing
  `ProfileReferencePort`, preserves `createdAt` on update, and updates
  `updatedAt` on every write.
- List supports optional `enabled`, `limit`, and `offset`, ordered by
  `nextRunAt ASC`, then `profileId ASC`.
- Adds an in-memory repository for unit tests.
- Adds PostgreSQL persistence through
  `collector_profile_home_feed_collection_schedules`, with no foreign key to
  Collector Profile Manager tables.
- Adds safe operator HTTP routes:
  - `PUT /collector/profile-home-feed-collection-schedules/:profileId`
  - `GET /collector/profile-home-feed-collection-schedules/:profileId`
  - `GET /collector/profile-home-feed-collection-schedules`
- The safe DTO allowlist is exactly schedule identity, cadence, parameters, and
  timestamps: `profileId`, `enabled`, `intervalMinutes`, `nextRunAt`,
  `parameters`, `createdAt`, and `updatedAt`.

## Persistence

Migration:

- `drizzle/0025_profile_home_feed_collection_schedules.sql`

Table:

- `collector_profile_home_feed_collection_schedules`

Columns:

- `profile_id` primary key
- `enabled`
- `interval_minutes`
- `next_run_at`
- `parameters` JSONB
- `created_at`
- `updated_at`

Indexes:

- `collector_phf_schedules_due_idx` on
  `enabled, next_run_at, profile_id`
- `collector_phf_schedules_next_idx` on
  `next_run_at, profile_id`

The table intentionally has no foreign key to Collector Profile Manager. The
profile id remains an external module reference validated through
`ProfileReferencePort`.

## HTTP Contract

`PUT /collector/profile-home-feed-collection-schedules/:profileId`

Strict body:

```json
{
  "enabled": true,
  "intervalMinutes": 60,
  "nextRunAt": "2026-06-21T10:00:00.000Z",
  "maxScrolls": 3,
  "maxDurationMs": 30000,
  "maxPosts": 20
}
```

`maxScrolls`, `maxDurationMs`, and `maxPosts` are optional. Unknown fields,
missing required fields, `null`, invalid intervals, invalid timestamps, and
invalid parameters are rejected.

Single response:

```json
{
  "schedule": {
    "profileId": "profile-1",
    "enabled": true,
    "intervalMinutes": 60,
    "nextRunAt": "2026-06-21T10:00:00.000Z",
    "parameters": {},
    "createdAt": "2026-06-21T09:00:00.000Z",
    "updatedAt": "2026-06-21T09:00:00.000Z"
  }
}
```

List response:

```json
{
  "items": [],
  "page": {
    "limit": 50,
    "offset": 0,
    "total": 0
  }
}
```

## Security

The schedule model, DTOs, tests, docs, and migration do not persist or expose
cookies, localStorage, tokens, authorization headers, proxy credentials,
trusted runtime configuration, raw HTML, raw GraphQL, screenshots, viewer ids,
account private payloads, browser diagnostics, or other private runtime data.

## Out Of Scope

- Dispatching due schedules into `ProfileHomeFeedCollectionRun`.
- Adding a `SCHEDULED` trigger type to home-feed runs.
- Wiring the Sprint 059 scheduler poller.
- Worker changes.
- Browser execution.
- Live Facebook validation.
- Profile checkout or lease logic.
- Content Manager changes.
- Web UI.
- Docker service changes.
- Retry/backoff policy beyond storing basic cadence.
- Bulk scheduling.
- SourcePublisher review or promotion changes.
- Content Builder or Content Publisher behavior.

## Status

Sprint 068A is **accepted** at
`fe14d016e364724df354c2816c5d3f75abda8703`.

Sprint 068B-D is the active design-only scheduled-dispatch sprint. It
does not implement dispatch, add migrations, wire pollers or workers,
or execute browser collection.

Sprint 068B or any later dispatch/poller wiring remains future work and
is not started by this sprint.
