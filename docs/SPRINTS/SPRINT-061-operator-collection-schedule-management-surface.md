# Sprint 061: Operator Collection Schedule Management Surface

## Goal

Expose the existing `CollectionSchedule` aggregate to operators through
HTTP routes and a Web UI management page. Sprint 057 introduced the
domain, persistence, and the `Upsert` / `Get` / `List` use cases.
Sprints 058–060 turned the schedule into a live, schedulable
configuration. Sprint 061 closes the operator feedback loop by adding
the read and write surface that the Web UI uses, the Web UI itself,
and a small compatibility fix for the existing `SCHEDULED` run
trigger type.

The Collector Runtime already owns the `CollectionSchedule` domain,
the `CollectionScheduleRepository` port, the `InMemoryCollectionScheduleRepository`
in test support, the `DrizzleCollectionScheduleRepository` adapter,
and the `UpsertCollectionScheduleUseCase`,
`GetCollectionScheduleUseCase`, and `ListCollectionSchedulesUseCase`
application use cases. This sprint does not redesign those layers.

## Capability Summary

- Backend HTTP routes (added under `/collector/collection-schedules`):
  - `GET /collector/collection-schedules` — list schedules with
    `limit` / `offset` paging and exact `total`.
  - `GET /collector/collection-schedules/:sourceGroupId` — fetch a
    single schedule by source group id.
  - `PUT /collector/collection-schedules/:sourceGroupId` — upsert a
    schedule. The path is the only place `sourceGroupId` appears.
- The backend reuses `UpsertCollectionScheduleUseCase`,
  `GetCollectionScheduleUseCase`, and `ListCollectionSchedulesUseCase`
  unchanged. Error mappings already wired in Sprint 057 remain in
  effect: `400` for validation, `404` for not found, `409` for
  business conflict, and a sanitized `502` for unexpected source
  group lookup failures.
- Strict Zod schemas for body, params, and querystring; strict JSON
  Schema route definitions matching the existing convention.
- A safe DTO mapper for `CollectionSchedule`; null-vs-omission
  semantics preserved for optional parameters.
- Web UI:
  - A new "Schedules" navigation entry and a `/collection-schedules`
    route.
  - A paginated list of all `CollectionSchedule` records with
    source-group name / status / id, enabled state, interval,
    next-run timestamp, optional `maxScrolls` / `maxDurationMs`,
    and `updatedAt`.
  - An operator page that supports creating a new schedule,
    editing an existing one, enabling, and disabling it. The
    `sourceGroupId` is locked while editing; creating a new
    schedule requires selecting one.
  - Datetime-local fields are converted explicitly to ISO datetimes
    with offset before being sent to the backend. Datetimes are
    displayed in the operator's local timezone.
  - Empty optional numeric fields are omitted from the PUT body
    rather than sent as `null`, preserving null-vs-omission.
  - Field-level and backend errors are surfaced through the existing
    `FormField` / `BackendErrorPanel` components.
  - Relevant schedule queries are invalidated after a successful
    save.
  - Deletion, bulk actions, cron / timezone cadence, run-now,
    scheduler health / logs, and a JSON editor are not in scope.
- The existing Content Manager source-group client (already safe) is
  used for presentation: the schedules page reads source groups
  through `useSourceGroupsQuery` rather than calling
  `Collector Runtime` source-group endpoints.
- Compatibility fix: the Web UI Collector Runtime client schema is
  updated so `CollectionRunTriggerTypeSchema` accepts `SCHEDULED`
  in addition to `MANUAL_API`. A regression test asserts that a
  `CollectionRunsListResponse` containing a scheduled run is
  accepted by the response schema. The Collection Runs page is not
  otherwise redesigned.

## Architecture

