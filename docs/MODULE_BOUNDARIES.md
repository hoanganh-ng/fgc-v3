# Module Boundaries

## Collector Profile Manager

Owns:

- Profile lifecycle and state machine rules.
- Account maturity/readiness stage and transition rules.
- Profile property model and invariants.
- Provisioning token lifecycle.
- Session ingestion rules.
- Checkout eligibility rules.
- Domain-level validation for profile readiness, busy state, cooldowns, temporal windows, and safety thresholds.
- Checkout eligibility gating for normal collection, including the requirement that `accountStage = COLLECTION_READY`.
- Profile lease purpose rules for `COLLECTION`, `AMBIENT_EXERCISE`, and `ASSISTED_GROUP_ACCESS`.
- Specified-profile ambient exercise checkout eligibility for `READY` profiles, including allowed account stages and rejected review/retired stages.
- Specified-profile assisted group access checkout eligibility for `READY` profiles in `WARMING` or `COLLECTION_READY`, with source-group reference validation and no profile-source access mutation.
- Profile-source access state for `profileId + sourceGroupId` pairs, stored with `sourceGroupId` as an external module reference string.
- Profile-source access HTTP workflows, including validating source group references through an explicit Content Manager-facing port or adapter.

Does not own:

- Browser automation execution.
- Collection task orchestration.
- Content Manager source group records or source group entry route metadata.
- Direct Content Manager repository access or database foreign keys from profile-source access records to Content Manager source group tables.
- Web UI rendering.
- Database technology selection.
- HTTP framework implementation.
- Content building.
- Content publishing.

## Content Manager

Owns:

- Validation of normalized content ingestion input.
- Content item storage.
- Content deduplication and upsert rules.
- Content lifecycle status.
- Source group records.
- Source group entry route metadata for future access and exercise paths.
- Group categories as managed entities.
- Engagement counts.
- Top comments as normalized metadata for each content item.
- `SourcePublisher` identity (`platform + kind + externalPublisherId`)
  as the durable publishing-source identity for a Facebook group or
  page observed while reading a feed.
- `SourcePublisher` pure observation behavior: first observation
  creates `status = DISCOVERED` with `observationCount = 1`; subsequent
  observations preserve `id`, identity, `createdAt`, `firstObservedAt`,
  and current review `status`; `observationCount` increments by
  exactly 1; `lastObservedAt` never moves backward; older observations
  do not overwrite metadata from newer observations; omitted
  metadata does not clear existing metadata; observation never
  changes review status.
- Explicit, reversible `SourcePublisher` status updates (idempotent
  when reapplying the current status).
- `SourcePublisher` application ports (`observeAtomically`,
  `updateStatus`, `findById`, `findByIdentity`, `list` with bounded
  `limit` and non-negative `offset`, ordered `lastObservedAt`
  descending then `id` ascending).
- `ContentCollectionProvenance` domain value object: a strict,
  Zod-validated `CollectionSurface` discriminated union with
  `SOURCE_GROUP` (with `sourceGroupId`) and `PROFILE_HOME_FEED`
  (no profile id, no source group id) branches; a
  `CollectedContentProvenanceInput` with the collection surface,
  an optional `sourcePublisherId`, and an optional
  `managedSourceGroupId` (required and equal to the surface
  `sourceGroupId` when the surface is `SOURCE_GROUP`; absent or
  present when the surface is `PROFILE_HOME_FEED`); a durable
  `ContentCollectionProvenance` with the immutable
  `firstCollectionSurface` plus the optional associations (the
  same cross-field rule applies: required and equal when the
  first surface is `SOURCE_GROUP`, absent or present when the
  first surface is `PROFILE_HOME_FEED`); pure
  `createInitialContentCollectionProvenance` and
  `mergeContentCollectionProvenance` that runtime-validate their
  inputs and outputs against the existing Zod domain schemas,
  preserve the first surface, fill absent associations later,
  are idempotent on identical observations, do not mutate inputs,
  and throw a typed `ContentCollectionProvenanceConflictError`
  (code `CONTENT_COLLECTION_PROVENANCE_CONFLICT`) on conflicting
  `sourcePublisherId` or `managedSourceGroupId`. The
  `PROFILE_HOME_FEED` surface contains no source-group
  identifier; the optional `managedSourceGroupId` association is
  a separate top-level field. Provenance is a domain value
  object; it does not own profile ids, collection run ids, URLs,
  entry routes, raw publisher identities, raw payloads,
  observation arrays, or event history. Sprint 064A adds no
  persistence, HTTP, application, composition, runtime,
  extractor, browser, scheduler, Docker, or Web UI behavior.
