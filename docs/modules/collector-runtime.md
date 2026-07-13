# Collector Runtime

## Ownership
- Execution of collection workflows (queues, workers).
- Durable run records for collection, ambient exercise, profile-source access checks, and profile-bound home-feed runs.
- Orchestrating profile checkout from Collector Profile Manager (including profile-bound home-feed checkout via the new `ProfileHomeFeedCheckoutPort`).
- Orchestrating browser automation, network payload capture, and page context interaction.
- Platform Extractors (e.g. Facebook GraphQL Payload Extractor) converting raw artifacts to normalized inputs.
- Submitting normalized collected content to Content Manager.
- Processing lease-scoped runtime profile configuration.
- Detecting authentication walls (login, checkpoints).
- Owns the `CollectionSchedule` aggregate (one schedule per source group; persisted schedule, not yet driving dispatch).
- Atomic scheduled dispatch: `DispatchNextDueCollectionScheduleUseCase` selects one enabled due schedule with `FOR UPDATE SKIP LOCKED`, inserts a `QUEUED` `SCHEDULED` `CollectionRun`, and advances the schedule's `next_run_at` per the cadence policy, all in a single PostgreSQL transaction. Missed intervals produce one run only. See [Sprint 058](../SPRINTS/SPRINT-058-atomic-scheduled-collection-dispatch.md).
- Scheduled dispatch poller: the **collection scheduler** (`src/operator-tools/collection-scheduler/`) is a sibling CLI that polls `DispatchNextDueCollectionScheduleUseCase` on an interval; it dispatches due schedules into runs but never executes them — execution remains the collector worker's job. See [Sprint 059](../SPRINTS/SPRINT-059-scheduled-collection-dispatch-poller.md). The scheduler is available as an opt-in `collection-scheduler` Docker Compose service in the dev and preview stacks, built from a lightweight `scheduler-runtime` image that does not install or run a browser. See [Sprint 060](../SPRINTS/SPRINT-060-collection-scheduler-containerization.md).
- Owns the `ProfileHomeFeedCollectionSchedule` aggregate (one schedule per profile; persisted schedule configuration only). Sprint 068A exposes safe operator create/update, get, and list HTTP routes for these profile-bound home-feed schedules, but does not dispatch schedules into home-feed runs, wire a poller, execute browser collection, or change the one-shot home-feed executor. Sprint 068C exposes those routes through a Web UI list / create / edit / enable / disable page at `/profile-home-feed-schedules` (read-only presentation of safe Profile Manager summary metadata; no behavior change to the backend).
- Current state: Sprint 071 exposes the existing safe `ProfileHomeFeedCollectionRun` request/list/get/cancel HTTP contracts through the Web UI at `/profile-home-feed-collection-runs`, allowing operators to queue manual profile-bound Facebook home-feed collection runs, monitor and filter runs by status/profile, refresh, paginate, poll active QUEUED/RUNNING rows, and cancel only QUEUED/RUNNING runs. Backend behavior, persistence, HTTP routes, schedules, scheduled dispatch, the bounded runner, scheduler/worker services, Docker, and other modules are unchanged.
- Profile home-feed scheduled dispatch: `DispatchNextDueProfileHomeFeedCollectionScheduleUseCase` selects one eligible due profile-home-feed schedule, performs profile reference lookup outside any database transaction, and persists exactly one queued `SCHEDULED` `ProfileHomeFeedCollectionRun` or a safe skip/defer outcome through a schedule compare-and-set repository.
- Profile home-feed runtime services: `src/operator-tools/profile-home-feed-scheduler/` polls the existing scheduled dispatch use case, and `src/operator-tools/profile-home-feed-worker/` claims queued profile home-feed runs and delegates execution to the existing bounded home-feed runner. Sprint 068B2 exposes them as separate opt-in `profile-home-feed-scheduler` and `profile-home-feed-worker` Docker Compose services in dev and preview. The scheduler uses the lightweight `scheduler-runtime` image and does not launch a browser; the worker uses `worker-runtime` and starts Xvfb like the other browser-backed worker services.

## Safe Home-Feed Diagnostic Contract (Sprint 074)

Sprint 074 adds a strict, safe, aggregate diagnostic summary on every terminal `ProfileHomeFeedCollectionRun`. The summary is owned by **Collector Runtime**; it is never persisted by Content Manager, never copied into the broader run, and is exposed only through the existing profile home-feed run read contracts and Web UI.

### Ownership

- **Source of truth**: `src/collector-runtime/domain/profile-home-feed-diagnostic-summary.schemas.ts`. Domain types are inferred from the Zod schema; the public summary is the strict `ProfileHomeFeedDiagnosticSummary`.
- **Persistence**: a single nullable JSONB column `profile_home_feed_collection_runs.diagnostics` (migration `drizzle/0028_profile_home_feed_collection_runs_diagnostics.sql`). The mapper rejects unknown warning codes, unknown failure codes, unknown page-state values, and unknown schema versions at the boundary.
- **Capture & execution propagation**: `src/collector-runtime/application/profile-home-feed-diagnostic-aggregator.ts` is the pure aggregator; `ExecuteProfileHomeFeedCollectionRunUseCase` records events at every stage and forwards the finalized summary through `markSucceeded` and `markFailed`.
- **HTTP**: `ProfileHomeFeedCollectionRunDto` exposes `diagnostics?` via a strict OpenAPI allowlist (`additionalProperties: false` on every nested block).
- **Web UI**: `apps/web/src/pages/profile-home-feed-collection-runs-page.tsx` renders an explicit "Diagnostics unavailable for this run" placeholder for older runs without the field, and a structured panel for newer runs.
- **Operator logger**: the bounded home-feed runner (`src/operator-tools/profile-home-feed-runner/runner.ts`) prints the diagnostic lines alongside the existing safe summary block. No raw URLs, no Facebook field values, no upstream error codes are logged.

