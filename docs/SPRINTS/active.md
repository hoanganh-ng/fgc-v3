# Active Sprint

Sprint 063A — Source Publisher Domain and Application is **accepted**.
It defined the Content Manager-owned `SourcePublisher` identity and
pure observation behavior and the Content Manager application layer
(ports, use cases, typed application error, and in-memory
repository). No persistence, HTTP, UI, browser, or feed execution.

- [Sprint 063A - Source Publisher Domain and Application](SPRINT-063A-source-publisher-domain-and-application.md)

Sprint 063B — Source Publisher Persistence and Atomic Observation is
**accepted**. It added PostgreSQL persistence for the Content
Manager-owned `SourcePublisher` aggregate, the Drizzle schema and
migration, the durable repository implementation, the atomic
observation algorithm, the durable status update, the durable read
operations, and the Content Manager composition wiring. The
durable outcome: `SourcePublisher` persistence is
PostgreSQL-backed; observation is atomic and concurrency-safe;
observation and status writes own separate fields; domain rules
remain the source of truth. HTTP routes, DTOs, Docker E2E coverage,
the Web UI review surface, `SourceGroup` promotion, the extractor
and browser behavior, and the future Content Builder / Content
Publisher pipeline stages remain out of scope and were not part of
Sprint 063B.

- [Sprint 063B - Source Publisher Persistence and Atomic Observation](SPRINT-063B-source-publisher-persistence-and-atomic-observation.md)

Sprint 063C — Source Publisher HTTP Contract and E2E is
**accepted**. It exposes safe HTTP contracts for observing,
listing, and reading Content Manager-owned `SourcePublisher`
aggregates and proves the flow through Nginx web-gateway →
Fastify HTTP adapter → Content Manager application → PostgreSQL
using only synthetic fixtures. Status mutation (approve / ignore /
block) remains deferred to Sprint 066.

- [Sprint 063C - Source Publisher HTTP Contract and E2E](SPRINT-063C-source-publisher-http-contract-and-e2e.md)

Sprint 064A — Content Collection Provenance Model is
**accepted**. It adds a pure Content Manager domain model that
records the first collection surface and the optional
`SourcePublisher` and managed `SourceGroup` associations for a
collected content item. It does not add persistence, HTTP, runtime,
extractor, browser, UI, scheduler, or Docker behavior, and it does
not modify existing ingestion, persistence, HTTP, Collector Runtime,
extractor, browser, Web UI, scheduler, or Docker behavior.

- [Sprint 064A - Content Collection Provenance Model](SPRINT-064A-content-collection-provenance-model.md)

Sprint 064B — Provenance Persistence And Compatibility is
**accepted**. It persists the Sprint 064A
`ContentCollectionProvenance` value object as a required
`collectionProvenance` field on every durable `ContentItem`, adds
a final `NOT NULL content_items.collection_provenance JSONB`
column, safely backfills every existing source-group content row
from its `source_group_id` through a split add-column → backfill →
set-NOT-NULL migration sequence mirroring the existing
`0011`/`0012`/`0013` split, and integrates provenance creation
(`createInitialContentCollectionProvenance`) and merge
(`mergeContentCollectionProvenance`) into the current source-group
ingestion flow. Provenance is derived from the required
`sourceGroupId` internally through a `SOURCE_GROUP` collection
surface; conflicting merges propagate a typed
`ContentCollectionProvenanceConflictError` and never persist. The
existing `sourceGroupId` field and the PostgreSQL
`source_group_id` column remain required and unchanged for
backward compatibility; `collectionProvenance` is internal-only and
is not exposed through HTTP DTOs or JSON schemas. Sprint 064B does
not introduce home-feed ingestion or execution, does not make
`sourceGroupId` nullable, does not add `SourcePublisher`
observation or resolution, does not add a new HTTP DTO field,
does not add a provenance filter or index, and does not change the
Collector Runtime, extractor, browser, workers, scheduler, Docker,
or Web UI. Sprint 065B and Sprint 065C remain future work and are
not activated by this acceptance.

- [Sprint 064B - Provenance Persistence And Compatibility](SPRINT-064B-provenance-persistence-and-compatibility.md)

