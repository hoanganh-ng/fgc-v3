# Sprint 056: Operator Authentication Health Filtering and Profile Inventory Pagination

## Goal

Make Sprint 055's authentication-health recovery flow operational at
realistic profile counts by adding server-side `authenticationHealth`
filtering, URL-backed inventory controls, deterministic pagination,
and `Health Updated` visibility to the existing profile inventory.

No health mutations, no automation, no checkpoint bypass, no
`accountStage` changes, and no new endpoints are introduced. Sprint
054A, 054B, and 055 invariants are preserved.

## Scope

### Collector Profile Manager — Application

- Extend `ListProfilesInput` and the port-level `ProfileListQuery`
  with optional `authenticationHealth: ProfileAuthenticationHealth`.
- `ListProfilesUseCase` validates the optional value through the
  domain-owned `ProfileAuthenticationHealthSchema` and forwards it
  to the repository. Unknown values produce `InvalidProfileQueryError`.
- Existing `status`, `limit`, `offset`, default behavior, and
  deterministic `createdAt` / `profileId` ordering are preserved.

### Collector Profile Manager — Repository Adapters

- `InMemoryProfileRepository.listProfiles` and
  `DrizzleProfileRepository.listProfiles` apply an identical composed
  predicate: `status` (optional) AND `authenticationHealth` (optional).
- Both item queries and total-count queries are built from the same
  composed predicate, guaranteeing matched totals.
- The Drizzle adapter builds the predicate once via
  `buildProfileListWhere(query)` and reuses it for both queries.

### Infrastructure

- New migration `0014_collector_profiles_authentication_health_index`
  adds a composite btree index on
  `(authentication_health, created_at, profile_id)` to support
  filter + deterministic ordering at realistic scale.
- New journal entry `idx: 14` in `drizzle/meta/_journal.json`.

### HTTP Contract

- `ListProfilesHttpQuerySchema` and the matching Fastify route JSON
  schema gain an optional strict `authenticationHealth` enum using
  the domain-owned values.
- The existing `GET /collector/profiles` route forwards the optional
  value. No new endpoint, no response shape change.
- Unknown values produce `400 VALIDATION_ERROR` and the request is
  not passed to the use case.

### Web API Client

- `ListProfilesQuery` gains an optional
  `authenticationHealth: KnownProfileAuthenticationHealth`.
- `toListProfilesQueryParams` serializes the optional value only
  when present.
- TanStack Query keys continue to derive from the full query object,
  so the new filter naturally separates cache entries.
- Default page size is reduced from 100 to 25 to match the
  inventory's fixed pagination.

### Web UI

- `apps/web/src/pages/profiles-page.tsx` introduces URL-backed
  Status and Authentication Health controls.
- Changing a filter resets `offset` to `0` and updates the URL.
- Refresh and browser navigation preserve query state because the
  state lives in the URL.
- Invalid URL values fall back safely to `undefined` (no filter).
- 25-item fixed pagination with Previous / Next buttons, a visible
  range, and the matching total from the API.
- A new `Health Updated` column displays
  `authenticationHealthUpdatedAt`.
- Two distinct empty states:
  - Global "No Profiles" (no profiles exist).
  - "No Matching Profiles" with a `Reset filters` action when
    filters are active.
- Existing `ProfileAuthenticationHealthBadge` is reused; no new
  component is introduced.
- No tokens, cookies, localStorage, raw payloads, fingerprint
  secrets, screenshots, or page text in the URL, local state, or
  rendered copy.

## Architecture Boundaries

- The query, predicate composition, and validation live in the
  application + infrastructure layers. Domain continues to own the
  `ProfileAuthenticationHealth` enum and the health transition
  policy from Sprint 054B.
- No new event tables, retries, outbox work, or health history are
  added.
- No manual or automatic health mutation endpoint is introduced.
- No `accountStage` or `authenticationState` mutation is performed
  by the inventory path.
- The Web UI consumes safe HTTP contracts; it does not import
  backend domain, repository, database, or composition modules.

## Out Of Scope

- Health event history or provenance.
- Multiple health values in one API query.
- Synthetic `needsRecovery` query values.
- Dashboard summary counts.
- Health timestamp sorting.
- Manual or automatic health mutation.
- Automated login, CAPTCHA solving, or checkpoint bypass.
- Collector Runtime changes.
- Notifications.
- Unrelated refactoring.
- Commits or pushes.

