# Project Snapshot

## Current Product Stage
The product is currently in the **Content Collector** stage (Stage 1 of 3, preceding Builder and Publisher). The core focus is collecting normalized content from configured Facebook sources while maintaining strict isolation between profile management, collection orchestration, and content storage.

## Current Active Sprint
Sprint 064B — Provenance Persistence And Compatibility is **active
and authorized**. It persists the Sprint 064A
`ContentCollectionProvenance` value object as a required
`collectionProvenance` field on every durable `ContentItem`, adds
a final `NOT NULL content_items.collection_provenance JSONB`
column, safely backfills every existing source-group content row
from its `source_group_id` through a split
add-column → backfill → set-NOT-NULL migration sequence mirroring
the existing `0011`/`0012`/`0013` split, integrates provenance
creation (`createInitialContentCollectionProvenance`) and merge
(`mergeContentCollectionProvenance`) into the current
source-group ingestion flow, derives `SOURCE_GROUP` provenance
internally from the required `sourceGroupId`, propagates typed
`ContentCollectionProvenanceConflictError` on conflicting merges,
never saves after a failed merge, and keeps the existing
`ContentItem.sourceGroupId` field and the PostgreSQL
`source_group_id` column required and unchanged for backward
compatibility. The HTTP DTOs and JSON schemas are unchanged;
`collectionProvenance` is internal-only and is not exposed through
HTTP. Sprint 064B does not introduce home-feed ingestion or
execution, does not make `sourceGroupId` nullable, does not add
`SourcePublisher` observation or resolution, does not add a new
HTTP DTO field, does not add a provenance filter or index, and
does not change the Collector Runtime, extractor, browser,
workers, scheduler, Docker, or Web UI. Sprint 064B is not accepted
and is not complete.
Sprint 063C — Source Publisher HTTP Contract and E2E (Accepted).
Sprint 064A — Content Collection Provenance Model (Accepted).
Sprint 064B — Provenance Persistence And Compatibility (Active
and authorized; not accepted and not complete).
Sprint 063B — Source Publisher Persistence and Atomic Observation (Accepted).
Sprint 063A — Source Publisher Domain and Application (Accepted).

- **Content Management**: Storage of normalized Facebook knowledge group text posts and top comments, and the Content Manager-owned `SourcePublisher` identity and observation behavior (durable publishing-source identity for a Facebook group or page observed while reading a feed, with `DISCOVERED | APPROVED | IGNORED | BLOCKED` review status). `SourcePublisher` is distinct from managed `SourceGroup` and is not the future Content Publisher pipeline stage. Sprint 063A (accepted) shipped the domain and application foundation; Sprint 063B (accepted) shipped the durable persistence, the atomic observation algorithm, the durable status update, the durable read operations, and the Content Manager composition wiring; Sprint 063C (accepted) ships the safe observation, list, and get HTTP contracts, the safe `SourcePublisherDto` allowlist, the stub-backed HTTP unit tests, the opt-in PostgreSQL-backed HTTP integration test, the Docker E2E spec through web-gateway, and the corresponding documentation. `SourcePublisher` status mutation (approve / ignore / block) remains deferred to Sprint 066; no review UI, no Web UI changes, no Collector Runtime consumption, no browser execution, and no feed execution are part of Sprint 063C. Sprint 064A (accepted) adds the pure Content Manager `ContentCollectionProvenance` domain model: a strict, Zod-validated `CollectionSurface` discriminated union with `SOURCE_GROUP` (with `sourceGroupId`) and `PROFILE_HOME_FEED` (no profile id, no source group id) branches; a `CollectedContentProvenanceInput` with the collection surface, an optional `sourcePublisherId`, and an optional `managedSourceGroupId` (required and equal to the surface `sourceGroupId` when the surface is `SOURCE_GROUP`; absent or present when the surface is `PROFILE_HOME_FEED`); a durable `ContentCollectionProvenance` with the immutable `firstCollectionSurface` plus the optional associations (the same cross-field rule applies); pure `createInitialContentCollectionProvenance` and `mergeContentCollectionProvenance` that runtime-validate their inputs and outputs against the existing Zod domain schemas, preserve the first surface, fill absent associations later, are idempotent on identical observations, do not mutate inputs, and throw a typed `ContentCollectionProvenanceConflictError` (code `CONTENT_COLLECTION_PROVENANCE_CONFLICT`) on conflicting `sourcePublisherId` or `managedSourceGroupId`. Sprint 064B (active and authorized) persists the Sprint 064A `ContentCollectionProvenance` value object as a required `collectionProvenance` field on every durable `ContentItem`, adds a final `NOT NULL content_items.collection_provenance JSONB` column, safely backfills every existing source-group content row from its `source_group_id` through a split add-column → backfill → set-NOT-NULL migration sequence mirroring the existing `0011`/`0012`/`0013` split, integrates provenance creation (`createInitialContentCollectionProvenance`) and merge (`mergeContentCollectionProvenance`) into the current source-group ingestion flow, derives `SOURCE_GROUP` provenance internally from the required `sourceGroupId`, propagates typed `ContentCollectionProvenanceConflictError` on conflicting merges, never saves after a failed merge, and keeps the existing `ContentItem.sourceGroupId` field and the PostgreSQL `source_group_id` column required and unchanged for backward compatibility. The HTTP DTOs and JSON schemas are unchanged; `collectionProvenance` is internal-only and is not exposed through HTTP. Sprint 064B does not introduce home-feed ingestion or execution, does not make `sourceGroupId` nullable, does not add `SourcePublisher` observation or resolution, does not add a new HTTP DTO field, does not add a provenance filter or index, and does not change the Collector Runtime, extractor, browser, workers, scheduler, Docker, or Web UI.

