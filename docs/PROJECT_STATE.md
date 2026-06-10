# Project State

## Current Focus

The project is a Content Video Pipeline with three stages:

1. Content Collector
2. Content Builder
3. Content Publisher

The current focus is the Content Collector stage. Collector Profile Manager is complete through Sprint 013 and accepted as the first backend module. Content Manager backend is complete through Sprint 019. Web UI foundation work started in Sprint 025, read-only Profile Manager list/detail integration was added in Sprint 026, Dockerized full-stack runtime support was added in Sprint 027, structured profile create/configure forms were added in Sprint 028, Start Provisioning UI was added in Sprint 029, the Profile Provisioning Browser CLI was added in Sprint 030, and provisioning E2E verification and hardening was completed in Sprint 031.

The next active work is the Facebook Browser Payload Capture Adapter. It adds the first manual/dev single-group Collector Runtime browser capture adapter that uses an existing READY profile session, captures Facebook GraphQL JSON responses in memory, runs the existing extractor, submits normalized candidates to Content Manager, releases the profile lease, and prints only safe operator summaries.

## Current Sprint

Sprint 032: Facebook Browser Payload Capture Adapter

Active sprint file: `docs/SPRINTS/SPRINT-032-facebook-browser-payload-capture-adapter.md`

Sprint 032 adds the first real Facebook browser payload capture adapter for a manual/dev single-group run. It may add Playwright browser capture under Collector Runtime infrastructure/adapters or operator tooling and an operator command that checks out a READY profile, fetches trusted runtime configuration, captures `/api/graphql` JSON responses in memory, runs the existing extractor, submits normalized candidates, releases the lease, and prints safe counts. No scheduler, queue, `collection_runs` table, multi-group runs, multi-profile runs, Web UI trigger, credential automation, CAPTCHA solving, stealth tooling, anti-detection tricks, rate-limit bypass, access-control bypass, posting/commenting/liking, raw payload persistence, Content Builder, or Publisher work should happen in this sprint.

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
- Content Manager owns validation of normalized content ingestion input, content item storage, content deduplication/upsert behavior, content lifecycle status, source group records, managed group categories, engagement counts, top comments as normalized metadata, safe read contracts, and future Content Builder handoff shape.
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

- Browser automation framework for runtime collection.
- Queue, event bus, or scheduler technology.
- Deployment platform and infrastructure.
- Authentication and authorization approach for management interfaces.
- Observability stack.
- API contracts beyond the current Collector Profile Manager routes, runtime profile configuration route, and Content Manager safe read/normalized write contracts.
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