## Verification

### Required checks

```bash
pnpm typecheck
pnpm web:typecheck
pnpm web:build
pnpm test
pnpm test:db
pnpm test:http:db
git diff --check
```

### UI / view-model coverage

- Pure `profile-inventory-view-model` module
  (`apps/web/src/features/profiles/profile-inventory-view-model.ts`)
  owns URL building, filter parsing, pagination, range text, and
  empty-state decisions. The page consumes it; no UI testing
  dependency was added.
- `profiles-page.tsx` renders the two distinct empty states:
  - Global "No Profiles" (no profiles, no filters): offers
    `New Profile`.
  - Filtered "No Matching Profiles" (filters active, no matches):
    offers `Reset filters` only. `New Profile` is intentionally
    absent.
- Stale out-of-range offset recovery: when `items` is empty but
  `total > 0`, the page issues a `replace` navigation back to
  `offset=0` while preserving active filters.
- Readable filter labels (enum values remain in URLs and API
  requests):
  - `PENDING_CONFIG` -> Pending configuration
  - `PENDING_LOGIN` -> Pending login
  - `READY` -> Ready
  - `BUSY` -> Busy
  - `NOT_PROVISIONED` -> Not provisioned
  - `HEALTHY` -> Healthy
  - `REAUTH_REQUIRED` -> Reauthentication required
  - `CHECKPOINT_REVIEW_REQUIRED` -> Checkpoint review required
- Strict offset parsing rejects `"25abc"`, `"1.5"`, `"-1"`, empty,
  and unsafe integers; all fall back to `0`.
- `getProfileInventoryPaginationModel` honors optional `total`:
  - When `total` is present, `canGoNext` is computed from
    `offset + itemCount < total`. Range text uses `total`.
  - When `total` is omitted, `canGoNext` is
    `itemCount >= limit`. Range text shows the visible range and
    "of unknown total".
  - `canGoBack` is always `offset > 0`.

### Vitest coverage

`apps/web/src/features/profiles/profile-inventory-view-model.test.ts`
(48 tests) covers:

- Valid and invalid status parsing via `pickKnownValue`.
- Valid and invalid authentication-health parsing via
  `pickKnownValue`.
- Strict offset parsing via `parseProfileInventoryOffset`,
  including malformed, signed, fractional, whitespace, and
  unsafe-integer rejection.
- Filter changes reset offset via
  `applyProfileInventoryFilterChange`; reset behavior via
  `applyProfileInventoryResetFilters`.
- Query keys differ by `status`, `authenticationHealth`, `limit`,
  and `offset` (asserted against
  `profileQueryKeys.list(query)`).
- Previous and Next boundaries with `total` provided
  (mid-page, last page, offset > 0, offset = 0).
- Pagination behavior when `total` is omitted
  (`itemCount >= limit` Next rule, no fake total).
- `resolveProfileInventoryEmptyState` produces `GLOBAL_NO_PROFILES`
  for the unfiltered empty case, `FILTERED_NO_MATCH` for the
  filtered empty case, and `OUT_OF_RANGE` for the
  `total > 0 && items === 0` case.
- `applyProfileInventoryOffsetChange` preserves filters,
  omits `offset` when zero, and ignores negative offsets.
- The filtered no-match model does not offer `New Profile`
  (asserted as a distinct `FILTERED_NO_MATCH` marker, separate
  from `GLOBAL_NO_PROFILES`).

### Manual Web UI check

Performed against the running `web-dev` container backed by the
`api` container. Steps:

1. Open `/profiles` with no query params. The Status and
   Authentication Health selects both display the "All" option
   plus the operator-readable labels (Pending configuration,
   Pending login, Ready, Busy, Not provisioned, Healthy,
   Reauthentication required, Checkpoint review required). The
   enum values (`READY`, `HEALTHY`, ...) appear in the DOM as the
   `<option value="...">` attribute and in the URL, never in the
   visible label.
2. Pick `Status = Ready` and `Authentication Health = Healthy`.
   The URL becomes
   `/profiles?status=READY&authenticationHealth=HEALTHY` and the
   table re-queries. The Next / Previous buttons reflect the
   visible range and `total`.