- Sprint 062: Feed Discovery Delivery Plan And Docker E2E Foundation (Accepted).
Sprint 061: Operator Collection Schedule Management Surface (Accepted).
Sprint 060: Collection Scheduler Containerization and Stack Integration (Accepted).
Sprint 059: Scheduled Collection Dispatch Poller (Accepted).
Sprint 058: Atomic Scheduled Collection Dispatch (Accepted).
Sprint 057: Collection Schedule Domain and Persistence Foundation (Accepted).
Sprint 056: Operator Authentication Health Filtering and Profile Inventory Pagination (Accepted).
Sprint 055: Operator Authentication Recovery and Reprovisioning (Accepted).
Sprint 054B: Runtime Authentication Health Reporting and Checkout Enforcement (Accepted).
Sprint 054A: Profile Authentication Health Foundation (Accepted).

## Currently Available Capabilities
- **Profile Management**: Creation, lifecycle, session ingestion, checkout leasing, and operator-driven recovery reprovisioning for `REAUTH_REQUIRED` and `CHECKPOINT_REVIEW_REQUIRED` profiles.
- **Content Management**: Storage of normalized Facebook knowledge group text posts and top comments, and the Content Manager-owned `SourcePublisher` identity and observation behavior (durable publishing-source identity for a Facebook group or page observed while reading a feed, with `DISCOVERED | APPROVED | IGNORED | BLOCKED` review status). `SourcePublisher` is distinct from managed `SourceGroup` and is not the future Content Publisher pipeline stage. Sprint 063A (accepted) shipped the domain and application foundation; Sprint 063B (accepted) shipped the durable persistence, the atomic observation algorithm, the durable status update, the durable read operations, and the Content Manager composition wiring; Sprint 063C (accepted) ships the safe observation, list, and get HTTP contracts, the safe `SourcePublisherDto` allowlist, the stub-backed HTTP unit tests, the opt-in PostgreSQL-backed HTTP integration test, the Docker E2E spec through web-gateway, and the corresponding documentation. `SourcePublisher` status mutation (approve / ignore / block) remains deferred to Sprint 066; no review UI, no Web UI changes, no Collector Runtime consumption, no browser execution, and no feed execution are part of Sprint 063C. Sprint 064A (active and authorized) adds the pure Content Manager `ContentCollectionProvenance` domain model: a strict, Zod-validated `CollectionSurface` discriminated union with `SOURCE_GROUP` (with `sourceGroupId`) and `PROFILE_HOME_FEED` (no profile id, no source group id) branches; a `CollectedContentProvenanceInput` with the collection surface, an optional `sourcePublisherId`, and an optional `managedSourceGroupId` (required and equal to the surface `sourceGroupId` when the surface is `SOURCE_GROUP`; absent or present when the surface is `PROFILE_HOME_FEED`); a durable `ContentCollectionProvenance` with the immutable `firstCollectionSurface` plus the optional associations (the same cross-field rule applies); pure `createInitialContentCollectionProvenance` and `mergeContentCollectionProvenance` that runtime-validate their inputs and outputs against the existing Zod domain schemas, preserve the first surface, fill absent associations later, are idempotent on identical observations, do not mutate inputs, and throw a typed `ContentCollectionProvenanceConflictError` (code `CONTENT_COLLECTION_PROVENANCE_CONFLICT`) on conflicting `sourcePublisherId` or `managedSourceGroupId`. Sprint 064A adds no persistence, HTTP, application, composition, runtime, extractor, browser, scheduler, Docker, or Web UI behavior.
- **Collection Execution**: Headless browser extraction using Playwright (or experimental CloakBrowser). Worker processes automatically consume queued collection runs, ambient exercise runs, and access-check runs.
- **Collection Scheduling**: One persisted `CollectionSchedule` per source group (interval, next run, parameters). A containerized `collection-scheduler` Compose service drains due schedules into queued `SCHEDULED` collection runs on an interval; the scheduler-runtime image does not provision browser executables, Playwright browser downloads, Xvfb, browser-specific system packages, or a runnable CloakBrowser browser/system runtime, and does not launch a browser.
- **Operator Tools**: CLI tools for profile provisioning, manual collection, worker execution, browser probing, the same provisioning CLI used for first-time and recovery login, and the containerized collection scheduler.
- **Web UI**: Dashboard for managing profiles, source groups, categories, content items, and reviewing run status. The profile detail page now displays `authenticationHealth` and a generalized provisioning card for `Start Provisioning`, `Issue New Provisioning Token`, `Start Reauthentication`, and `Start Manual Checkpoint Recovery`. The profile inventory page now supports URL-backed Status and Authentication Health filters, a `Health Updated` column, and 25-item pagination with Previous / Next navigation.
- **Docker E2E**: An isolated production-like Docker E2E harness (`docker-compose.e2e.yml`) that runs the production Nginx gateway, the API after migrations, an isolated PostgreSQL instance, and a Playwright Chromium runner. The harness proves the current stack works end-to-end using only synthetic fixtures. It never touches dev or preview volumes and never publishes a host port.

