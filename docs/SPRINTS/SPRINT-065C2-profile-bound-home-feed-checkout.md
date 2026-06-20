# Sprint 065C2: Profile-Bound Home-Feed Checkout

## Goal

Add an explicit profile-bound checkout path for the exact profile
referenced by a `ProfileHomeFeedCollectionRun`. A `HOME_FEED_COLLECTION`
lease is created with the same `COLLECTION_READY` account-stage rule
that already gates source-group `COLLECTION` leases, but the new
purpose:

- requires no `Source Group` reference;
- requires no `profile-source access` record;
- preserves the full shared eligibility + safety check set, including
  the approved `NETWORK_CONTEXT_MISSING` rule.

The contract is exposed through `Collector Profile Manager` HTTP and
through a new dedicated `ProfileHomeFeedCheckoutPort` plus
`ProfileManagerHttpClient.checkoutProfileForHomeFeedCollection`
method in `Collector Runtime`. Sprint 065C2 does not execute a run,
does not navigate Facebook, does not wire the port into a worker, and
does not transition `ProfileHomeFeedCollectionRun` lifecycle.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/SPRINTS/SPRINT-064B-provenance-persistence-and-compatibility.md`
- `docs/SPRINTS/SPRINT-065A-facebook-home-feed-extractor-fixtures.md`
- `docs/SPRINTS/SPRINT-065B-profile-bound-home-feed-run-model.md`
- `docs/SPRINTS/SPRINT-065C1-bare-home-feed-content-ingestion.md`
- `src/collector-profile-manager/domain/checkout-eligibility.ts`
- `src/collector-profile-manager/domain/profile-lease.ts`
- `src/collector-profile-manager/application/use-cases/checkout-profile.use-case.ts`
- `src/collector-profile-manager/application/use-cases/checkout-profile-for-assisted-group-access.use-case.ts`
- `src/collector-profile-manager/application/use-cases/checkout-profile-for-exercise.use-case.ts`
- `src/collector-profile-manager/application/use-cases/release-profile-lease.use-case.ts`
- `src/collector-profile-manager/application/use-cases/get-runtime-profile-configuration.use-case.ts`
- `src/collector-runtime/application/collector-runtime.ports.ts`
- `src/collector-runtime/infrastructure/profile-manager-http-client.ts`
- `src/infrastructure/database/schema/collector-profile-manager.schema.ts`
- `src/interfaces/http/routes/collector-profile-manager.routes.ts`
- `src/interfaces/http/schemas/collector-profile-manager.http-schemas.ts`
- `src/composition/collector-profile-manager/collector-profile-manager.container.ts`
- `tests/e2e/home-feed-content-ingestion.spec.ts`

## Capability Summary

### Domain (`Collector Profile Manager`)

- `ProfileLeasePurpose` extends with a fourth value,
  `HOME_FEED_COLLECTION`. The shared `COLLECTION`,
  `AMBIENT_EXERCISE`, and `ASSISTED_GROUP_ACCESS` values are
  unchanged.
- `evaluateCheckoutEligibility(profile, now, { purpose })` reuses the
  existing `ACCOUNT_STAGE_NOT_COLLECTION_READY` rule for
  `HOME_FEED_COLLECTION` (the new purpose shares the source-group
  collection read gate).
- The full existing safety and readiness check set is preserved:
  `PROFILE_NOT_READY`, `ACCOUNT_STAGE_NOT_COLLECTION_READY`,
  `AUTHENTICATION_MISSING`, `AUTHENTICATION_EXPIRED`,
  `AUTHENTICATION_HEALTH_NOT_HEALTHY`, `NETWORK_CONTEXT_MISSING`,
  `HARDWARE_FINGERPRINT_MISSING`, `INVALID_TEMPORAL_ROUTINE`,
  `OUTSIDE_ACTIVE_WINDOW`, `COOLDOWN_ACTIVE`,
  `INVALID_SAFETY_THRESHOLDS`, `DAILY_SESSION_LIMIT_REACHED`,
  `DAILY_ACTIVE_DURATION_LIMIT_REACHED`,
  `DAILY_MACRO_ACTION_LIMIT_REACHED`.
- `GetRuntimeProfileConfigurationUseCase` continues to accept any
  active lease (including `HOME_FEED_COLLECTION`) for its matching
  `BUSY` profile. `ReleaseProfileLeaseUseCase` returns the profile to
  `READY`. Both public contracts are unchanged.

### Application (`Collector Profile Manager`)

- New `CheckoutProfileForHomeFeedCollectionUseCase`:
  - Input: `{ profileId }` only.
  - Loads the exact requested profile.
  - Queries the active lease by profile id.
  - When an active lease exists, throws
    `ProfileLeaseStateConflictError`. The active-lease check and all
    subsequent writes are inside the existing transaction-manager
    callback when a transaction manager is supplied.
  - Evaluates eligibility with `purpose: "HOME_FEED_COLLECTION"` and
    rejects ineligible profiles with `ProfileNotCheckoutEligibleError`.
  - Atomically marks the profile `BUSY` and saves an `ACTIVE`
    `HOME_FEED_COLLECTION` lease through the existing transaction
    manager.
  - Returns the lease and a safe `{ profileId, accountStage }`
    profile summary.
  - Does not depend on `SourceGroupReferencePort` or
    `ProfileSourceAccessRepository`. Does not perform candidate
    selection.
- `ReleaseProfileLeaseUseCase` continues to release the
  `HOME_FEED_COLLECTION` lease through the same code path that
  releases any other lease.

### Persistence

- New migration
  `drizzle/0024_collector_profile_lease_purpose_home_feed.sql`
  extending the existing
  `collector_profile_lease_purpose` enum with
  `HOME_FEED_COLLECTION` (PostgreSQL `ALTER TYPE ... ADD VALUE`).
- The Drizzle schema, journal, and latest snapshot are updated in
  lock-step. No tables, columns, indexes, or backfills were added.
- The unique partial index `collector_profile_leases_active_profile_uidx`
  continues to enforce one-active-lease-per-profile protection
  unchanged.

### HTTP contract (`Collector Profile Manager`)

- New route: `POST /collector/profiles/:profileId/home-feed/checkout`.
- Path params: `profileId` only. No body is required. Unknown body
  fields are rejected by the strict schema.
- Response 200: `{ lease, profile }` where `profile` is the
  `{ profileId, accountStage }` summary and `lease` is the
  `HOME_FEED_COLLECTION` lease JSON.
- Duplicate checkouts of the same profile are mapped to HTTP 409
  with `PROFILE_LEASE_STATE_CONFLICT`.
- Genuinely ineligible profiles that do not already have an active
  lease are mapped to HTTP 409 with `PROFILE_NOT_CHECKOUT_ELIGIBLE`.
- Response never carries `cookies`, `localStorage`, authentication
  state, network configuration, proxy credentials, fingerprint
  data, provisioning tokens, Source Group data, source-access data,
  or runtime configuration.
- Existing checkout and release routes are unchanged.

### `Collector Runtime` port and HTTP client

- New application-owned port `ProfileHomeFeedCheckoutPort` whose
  `accountStage` field is typed as `CollectorRuntimeAccountStage`.
- `ProfileManagerHttpClient` implements it with
  `checkoutProfileForHomeFeedCollection(profileId)` posting to the
  new HTTP route. The method:
  - Validates the response `profile.id`, `lease.profileId`,
    `lease.purpose`, and `lease.status`. Mismatches are mapped to
    `PROFILE_MANAGER_RESPONSE_ERROR`.
  - Parses the response `accountStage` through
    `CollectorRuntimeAccountStageSchema`; unsupported or malformed
    values produce `PROFILE_MANAGER_RESPONSE_ERROR`. The
    `Collector Runtime` account-stage enum is not broadened.
  - Returns the safe `{ profileId, accountStage, leaseId,
    leaseExpiresAt? }` with the typed `accountStage`.
  - Preserves safe HTTP and network error mapping.
- The port is **not** wired into a worker, executor, or operator
  tool in Sprint 065C2.

### Composition

- `CollectorProfileManagerContainer` exposes the new use case as
  `checkoutProfileForHomeFeedCollection`.
- `CollectorProfileManagerHttpService` interface extended with the
  same field.
- In-memory and database-backed composition tests cover the new
  field.

## Compatibility

- `GetRuntimeProfileConfigurationUseCase` accepts an active
  `HOME_FEED_COLLECTION` lease for its matching `BUSY` profile.
- `ReleaseProfileLeaseUseCase` releases the lease and returns the
  profile to `READY`.
- Existing source-group and assisted-group checkout behavior is
  unchanged. No `Source Group` reference, no profile-source access
  record, and no candidate selection are required for
  `HOME_FEED_COLLECTION`.

## Out of Scope

- Browser execution and Facebook navigation
- Scrolling or timing bounds execution
- Payload capture and the Sprint 065A extractor invocation
- `SourcePublisher` observation, review, status mutation, or promotion
- Content Manager submission or `ContentItem` updates
- Home-feed run status transitions, worker, or scheduler integration
- Manual live-Facebook validation
- Web UI behavior
- Normal source-group checkout changes
- Proxy or network policy changes
- Content Builder or Content Publisher

## Verification (recorded)

### Focused unit tests (post-correction)

```text
$ pnpm exec vitest run \
    src/collector-profile-manager/application/checkout-use-cases.test.ts \
    src/collector-runtime/infrastructure/profile-manager-http-client.test.ts \
    src/interfaces/http/server.test.ts

 PASS  (164) FAIL (0)
