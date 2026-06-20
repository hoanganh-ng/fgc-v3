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
  - Loads the exact profile.
  - Evaluates eligibility with `purpose: "HOME_FEED_COLLECTION"` and
    rejects ineligible profiles with `ProfileNotCheckoutEligibleError`.
  - Rejects an existing active lease with
    `ProfileLeaseStateConflictError`.
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
- 409 is returned for eligibility rejection
  (`PROFILE_NOT_CHECKOUT_ELIGIBLE`) and active-lease conflict
  (`PROFILE_LEASE_STATE_CONFLICT`).
- Response never carries `cookies`, `localStorage`, authentication
  state, network configuration, proxy credentials, fingerprint
  data, provisioning tokens, Source Group data, source-access data,
  or runtime configuration.
- Existing checkout and release routes are unchanged.

### `Collector Runtime` port and HTTP client

- New application-owned port `ProfileHomeFeedCheckoutPort`.
- `ProfileManagerHttpClient` implements it with
  `checkoutProfileForHomeFeedCollection(profileId)` posting to the
  new HTTP route. The method:
  - Validates the response `profile.id`, `lease.profileId`,
    `lease.purpose`, and `lease.status`. Mismatches are mapped to
    `PROFILE_MANAGER_RESPONSE_ERROR`.
  - Returns the safe `{ profileId, accountStage, leaseId,
    leaseExpiresAt? }`.
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

### Unit / application

```text
$ pnpm exec vitest run src/collector-profile-manager/domain \
    src/collector-profile-manager/application/checkout-use-cases.test.ts
 PASS  (123) FAIL (0)

$ pnpm exec vitest run src/collector-runtime/infrastructure/profile-manager-http-client.test.ts
 PASS  (32) FAIL (0)

$ pnpm exec vitest run src/composition/collector-profile-manager/collector-profile-manager.container.test.ts
 PASS  (1)  FAIL (0)

$ pnpm exec vitest run src/interfaces/http/server.test.ts
 PASS  (67) FAIL (0)
```

### Docker-backed DB infrastructure (Layer 1, isolated)

```text
$ compose run --rm --no-deps api sh -lc '
    export SPRINT_058_DATABASE_URL="${DATABASE_URL%/*}/sprint_058_isolated"
    RUN_DB_TESTS=true pnpm exec vitest run src/infrastructure \
      --no-file-parallelism'

 Test Files  27 passed | 1 skipped (28)
      Tests  224 passed | 1 skipped (225)
   Duration  31.40s
```

### HTTP DB (Layer 3)

```text
$ compose run --rm --no-deps api sh -lc '
    RUN_HTTP_DB_TESTS=true pnpm exec vitest run \
      src/interfaces/http --no-file-parallelism'

 Test Files  9 passed (9)
      Tests  176 passed (176)
   Duration  43.40s
```

### Docker E2E (Layer 4, synthetic)

```text
$ pnpm test:e2e:docker

 15 passed (4.6s)
```

### Other gates

```text
$ pnpm typecheck
(0 errors)

$ pnpm web:typecheck
(0 errors)

$ pnpm web:build
✓ built in 5.21s

$ git diff --check
(no output)

$ git status --short
~ Modified: 18 files
? Untracked: 4 files
```

### Parallel `pnpm test:db` (known shared-database isolation limitation)

The full serial Docker-backed infrastructure suite above passes in
its entirety. Running `pnpm test:db` in parallel against a single
shared PostgreSQL database produces cross-suite failures in the
`source_publishers` cleanup path that are unrelated to Sprint 065C2
and predate the sprint. The serial isolated infrastructure suite is
the authoritative verification path.

## Changed files

Modified:

- `drizzle/meta/_journal.json`
- `src/collector-profile-manager/application/checkout-use-cases.test.ts`
- `src/collector-profile-manager/application/index.ts`
- `src/collector-profile-manager/domain/checkout-eligibility.ts`
- `src/collector-profile-manager/domain/profile-lease.ts`
- `src/collector-runtime/application/collector-runtime.ports.ts`
- `src/collector-runtime/infrastructure/profile-manager-http-client.test.ts`
- `src/collector-runtime/infrastructure/profile-manager-http-client.ts`
- `src/composition/collector-profile-manager/collector-profile-manager.container.test.ts`
- `src/composition/collector-profile-manager/collector-profile-manager.container.ts`
- `src/infrastructure/database/repositories/drizzle-repositories.integration.test.ts`
- `src/infrastructure/database/schema/collector-profile-manager.schema.test.ts`
- `src/interfaces/http/routes/collector-profile-manager.routes.ts`
- `src/interfaces/http/schemas/collector-profile-manager.http-schemas.ts`
- `src/interfaces/http/server.test.ts`
- `src/interfaces/http/server.database.integration.test.ts`
- `src/interfaces/http/test-support/collector-profile-manager-http-service.ts`
- `tests/e2e/profile-home-feed-checkout.spec.ts` (new spec file)

New:

- `drizzle/0024_collector_profile_lease_purpose_home_feed.sql`
- `drizzle/meta/0024_snapshot.json`
- `src/collector-profile-manager/application/use-cases/checkout-profile-for-home-feed-collection.use-case.ts`
- `tests/e2e/profile-home-feed-checkout.spec.ts`
- `docs/SPRINTS/SPRINT-065C2-profile-bound-home-feed-checkout.md`

## Remaining Risks

- The parallel `pnpm test:db` shared-database isolation limitation
  remains. Sprint 065C2 does not modify the test harness; the
  serial Docker-backed infrastructure suite passes in full.
- The new `HOME_FEED_COLLECTION` purpose is exercised by HTTP DB and
  Docker E2E flows. It is intentionally not wired into a worker or
  executor; that wiring is future work.