## Current Modules
- **Collector Profile Manager**: Identity, sessions, provisioning, readiness, leases.
- **Content Manager**: Categories, source groups, normalized content, deduplication.
- **Collector Runtime**: Collection orchestration, browser providers, extraction, submission, collection-schedule domain, atomic scheduled dispatch, scheduled dispatch poller.
- **Web UI**: Operator presentation and safe API consumption.

## Important Architectural Invariants
- Hexagonal architecture: Domain logic has zero dependencies on HTTP, databases, browsers, or queues.
- Security: Raw session data (cookies, tokens, proxy credentials) and raw Facebook private payloads are never exposed to the UI, logs, or persistent records.
- Separation of Concerns: Profile readiness/leasing is owned entirely by Profile Manager. Browsers consume leases but do not determine profile eligibility.
- Test isolation: The E2E harness uses its own Compose project (`fgc-v3-e2e`), its own named volume (`fgc_e2e_postgres_data`), and its own network. It cannot read or modify dev or preview resources.

## Important Unresolved Risks
- Scale of active profile checkout frequency vs PostgreSQL concurrency.
- Long-term viability of browser provider evasion capabilities (e.g. Playwright vs CloakBrowser) against Facebook fingerprinting.
- Future Content Builder handoff payload structure.

## Testing Strategy
The cross-cutting testing strategy is documented in [`docs/TESTING_STRATEGY.md`](TESTING_STRATEGY.md). It defines five layers: unit tests (Vitest), database integration tests (opt-in Vitest with PostgreSQL), HTTP integration tests (opt-in Vitest with PostgreSQL), Docker E2E (Sprint 062 Playwright in production-like Compose), and manual live-Facebook validation (opt-in operator-driven probes).

