# Project State

## Current Focus

The project is a Content Video Pipeline with three stages:

1. Content Collector
2. Content Builder
3. Content Publisher

The current focus is the Content Collector stage. Collector Profile Manager is complete through Sprint 013 and accepted as the first backend module. Content Manager backend is complete through Sprint 019. Web UI foundation work started in Sprint 025, read-only Profile Manager list/detail integration was added in Sprint 026, Dockerized full-stack runtime support was added in Sprint 027, structured profile create/configure forms were added in Sprint 028, Start Provisioning UI was added in Sprint 029, the Profile Provisioning Browser CLI was added in Sprint 030, provisioning E2E verification and hardening was completed in Sprint 031, the Facebook Browser Payload Capture Adapter was added in Sprint 032, Web UI content category/source group management was added in Sprint 033, Collector CLI source group resolution and checkout diagnostics were added in Sprint 034A, page-context Facebook fetch/XHR capture was added in Sprint 034B, Content Items review UI screens were added in Sprint 035, Content Items review layout polish was completed in Sprint 035A, collection run records plus API trigger work was completed in Sprint 036, the Collector Worker Process was added in Sprint 037, the Collector Runtime browser-provider boundary plus optional experimental CloakBrowser adapter were added in Sprint 037A, runtime command hygiene plus the root README were completed in Sprint 037A.1, the containerized collector worker runtime was completed in Sprint 037B, the Profile Account Stage Readiness Gate was completed in Sprint 038, the Ambient Account Exercise Foundation was completed in Sprint 039, Source Group Entry Routes Foundation was completed in Sprint 040, Profile-Source Access Domain + Storage was completed in Sprint 041A, and Profile-Source Access HTTP API was completed in Sprint 041B. Sprint 041C is active for Profile-Source Access Web UI.

The next active work is Web UI access management for durable profile-source access state before adding assisted group access, category browse exercise, scheduler behavior, browser-backed access checks, or automatic account-stage promotion.

## Current Sprint

Sprint 041C: Profile-Source Access Web UI

Active sprint file: `docs/SPRINTS/SPRINT-041C-profile-source-access-web-ui.md`

Sprint 041C adds operator-facing profile-source access management to the existing Web UI profile detail page. It consumes the Sprint 041B profile-source access HTTP endpoints and remains frontend-only. The sprint must not add backend behavior, platform automation, assisted group access, group access checking, group joining, category browsing, scheduler behavior, collection worker changes, CAPTCHA solving, checkpoint bypass, credential automation, platform actions, automatic account-stage promotion/demotion, or source-group-centric profile-access screens.

## Decided Items

