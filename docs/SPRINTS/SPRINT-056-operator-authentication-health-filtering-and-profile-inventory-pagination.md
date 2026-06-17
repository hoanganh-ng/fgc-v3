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