Sprint 065A — Facebook Home-Feed Extractor Fixtures is **accepted** at
`28906556bffa2b4052cd429b0bf5634cf74de875`. It added a separate,
pure, fixture-driven Facebook home-feed GraphQL extractor for group
and page posts. The extractor produces normalized content candidates
without `sourceGroupId`, derives a safe `publisherObservation` for
explicit GROUP/PAGE publishers with stable external publisher ids,
excludes explicit sponsored and personal-profile posts with typed
warnings, handles malformed payloads safely, and keeps the existing
source-group extractor contract unchanged. Sprint 065A did not add
browser, persistence, HTTP, worker, scheduler, Docker, Web UI, or
live-Facebook behavior.

- [Sprint 065A - Facebook Home-Feed Extractor Fixtures](SPRINT-065A-facebook-home-feed-extractor-fixtures.md)

Sprint 065B — Profile-Bound Home-Feed Run Model is **accepted** at
`b9d84cad6d48f4ef94efb5be037550a7409afa05`. It added a separate
durable `ProfileHomeFeedCollectionRun` aggregate and lifecycle in
Collector Runtime, with application ports/use cases, PostgreSQL
persistence, safe operator HTTP request/list/get/cancel routes, and
composition wiring. It kept existing `CollectionRun.sourceGroupId`
required and unchanged, did not create a fake Home Feed
`SourceGroup`, stored `profileId` as the operational target reference,
used strict `{ platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" }`
targets, and used `MANUAL_API` only. Run creation uses an insert-only
repository `create` operation (no `onConflictDoUpdate`); lifecycle
updates are exclusively owned by `claimNextQueued` and
`transitionStatus` compare-and-set. Sprint 065B does not execute a
browser, connect to the Sprint 065A extractor, capture payloads,
observe `SourcePublisher`, submit Content Manager items, add workers
or schedulers, change Docker, add Web UI behavior, or make any
live-Facebook claim.

- [Sprint 065B - Profile-Bound Home-Feed Run Model](SPRINT-065B-profile-bound-home-feed-run-model.md)

Sprint 065C1 — Bare Home-Feed Content Ingestion is **accepted** at
`40b3ce7023c126c03386994a719ae7acb7758f21`. It closes the gap
between Sprint 065A's normalized home-feed candidates (which carry a
required `publisherObservation` and no `sourceGroupId`) and Content
Manager ingestion (which still required `sourceGroupId`). It makes
`ContentItem.sourceGroupId` optional in the domain schema and DTOs
and `NULL`-tolerant in PostgreSQL, keeps the existing
`sourceGroupId`-required source-group ingestion contract unchanged,
adds a dedicated `IngestHomeFeedCollectedContentUseCase` that
ingests a home-feed candidate carrying only `sourcePublisherId` and
normalized safe content, validates the publisher exists and its
platform matches, and persists the resulting item with
`firstCollectionSurface.kind = "PROFILE_HOME_FEED"`, no
`sourceGroupId`, no `managedSourceGroupId`, and no fake Home Feed
`SourceGroup`. The use case preserves the immutable first surface
on duplicates, fills absent associations on later merges, is
idempotent for identical associations, and rejects conflicting
associations through the existing typed
`ContentCollectionProvenanceConflictError`. It adds
`POST /collector/content-items/home-feed` with a strict allowlist
body schema (sourcePublisherId + normalized content only; no
sourceGroupId, managedSourceGroupId, profileId, runId, provenance,
raw payloads, cookies, localStorage, tokens, headers, proxy
details, viewer data, or unknown fields). It updates the existing
`IngestCollectedContentUseCase` so a later source-group collection
can fill `sourceGroupId` and `managedSourceGroupId` on an
existing home-feed-first item while preserving the original
`PROFILE_HOME_FEED` first surface. It extends the Web UI
`ContentItem` schema and the list/detail pages to render
"No managed source group" safely when `sourceGroupId` is omitted.
Generic `ContentCollectionProvenance` and
`CollectedContentProvenanceInput` continue to allow an absent
`sourcePublisherId`; the dedicated
`HomeFeedCollectedContentInputSchema` and
`POST /collector/content-items/home-feed` route still require it.
Sprint 065C1 does not add browser execution, Facebook navigation,
capture, extractor orchestration, Collector Runtime HTTP client
changes, workers, schedulers, Docker service changes, live-Facebook
validation, `SourcePublisher` review or status mutation, source-group
promotion, Content Builder, or Content Publisher behavior.
`collectionProvenance` remains internal-only and is not exposed
through HTTP DTOs. Sprint 065C1 makes no browser or live-Facebook
execution claim.

