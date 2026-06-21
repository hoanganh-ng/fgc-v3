# Sprint 068C: Profile Home-Feed Schedule Operator UI

## Goal

Expose the existing `ProfileHomeFeedCollectionSchedule` aggregate to operators
through a Web UI page so they can list, create, edit, enable, and disable
profile-bound Facebook home-feed collection schedules. Sprint 068A introduced
the domain, persistence, and safe operator HTTP routes (`PUT`/`GET list`/`GET
detail`). Sprints 068B1 and 068B2 added scheduled dispatch and
containerization. Sprint 068C closes the operator feedback loop by adding the
read and write surface that the Web UI uses and the Web UI itself.

The backend HTTP routes, `CreateOrUpdate…` / `Get…` / `List…` use cases,
domain rules, persistence, scheduled dispatch, and containerized scheduler /
worker services are all already in place from earlier sprints. This sprint
does not redesign those layers.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/SPRINTS/SPRINT-068A-profile-home-feed-schedule-foundation.md`
- `docs/SPRINTS/SPRINT-068B1-home-feed-scheduled-dispatch-persistence-use-case.md`
- `docs/SPRINTS/SPRINT-068B2-home-feed-scheduler-worker-containerization.md`
- `docs/SPRINTS/SPRINT-061-operator-collection-schedule-management-surface.md`
- `docs/RUNTIME.md`
- `docs/modules/collector-runtime.md`
- `apps/web/src/app/navigation.ts`
- `apps/web/src/app/router.tsx`
- `apps/web/src/lib/api/collector-runtime-client.ts`
- `apps/web/src/lib/api/profile-manager-client.ts`
- `apps/web/src/features/profiles/profile-queries.ts`
- Existing collection schedule UI files and tests in `apps/web/src/`

## Capability Summary

- Web UI client support in `apps/web/src/lib/api/collector-runtime-client.ts`:
  - strict Zod schemas for `ProfileHomeFeedCollectionSchedule`,
    `ProfileHomeFeedCollectionScheduleListResponse`,
    `ProfileHomeFeedCollectionScheduleResponse`, and
    `UpsertProfileHomeFeedCollectionScheduleRequest`
  - exported types and `CollectorRuntimeClient` methods:
    `listProfileHomeFeedCollectionSchedules`,
    `getProfileHomeFeedCollectionSchedule`,
    `upsertProfileHomeFeedCollectionSchedule`
  - `toListProfileHomeFeedCollectionSchedulesQueryParams` for safe query
    string assembly
- React Query hooks in
  `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-queries.ts`:
  - `useProfileHomeFeedCollectionSchedulesQuery`
  - `useProfileHomeFeedCollectionScheduleQuery`
  - stable query keys under `profileHomeFeedCollectionScheduleQueryKeys`
- Production mutation helpers in
  `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-mutations.ts`:
  - `upsertProfileHomeFeedCollectionSchedule` exported helper
  - `invalidateProfileHomeFeedCollectionScheduleQueries` exported
    post-success invalidation helper
  - `useUpsertProfileHomeFeedCollectionScheduleMutation` React Query hook
    delegating to the helpers above
- View-model in
  `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-view-model.ts`:
  - form schema with required `profileId`, required integer
    `intervalMinutes` (1..10080), required `nextRunAtLocal`, and optional
    `maxScrolls`, `maxDurationMs`, `maxPosts`
  - `toUpsertProfileHomeFeedCollectionScheduleRequest` produces a request
    object that never sends `profileId` and never sends `null` for empty
    optional numerics
  - `toIsoDateTimeWithOffset` and `toLocalDateTimeInputValue` perform the
    operator-local datetime conversion
  - `resolveProfileHomeFeedScheduleSubmit` performs an independent create
    conflict probe against the existing schedule resource and short-circuits
    on edit
- New page `apps/web/src/pages/profile-home-feed-collection-schedules-page.tsx`:
  - route `/profile-home-feed-collection-schedules`
  - paginated list of schedules with profile display name, status,
    account stage, and authentication health when available, falling back to
    `profileId` when the profile is not in the loaded summary page
  - create / edit / enable / disable / refresh actions
  - partial-inventory warning when the loaded profile page does not cover
    `page.total`
  - edit-detail loading and error branches with a Retry control
  - editor locks the `profileId` field while editing
- Navigation entry `Home Feed Schedules` under
  `/profile-home-feed-collection-schedules`, reusing the existing
  `CalendarClock` icon.

## Architecture

```
Web UI (apps/web/src/)
  lib/api/collector-runtime-client.ts
    ProfileHomeFeedCollectionScheduleSchema,
      ProfileHomeFeedCollectionScheduleListResponseSchema,
      ProfileHomeFeedCollectionScheduleResponseSchema
    UpsertProfileHomeFeedCollectionScheduleRequestSchema
    Client gains listProfileHomeFeedCollectionSchedules,
      getProfileHomeFeedCollectionSchedule,
      upsertProfileHomeFeedCollectionSchedule
  features/collector-runtime/profile-home-feed-collection-schedule-queries.ts
    profileHomeFeedCollectionScheduleQueryKeys
    useProfileHomeFeedCollectionSchedulesQuery
    useProfileHomeFeedCollectionScheduleQuery
  features/collector-runtime/profile-home-feed-collection-schedule-mutations.ts
    useUpsertProfileHomeFeedCollectionScheduleMutation (invalidates schedule
      keys on success)
    upsertProfileHomeFeedCollectionSchedule (exported production mutation
      helper)
    invalidateProfileHomeFeedCollectionScheduleQueries (exported
      post-success invalidation helper)
  features/collector-runtime/profile-home-feed-collection-schedule-view-model.ts
    toUpsertProfileHomeFeedCollectionScheduleRequest (form -> API, requires
      parsed intervalMinutes)
    formatLocalDateTimeSeconds (renders local timezone for next-run/updated)
    toLocalDateTimeInputValue (ISO -> datetime-local)
    toIsoDateTimeWithOffset (datetime-local -> ISO with offset)
    profileHomeFeedScheduleToFormValues (DTO -> form values, omitting empty
      optionals)
    emptyProfileHomeFeedScheduleFormValues (default create form)
    checkCreateProfileHomeFeedScheduleConflict
      (GET-based create guard, independent of the current list page)
    resolveProfileHomeFeedScheduleSubmit (production submit-decision helper
      that calls the conflict probe for create and short-circuits for edit)
    CREATE_PROFILE_HOME_FEED_SCHEDULE_CONFLICT_EXISTS_MESSAGE
  pages/profile-home-feed-collection-schedules-page.tsx (new)
  app/router.tsx (adds the /profile-home-feed-collection-schedules route)
  app/navigation.ts (adds the "Home Feed Schedules" entry)
  features/collector-runtime/profile-home-feed-collection-schedule-view-model.test.ts
  features/collector-runtime/profile-home-feed-collection-schedule-page.test.tsx
  features/collector-runtime/profile-home-feed-collection-schedule-mutations.test.ts