### Schema version

- `schemaVersion` is a required integer literal `1`.
- Older runs without a `diagnostics` column (pre-Sprint 074) are readable: the mapper returns `null`, the domain `run.diagnostics` is `undefined`, the HTTP DTO omits the `diagnostics` field, the Web UI shows "Diagnostics unavailable for this run."
- New runs always write a `diagnostics` JSON object; on the existing unaccepted Sprint 074 implementation rows, a one-time re-shape is not part of the sprint.

### Strict, safe shape

- **Capture counters** (`capture`): aggregate counts from the existing `FacebookPayloadCaptureDiagnostics` — page-context fetch/XHR counts, network listener count, parse failure count, payloads passed to the extractor. Counts are non-negative integers.
- **Capture stage** (`captureStage`): closed enum `NOT_STARTED | IN_PROGRESS | SUCCEEDED | CAPTURE_FAILED | INTERRUPTED`.
- **Capture page state** (`capturePageState`): closed enum `HOME_FEED | LOGIN | CHECKPOINT | OTHER`. The original raw URL and any upstream `FacebookPageBlockingState` value are mapped into one of these four values at the application boundary; raw URLs are never persisted, returned, or logged.
- **Capture login redirect** (`captureLoginRedirectSuspected`): boolean. Set from the existing capture-port diagnostic.
- **Extractor counters** (`extractor`): `extractedCandidateCount` is the total raw extractor output before executor-level cross-payload deduplication; `deduplicatedCandidateCount` is the count of candidates that survived the executor's `platform + externalPostId` cross-payload dedup and the `maxPosts` ceiling. The two are independent and truthful.
- **Warning histogram** (`warningCounts`): partial `Record<ProfileHomeFeedDiagnosticWarningCode, non-negative integer>`. Keys are restricted to the 13 allowlisted `FacebookHomeFeedExtractionWarningCode` values; unknown keys are rejected by the strict Zod object schema and the strict OpenAPI `additionalProperties: false` allowlist.
- **Unsupported payload count** (`unsupportedPayloadCount`): non-negative integer, derived from the `UNSUPPORTED_PAYLOAD_SHAPE` extractor warning.
- **Run outcome** (`runOutcome`): `failureStage` from the closed enum `BOUNDS_EXCEEDED | CHECKOUT | CAPTURE | PUBLISHER_OBSERVATION | CONTENT_SUBMISSION | LEASE_RELEASE | PARTIAL | INTERRUPTED | EXECUTION`; `failureCode` from the closed enum `PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES`. When the lease release fails, the run outcome is force-overwritten to `LEASE_RELEASE` with code `HOME_FEED_LEASE_RELEASE_FAILED` so a stale stage from a prior branch cannot leak into the persisted row.

### Prohibited fields (must not appear on the diagnostic contract)

- Raw Facebook payloads or response bodies
- Cookies, localStorage, tokens, authorization headers, proxy credentials, fingerprint secrets, trusted runtime configuration
- Viewer / account identifiers, screenshots, raw HTML, stack traces
- The full or sanitized final-page URL. **No URL** appears on the diagnostic contract — not on the persisted column, not in the HTTP DTO, not in the Web UI, not in operator logs. Only the closed `capturePageState` enum value is permitted.
- Upstream capture-port error codes. Every code is mapped to an allowlisted `PROFILE_HOME_FEED_DIAGNOSTIC_FAILURE_CODES` value at the application boundary via `mapCaptureErrorCodeToFailureCode`; the original code is never copied through.

### Backward compatibility for legacy rows

Sprint 074 is unaccepted. The chosen compatibility behavior for any pre-Sprint 074 rows is **read-and-omit**: existing rows that pre-date this sprint carry a `NULL` `diagnostics` column, the mapper returns `null`, the domain `run.diagnostics` is `undefined`, the HTTP DTO omits `diagnostics`, the Web UI shows the explicit unavailable state. No data migration, no shape coercion, and no back-fill of legacy rows is performed.

## Does Not Own
- Profile property invariants, session ingestion rules, or checkout eligibility.
- Content item lifecycle, deduplication, or storage.
- Source group entry route metadata mutations.
- Automatic profile account stage promotion or demotion.
- Authority over profile identity or proxy/fingerprint secrets.

## Important Source Paths
- `src/collector-runtime/`
- `src/collector-runtime/platform-extractors/`
- `src/collector-runtime/workers/`
- `src/collector-runtime/infrastructure/adapters/browser/`

## Important Entrypoints
- `Workers`: `src/collector-runtime/workers/` (e.g. `start-collector-worker.ts`)
- `Orchestration`: Collection flow use cases invoking HTTP clients to other modules.
- `Platform Extractors`: Pure domain logic mapping raw JSON to normalized types.

## Critical Invariants
- Must release profile leases accurately, specifically in error or interruption paths.
- Extractor rules must yield data complying with the Content Manager schema.
- Must safely detect and yield on authentication issues, relying on Profile Manager to handle health states.

## Cross-Module Communication
- Uses explicit HTTP or adapter contracts to interface with Profile Manager (for leases/config) and Content Manager (for submission).
- Does not import repositories from other modules.

## Sensitive Data Rules
- Browser provider execution must not leak runtime config, cookies, or payloads to logs.
- Extractor test fixtures must use synthetic or sanitized real data.

## Relevant Verification Commands
```bash
pnpm test src/collector-runtime
pnpm test:db src/collector-runtime
pnpm test:http:db src/collector-runtime
```