- [Sprint 065C1 - Bare Home-Feed Content Ingestion](SPRINT-065C1-bare-home-feed-content-ingestion.md)

Sprint 065C2 — Profile-Bound Home-Feed Checkout is **accepted** at
`6591a05b3ecde7e615f824efc715c815c25bc2d2`. It adds the explicit
profile-bound checkout path for the exact profile referenced by a
`ProfileHomeFeedCollectionRun`. It extends `ProfileLeasePurpose`
with a fourth value, `HOME_FEED_COLLECTION`, which shares the
existing `COLLECTION_READY` account-stage rule and the full existing
safety and readiness check set (including the approved
`NETWORK_CONTEXT_MISSING` rule). It adds
`CheckoutProfileForHomeFeedCollectionUseCase`, the matching
`POST /collector/profiles/:profileId/home-feed/checkout` route, and
the `ProfileHomeFeedCheckoutPort` plus
`ProfileManagerHttpClient.checkoutProfileForHomeFeedCollection`
binding. Migration `0024` extends the existing
`collector_profile_lease_purpose` enum with `HOME_FEED_COLLECTION`
through `ALTER TYPE ... ADD VALUE`; the unique partial index that
enforces one-active-lease-per-profile remains unchanged.
`GetRuntimeProfileConfigurationUseCase` accepts an active
`HOME_FEED_COLLECTION` lease for its matching `BUSY` profile;
`ReleaseProfileLeaseUseCase` returns the profile to `READY`. The
`ProfileHomeFeedCheckoutPort` was not wired into a worker or executor
in Sprint 065C2.

- [Sprint 065C2 - Profile-Bound Home-Feed Checkout](SPRINT-065C2-profile-bound-home-feed-checkout.md)

Sprint 065C3 — Bounded Facebook Home-Feed Execution is **accepted** at
`e60e5a8f0167cad84d7fac4545fdda2e29feea99`. It
adds one-shot, operator-invoked execution of an existing durable
`ProfileHomeFeedCollectionRun`: claim at most one queued run, checkout
the run's exact profile through `HOME_FEED_COLLECTION`, capture the
authenticated Facebook home feed under bounded scroll/duration limits,
invoke the existing Sprint 065A extractor, observe each distinct
`SourcePublisher` once, submit bounded home-feed content through the
existing Content Manager HTTP contracts, release the lease, and
persist a sanitized `SUCCEEDED` or `FAILED` terminal run through the
existing compare-and-set transition path. Defaults are `maxScrolls=3`,
`maxDurationMs=30000`, `maxPosts=20`; hard ceilings are
`maxScrolls<=10`, `maxDurationMs<=120000`, `maxPosts<=100`. Bounds are
never silently clamped — exceeding a ceiling fails the RUNNING run
before checkout with `HOME_FEED_EXECUTION_BOUNDS_EXCEEDED`. It adds
`ExecuteProfileHomeFeedCollectionRunUseCase`, a separate application-owned
`FacebookHomeFeedPayloadCapturePort` (and its infrastructure adapter
that navigates to the fixed internal URL
`https://www.facebook.com/?sk=h_chr`, reuses fetch/XHR/network capture
and page-state detection, obeys the effective per-call bounds, and
closes the browser on every path), `SourcePublisherObservationPort`
and `HomeFeedContentSubmissionPort` (both implemented by
`ContentManagerHttpClient` against the existing
`POST /collector/source-publishers/observations` and
`POST /collector/content-items/home-feed` routes with response
identity validation), a one-shot operator command
`pnpm profile:home-feed:run-next -- --base-url <url> --browser-provider <provider>`,
and focused unit + Docker E2E coverage. The runner claims and runs
terminal CAS transitions directly against the durable repository (no
HTTP execute route is exposed), and forwards `LOGIN_REQUIRED` /
`CHECKPOINT_REQUIRED` to the existing lease-release authentication
observation. A failed lease release marks the run FAILED. Failed runs
retain a safe partial summary. Sprint 065C3 does not add a polling
loop, persistent worker, Docker service, scheduler integration, Web
UI changes, or an HTTP execute route. Manual live-Facebook validation
was **not performed** by Sprint 065C3.

- [Sprint 065C3 - Bounded Facebook Home-Feed Execution](SPRINT-065C3-bounded-facebook-home-feed-execution.md)