## Verification Commands
```bash
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:http:db
pnpm web:typecheck
pnpm web:build
pnpm test:e2e:docker
```

## Immediate Next Expected Work
Sprint 061 closed the operator feedback loop for collection schedules
by adding HTTP routes, a Web UI page, and the small SCHEDULED regression
fix. Sprint 062 is accepted: it published the feed discovery delivery
plan, the cross-cutting testing strategy, the isolated Docker E2E
harness, and the baseline E2E flow that proves the production-like
stack works through Nginx → API → migrations → PostgreSQL using only
synthetic fixtures. Sprint 063A — Source Publisher Domain and
Application is accepted: it shipped the Content Manager domain and
application foundation for the `SourcePublisher` identity and
observation behavior (no persistence, no HTTP, no UI, no browser, no
feed execution) plus strict runtime validation for the observation
application input and the regression coverage that proves invalid
input is rejected before any use-case side effect. Sprint 063B —
Source Publisher Persistence and Atomic Observation is accepted: it
shipped the `source_publishers` Drizzle schema and migration, the
`DrizzleSourcePublisherRepository` adapter with the atomic observation
algorithm, the durable status update, the durable read operations,
the Content Manager composition wiring, the unit and mapper tests,
the opt-in database integration tests, and the real PostgreSQL
concurrency tests. Sprint 063C — Source Publisher HTTP Contract
and E2E is accepted: it ships the safe observation, list, and get
HTTP contracts, the safe `SourcePublisherDto` allowlist, the
stub-backed HTTP unit tests, the opt-in PostgreSQL-backed HTTP
integration test, the Docker E2E spec through web-gateway, and
the corresponding documentation. Status mutation (approve / ignore /
block) is intentionally deferred to Sprint 066. Sprint 064A —
Content Collection Provenance Model is active and authorized: it
adds the pure Content Manager `ContentCollectionProvenance`
domain model (the `CollectionSurface` discriminated union, the
strict input and durable schemas with the corrected
`PROFILE_HOME_FEED` `managedSourceGroupId` rule, the typed
`ContentCollectionProvenanceConflictError`, and the pure create /
merge behavior with runtime validation against the existing Zod
domain schemas) plus the focused unit test coverage. Sprint 064A
adds no persistence, HTTP, application, composition, runtime,
extractor, browser, scheduler, Docker, or Web UI behavior. Sprint
064B — Provenance Persistence And Compatibility is active and
authorized: it persists the Sprint 064A
`ContentCollectionProvenance` value object as a required
`collectionProvenance` field on every durable `ContentItem`, adds a
final `NOT NULL content_items.collection_provenance JSONB` column,
safely backfills every existing source-group content row from its
`source_group_id` through a split add-column → backfill →
set-NOT-NULL migration sequence mirroring the existing
`0011`/`0012`/`0013` split, integrates provenance creation and
merge into the current source-group ingestion flow, derives
`SOURCE_GROUP` provenance internally from the required
`sourceGroupId`, propagates typed
`ContentCollectionProvenanceConflictError` on conflicting merges,
never saves after a failed merge, and keeps the existing
`ContentItem.sourceGroupId` field and the PostgreSQL
`source_group_id` column required and unchanged for backward
compatibility. The HTTP DTOs and JSON schemas are unchanged;
`collectionProvenance` is internal-only and is not exposed through
HTTP. Future
sprint work after Sprint 064A follows the 064A–068 sequence
documented in `docs/ROADMAP.md`, in which `SourcePublisher` is
the Content Manager-owned publishing-source identity (a group or
a page observed while reading the feed) and is not the future
Content Publisher pipeline stage. The long-term `Future: Content
Builder` and `Future: Content Publisher` pipeline stages are
retained.