```
HTTP layer (src/interfaces/http/)
  schemas/collector-runtime.http-schemas.ts
    CollectionScheduleSourceGroupIdHttpParamsSchema
    UpsertCollectionScheduleHttpBodySchema
    ListCollectionSchedulesHttpQuerySchema
    collectionScheduleJsonSchema
    listCollectionSchedulesHttpRouteSchema
    getCollectionScheduleHttpRouteSchema
    upsertCollectionScheduleHttpRouteSchema
  routes/collector-runtime.routes.ts
    registerCollectorRuntimeRoutes() gains three routes
    CollectorRuntimeHttpService gains upsertCollectionSchedule,
      getCollectionSchedule, listCollectionSchedules
    toCollectionScheduleDto() maps a CollectionSchedule to a safe
      DTO (parameters: only set keys are spread)

Web UI (apps/web/src/)
  lib/api/collector-runtime-client.ts
    CollectionRunTriggerTypeSchema accepts "MANUAL_API" and "SCHEDULED"
    CollectionScheduleSchema, CollectionScheduleListResponseSchema,
      CollectionScheduleResponseSchema
    UpsertCollectionScheduleRequestSchema
    Client gains listCollectionSchedules, getCollectionSchedule,
      upsertCollectionSchedule
  features/collector-runtime/collection-schedule-queries.ts
    collectionScheduleQueryKeys, useCollectionSchedulesQuery,
    useCollectionScheduleQuery
  features/collector-runtime/collection-schedule-mutations.ts
    useUpsertCollectionScheduleMutation (invalidates schedule keys
      and collection-run keys on success)
  features/collector-runtime/collection-schedule-view-model.ts
    toUpsertCollectionScheduleRequest (form -> API, requires parsed intervalMinutes)
    formatLocalDateTimeSeconds (renders local timezone for next-run/updated)
    toLocalDateTimeInputValue (ISO -> datetime-local)
    toIsoDateTimeWithOffset (datetime-local -> ISO with offset)
    filterSchedulableSourceGroups (FACEBOOK + ACTIVE/PAUSED/ARCHIVED)
    excludeScheduledSourceGroups (hides already-scheduled groups from the
      create selector)
  pages/collection-schedules-page.tsx (new)
  app/router.tsx (adds the /collection-schedules route)
  app/navigation.ts (adds the "Schedules" entry)
  features/collector-runtime/collection-schedule-view-model.test.ts
  features/collector-runtime/collection-schedule-page.test.tsx
  features/collector-runtime/collection-run-client.test.ts
    (extended regression test for SCHEDULED response)
```

No domain, repository, schema, migration, scheduler, dispatch,
worker, or browser behavior changes. Sprint 057's
`InMemoryCollectionScheduleRepository`,
`DrizzleCollectionScheduleRepository`, and the three use cases are
reused unchanged. Sprint 059's scheduler CLI and Sprint 060's
container image are untouched.

## Invariants

- One schedule per `sourceGroupId`. The path is the only place
  `sourceGroupId` appears in the request — the PUT body omits it.
- `intervalMinutes` is an integer from `1` through `10080` (matching
  the existing schedule CHECK constraint).
- `nextRunAt` is an absolute ISO datetime with offset. The Web UI
  converts the operator's `datetime-local` input to a timezone-aware
  ISO datetime using the operator's local offset before submitting;
  responses are rendered in the operator's local timezone.
- Enabled schedules require `ACTIVE` Facebook source groups.
  Disabled schedules may reference `PAUSED` or `ARCHIVED` Facebook
  groups. The use case enforces this; the Web UI presents the
  operator's selection as the form value and the use case rejects
  invalid combinations.
- `createdAt` is preserved on upsert and `updatedAt` is bumped by
  the existing application use case.
- Disabling, not deletion, is the lifecycle mechanism.

## Decisions Log

- **Reuse the existing use cases**: the backend reuses
  `UpsertCollectionScheduleUseCase`, `GetCollectionScheduleUseCase`,
  and `ListCollectionSchedulesUseCase` unchanged. No new application
  code or new domain schemas are introduced.
- **Path-only `sourceGroupId`**: the PUT body omits
  `sourceGroupId`. The path is the only place it appears in the
  request, eliminating a class of validation conflicts between
  body and path.
- **Safe DTO**: the route mapper spreads the domain schedule into
  a DTO with explicit null-vs-omission handling for the optional
  numeric `parameters.maxScrolls` and `parameters.maxDurationMs`.
- **Local timezone display**: the page renders all `nextRunAt` and
  `updatedAt` values through `Intl.DateTimeFormat` so the operator
  sees their local timezone. Input goes through
  `toIsoDateTimeWithOffset` so the backend always sees an absolute
  ISO datetime with offset.
- **Omit empty numerics**: the page omits empty `maxScrolls` /
  `maxDurationMs` fields from the PUT body. The view-model does not
  send `null` for empty inputs.
- **`useSourceGroupsQuery` for presentation**: the schedules page
  reuses the existing safe Content Manager source-group client for
  presentation rather than calling the Collector Runtime
  source-group endpoints. This avoids touching
  `CollectorRuntimeHttpService` to add a "for presentation" source
  group listing.
- **Lock `sourceGroupId` while editing**: the form's source-group
  field is read-only when the user is editing an existing schedule.
  Operators who want to change the source group must create a new
  schedule (the existing `Upsert` use case preserves `createdAt`
  on the same `sourceGroupId`).
- **Invalidate relevant queries**: the mutation invalidates
  collection-schedule and collection-run query keys on success so
  the Collection Runs page refetches when a scheduled run changes.

