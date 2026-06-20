# Project Snapshot

## Current Product Stage
The product is currently in the **Content Collector** stage (Stage 1 of 3, preceding Builder and Publisher). The core focus is collecting normalized content from configured Facebook sources while maintaining strict isolation between profile management, collection orchestration, and content storage.

## Current Active Sprint
Sprint 065A — Facebook Home-Feed Extractor Fixtures is **accepted** at
`28906556bffa2b4052cd429b0bf5634cf74de875`. It added the separate,
pure, fixture-driven Facebook home-feed extractor and made no
live-Facebook validation claim.

Sprint 065B — Profile-Bound Home-Feed Run Model is **accepted** at
`b9d84cad6d48f4ef94efb5be037550a7409afa05`. It added the durable
Collector Runtime `ProfileHomeFeedCollectionRun` aggregate and
lifecycle, application ports/use cases, PostgreSQL persistence, safe
operator HTTP request/list/get/cancel routes, and composition wiring.
It stored `profileId` as the operational target reference, used the
strict `{ platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" }` target,
used `MANUAL_API` only, preserved existing
`CollectionRun.sourceGroupId` requiredness, and did not create a fake
Home Feed `SourceGroup`. Sprint 065B did not execute a browser, connect
to the Sprint 065A extractor, capture payloads, observe
`SourcePublisher`, submit Content Manager items, add workers or
schedulers, change Docker, add Web UI behavior, or make any
live-Facebook claim.

Sprint 065C1 — Bare Home-Feed Content Ingestion is **accepted** at
`40b3ce7023c126c03386994a719ae7acb7758f21`. It closes the gap
between Sprint 065A's normalized home-feed candidates and Content
Manager ingestion by making `ContentItem.sourceGroupId` optional in
the domain schema and DTOs and `NULL`-tolerant in PostgreSQL, adding
a dedicated `IngestHomeFeedCollectedContentUseCase` that ingests a
home-feed candidate with `sourcePublisherId` only and persists an
item whose `firstCollectionSurface.kind = "PROFILE_HOME_FEED"` with
no `sourceGroupId`, no `managedSourceGroupId`, and no fake Home Feed
`SourceGroup`. It adds `POST /collector/content-items/home-feed` with
a strict allowlist body schema and extends the existing source-group
ingestion so a later source-group collection can fill
`sourceGroupId` and `managedSourceGroupId` on an existing
home-feed-first item while preserving the original
`PROFILE_HOME_FEED` first surface. The Web UI tolerates omitted
`sourceGroupId` and renders "No managed source group" safely.
Sprint 065C1 does not add browser execution, Facebook navigation,
capture, extractor orchestration, Collector Runtime HTTP client
changes, workers, schedulers, Docker service changes, live-Facebook
validation, `SourcePublisher` review or status mutation,
source-group promotion, Content Builder, or Content Publisher
behavior. `collectionProvenance` remains internal-only and is not
exposed through HTTP DTOs. Sprint 065C1 makes no browser or
live-Facebook execution claim.

Sprint 065C2 — Profile-Bound Home-Feed Checkout is the **only active
and authorized** sprint. It is the implementation authority. It
adds the explicit profile-bound checkout path for the exact profile
referenced by a `ProfileHomeFeedCollectionRun`. It extends
`ProfileLeasePurpose` with a fourth value, `HOME_FEED_COLLECTION`,
which shares the existing `COLLECTION_READY` account-stage rule and
the full existing safety and readiness check set (including the
approved `NETWORK_CONTEXT_MISSING` rule). It adds
`CheckoutProfileForHomeFeedCollectionUseCase` (input: `{ profileId }`
only — no Source Group, no profile-source access record, no
candidate selection) which loads the exact requested profile, then
queries the active lease, throws `ProfileLeaseStateConflictError`
when an active lease exists, evaluates `HOME_FEED_COLLECTION`
eligibility, and atomically marks the profile `BUSY` and saves an
`ACTIVE` `HOME_FEED_COLLECTION` lease through the existing
transaction manager. It adds `POST
/collector/profiles/:profileId/home-feed/checkout` with no required
body and a strict empty-allowlist body schema. Duplicate checkouts
of the same profile are mapped to HTTP 409 with
`PROFILE_LEASE_STATE_CONFLICT`. It extends `ProfileManagerHttpClient`
with a dedicated `checkoutProfileForHomeFeedCollection(profileId)`
method backed by a new application-owned
`ProfileHomeFeedCheckoutPort` whose `accountStage` is typed as
`CollectorRuntimeAccountStage` (parsed through
`CollectorRuntimeAccountStageSchema`; an unsupported or malformed
account stage produces `PROFILE_MANAGER_RESPONSE_ERROR`). The port
returns only `{ profileId, accountStage, leaseId, leaseExpiresAt? }`.
It adds migration `0024` (PostgreSQL `ALTER TYPE ... ADD VALUE`) to
add `HOME_FEED_COLLECTION` to the existing
`collector_profile_lease_purpose` enum. The migration preserves the
one-active-lease-per-profile unique partial index unchanged.
`GetRuntimeProfileConfigurationUseCase` accepts an active
`HOME_FEED_COLLECTION` lease for its matching `BUSY` profile.
`ReleaseProfileLeaseUseCase` releases the lease and returns the
profile to `READY`. Sprint 065C2 does not execute a run, navigate
Facebook, capture payloads, observe `SourcePublisher`, submit
Content Manager items, add workers or schedulers, change Docker,
add Web UI behavior, or make any live-Facebook claim. The new
`ProfileHomeFeedCheckoutPort` is not wired into a worker or executor
in Sprint 065C2.