```

No domain, repository, schema, migration, scheduler, dispatch, worker,
browser, or Docker behavior changes. Sprints 068A/068B1/068B2 use cases,
domain schemas, persistence, scheduled dispatch, and container services are
reused unchanged.

## Invariants

- One schedule per `profileId`. The path is the only place `profileId`
  appears in the request — the PUT body omits it.
- `intervalMinutes` is an integer from `1` through `10080` (matching the
  existing schedule CHECK constraint).
- `nextRunAt` is an absolute ISO datetime with offset. The Web UI converts
  the operator's `datetime-local` input to a timezone-aware ISO datetime
  using the operator's local offset before submitting; responses are
  rendered in the operator's local timezone.
- `createdAt` is preserved on upsert and `updatedAt` is bumped by the
  existing Sprint 068A use case.
- Disabling, not deletion, is the lifecycle mechanism.
- Optional `maxScrolls`, `maxDurationMs`, and `maxPosts` are omitted from the
  PUT body when empty — the view-model never sends `null` for empty inputs.
- The page never claims the profile is checkout-eligible; it only presents
  safe summary metadata (display name, status, account stage,
  authentication health).

## Decisions Log

- **Reuse the existing Profile Manager summaries for presentation.** The
  page reads `useProfilesQuery({ limit: 100, offset: 0 })` rather than
  adding new Collector Runtime endpoints. This keeps the Web UI surface
  contained and avoids duplicating profile metadata in Collector Runtime.
- **Path-only `profileId`.** The PUT body omits `profileId`. The path is
  the only place it appears in the request, eliminating a class of
  validation conflicts between body and path.
- **Optional parameters are top-level on the request body.** The backend
  HTTP body schema accepts `maxScrolls`, `maxDurationMs`, and `maxPosts`
  as top-level optional integers. The Web UI client mirrors that shape
  and the safe DTO exposes them inside `parameters` (matching the existing
  home-feed run parameters DTO).
- **Local timezone display.** The page renders `nextRunAt` and `updatedAt`
  through `Intl.DateTimeFormat` so the operator sees their local timezone.
  Input goes through `toIsoDateTimeWithOffset` so the backend always sees
  an absolute ISO datetime with offset.
- **Omit empty numerics.** The page omits empty `maxScrolls`,
  `maxDurationMs`, and `maxPosts` fields from the PUT body. The view-model
  does not send `null` for empty inputs.
- **Lock `profileId` while editing.** The form's profile field is read-only
  when the user is editing an existing schedule. Operators who want to
  change the profile must create a new schedule (the existing `Upsert`
  use case preserves `createdAt` on the same `profileId`).
- **Invalidate schedule queries on success.** The mutation invalidates
  `profileHomeFeedCollectionScheduleQueryKeys.all` on success so the page
  refetches after a save. The post-success invalidation logic is exported
  as `invalidateProfileHomeFeedCollectionScheduleQueries` and exercised by
  the Sprint 068C mutation test.
- **Independent create-conflict probe.** Create submissions are guarded by
  `checkCreateProfileHomeFeedScheduleConflict`, which performs a single
  GET against the existing schedule resource independently of the current
  paginated list page. A 200 response blocks Create with
  `CREATE_PROFILE_HOME_FEED_SCHEDULE_CONFLICT_EXISTS_MESSAGE`; a 404
  permits Create; any other failure blocks Create and surfaces the
  underlying error. The combined submit-decision helper
  `resolveProfileHomeFeedScheduleSubmit` is the production seam.
- **Partial-inventory warning.** When the loaded profile page is shorter
  than the reported `page.total`, the page surfaces a partial-inventory
  warning so operators know some profiles may be missing from the
  create-selector list.

## File Manifest

### Create

- `apps/web/src/pages/profile-home-feed-collection-schedules-page.tsx`
- `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-queries.ts`
- `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-mutations.ts`
- `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-view-model.ts`
- `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-view-model.test.ts`
- `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-page.test.tsx`
- `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-mutations.test.ts`
- `docs/SPRINTS/SPRINT-068C-profile-home-feed-schedule-operator-ui.md`

### Modify

- `apps/web/src/lib/api/collector-runtime-client.ts` — add schedule schemas,
  request/response types, and client methods.
- `apps/web/src/app/router.tsx` — add the
  `/profile-home-feed-collection-schedules` route.
- `apps/web/src/app/navigation.ts` — add the `Home Feed Schedules` entry.
- `docs/SPRINTS/active.md` — mark Sprint 068B2 accepted and Sprint 068C
  active.
- `docs/modules/collector-runtime.md` — note the Web UI surface.

## Test Matrix

| Requirement                                                                 | Test file                                                                                       |
|-----------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| Strict `ProfileHomeFeedCollectionScheduleListResponse` and `…Response` schemas | `apps/web/src/features/collector-runtime/profile-home-feed-collection-schedule-view-model.test.ts` |
| Strict `UpsertProfileHomeFeedCollectionScheduleRequestSchema` rejects extra `profileId` | `…-view-model.test.ts`                                              |
| Form schema rejects out-of-range, non-integer, non-numeric, and empty intervals | `…-view-model.test.ts`                                              |
| Form schema rejects the complete empty form shape (no one-minute fallback)   | `…-view-model.test.ts`                                                                    |
| Form schema rejects negative and non-numeric optional numerics                | `…-view-model.test.ts`                                                                    |
| Datetime conversion (local -> ISO with offset; ISO -> local input)          | `…-view-model.test.ts`                                                                    |
| `toUpsertProfileHomeFeedCollectionScheduleRequest` requires a parsed `intervalMinutes` number | `…-view-model.test.ts`                                  |
| `toUpsert…Request` omits empty optional numerics                            | `…-view-model.test.ts`                                                                    |
| `toUpsert…Request` includes set optional numerics                            | `…-view-model.test.ts`                                                                    |
| Round-trip a schedule through `profileHomeFeedScheduleToFormValues`           | `…-view-model.test.ts`                                                                    |
| `toListProfileHomeFeedCollectionSchedulesQueryParams` includes `enabled` boolean | `…-view-model.test.ts`                                                                 |
| `checkCreateProfileHomeFeedScheduleConflict` returns `not_found` for 404, `exists` for 200, `error` for 500/400/network | `…-view-model.test.ts`           |
| `resolveProfileHomeFeedScheduleSubmit` short-circuits on edit and gates create on the conflict probe | `…-view-model.test.ts`     |
| `upsertProfileHomeFeedCollectionSchedule` (exported production helper) calls the production client and returns the schedule | `…-mutations.test.ts` |
| `invalidateProfileHomeFeedCollectionScheduleQueries` (exported post-success helper) invalidates `profileHomeFeedCollectionScheduleQueryKeys.all` | `…-mutations.test.ts` |
| Page renders a list with profile metadata (smoke render)                    | `…-page.test.tsx`                                                                          |
| Page shows empty state when no schedules                                    | `…-page.test.tsx`                                                                          |
| Page renders the `profileId` fallback when profile metadata is missing        | `…-page.test.tsx`                                                                          |
| Page renders a partial profile inventory warning                             | `…-page.test.tsx`                                                                          |
| Editor renders the edit-detail loading state until the detail query resolves | `…-page.test.tsx`                                                                          |
| Editor disables submission before the detail query succeeds                  | `…-page.test.tsx`                                                                          |
| Editor locks `profileId` while editing                                      | `…-page.test.tsx`                                                                          |
| `resolveProfileHomeFeedScheduleSubmit` blocks Create when the profile has a schedule outside the visible list page | `…-page.test.tsx` |

## Out Of Scope

- Backend HTTP route, application use case, repository, schema, or migration
  changes.
- Scheduler, scheduled dispatch, worker execution, or browser capture
  changes.
- Profile Manager, Content Manager, Content Builder, or Content Publisher
  behavior changes.
- Docker or Compose changes.
- Profile home-feed schedule deletion, bulk actions, cron / timezone
  cadence, run-now, scheduler health / logs, JSON editor.
- Live Facebook validation.
- Commits, pushes, marking Sprint 068C complete, or moving to the next
  sprint.

## Verification

```bash
pnpm web:typecheck
pnpm web:build
pnpm typecheck
pnpm test apps/web/src/features/collector-runtime
pnpm test
git diff --check
```

When Docker resources permit:

```bash
pnpm stack:dev:start
```

Manual UI checks (matching the verification list in the sprint brief):

- `/profile-home-feed-collection-schedules` loads.
- Empty schedule list renders the empty state.
- Create schedule submits and persists; row appears in the list.
- Edit schedule locks the `profileId` field.
- Enable / disable toggling persists.
- Empty optional numeric fields are omitted from the PUT body.
- Existing `/collection-schedules` page still works.

Live validation is reported separately and not claimed here. Any
limitations are reported alongside the verification output.

## Sprint Status

Sprint 068B2 is accepted. Sprint 068C is the active UI-only sprint that
adds the operator list / create / edit / enable / disable surface for
`ProfileHomeFeedCollectionSchedule`. It does not advance beyond its
declared scope.