## File Manifest

### Create

- `docs/SPRINTS/SPRINT-061-operator-collection-schedule-management-surface.md`
- `apps/web/src/pages/collection-schedules-page.tsx`
- `apps/web/src/features/collector-runtime/collection-schedule-queries.ts`
- `apps/web/src/features/collector-runtime/collection-schedule-mutations.ts`
- `apps/web/src/features/collector-runtime/collection-schedule-view-model.ts`
- `apps/web/src/features/collector-runtime/collection-schedule-view-model.test.ts`
- `apps/web/src/features/collector-runtime/collection-schedule-page.test.tsx`

### Modify

- `docs/SPRINTS/active.md` — mark Sprint 060 accepted and Sprint 061
  active.
- `docs/PROJECT_SNAPSHOT.md` — correct the current-sprint section,
  the immediate-next-work section, and broaden the
  "scheduler-runtime" wording to the precise statement required by
  the sprint.
- `src/interfaces/http/schemas/collector-runtime.http-schemas.ts` —
  add schedule HTTP schemas and route JSON schemas.
- `src/interfaces/http/routes/collector-runtime.routes.ts` — add
  the three schedule routes, the safe DTO mapper, and extend
  `CollectorRuntimeHttpService`.
- `src/interfaces/http/test-support/collector-runtime-http-service.ts`
  — add the three schedule stub use cases and a
  `createCollectionSchedule` helper.
- `src/interfaces/http/collector-runtime.server.test.ts` — add
  focused schedule route tests.
- `apps/web/src/lib/api/collector-runtime-client.ts` — add schedule
  schemas, request/response types, and client methods; extend
  `CollectionRunTriggerTypeSchema` to accept `SCHEDULED`.
- `apps/web/src/features/collector-runtime/collection-run-client.test.ts`
  — add the `SCHEDULED` regression test.
- `apps/web/src/app/router.tsx` — add the `/collection-schedules`
  route.
- `apps/web/src/app/navigation.ts` — add the "Schedules" entry.

## Test Matrix

| Requirement                                                                 | Test file                                                                                       |
|-----------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| Strict `ListCollectionSchedules` and `GetCollectionSchedule` response schemas | `src/interfaces/http/collector-runtime.server.test.ts`                                          |
| `GET /collector/collection-schedules` lists and paginates                   | `src/interfaces/http/collector-runtime.server.test.ts`                                          |
| `GET /collector/collection-schedules/:sourceGroupId` 404s when missing     | `src/interfaces/http/collector-runtime.server.test.ts`                                          |
| `PUT /collector/collection-schedules/:sourceGroupId` happy path; safe DTO    | `src/interfaces/http/collector-runtime.server.test.ts`                                          |
| `PUT` accepts an empty `parameters` object and the safe DTO stays empty    | `src/interfaces/http/collector-runtime.server.test.ts`                                          |
| `PUT` 400 when the body omits `parameters`                                 | `src/interfaces/http/collector-runtime.server.test.ts`                                          |
| `PUT` 400 on invalid body (interval out of range, non-ISO nextRunAt)        | `src/interfaces/http/collector-runtime.server.test.ts`                                          |
| `PUT` 404 on missing source group; 409 on PAUSED+enabled; 409 on non-FB     | `src/interfaces/http/collector-runtime.server.test.ts`                                          |
| `PUT` 502 on unexpected source group lookup failure                         | `src/interfaces/http/collector-runtime.server.test.ts`                                          |
| `CollectionRunTriggerTypeSchema` accepts `SCHEDULED`                       | `apps/web/src/features/collector-runtime/collection-run-client.test.ts`                         |
| `CollectionSchedule` request / response schemas are strict                  | `apps/web/src/features/collector-runtime/collection-schedule-view-model.test.ts`                 |
| `UpsertCollectionScheduleRequestSchema` requires `parameters` and accepts `parameters: {}` | `apps/web/src/features/collector-runtime/collection-schedule-view-model.test.ts` |
| Form schema rejects the complete empty form shape (no one-minute fallback) | `apps/web/src/features/collector-runtime/collection-schedule-view-model.test.ts`                 |
| `toUpsertCollectionScheduleRequest` requires a parsed `intervalMinutes` number | `apps/web/src/features/collector-runtime/collection-schedule-view-model.test.ts`                |
| Datetime conversion (local -> ISO with offset; ISO -> local input)          | `apps/web/src/features/collector-runtime/collection-schedule-view-model.test.ts`                 |
| `toUpsertCollectionScheduleRequest` omits empty optionals                   | `apps/web/src/features/collector-runtime/collection-schedule-view-model.test.ts`                 |
| `excludeScheduledSourceGroups` filters already-scheduled groups             | `apps/web/src/features/collector-runtime/collection-schedule-view-model.test.ts`                 |
| Schedules page renders list with source-group metadata (smoke render)       | `apps/web/src/features/collector-runtime/collection-schedule-page.test.tsx`                     |
| Schedules page does not issue an unsupported source-group `limit: 200`     | `apps/web/src/features/collector-runtime/collection-schedule-page.test.tsx`                     |
| Schedules page renders a partial source-group inventory warning             | `apps/web/src/features/collector-runtime/collection-schedule-page.test.tsx`                     |
| Collection-schedule mutation invalidates `collectionScheduleQueryKeys.all` and `collectionRunQueryKeys.all` | `apps/web/src/features/collector-runtime/collection-schedule-mutations.test.ts`     |