- Durable `ContentItem.collectionProvenance` persistence and
  ingestion integration: the Sprint 064A
  `ContentCollectionProvenance` value object is required on every
  durable content item and is persisted through a final
  `NOT NULL content_items.collection_provenance JSONB` column.
  The Content Manager owns the safe split add-column → backfill →
  set-NOT-NULL migration sequence that mirrors the existing
  `0011`/`0012`/`0013` split. Provenance is derived from the
  required `sourceGroupId` internally through a `SOURCE_GROUP`
  collection surface; new content items use
  `createInitialContentCollectionProvenance`; duplicate content
  items (matched by `platform + externalPostId`) use
  `mergeContentCollectionProvenance`. A merge that throws
  `ContentCollectionProvenanceConflictError` propagates the typed
  domain error and never persists. The legacy `sourceGroupId`
  field and the PostgreSQL `source_group_id` column remain
  required and unchanged for backward compatibility. A
  source-group consistency invariant guarantees that
  `collectionProvenance.firstCollectionSurface.kind === 'SOURCE_GROUP'`
  and that
  `collectionProvenance.firstCollectionSurface.sourceGroupId === sourceGroupId`
  on every persisted content item. The HTTP DTOs and JSON schemas
  are unchanged; `collectionProvenance` is internal-only and is
  not exposed through HTTP. Sprint 064B is accepted and does not introduce
  home-feed ingestion or execution, does not make `sourceGroupId`
  nullable, does not add `SourcePublisher` observation or
  resolution, does not add a new HTTP DTO field, does not add a
  provenance filter or index, and does not change the Collector
  Runtime, extractor, browser, workers, scheduler, Docker, or
  Web UI.
- Sprint 065C1 (active and authorized) makes
  `ContentItem.sourceGroupId` optional in the domain schema and DTOs
  and `NULL`-tolerant in PostgreSQL while preserving the existing
  `sourceGroupId`-required source-group ingestion contract.
  `SOURCE_GROUP` first surfaces still require `sourceGroupId` and a
  matching `managedSourceGroupId`. `PROFILE_HOME_FEED` first surfaces
  may omit both `sourceGroupId` and `managedSourceGroupId`; when
  either is present both must be present and equal.
  `CollectionProvenance` does not gain `profileId`, `runId`, URLs,
  raw payloads, or event history. Generic PROFILE_HOME_FEED
  provenance permits an absent `sourcePublisherId`; the dedicated
  `IngestHomeFeedCollectedContentUseCase` boundary still requires
  it. The use case accepts an input carrying only `sourcePublisherId`
  and normalized safe content (no `sourceGroupId`,
  `managedSourceGroupId`, `profileId`, `runId`, provenance, raw
  GraphQL, cookies, localStorage, tokens, headers, proxy details,
  viewer data, or unknown fields), verifies the publisher exists and
  its platform matches, and persists the item with
  `firstCollectionSurface.kind = "PROFILE_HOME_FEED"`, no
  `sourceGroupId`, no `managedSourceGroupId`, and no fake Home Feed
  `SourceGroup`. The use case preserves the immutable first surface
  on duplicates, fills absent associations on later merges, is
  idempotent for identical associations, and rejects conflicting
  associations through the existing typed
  `ContentCollectionProvenanceConflictError`. The existing
  `IngestCollectedContentUseCase` is extended so a later source-group
  collection can fill `sourceGroupId` and `managedSourceGroupId` on
  a home-feed-first item while preserving its
  `PROFILE_HOME_FEED` first surface. The new
  `POST /collector/content-items/home-feed` route uses a strict
  allowlist body schema; `ContentItemDto.sourceGroupId` is optional
  and omitted when absent; `collectionProvenance` remains internal
  and is not exposed through HTTP. Sprint 065C1 extends the Web UI
  `ContentItem` schema and the list/detail pages to render "No
  managed source group" safely when `sourceGroupId` is omitted. It
  does not add browser execution, Facebook navigation, capture,
  extractor orchestration, Collector Runtime HTTP client changes,
  workers, schedulers, Docker service changes, live-Facebook
  validation, `SourcePublisher` review or status mutation,
  source-group promotion, Content Builder, or Content Publisher
  behavior.