- The project will maintain a documentation-based project brain at the repository root and under `docs/`.
- `AGENTS.md` is the Builder entrypoint.
- Future Builders must read the project state, architecture, module boundaries, and active sprint before making changes.
- Future Builders must follow only the active sprint.
- The system has three high-level stages: Content Collector, Content Builder, and Content Publisher.
- The first implementation focus is Content Collector.
- The first Content Collector module is Collector Profile Manager.
- The intended architecture is hexagonal.
- Domain logic must not depend on HTTP, database, browser automation, queues, or framework code.
- Seed requirements from `FR.md` and `NFR.md` are copied into the Collector Profile Manager requirements documents.
- Sprint 001 uses plain TypeScript for the Collector Profile Manager domain model foundation.
- Sprint 001 created the Collector Profile Manager domain model foundation.
- Sprint 002 uses pnpm for package management because no existing lockfile or package manager was present and npm was not available in the implementation environment.
- Sprint 002 uses TypeScript and Vitest for domain typechecking and automated tests.
- Sprint 003 uses Zod for Collector Profile Manager runtime validation schemas in the domain layer.
- Sprint 004 introduces the Collector Profile Manager application layer as use cases coordinated through application-owned ports, with in-memory fakes only in tests.
- Sprint 005 introduces checkout eligibility and leasing in the Collector Profile Manager core, with profile leases and application-owned lease ports.
- Sprint 006 uses database-agnostic repository contracts and documents a likely PostgreSQL storage shape with root-level operational columns and JSONB-style complex property groups.
- Sprint 007 selects PostgreSQL as the first persistence target with Drizzle for TypeScript schema and migrations and node-postgres as the driver, while deferring repository adapters.
- Sprint 008 implements PostgreSQL repository adapters in infrastructure, keeps transaction support behind an application-owned abstraction, and uses deterministic infrastructure hashing for persisted provisioning token lookup.
- Sprint 009 keeps default tests database-free and adds opt-in PostgreSQL integration verification for repository adapters and transaction behavior.
- Sprint 010 introduces the composition root as the outer boundary that wires Collector Profile Manager use cases to infrastructure adapters and system port implementations.
- Sprint 011 introduces Fastify as the first HTTP adapter at the outer interface layer, with validation and centralized error mapping while leaving authentication deferred.
- Sprint 012 introduces application-owned profile query use cases and HTTP read routes with explicit DTOs that omit authentication state, provisioning token internals, and proxy credentials.
- Sprint 013 introduces opt-in DB-backed HTTP integration verification for the full Collector Profile Manager backend slice while keeping default tests database-free.
- Collector Profile Manager is complete through Sprint 013 and accepted.
- Sprint 014 introduces Content Manager as the next Content Collector module before Web UI and Collector Runtime.
- Sprint 015 introduces the Content Manager domain model and domain tests for normalized collected content.
- Sprint 016 introduces the Content Manager application layer and application-owned ports for normalized collected content use cases.
- Sprint 016A verified that the Content Manager application layer is already organized into focused files and that `src/content-manager/application/index.ts` is a barrel export only.
- Sprint 017 introduces PostgreSQL/Drizzle storage for Content Manager through infrastructure adapters that implement application-owned repository ports.
- Sprint 018 introduces Content Manager composition root wiring through real infrastructure adapters while keeping HTTP routes and parser/runtime code deferred.
- Sprint 019 introduces Content Manager HTTP routes through the existing Fastify adapter while keeping parser/runtime/UI work deferred.
- Sprint 020 introduces the Facebook GraphQL Payload Extractor under the Collector Runtime / Platform Extractor boundary while keeping browser automation, network interception, profile checkout, HTTP submission, and database access deferred.
- Sprint 021 introduces the Collector Runtime submission flow that sends extracted normalized candidates to the Content Manager HTTP API while keeping browser automation, network interception, profile checkout, lease release, scheduling, queues, and database access deferred.
- Sprint 022 introduces the Collector Runtime profile-orchestrated collection flow that coordinates profile checkout, placeholder captured-payload collection, Sprint 021 submission, and lease release through runtime-owned ports while keeping real browser automation, network interception, scheduling, queues, direct database access, and Web UI work deferred.
- Sprint 022A resolves release-readiness tracking for sanitized Facebook extractor fixtures and keeps raw/sensitive Facebook payload data out of the repository before browser/network capture work begins.
- Sprint 023 introduces a Collector Runtime HTTP adapter for Profile Manager checkout/release through the runtime-owned profile lease port, without importing Profile Manager repositories, database adapters, or composition roots.
- Sprint 024 introduces a trusted lease-scoped runtime profile configuration contract and HTTP route for Collector Runtime, without changing public profile read DTOs or adding browser automation.
- Sprint 025 starts the Web UI foundation as a React/Vite TypeScript app under `apps/web`, with dashboard routing, layout shell, Tailwind CSS, TanStack Query, local UI primitives, and API client foundation only.
- Sprint 026 replaces the Profiles placeholder with read-only safe Collector Profile Manager list and detail integration, using `/collector/profiles` and `/collector/profiles/:profileId` without exposing cookies, local storage, proxy credentials, raw session state, token hashes, provisioning token hashes, or trusted runtime secrets.
- Sprint 027 adds Docker Compose development and production-like preview runtimes, using Vite for development hot reload and Nginx to serve the built Web UI and proxy `/collector/*` to the Fastify API in preview mode.
- Sprint 028 adds structured Web UI create and configure forms for Collector Profile Manager profiles, using existing backend contracts and keeping sensitive session, token, provisioning, proxy password, and trusted runtime data out of the UI.
- Sprint 029 adds a safe Web UI Start Provisioning action on profile detail, using the existing backend contract and keeping one-time provisioning tokens confined to the immediate success UI when returned.
- Sprint 030 adds an operator-only Profile Provisioning Browser CLI that consumes one-time provisioning tokens and submits manually captured Facebook session state through existing Profile Manager HTTP contracts without printing or storing raw session material.
- Sprint 031 verifies and hardens the complete manual provisioning flow from Web UI profile creation through CLI manual login and READY profile state.
- Sprint 032 adds the first manual/dev Facebook browser payload capture adapter under Collector Runtime infrastructure/adapters or operator tooling, reusing existing runtime orchestration, extractor, and HTTP clients.
- Sprint 033 adds Web UI management for Content Manager content categories and Facebook source groups, including creation, listing, source group ID copy support, and source group status updates.
- Sprint 034A makes `sourceGroupId` the primary manual Facebook collector CLI input, resolves the source URL from Content Manager, and improves safe checkout diagnostics.
- Sprint 034B adapts page-context Facebook `fetch` and XHR capture into the Playwright collector, keeps network response capture as secondary diagnostics, and reports safe capture counters without logging or persisting raw payloads.
- Sprint 035 adds Web UI Content Items list/detail review screens and status actions backed by existing Content Manager safe read and lifecycle APIs.
- Sprint 035A polishes Web UI Content Items list/detail review layouts without changing backend behavior or exposing sensitive/raw collector data.
- Sprint 036 introduces durable Collector Runtime collection-run records and API-triggered queued run creation without executing browser collection from HTTP requests.
- Sprint 037 introduces a Collector Runtime worker process that claims queued collection runs and executes them through existing Facebook collector orchestration.
- Sprint 037A introduces a Collector Runtime browser provider boundary, keeps `PLAYWRIGHT_CHROMIUM` as the default provider, and adds `CLOAK_BROWSER` as an optional experimental provider selected by operator configuration.
- Sprint 037A.1 introduces canonical root script names for app runtime, Web UI, and operator tools; preserves existing command aliases; adds the root README as the repo front door; and documents command groups without changing runtime behavior.
- Sprint 037B introduces an opt-in Compose `collector-worker` service that runs the existing worker process through internal Docker networking with Playwright as the default provider.
- Sprint 038 introduces Collector Profile Manager `accountStage` as the account maturity/readiness state separate from operational profile `status`, defaults new profiles to `NEW_ACCOUNT`, and gates normal collection checkout on `COLLECTION_READY`.
- Operational profile `status` remains `PENDING_CONFIG -> PENDING_LOGIN -> READY -> BUSY -> READY`; account maturity is tracked separately as `NEW_ACCOUNT`, `WARMING`, `COLLECTION_READY`, `LIMITED`, `NEEDS_REVIEW`, or `RETIRED`.
- Account stage transitions are manual/operator-driven in Sprint 038. `RETIRED` is terminal; direct `NEW_ACCOUNT -> COLLECTION_READY`, `NEW_ACCOUNT -> RETIRED`, and `NEEDS_REVIEW -> COLLECTION_READY` transitions are intentionally not allowed.
- Sprint 039 introduces profile lease purposes. `COLLECTION` remains the default purpose for normal checkout; `AMBIENT_EXERCISE` is reserved for specified-profile exercise checkout and does not loosen normal collection eligibility.
- Sprint 039 introduces Collector Runtime Ambient Exercise Run records with `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, and `CANCELED` statuses for `AMBIENT_ACCOUNT` exercise.
- Sprint 039 adds an operator-only ambient profile exercise command that opens Facebook through stored runtime configuration, performs read-only dwell and light scrolls, releases the lease, and stores only safe summary booleans/counts or sanitized failure data.
- Ambient exercise never submits content items, joins groups, posts, comments, likes, shares, messages, sends friend requests, solves CAPTCHAs, bypasses checkpoints/rate limits/access controls, automates credentials, or changes `accountStage` automatically.
- Sprint 040 introduces source group entry route metadata owned by Content Manager. Entry routes describe possible future paths toward a source group, but they do not grant access, imply profile eligibility, or mutate profile/source access state.
- Sprint 040 treats source groups without explicit entry routes as having a derived default `DIRECT_GROUP_URL` route from the source group URL. The default direct route uses `MEDIUM` risk because a direct final group visit is valid metadata but should not be treated as the lowest-risk warm-up path by default.
- Sprint 041A introduces profile-source access state owned by Collector Profile Manager. It stores profile-specific access/readiness facts for a `profileId + sourceGroupId` pair, while treating `sourceGroupId` as an external Content Manager reference string.
- Sprint 041A does not validate source group existence yet, does not import Content Manager repositories, and does not add HTTP, Web UI, browser automation, assisted group access, scheduler behavior, or automatic account-stage changes.
- Sprint 041B exposes profile-source access state through safe HTTP endpoints and validates source group existence through an explicit Content Manager-facing port/adapter.
- Sprint 041B keeps Collector Profile Manager from importing Content Manager repositories, keeps `sourceGroupId` as an external reference string, and does not add Web UI, browser automation, assisted access workflows, scheduler behavior, group joining, or account-stage automation.
- Sprint 041C adds profile-source access management to the Web UI profile detail page using the Sprint 041B HTTP endpoints only.
- Sprint 041C keeps the UI frontend-only and does not add a source-group-centric profile-access screen, backend behavior, browser automation, assisted access workflows, scheduler behavior, group joining, or account-stage automation.
- Future account-readiness roadmap items include Assisted Group Access, Category Browse Exercise, Scheduler behavior, and automatic account-stage recommendations, but those are out of scope for Sprint 041C.
- Browser-provider hardening is allowed only inside Collector Runtime infrastructure. Profile Manager remains the source of truth for profile identity, session state, proxy configuration, and fingerprint configuration.
- Content Manager owns validation of normalized content ingestion input, content item storage, content deduplication/upsert behavior, content lifecycle status, source group records, source group entry route metadata, managed group categories, engagement counts, top comments as normalized metadata, safe read contracts, and future Content Builder handoff shape.
- Content Manager does not own profile/session management, browser automation, network payload capture, raw Facebook GraphQL parsing, scraping strategy, platform-specific extraction rules, comment crawling strategy, video generation, or publishing workflows.
- The Content Collector module separation is Collector Profile Manager, Content Manager, and Collector Runtime.
- Collector Runtime will later own checking out profiles, visiting Facebook groups and posts, capturing platform artifacts, using Platform Extractors, submitting normalized collected content to Content Manager, and releasing leases.
- Sprint 022 Collector Runtime orchestration owns the coordination of profile checkout, payload capture port invocation, submission flow invocation, and profile lease release, but not the business rules behind profile eligibility/leasing or content deduplication/upsert.
- The Sprint 020 Facebook GraphQL Payload Extractor owns conversion from captured Facebook GraphQL response bodies to normalized Content Manager ingestion input candidates only.
- Sprint 020 extractor fixtures include synthetic fixtures and sanitized real Facebook payload fixtures.
- The Sprint 020 extractor outputs normalized ISO datetime strings so candidates structurally match Content Manager ingestion input.
- The Sprint 021 Collector Runtime submission flow accepts already-captured payloads only and submits normalized candidates to Content Manager through the HTTP API.
- The Sprint 022 Collector Runtime orchestration flow uses a capture port as a placeholder for future browser/network capture; it does not implement real Facebook login, navigation, or network interception.
- The Sprint 023 Profile Manager HTTP adapter consumes the current checkout response internally but returns only `profileId`, `leaseId`, and optional lease expiry through the runtime-owned port.
- The Sprint 024 runtime profile configuration contract is guarded by `leaseId` and returns browser-relevant runtime groups only for active leases while omitting provisioning token material.
- Public profile read DTOs remain safe and do not expose cookies, local storage, proxy credentials, provisioning token values, or token hashes.
- Content Manager remains responsible for validation, persistent deduplication, upsert behavior, lifecycle status, and storage after runtime submission.
- Facebook is the first Content Manager platform.
- Facebook knowledge groups are the first Content Manager source type.
- Facebook rich text posts are the first Content Manager content type.
- Group categories are managed entities, not free text.
- V1 content deduplication uses `platform + externalPostId`.
- V1 duplicate content preserves `id`, `firstCollectedAt`, `createdAt`, and manual status while updating body text, engagement counts, top comments, `lastCollectedAt`, and `updatedAt`.
- V1 top comments store normalized top N comments selected by reaction count during extraction, with default N = 10 and no full comment history.
- V1 Content Manager PostgreSQL storage keeps top comments as JSONB on `content_items`.
- A Platform Extractor is a collection-side component that converts raw platform-specific artifacts into normalized Content Manager ingestion input.
- Facebook GraphQL Payload Extractor is the first planned Platform Extractor.
- Collector Runtime / Platform Extractor owns raw Facebook GraphQL payload interpretation, Facebook-specific field mapping, post extraction, high-engagement comment extraction, engagement count extraction, best-effort missing-field handling, and future extractor fixtures and parser tests.
- The canonical content collection flow is raw GraphQL payload -> Facebook GraphQL Payload Extractor -> normalized Content Manager ingestion input -> Content Manager validation/upsert/storage.
- Content Manager should not accept raw Facebook GraphQL payloads as its primary ingestion contract.
- Optional future `sanitizedRawPayload` storage is diagnostic and not the canonical content model. `rawPayloadRef` is an optional external reference, not embedded raw payload storage.

## Not Decided Yet

- Future browser providers beyond the default Playwright Chromium adapter and optional experimental CloakBrowser adapter.
- Queue, event bus, or scheduler technology.
- Deployment platform and infrastructure.
- Authentication and authorization approach for management interfaces.
- Observability stack.
- API contracts beyond the current Collector Profile Manager routes, profile-source access routes, runtime profile configuration route, and Content Manager safe read/normalized write contracts.
- Backend runtime concerns beyond the minimal Fastify entrypoint.
- Whether top comments remain JSONB long term or move into a dedicated comment table.
- Exact Collector Runtime crawling strategy.
- Exact Collector Runtime browser-backed capture strategy.
- Authentication, authorization, and audit policy for trusted runtime configuration access.
- Exact Content Builder handoff use cases and status transitions beyond the initial `SELECTED` direction.

## Open Questions

- What retry or error-translation policy should future runtime composition use for active lease unique-conflict failures?
- What actor or system is authorized to create, provision, modify, and check out profiles?
- How will provisioning tokens be delivered to trusted consumers?
- What audit trail is required for profile lifecycle changes and session ingestion?
- Which target platforms or collector behaviors impose additional safety constraints?
- What is the expected scale for profile count and checkout frequency?
- How will Content Collector outputs be handed off to Content Builder?
- What actor or system is authorized to manage source groups, categories, content status, and future builder handoff?
- Which Facebook source and author fields can be safely displayed in future management interfaces?
- What retention policy should apply to optional sanitized raw payload diagnostics or raw payload references?
- When will top comments need dedicated querying instead of JSONB storage?