```

### Full unit verification

```text
$ pnpm typecheck
(0 errors)

$ pnpm test
 Test Files  114 passed | 14 skipped (128)
      Tests  1606 passed | 15 skipped (1621)
   Duration  18.11s

$ pnpm web:typecheck
(0 errors)

$ pnpm web:build
dist/index.html                   0.41 kB
dist/assets/index-rSPDjip7.css   23.60 kB
dist/assets/index-CCdlT0L6.js   648.75 kB
✓ built in 4.97s
```

### PostgreSQL-backed HTTP tests (docker-compose.e2e.yml)

```text
$ compose="docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml"
$ trap '$compose down -v --remove-orphans > /dev/null 2>&1 || true' EXIT INT TERM
$ $compose down -v --remove-orphans > /dev/null 2>&1 || true
$ $compose build api
$ $compose up -d --wait postgres
$ $compose run --rm --no-deps api sh -lc '
    pnpm db:migrate &&
    RUN_HTTP_DB_TESTS=true pnpm exec vitest run \
      src/interfaces/http/server.database.integration.test.ts \
      --no-file-parallelism'

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  5.49s

# Full src/interfaces/http HTTP DB suite
 Test Files  9 passed (9)
      Tests  176 passed (176)
   Duration  43.77s

$ $compose down -v --remove-orphans > /dev/null 2>&1 || true
```

Cleanup runs through the trap on success, failure, and
interruption. The trap never printed `DATABASE_URL` or any
sensitive environment value.

### Docker E2E (Layer 4, synthetic)

```text
$ pnpm test:e2e:docker

 15 passed (4.8s)
