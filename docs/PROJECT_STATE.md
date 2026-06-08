# Project State

## Current Focus

The project is a Content Video Pipeline with three stages:

1. Content Collector
2. Content Builder
3. Content Publisher

The current focus is the Content Collector stage. Collector Profile Manager is complete through Sprint 013 and accepted as the first backend module. Content Manager backend is complete through Sprint 019. Web UI remains intentionally deferred.

The next active module work is the Collector Runtime Submission Flow. It takes already-captured Facebook GraphQL response bodies, invokes the Facebook GraphQL Payload Extractor, and submits normalized content candidates to the Content Manager HTTP API while keeping browser automation, network interception, profile checkout, lease release, scheduling, queues, and database access deferred.

## Current Sprint

Sprint 021: Collector Runtime Submission Flow

Active sprint file: `docs/SPRINTS/SPRINT-021-collector-runtime-submission-flow.md`

Sprint 021 implements the Collector Runtime submission flow for already-captured Facebook GraphQL response bodies. It connects the Sprint 020 Facebook GraphQL Payload Extractor to the existing Content Manager normalized ingestion HTTP API through a Collector Runtime-owned submission port and HTTP client adapter. No browser automation, network interception, profile checkout, lease release, scheduling, queues, database access, Content Manager business-rule changes, Web UI, Content Builder, or Publisher work should happen in this sprint.

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
- Content Manager owns validation of normalized content ingestion input, content item storage, content deduplication/upsert behavior, content lifecycle status, source group records, managed group categories, engagement counts, top comments as normalized metadata, safe read contracts, and future Content Builder handoff shape.
- Content Manager does not own profile/session management, browser automation, network payload capture, raw Facebook GraphQL parsing, scraping strategy, platform-specific extraction rules, comment crawling strategy, video generation, or publishing workflows.
- The Content Collector module separation is Collector Profile Manager, Content Manager, and Collector Runtime.
- Collector Runtime will later own checking out profiles, visiting Facebook groups and posts, capturing platform artifacts, using Platform Extractors, submitting normalized collected content to Content Manager, and releasing leases.
- The Sprint 020 Facebook GraphQL Payload Extractor owns conversion from captured Facebook GraphQL response bodies to normalized Content Manager ingestion input candidates only.
- Sprint 020 extractor fixtures include synthetic fixtures and sanitized real Facebook payload fixtures.
- The Sprint 020 extractor outputs normalized ISO datetime strings so candidates structurally match Content Manager ingestion input.
- The Sprint 021 Collector Runtime submission flow accepts already-captured payloads only and submits normalized candidates to Content Manager through the HTTP API.
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

- Frontend runtime, framework, and component system.
- Browser automation framework.
- Queue, event bus, or scheduler technology.
- Deployment platform and infrastructure.
- Authentication and authorization approach for management interfaces.
- Observability stack.
- API contracts beyond the current Collector Profile Manager routes and Content Manager safe read/normalized write contracts.
- Backend runtime concerns beyond the minimal Fastify entrypoint.
- Whether top comments remain JSONB long term or move into a dedicated comment table.
- Exact Collector Runtime crawling strategy.
- Exact Collector Runtime profile-orchestrated capture strategy.
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