Sprint 065C3 remains **inactive and unauthorized**. It will split
the Sprint 065C "Manual Home-Feed Execution" work but is not
authorized by Sprint 065C2.
Sprint 065C2 — Profile-Bound Home-Feed Checkout (Active).
Sprint 065C1 — Bare Home-Feed Content Ingestion (Accepted).
Sprint 065B — Profile-Bound Home-Feed Run Model (Accepted).
Sprint 065A — Facebook Home-Feed Extractor Fixtures (Accepted).
Sprint 063C — Source Publisher HTTP Contract and E2E (Accepted).
Sprint 064A — Content Collection Provenance Model (Accepted).
Sprint 064B — Provenance Persistence And Compatibility (Accepted).
Sprint 063B — Source Publisher Persistence and Atomic Observation (Accepted).
Sprint 063A — Source Publisher Domain and Application (Accepted).

- **Content Management**: Storage of normalized Facebook knowledge group text posts and top comments, and the Content Manager-owned `SourcePublisher` identity and observation behavior (durable publishing-source identity for a Facebook group or page observed while reading a feed, with `DISCOVERED | APPROVED | IGNORED | BLOCKED` review status). `SourcePublisher` is distinct from managed `SourceGroup` and is not the future Content Publisher pipeline stage. Sprint 063A (accepted) shipped the domain and application foundation; Sprint 063B (accepted) shipped the durable persistence, the atomic observation algorithm, the durable status update, the durable read operations, and the Content Manager composition wiring; Sprint 063C (accepted) ships the safe observation, list, and get HTTP contracts, the safe `SourcePublisherDto` allowlist, the stub-backed HTTP unit tests, the opt-in PostgreSQL-backed HTTP integration test, the Docker E2E spec through web-gateway, and the corresponding documentation. `SourcePublisher` status mutation (approve / ignore / block) remains deferred to Sprint 066; no review UI, no Web UI changes, no Collector Runtime consumption, no browser execution, and no feed execution are part of Sprint 063C. Sprint 064A (accepted) adds the pure Content Manager `ContentCollectionProvenance` domain model: a strict, Zod-validated `CollectionSurface` discriminated union with `SOURCE_GROUP` (with `sourceGroupId`) and `PROFILE_HOME_FEED` (no profile id, no source group id) branches; a `CollectedContentProvenanceInput` with the collection surface, an optional `sourcePublisherId`, and an optional `managedSourceGroupId` (required and equal to the surface `sourceGroupId` when the surface is `SOURCE_GROUP`; absent or present when the surface is `PROFILE_HOME_FEED`); a durable `ContentCollectionProvenance` with the immutable `firstCollectionSurface` plus the optional associations (the same cross-field rule applies); pure `createInitialContentCollectionProvenance` and `mergeContentCollectionProvenance` that runtime-validate their inputs and outputs against the existing Zod domain schemas, preserve the first surface, fill absent associations later, are idempotent on identical observations, do not mutate inputs, and throw a typed `ContentCollectionProvenanceConflictError` (code `CONTENT_COLLECTION_PROVENANCE_CONFLICT`) on conflicting `sourcePublisherId` or `managedSourceGroupId`. Sprint 064B (accepted) persists the Sprint 064A `ContentCollectionProvenance` value object as a required `collectionProvenance` field on every durable `ContentItem`, adds a final `NOT NULL content_items.collection_provenance JSONB` column, safely backfills every existing source-group content row from its `source_group_id` through a split add-column → backfill → set-NOT-NULL migration sequence mirroring the existing `0011`/`0012`/`0013` split, integrates provenance creation (`createInitialContentCollectionProvenance`) and merge (`mergeContentCollectionProvenance`) into the current source-group ingestion flow, derives `SOURCE_GROUP` provenance internally from the required `sourceGroupId`, propagates typed `ContentCollectionProvenanceConflictError` on conflicting merges, never saves after a failed merge, and keeps the existing `ContentItem.sourceGroupId` field and the PostgreSQL `source_group_id` column required and unchanged for backward compatibility. The HTTP DTOs and JSON schemas are unchanged; `collectionProvenance` is internal-only and is not exposed through HTTP. Sprint 064B does not introduce home-feed ingestion or execution, does not make `sourceGroupId` nullable, does not add `SourcePublisher` observation or resolution, does not add a new HTTP DTO field, does not add a provenance filter or index, and does not change the Collector Runtime, extractor, browser, workers, scheduler, Docker, or Web UI. Sprint 065C1 (accepted) makes `ContentItem.sourceGroupId` optional in the domain schema and DTOs and `NULL`-tolerant in PostgreSQL while preserving the existing `sourceGroupId`-required source-group ingestion contract, adds a dedicated `IngestHomeFeedCollectedContentUseCase` whose input carries only `sourcePublisherId` and normalized safe content, validates that the publisher exists and its platform matches, and persists the resulting item with `firstCollectionSurface.kind = "PROFILE_HOME_FEED"`, no `sourceGroupId`, no `managedSourceGroupId`, and no fake Home Feed `SourceGroup`. The use case preserves the immutable first surface on duplicates, fills absent associations on later merges, is idempotent for identical associations, and rejects conflicting associations through the existing typed `ContentCollectionProvenanceConflictError`. Sprint 065C1 adds `POST /collector/content-items/home-feed` with a strict allowlist body schema, makes `ContentItemDto.sourceGroupId` optional and omits it when absent, and keeps `collectionProvenance` internal-only. It extends the existing source-group ingestion so a later source-group collection can fill `sourceGroupId` and `managedSourceGroupId` on a home-feed-first item while preserving its `PROFILE_HOME_FEED` first surface. Sprint 065C1 extends the Web UI `ContentItem` schema and list/detail pages to render "No managed source group" safely when `sourceGroupId` is omitted. Sprint 065C1 does not add browser execution, Facebook navigation, capture, extractor orchestration, Collector Runtime HTTP client changes, workers, schedulers, Docker service changes, live-Facebook validation, `SourcePublisher` review or status mutation, source-group promotion, Content Builder, or Content Publisher behavior. Sprint 065C2 is the only active and authorized sprint. Sprint 065C3 remains inactive and unauthorized.

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
- **Content Management**: Storage of normalized Facebook knowledge group text posts and top comments, the Content Manager-owned `SourcePublisher` identity and observation behavior, durable `ContentCollectionProvenance` on content items, and Sprint 065C1's bare home-feed content ingestion. Sprint 063A through 064B and 065B are accepted; Sprint 065C1 is active and authorized; status mutation (approve / ignore / block) remains deferred to Sprint 066. The existing HTTP DTOs do not expose `collectionProvenance`; Sprint 065C1's `ContentItemDto.sourceGroupId` is optional and omitted when absent.
- **Collection Execution**: Headless browser extraction using Playwright (or experimental CloakBrowser). Worker processes automatically consume queued collection runs, ambient exercise runs, and access-check runs. Collector Runtime has the existing source-group Facebook GraphQL payload extractor, the accepted Sprint 065A pure home-feed fixture extractor contract for group/page candidates, and accepted Sprint 065B's profile-bound home-feed run model. Sprint 065C1 adds bare home-feed content ingestion to Content Manager but does not add live home-feed execution. Sprint 065C2 and Sprint 065C3 remain inactive and unauthorized.
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
Content Collection Provenance Model is accepted, and Sprint 064B —
Provenance Persistence And Compatibility is accepted. Sprint 065A —
Facebook Home-Feed Extractor Fixtures is accepted at
`28906556bffa2b4052cd429b0bf5634cf74de875`. Sprint 065B —
Profile-Bound Home-Feed Run Model is accepted at
`b9d84cad6d48f4ef94efb5be037550a7409afa05`. Sprint 065C1 — Bare
Home-Feed Content Ingestion is accepted at
`40b3ce7023c126c03386994a719ae7acb7758f21`: it adds the
nullable `ContentItem.sourceGroupId`, the dedicated
`IngestHomeFeedCollectedContentUseCase`, the strict
`POST /collector/content-items/home-feed` HTTP route, the
source-group follow-up merge that fills `sourceGroupId` and
`managedSourceGroupId` on a home-feed-first item while preserving the
original `PROFILE_HOME_FEED` first surface, the Web UI tolerance for
omitted `sourceGroupId`, and the matching migration / journal /
snapshot updates — without browser execution, extractor invocation,
workers, scheduler, Docker, or live-Facebook validation. Sprint 065C2
is the only active and authorized sprint. Sprint 065C3 remains
inactive and unauthorized. Future sprint work follows
the 064A–068 sequence documented in `docs/ROADMAP.md`, in which
`SourcePublisher` is the Content Manager-owned publishing-source
identity (a group or a page observed while reading the feed) and is
not the future Content Publisher pipeline stage. The long-term
`Future: Content Builder` and `Future: Content Publisher` pipeline
stages are retained.