```

The Sprint 065C2 spec
(`tests/e2e/profile-home-feed-checkout.spec.ts`) asserts that
duplicate home-feed checkout returns HTTP 409 with
`PROFILE_LEASE_STATE_CONFLICT`.

### Other gates

```text
$ git diff --check
(no output)

$ git status --short
 M docs/MODULE_BOUNDARIES.md
 M docs/PROJECT_SNAPSHOT.md
 M docs/ROADMAP.md
 M docs/SPRINTS/SPRINT-065C1-bare-home-feed-content-ingestion.md
 M docs/SPRINTS/SPRINT-065C2-profile-bound-home-feed-checkout.md
 M docs/SPRINTS/active.md
 M src/collector-profile-manager/application/checkout-use-cases.test.ts
 M src/collector-profile-manager/application/use-cases/checkout-profile-for-home-feed-collection.use-case.ts
 M src/collector-runtime/application/collector-runtime.ports.ts
 M src/collector-runtime/infrastructure/profile-manager-http-client.test.ts
 M src/collector-runtime/infrastructure/profile-manager-http-client.ts
 M src/interfaces/http/server.database.integration.test.ts
 M tests/e2e/profile-home-feed-checkout.spec.ts
```

## Changed files (correction overlay on base commit `8f4bc38`)

Modified in this correction:

- `docs/MODULE_BOUNDARIES.md`
- `docs/PROJECT_SNAPSHOT.md`
- `docs/ROADMAP.md`
- `docs/SPRINTS/SPRINT-065C1-bare-home-feed-content-ingestion.md`
- `docs/SPRINTS/SPRINT-065C2-profile-bound-home-feed-checkout.md`
- `docs/SPRINTS/active.md`
- `src/collector-profile-manager/application/checkout-use-cases.test.ts`
- `src/collector-profile-manager/application/use-cases/checkout-profile-for-home-feed-collection.use-case.ts`
- `src/collector-runtime/application/collector-runtime.ports.ts`
- `src/collector-runtime/infrastructure/profile-manager-http-client.test.ts`
- `src/collector-runtime/infrastructure/profile-manager-http-client.ts`
- `src/interfaces/http/server.database.integration.test.ts`
- `tests/e2e/profile-home-feed-checkout.spec.ts`

The remaining Sprint 065C2 files (use case wiring, Drizzle schema,
migration `0024`, HTTP routes, composition container, integration
test fixtures, and the new files) were already present at the
correction base commit `8f4bc389a4f2000b79323822ddaf33c83075dc9d`
and were not modified in this correction.

## Remaining Risks

- The parallel `pnpm test:db` shared-database isolation limitation
  remains. Sprint 065C2 does not modify the test harness; the
  serial Docker-backed infrastructure suite passes in full.
- The new `HOME_FEED_COLLECTION` purpose is exercised by HTTP DB and
  Docker E2E flows. It is intentionally not wired into a worker or
  executor; that wiring is future work.
- The correction narrows the active-lease conflict ordering in
  `CheckoutProfileForHomeFeedCollectionUseCase` so duplicate
  checkouts of the same profile now produce HTTP 409
  `PROFILE_LEASE_STATE_CONFLICT` (rather than
  `PROFILE_NOT_CHECKOUT_ELIGIBLE`). This is consistent with the
  existing source-group and assisted-group-access checkouts and is
  intentional.

## Status

Sprint 065C2 is **accepted** at
`6591a05b3ecde7e615f824efc715c815c25bc2d2`. The required
stub-backed HTTP regression in `src/interfaces/http/server.test.ts`
asserts HTTP 409 `PROFILE_LEASE_STATE_CONFLICT` for duplicate home-feed
checkout, calls `checkoutProfileForHomeFeedCollection` exactly once
with `{ profileId: "profile-1" }`, and confirms the response contains
no sensitive fields.

Sprint 065C3 — Bounded Facebook Home-Feed Execution is the **only
active and authorized** sprint.