- Safe read APIs.
- Future handoff shape for Content Builder.

Does not own:

- Profile or session management.
- Profile-source access state for individual profiles.
- Browser automation.
- Network payload capture.
- Raw Facebook GraphQL parsing.
- Scraping strategy.
- Platform-specific extraction rules.
- Comment crawling strategy.
- Video generation.
- Publishing workflows.
- Promotion of a `SourcePublisher` into a managed `SourceGroup`,
  `SourceGroup` configuration, scheduling, or any social action.
- `Content Publisher` pipeline behavior. `SourcePublisher` is the
  Content Manager-owned durable publishing-source identity, not the
  future Content Publisher pipeline module, and it does not model
  drafts, publications, videos, publishing schedules, or published
  artifacts.
- Profile ids, collection run ids, URLs, entry routes, raw
  publisher identities, raw payloads, observation arrays, or
  event history for `ContentCollectionProvenance`. The provenance
  value object records the first collection surface and the
  optional `SourcePublisher` and managed `SourceGroup`
  associations only.

Content Manager should not accept raw Facebook GraphQL payloads as its primary ingestion contract. Its canonical write contract is normalized Content Manager ingestion input. A future implementation may optionally store sanitized raw payload data or a raw payload reference for trusted diagnostics or reprocessing, but that storage is not the canonical content model.

`SourcePublisher` is the Content Manager-owned publishing-source
identity and is distinct from `SourceGroup`. A `SourcePublisher` is
not a managed `SourceGroup`, is not the future Content Publisher
pipeline stage, and Sprint 063A does not promote, configure,
schedule, or join anything.

## Collector Runtime

Owns:

- Future execution of collection workflows.
- Durable Collector Runtime run records for collection runs and ambient account exercise runs.
- Durable Collector Runtime run records for profile-source access check runs.
- Checking out eligible profiles from Collector Profile Manager.
- Calling specified-profile ambient exercise checkout for read-only account exercise attempts.
- Future consumption of assisted group access leases after Profile Manager checkout, when explicitly added by a later sprint.
- Visiting Facebook groups and posts.
- Future consumption of Content Manager source group entry route metadata through explicit contracts.
- Visiting safe Facebook home/feed surfaces for read-only account exercise.
- Browser automation and network payload capture.
- Browser provider orchestration and provider adapters inside infrastructure.
- Platform Extractors that convert raw platform artifacts into normalized Content Manager ingestion input.
- The Facebook GraphQL Payload Extractor that converts captured Facebook GraphQL response bodies into normalized Content Manager ingestion input candidates.
- Raw Facebook GraphQL payload interpretation.
- Facebook-specific field mapping.
- Post extraction.
- High-engagement comment extraction.
- Engagement count extraction.
- Best-effort handling of missing fields in captured platform payloads.
- Future extractor fixtures and parser tests.
- Submitting normalized collected content to Content Manager through the Content Manager HTTP API.
- Calling Collector Profile Manager checkout/release through runtime-owned ports and HTTP adapters.
- Requesting lease-scoped runtime profile configuration from Collector Profile Manager through trusted application/API contracts after checkout.
- Profile lease release orchestration.
- Returning profile usage outcomes and runtime metrics.
- Recording safe ambient exercise summaries and sanitized failure reasons.
- Browser-backed profile-source access check execution, including sanitized
  observation, deterministic outcome classification, and safe Profile Manager
  mutation through explicit ports.

The Sprint 022 orchestration flow coordinates Profile Manager checkout/release behavior, captured payload collection, and Content Manager submission through Collector Runtime-owned ports and use cases. Payload capture is represented by a port only in Sprint 022; real browser automation, network interception, login, navigation, scheduling, queues, and database access remain out of scope.

Browser-provider hardening must stay inside Collector Runtime infrastructure. Providers consume Profile Manager trusted runtime configuration after checkout; they must not become a profile manager, randomly mutate profile identity, regenerate fingerprints outside Profile Manager, solve CAPTCHAs, automate credentials, bypass checkpoints, bypass rate limits/access controls, post, comment, or like.

Ambient account exercise is a Collector Runtime workflow for safe stability exercise only. It may record that a page loaded, login was required, a checkpoint was detected, how many light scrolls ran, whether the lease was released, and the run duration. It must not collect or submit content items, join groups, create platform actions, or write raw browser/platform/session material to records or logs.