## Out Of Scope

- Domain, repository, schema, migration, scheduler, dispatch, worker,
  or browser behavior changes.
- Collection schedule deletion, bulk actions, cron / timezone
  cadence, run-now, scheduler health / logs, JSON editor.
- Composition root changes (the new routes are added in the HTTP
  layer; the container's `upsertCollectionSchedule` /
  `getCollectionSchedule` / `listCollectionSchedules` use cases
  are already wired and reused).
- Collection Profile Manager, Content Manager, or worker changes.
- Docker or Compose changes.
- Commits, pushes, marking the sprint complete, or moving to the
  next sprint.

## Verification

```bash
pnpm typecheck
pnpm test src/interfaces/http/collector-runtime.server.test.ts
pnpm test src/collector-runtime
pnpm test
pnpm web:typecheck
pnpm web:build
git diff --check
```

When local runtime resources permit:

- `pnpm test:http:db` against the existing dev / preview database.
- Manual API checks:
  - `GET /collector/collection-schedules` returns an empty page
    initially.
  - `PUT /collector/collection-schedules/<active-fb-source-group>`
    creates a schedule and returns the persisted record.
  - `GET /collector/collection-schedules/<active-fb-source-group>`
    returns the persisted record.
  - `PUT` with `enabled: true` against a `PAUSED` source group
    returns `409 COLLECTION_SCHEDULE_SOURCE_GROUP_NOT_ACTIVE`.
  - `PUT` with `intervalMinutes: 0` returns `400`.
- Manual UI checks:
  - Schedules page lists persisted schedules with source-group
    metadata, enabled state, interval, next-run, and `updatedAt`.
  - New schedule form accepts an `ACTIVE` Facebook source group
    and persists it.
  - Editing a schedule locks the `sourceGroupId` field and
    enables / disables the schedule.
  - The Collection Runs page accepts a `SCHEDULED` run in its list
    response (the existing list is unchanged; the regression test
    proves the schema accepts it).

Live validation is reported separately and not claimed here. Any
limitations are reported alongside the verification output.

## Sprint Status

Sprint 060 is accepted and recorded as the containerized scheduler
foundation for Sprint 061. Sprint 061 is implemented as the operator
collection schedule management surface: three backend HTTP routes
that reuse the Sprint 057 use cases, a Web UI schedules page with
list / create / edit / enable / disable, a `SCHEDULED` regression
fix in the Web UI Collector Runtime client, and a small schedule
view-model that converts operator-local datetimes to absolute ISO
datetimes with offset. It does not advance beyond its declared scope.

### Sprint 061 Corrections

A correction pass was applied to Sprint 061 without advancing the
sprint scope. The corrections:

- Replace the unsupported `limit: 200` source-group query with the
  Content Manager default `limit: 100`. Surface loading, error,
  retry, and unavailable states for `useSourceGroupsQuery`, and add
  a partial-inventory warning when `page.total > items.length`,
  mirroring the existing `source-group-profile-access-panel`
  pattern.
- Make `intervalMinutes` truly required. Empty input now fails form
  validation and the `?? MIN_INTERVAL_MINUTES` request fallback is
  removed.
- Exclude source groups that already have a schedule from the create
  selector; surface an explicit "every loaded eligible source group
  already has a schedule" state when the filtered list is empty.
- Render an edit-mode loading state until the schedule detail query
  resolves and an error/retry state on detail failure. Disable
  submission until the detail query loads successfully.
- Restore the approved complete PUT contract: `parameters` required
  (with `{}` valid) and `maxScrolls` / `maxDurationMs` individually
  optional — applied to the Zod body schema, the Fastify JSON schema
  `required` list, and the Web UI client request schema.
- Update Sprint 060 wording to the precise scheduler-runtime scope.
- Correct the Sprint 061 Test Matrix to match the real coverage
  (and remove the nonexistent `formatScheduleForDisplay`
  reference).