Sprint 066 — Source Publisher Status Mutation HTTP Contract is
**active**. It exposes
`PATCH /collector/source-publishers/:sourcePublisherId/status` as a
safe Content Manager HTTP contract that delegates to the existing
`UpdateSourcePublisherStatusUseCase`. The body is strict and
accepts exactly `{ status }` where `status` is one of `DISCOVERED`,
`APPROVED`, `IGNORED`, `BLOCKED`; unknown fields, missing fields,
and `null` are rejected with HTTP 400 `VALIDATION_ERROR`. The 200
response reuses the existing safe `SourcePublisherDto` allowlist
(`displayName` and `canonicalUrl` omitted when absent, never
emitted as `null`) and a missing publisher maps to the existing
HTTP 404 `SOURCE_PUBLISHER_NOT_FOUND`. No new container wiring,
repository change, status transition rule, migration, Web UI,
browser behavior, scheduler, worker, or Docker service is
introduced by Sprint 066.

- [Sprint 066 - Source Publisher Status Mutation HTTP Contract](SPRINT-066-source-publisher-status-mutation-http-contract.md)

No sprint is currently active beyond Sprint 066. The remaining
067–068 feed-discovery items are documented placeholders and are
**not active** until the Product Owner explicitly approves the next
sprint.

`SourcePublisher` is the Content Manager-owned publishing-source
identity (a Facebook group or page observed while reading the feed)
and is not the future Content Publisher pipeline stage; it does
not model drafts, publications, videos, publishing schedules, or
published artifacts.

The roadmap in `docs/ROADMAP.md` records the remaining feed discovery
sequence (Sprint 063C–068) as documentation placeholders. The
long-term `Future: Content Builder` and `Future: Content Publisher`
pipeline stages are retained and are not removed or redefined by the
feed discovery sequence.

Sprint 062 is accepted and recorded as the feed discovery delivery plan
and Docker E2E foundation:

- [Sprint 062 - Feed Discovery Delivery Plan And Docker E2E Foundation](SPRINT-062-feed-discovery-delivery-plan-and-docker-e2e-foundation.md)

Sprint 061 is accepted and recorded as the operator collection schedule
management surface foundation for Sprint 062:

- [Sprint 061 - Operator Collection Schedule Management Surface](SPRINT-061-operator-collection-schedule-management-surface.md)

Sprint 060 is accepted and recorded as the containerized scheduler
foundation for Sprint 061:

- [Sprint 060 - Collection Scheduler Containerization and Stack Integration](SPRINT-060-collection-scheduler-containerization.md)

Sprint 059 is accepted and recorded as the scheduled dispatch poller
foundation for Sprint 060:

- [Sprint 059 - Scheduled Collection Dispatch Poller](SPRINT-059-scheduled-collection-dispatch-poller.md)

Sprint 058 is accepted and recorded as the atomic scheduled dispatch
foundation for Sprint 059:

- [Sprint 058 - Atomic Scheduled Collection Dispatch](SPRINT-058-atomic-scheduled-collection-dispatch.md)

Sprint 057 is accepted and recorded as the schedule persistence foundation
for Sprint 058:

- [Sprint 057 - Collection Schedule Domain and Persistence Foundation](SPRINT-057-collection-schedule-domain-and-persistence-foundation.md)

Sprint 056 is accepted and recorded as the operator authentication
health filtering and profile inventory pagination foundation for
Sprint 057:

- [Sprint 056 - Operator Authentication Health Filtering and Profile Inventory Pagination](SPRINT-056-operator-authentication-health-filtering-and-profile-inventory-pagination.md)

Sprint 055 is accepted and recorded as the operator recovery
foundation for Sprint 056:

- [Sprint 055 - Operator Authentication Recovery and Reprovisioning](SPRINT-055-operator-authentication-recovery-and-reprovisioning.md)

Sprint 054B is accepted and recorded as the runtime authentication
health foundation for Sprint 055 and Sprint 056:

- [Sprint 054B - Runtime Authentication Health Reporting and Checkout Enforcement](SPRINT-054B-runtime-authentication-health-reporting-and-checkout-enforcement.md)

Sprint 054A is accepted and recorded as the profile authentication
health model foundation for Sprint 054B, Sprint 055, and Sprint 056:

- [Sprint 054A - Profile Authentication Health Foundation](SPRINT-054A-profile-authentication-health-foundation.md)