Sprint 040 source group entry routes remain Content Manager metadata. Collector Runtime does not use them for navigation in Sprint 040, and it must not treat a route as proof of group access.

Does not own:

- Profile property invariants.
- Provisioning token rules.
- Authentication session ingestion rules.
- Content item lifecycle rules.
- Content deduplication or upsert rules.
- Group category management.
- Source group entry route metadata ownership or direct mutation.
- Direct database access to Collector Profile Manager or Content Manager storage.
- Direct Content Manager repository access.
- Collector Profile Manager repository access.
- Collector Profile Manager composition root wiring.
- Collector Profile Manager checkout eligibility or leasing business rules.
- Collector Profile Manager lease-purpose eligibility rules.
- Collector Profile Manager account maturity/readiness stage rules.
- Automatic account-stage promotion or demotion after exercise.
- Automatic account-stage promotion or demotion after profile-source access
  checks.
- Public Profile Manager read DTO expansion for sensitive runtime material.
- Authority over profile identity, session state, proxy configuration, or fingerprint configuration.
- Content building.
- Content publishing.

## Platform Extractor Boundary

A Platform Extractor is a collection-side component that converts raw platform-specific artifacts, such as captured Facebook GraphQL payloads, into normalized Content Manager ingestion input.

The first extractor is the Facebook GraphQL Payload Extractor under `src/collector-runtime/platform-extractors/facebook`.

The Sprint 020 extractor is extractor-only. It does not perform browser automation, network interception, profile checkout, HTTP submission to Content Manager, database access, or persistent deduplication.

The Sprint 021 submission flow accepts already-captured payloads only. It invokes the Facebook GraphQL Payload Extractor, submits normalized candidates to the Content Manager HTTP API, and reports per-candidate submission outcomes. It does not perform browser automation, network interception, profile checkout, lease release, scheduling, queueing, database access, or Content Manager business logic.

The Sprint 022 profile-orchestrated collection flow invokes the Sprint 021 submission flow for each captured payload. It does not move extractor rules, Content Manager deduplication/upsert behavior, or Profile Manager checkout eligibility/leasing rules into Collector Runtime.

The Sprint 024 trusted runtime profile configuration contract remains owned by Collector Profile Manager and is guarded by `leaseId`. Collector Runtime may consume that contract after checkout, but public profile read DTOs must continue to omit authentication state, local storage, proxy credentials, provisioning tokens, and token hashes.

Sprint 038 keeps profile operational status separate from account maturity. A profile may be `READY` after login/session ingestion while its `accountStage` remains `NEW_ACCOUNT`; Collector Runtime must still rely on Profile Manager checkout instead of interpreting or bypassing account-stage rules itself. Sprint 039 adds ambient exercise checkout for specified profiles, but exercise outcomes do not automatically change `accountStage` and do not grant normal collection eligibility.

Extractor fixtures must be sanitized. They must not include cookies, tokens, authorization headers, viewer IDs, private user data, raw request headers, or sensitive account/session details. Synthetic fixtures should be clearly named as synthetic. Real payload fixtures must be sanitized before they are used in tests.

Canonical collection ingestion flow:

```text
raw GraphQL payload
-> Facebook GraphQL Payload Extractor
-> normalized Content Manager ingestion input
-> Content Manager validation/upsert/storage
```

Platform Extractors belong to the Collector Runtime side of the Content Collector. They do not belong in the Content Manager domain core.

## Profile Manager Web UI

Owns:

- Future human-facing profile management screens.
- Future profile state inspection and operational controls.
- Calling application APIs to perform allowed profile operations.

Does not own:

- Profile domain rules.
- Direct persistence logic.
- Browser automation execution.
- Content building.
- Content publishing.

## Content Builder

Owns:

- Future transformation of collected material into video-ready assets and assembled video outputs.
- Future builder-specific validation, rendering, and quality workflows.

Does not own:

- Profile lifecycle.
- Profile provisioning.
- Collector runtime execution.
- Publishing workflows.

## Content Publisher

Owns:

- Future publishing workflows for completed video outputs.
- Future destination-specific publishing rules, scheduling, and status tracking.

Does not own:

- Profile lifecycle.
- Collection runtime execution.
- Video assembly.
- Collector profile provisioning.

## Boundary Rule

Shared behavior must be introduced only when it has a clear owner and does not leak adapter or framework concerns into domain logic. Cross-module communication should happen through explicit application contracts, not direct access to another module's internals.
