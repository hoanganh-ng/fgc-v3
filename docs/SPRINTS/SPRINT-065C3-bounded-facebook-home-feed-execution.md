# Sprint 065C3: Bounded Facebook Home-Feed Execution

## Goal

Add a one-shot, operator-invoked executor for an existing durable
`ProfileHomeFeedCollectionRun`. The executor claims at most one queued
run, checks out the run's exact profile through
`HOME_FEED_COLLECTION`, captures the authenticated Facebook home feed
under bounded scroll/duration limits, invokes the existing Sprint 065A
home-feed extractor, observes each distinct `SourcePublisher` once,
submits bounded home-feed content through the existing Sprint 065C1
Content Manager HTTP contracts, releases the lease, and persists a
sanitized `SUCCEEDED` or `FAILED` terminal run through the existing
compare-and-set transition path.

Sprint 065C3 does not add a polling loop, persistent worker, Docker
service, scheduler integration, Web UI changes, or an HTTP execute
route. Manual live-Facebook validation is opt-in and is **not
performed** by this sprint.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/SPRINTS/SPRINT-065A-facebook-home-feed-extractor-fixtures.md`
- `docs/SPRINTS/SPRINT-065B-profile-bound-home-feed-run-model.md`
- `docs/SPRINTS/SPRINT-065C1-bare-home-feed-content-ingestion.md`
- `docs/SPRINTS/SPRINT-065C2-profile-bound-home-feed-checkout.md`
- `src/collector-runtime/domain/profile-home-feed-collection-run*`
- `src/collector-runtime/application/use-cases/execute-profile-home-feed-collection-run.use-case.ts`
- `src/collector-runtime/application/collector-runtime.ports.ts`
- `src/collector-runtime/infrastructure/facebook-browser-payload-capture.ts`
- `src/collector-runtime/infrastructure/facebook-home-feed-browser-payload-capture.ts`
- `src/collector-runtime/infrastructure/content-manager-http-client.ts`
- `src/collector-runtime/infrastructure/profile-manager-http-client.ts`
- `src/operator-tools/profile-home-feed-runner/**`
- `tests/e2e/profile-home-feed-run-next.spec.ts`

## Capability Summary

### Execution bounds

- Per-field defaults applied when `run.parameters` omits a field:
  `maxScrolls = 3`, `maxDurationMs = 30000`, `maxPosts = 20`.
- Hard ceilings: `maxScrolls <= 10`, `maxDurationMs <= 120000`,
  `maxPosts <= 100`.
- **Never silently clamped.** Exceeding any ceiling fails the RUNNING
  run BEFORE checkout with the fixed sanitized failure
  `HOME_FEED_EXECUTION_BOUNDS_EXCEEDED`.

### Application

- `ExecuteProfileHomeFeedCollectionRunUseCase` orchestrates:
  1. Load run via repository, require `status === "RUNNING"`; otherwise
     throw `InvalidProfileHomeFeedCollectionRunStatusTransitionError`.
  2. Compute effective bounds; if any ceiling is exceeded, terminal
     `markFailed` with `HOME_FEED_EXECUTION_BOUNDS_EXCEEDED`.
  3. Checkout the exact `run.profileId` through
     `ProfileHomeFeedCheckoutPort`. Mismatched profile id ⇒
     `PROFILE_HOME_FEED_CHECKOUT_PROFILE_MISMATCH`. Failed checkout ⇒
     `HOME_FEED_CHECKOUT_FAILED`. No lease release on either path
     because no lease was acquired.
  4. Capture payloads via `FacebookHomeFeedPayloadCapturePort` with the
     effective per-call bounds. On failure, derive the
     `authenticationObservation` (`LOGIN_REQUIRED` /
     `CHECKPOINT_REQUIRED`) from the capture errorCode, release the
     lease, record a partial summary, and terminal
     `HOME_FEED_CAPTURE_FAILED`.
  5. Run each captured payload through the existing Sprint 065A
     `extractFacebookHomeFeedGraphQLPayload`. Deduplicate across the
     entire run by `platform + externalPostId`. Cap accepted
     `extractorCandidates` at `maxPosts`.
  6. For each accepted candidate: cache `platform + kind +
     externalPublisherId → sourcePublisherId` through
     `SourcePublisherObservationPort`. Observe each distinct publisher
     at most once per run. Failed publisher observations block content
     submission for that publisher's candidates and count in
     `failedContentSubmissions`. Independent publishers and candidates
     continue.
  7. Submit accepted candidates through `HomeFeedContentSubmissionPort`.
     Failed submissions count in `failedContentSubmissions` and the run
     continues.
  8. Always release the lease through `ProfileLeasePort` after
     successful checkout. A failed release marks the run FAILED with
     `HOME_FEED_LEASE_RELEASE_FAILED`.
  9. Success requires successful checkout, capture, all publisher
     observations, all content submissions, and lease release. Zero
     captured or accepted candidates is a valid success when capture
     and release succeeded.
  10. Failed runs retain a safe partial summary where available. A
      partial failure terminal uses
      `HOME_FEED_EXECUTION_PARTIAL_FAILURE`.

### Application-owned ports

Added to `src/collector-runtime/application/collector-runtime.ports.ts`:

- `FacebookHomeFeedPayloadCapturePort.captureHomeFeedPayloads(input)` —
  `input = { profileId, leaseId, maxScrolls, maxDurationMs }`. Returns
  the existing `FacebookPayloadCaptureResult`.
- `SourcePublisherObservationPort.observeSourcePublisher(input)` —
  input `{ platform: "FACEBOOK", kind: "GROUP" | "PAGE",
  externalPublisherId, observedAt, displayName?, canonicalUrl? }`.
- `HomeFeedContentSubmissionPort.submitHomeFeedCollectedContent(input)`
  — mirrors the strict allowlist body of
  `POST /collector/content-items/home-feed` from Sprint 065C1.

### Infrastructure

- `FacebookHomeFeedBrowserPayloadCaptureAdapter` (new) extends
  `FacebookBrowserPayloadCaptureAdapter` and implements the new
  port. It navigates to the fixed internal URL
  `FACEBOOK_HOME_FEED_URL = "https://www.facebook.com/?sk=h_chr"`
  (chronological home feed), reuses the same page-context fetch/XHR
  capture, network response capture, page-state observer, and browser
  cleanup as the existing source-group adapter, and uses the per-call
  bounds without constructor-level clamping. Browser session is closed
  on every path including thrown errors and abort signals.
- `FacebookBrowserPayloadCaptureAdapter` is internally refactored to
  expose a `protected performCapture(input)` helper that both
  source-group and home-feed adapters call. Public source-group
  behavior is unchanged. Field visibility is narrowed from `private` to
  `protected` only where the home-feed subclass needs it.
- `ContentManagerHttpClient` (modified) now also implements
  `SourcePublisherObservationPort` and `HomeFeedContentSubmissionPort`.
  - `observeSourcePublisher` posts to
    `/collector/source-publishers/observations` and validates the
    response envelope (`body.sourcePublisher.id` is a non-empty string
    AND `body.sourcePublisher.platform / kind / externalPublisherId`
    equal the request). Mismatch ⇒ `CONTENT_MANAGER_RESPONSE_ERROR`.
  - `submitHomeFeedCollectedContent` posts to
    `/collector/content-items/home-feed` and returns
    `contentItem.id` when present.
- Existing `submitCollectedContent` and `getSourceGroup` behavior is
  unchanged.

### Operator CLI

- Directory: `src/operator-tools/profile-home-feed-runner/`.
- Files:
  - `cli-args.ts` / `cli-args.test.ts` — parser for `--base-url <url>`
    and `--browser-provider <name>`. No `--once` or polling args.
    Defaults: `--base-url` falls back to
    `PROFILE_HOME_FEED_RUNNER_BASE_URL`, then `PROFILE_MANAGER_BASE_URL`,
    then `CONTENT_MANAGER_BASE_URL`, then `http://localhost:3000`.
    `--browser-provider` falls back to `BROWSER_PROVIDER`, then
    `playwright`.
  - `runner.ts` / `runner.test.ts` — builds dependencies (drizzle repo
    via `createDatabaseClient()`, `ProfileManagerHttpClient`,
    `ContentManagerHttpClient`,
    `FacebookHomeFeedBrowserPayloadCaptureAdapter`, the Sprint 065A
    extractor, `SystemClock`); claims at most one queued run via the
    existing `ClaimNextProfileHomeFeedCollectionRunUseCase`; executes
    via the new use case; prints a sanitized summary block. Always
    closes the database client in `finally`. Mirrors the dependency
    assembly + `close` lifecycle of
    `account-exercise-worker` and `profile-source-access-check-worker`.
  - `cli.ts` — entrypoint with `SIGINT`/`SIGTERM` handlers that abort
    the `AbortController`. Exit codes: `0` success, `1` failure, `130`
    interrupted.
- `package.json` adds `"profile:home-feed:run-next":
  "tsx src/operator-tools/profile-home-feed-runner/cli.ts"`.

## Security

The runner, capture adapter, content manager extensions, use case, CLI,
and E2E spec never expose, log, persist, or include in fixtures:
cookies, localStorage entries, tokens, authorization headers, proxy
credentials, fingerprint values, trusted runtime configuration, raw
GraphQL payloads, raw upstream exceptions, raw HTML, private
screenshots, or viewer data. All failure messages are fixed sanitized
strings.

## HTTP contracts used (unchanged)

- `POST /collector/source-publishers/observations` — Sprint 063C body
  and response.
- `POST /collector/content-items/home-feed` — Sprint 065C1 body and
  response.
- `POST /collector/profiles/:profileId/home-feed/checkout` — Sprint
  065C2 body and response.
- Profile lease release — Sprint 050 / 054B contract.

## Out Of Scope

- HTTP execute route for `ProfileHomeFeedCollectionRun`.
- Polling worker, scheduler integration, Docker service definition.
- Web UI behavior.
- Profile Manager checkout eligibility, lease semantics, or migrations.
- Content Manager domain, persistence, or migrations.
- Source-group collection behavior.
- `SourcePublisher` review / status mutation / promotion.
- `SourceGroup` promotion.
- Content Builder, Content Publisher.
- Manual live-Facebook validation. Live validation remains opt-in for
  the Product Owner or an authorized operator.

## Verification (recorded)

### Focused unit suites

```text
$ pnpm exec vitest run \
    src/collector-runtime/application/use-cases/execute-profile-home-feed-collection-run.use-case.test.ts \
    src/collector-runtime/infrastructure/facebook-home-feed-browser-payload-capture.test.ts \
    src/collector-runtime/infrastructure/content-manager-http-client.test.ts \
    src/operator-tools/profile-home-feed-runner/cli-args.test.ts \
    src/operator-tools/profile-home-feed-runner/runner.test.ts

 PASS (all) FAIL (0)
```

### Full unit verification

```text
$ pnpm typecheck
(0 errors)

$ pnpm test
 Test Files  118 passed | 14 skipped (132)
      Tests  1651 passed | 15 skipped (1666)

$ pnpm web:typecheck
(0 errors)

$ pnpm web:build
dist/index.html                   0.41 kB
dist/assets/index-rSPDjip7.css   23.60 kB
dist/assets/index-CCdlT0L6.js   648.75 kB
✓ built in 4.97s
```

### Docker-backed DB + HTTP suites (docker-compose.e2e.yml)

```text
$ compose="docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml"
$ $compose down -v --remove-orphans > /dev/null 2>&1 || true
$ $compose build api
$ $compose up -d --wait postgres
$ $compose run --rm --no-deps api sh -lc '
    pnpm db:migrate &&
    RUN_DB_TESTS=true pnpm exec vitest run src/infrastructure --no-file-parallelism'

 Test Files  1 failed | 26 passed | 1 skipped (28)
      Tests  214 passed | 1 skipped (215)
```

The single failed `src/infrastructure/database/repositories/drizzle-dispatch-next-due-collection-schedule.repository.integration.test.ts`
file is the known Sprint 058 isolated-database harness limitation
recorded in earlier sprints (it requires `SPRINT_058_DATABASE_URL` to
point at a dedicated `sprint_058_isolated` database). It is not a
Sprint 065C3 regression: every individual test in the file is
otherwise reported as passing (the suite emits 214 passed in the
serial run), and the file fails only because the guard hook rejects
the shared database URL.

```text
$ $compose run --rm --no-deps api sh -lc '
    RUN_HTTP_DB_TESTS=true pnpm exec vitest run src/interfaces/http --no-file-parallelism'

 Test Files  9 passed (9)
      Tests  176 passed (176)
```

### Docker E2E (Layer 4)

```text
$ pnpm test:e2e:docker

 18 passed (5.1s)
```

The Sprint 065C3 spec
(`tests/e2e/profile-home-feed-run-next.spec.ts`) asserts the
`POST /collector/profile-home-feed-collection-runs` request and the
`POST /collector/profile-home-feed-collection-runs/:id/cancel`
cancellation flow remain stable, with sanitized response shapes.
Live-browser execution of the runner is not exercised in synthetic
E2E because no fake browser provider is wired into the Compose stack;
the runner's orchestration is covered by unit tests with fake ports.

### Other gates

```text
$ git diff --check
(no output)

$ git status --short
 M package.json
 M src/collector-runtime/application/collector-runtime.ports.ts
 M src/collector-runtime/application/index.ts
 M src/collector-runtime/infrastructure/content-manager-http-client.test.ts
 M src/collector-runtime/infrastructure/content-manager-http-client.ts
 M src/collector-runtime/infrastructure/facebook-browser-payload-capture.ts
 M src/collector-runtime/infrastructure/index.ts
?? src/collector-runtime/application/use-cases/execute-profile-home-feed-collection-run.use-case.test.ts
?? src/collector-runtime/application/use-cases/execute-profile-home-feed-collection-run.use-case.ts
?? src/collector-runtime/infrastructure/facebook-home-feed-browser-payload-capture.test.ts
?? src/collector-runtime/infrastructure/facebook-home-feed-browser-payload-capture.ts
?? src/operator-tools/profile-home-feed-runner/
?? tests/e2e/profile-home-feed-run-next.spec.ts
```

(plus the sprint doc itself + `docs/SPRINTS/active.md`,
`docs/PROJECT_SNAPSHOT.md`, `docs/ROADMAP.md` updates once written.)

## Manual live-Facebook validation

**Not performed.** Live-Facebook validation requires an authorized
operator to:

1. Provision a real Facebook profile to `READY` + `COLLECTION_READY`.
2. Queue a `ProfileHomeFeedCollectionRun` for that profile via
   `POST /collector/profile-home-feed-collection-runs`.
3. Run
   `pnpm profile:home-feed:run-next -- --base-url <url> --browser-provider <provider>`.
4. Verify the run reaches `SUCCEEDED` or `FAILED` with a sanitized
   summary, the lease returns to RELEASED, and no sensitive data is
   logged or persisted.

This sprint makes no claim that step 3 has been executed against the
live Facebook network.

## Remaining Risks

- **Synthetic-fixture fake browser.** No deterministic in-memory
  browser provider is wired into the Compose stack, so the E2E layer
  cannot exercise the full capture orchestration end-to-end without
  going live. The orchestration is covered by unit tests; only the
  HTTP request/cancel flow is asserted in E2E.
- **Publisher identity comparison.** The Content Manager response
  identity check is strict (case-sensitive equality of `platform`,
  `kind`, `externalPublisherId`). Sprint 063C source-publisher
  responses already return these fields unchanged from the request, so
  the strict comparison is correct for the current contract; a future
  normalization in Content Manager would require updating the
  comparator.
- **Sprint 058 parallel DB isolation.** The
  `drizzle-dispatch-next-due-collection-schedule.repository.integration.test.ts`
  guard remains a known shared-database harness limitation predating
  Sprint 065C3. No 065C3 file fails when isolated.

## Status

Sprint 065A was accepted at
`28906556bffa2b4052cd429b0bf5634cf74de875`.

Sprint 065B was accepted at
`b9d84cad6d48f4ef94efb5be037550a7409afa05`.

Sprint 065C1 was accepted at
`40b3ce7023c126c03386994a719ae7acb7758f21`.

Sprint 065C2 was accepted at
`6591a05b3ecde7e615f824efc715c815c25bc2d2`.

Sprint 065C3 is **active and authorized** and is implemented in this
working tree. It is not yet accepted.

Sprint 065C3 makes **no live-Facebook execution claim**.