3. Click `Next`. The URL gains `offset=25`. Click `Previous`.
   The URL returns to `offset=0` (or omits the param when zero).
4. Click `Refresh`. The URL is unchanged; the query is refetched
   with the same Status, Authentication Health, and offset.
5. With a filter active that yields zero matches (e.g.
   `Status = Ready` and `Authentication Health = Healthy` against
   a test dataset with no such profile), the page shows the
   `No Matching Profiles` card with only `Reset filters`. The
   `New Profile` action is intentionally not present.
6. Visit `/profiles?status=READY&offset=1000` (stale
   out-of-range offset) and observe that the URL is normalized
   to `/profiles?status=READY` (filters preserved, offset
   cleared) via `replace` navigation, and the table re-renders
   at offset 0.
7. Use browser back / forward between several filter and offset
   states (e.g.
   `/profiles` -> `/profiles?status=READY` ->
   `/profiles?status=READY&offset=25` -> back -> forward). The
   filter, offset, and visible range all restore from the URL.

### DB verification

Run against an isolated, freshly created database
`fgc_sprint056_test` on the development Postgres container:

1. `docker exec fgc-v3-dev-postgres-1 psql -U content_pipeline -d postgres -c "DROP DATABASE IF EXISTS fgc_sprint056_test;"`
2. `docker exec fgc-v3-dev-postgres-1 psql -U content_pipeline -d postgres -c "CREATE DATABASE fgc_sprint056_test;"`
3. `DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5433/fgc_sprint056_test pnpm db:migrate`
4. `DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5433/fgc_sprint056_test RUN_DB_TESTS=true pnpm test:db`
5. `DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5433/fgc_sprint056_test RUN_HTTP_DB_TESTS=true pnpm test:http:db`

Results:

- Migrations applied successfully. `collector_profiles` contains
  the `authentication_health` column with the
  `collector_profile_authentication_health` enum and the
  `collector_profiles_authentication_health_created_at_idx`
  composite btree index on
  `(authentication_health, created_at, profile_id)`.
- `pnpm test:db` (RUN_DB_TESTS=true against the isolated DB): 16
  test files passed, 77 tests passed.
- `pnpm test:http:db` (RUN_HTTP_DB_TESTS=true against the
  isolated DB): 7 test files passed, 126 tests passed.
- `pnpm test` (full suite): 86 test files passed
  (8 skipped integration-only files), 1106 tests passed
  (8 skipped).
- `pnpm typecheck`, `pnpm web:typecheck`, `pnpm web:build`: all
  pass.
- `git diff --check`: clean.

The Content Manager tests were not modified to make any command
green.

### Test coverage targets

- Use case:
  - Filter by `authenticationHealth` returns the matching slice and
    correct total.
  - Combined `status` × `authenticationHealth` filter is AND.
  - Offset pagination over the health filter is deterministic and
    paginates in stable `createdAt` / `profileId` order.
  - Unknown `authenticationHealth` value raises
    `InvalidProfileQueryError`.
- Repository contract (in-memory):
  - Combined filter slices both axes and reports the correct total.
- Drizzle integration (DB):
  - Combined `status` × `authenticationHealth` returns the matching
    slice and the matching total.
  - Offset pagination over `authenticationHealth` is deterministic
    and total is exact.
- HTTP:
  - `authenticationHealth` query parameter is forwarded to the use
    case.
  - Combined `status` and `authenticationHealth` query parameters
    are forwarded together.
  - Unknown value returns `400 VALIDATION_ERROR` and the use case
    is not called.
- Web API client:
  - The serializer includes `authenticationHealth` only when set.
  - Undefined filters are omitted from the query string.
- Migration journal:
  - `0014_collector_profiles_authentication_health_index.sql` is
    referenced by the journal and present on disk.
- Backward compatibility: existing tests without
  `authenticationHealth` continue to pass.
- Sensitive-data exclusion: no cookies, localStorage, tokens, proxy
  credentials, raw session state, fingerprint secrets, screenshots,
  page text, or raw Facebook payloads in any new code, fixture,
  log, or rendered UI copy.

## Sprint Status

Sprint 055 is accepted. Sprint 056 is implemented as described above
and is not marked complete or advanced beyond its declared scope.
