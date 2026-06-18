# Roadmap

## Sprint 000: Project Brain Bootstrap

Create the documentation structure that future Builders use to understand project state, product intent, architecture, module boundaries, requirements, and active sprint scope.

## Sprints 001-013: Collector Profile Manager

Define and implement the core Collector Profile Manager backend slice for lifecycle state, profile properties, provisioning, session ingestion, checkout eligibility, leasing, PostgreSQL persistence, HTTP routes, read APIs, and opt-in DB-backed integration verification.

## Sprint 014: Content Manager Requirement Amendment And Boundary Definition

Define Content Manager as the next Content Collector module. Record boundaries, requirements, first platform, first source type, initial content model, top comment rules, deduplication/upsert behavior, storage direction, and module separation. This sprint is documentation/design only.

## Sprint 014A: Collector Extraction Boundary Amendment

Define the Platform Extractor boundary on the Collector Runtime side. Record that Facebook GraphQL payload parsing belongs to the future Facebook GraphQL Payload Extractor, not Content Manager core. This sprint is documentation/design only.

## Sprint 015: Content Manager Domain Model

Implement the Content Manager domain model for source groups, group categories, content items, top comments, lifecycle statuses, and deduplication/upsert rules.

## Sprint 016: Content Manager Application Use Cases

Add application use cases and application-owned ports for managing categories, managing source groups, ingesting/upserting collected content, changing content status, and reading safe content views.

## Sprint 017: Content Manager PostgreSQL Schema And Repository Adapters

Add PostgreSQL schema, migrations, repository adapters, and opt-in persistence verification for Content Manager while keeping domain and application layers database-free.

## Sprint 018: Content Manager Composition Root And Service Wiring

Wire Content Manager use cases to real infrastructure through the composition root, expose service types for future adapters, and verify construction without adding HTTP routes.

## Sprint 019: Content Manager HTTP API

Add HTTP adapter routes for Content Manager use cases and safe read APIs, with route handlers kept free of business logic.

## Sprint 020: Facebook GraphQL Payload Extractor

Implement the collection-side extractor that converts captured Facebook GraphQL payloads into normalized Content Manager ingestion input, with parser fixtures and extractor tests owned by the Collector Runtime side.

## Sprint 021: Collector Runtime Submission Flow

Implement the Collector Runtime submission flow for already-captured Facebook GraphQL payloads. This sprint invokes the Facebook GraphQL Payload Extractor and submits normalized ingestion input to the Content Manager HTTP API, without browser automation, network interception, profile checkout, lease release, scheduling, queues, or database access from Collector Runtime.

## Sprint 022: Collector Runtime Profile-Orchestrated Collection Flow

Add the next runtime layer that orchestrates profile checkout, captured payload collection through a placeholder port, content submission, and lease release through explicit application contracts.

## Sprint 023: Collector Runtime Profile Manager HTTP Adapter

Add the concrete Collector Runtime HTTP adapter for Profile Manager checkout/release through the runtime-owned profile lease port.

## Sprint 024: Trusted Runtime Profile Configuration Contract

Add a trusted, lease-scoped runtime profile configuration contract so Collector Runtime can fetch browser launch configuration from Profile Manager after checkout while public read DTOs remain safe.

## Sprint 025: Web UI Foundation

Start the Web UI foundation for profile and content management, consuming application/API contracts instead of owning domain rules or persistence logic.

## Sprint 026: Facebook Browser Payload Capture Adapter

Add the first real Facebook browser payload capture adapter for Collector Runtime, behind the Sprint 022 capture port.

## Sprint 060: Collection Scheduler Containerization

Add the containerized collection scheduler service that drives the scheduled dispatch poller in the dev and preview stacks. The scheduler-runtime image is lightweight and does not install a browser.

## Sprint 061: Operator Collection Schedule Management Surface

Expose the existing `CollectionSchedule` aggregate to operators through HTTP routes and a Web UI management page. Closes the operator feedback loop for collection schedules.

## Sprint 062: Feed Discovery Delivery Plan And Docker E2E Foundation

Publish the feed discovery delivery plan, the cross-cutting testing strategy, the isolated Docker E2E harness, and a deterministic baseline E2E flow that proves the production-like stack works through Nginx, the API, migrations, and PostgreSQL using only synthetic fixtures.

The cross-cutting testing strategy used by every sprint in the feed
discovery sequence is documented in [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md).

## Sprint 063A: Publisher Domain And Application

Define the Publisher domain (publication candidates, drafts, review states, scheduled publication) and the application use cases for creating drafts from approved source groups. No persistence, no HTTP, no UI. Domain and application layers remain database-free.

## Sprint 063B: Publisher Persistence And Atomic Observation

Add Publisher PostgreSQL schema, Drizzle migrations, repository adapters, and atomic transitions between review states. Keep domain and application layers database-free.

## Sprint 063C: Publisher HTTP Contract And E2E

Add the Publisher HTTP routes, safe DTOs, and an E2E flow that proves the publisher surface works through Nginx, the API, migrations, and PostgreSQL using only synthetic fixtures.

## Sprint 064A: Content Provenance

Define the content provenance model that records the originating content item, source group, captured payload hash, extraction rule version, and the publishing chain that produced a published artifact. Domain only; no persistence.

## Sprint 064B: Provenance Persistence And Compatibility

Add provenance PostgreSQL schema, repository adapters, and the compatibility shim for legacy content items. Keep domain and application layers database-free.

## Sprint 065A: Home-Feed Extractor Fixtures

Add deterministic home-feed extractor fixtures, parser tests, and the safe payload extractor contract that turns captured home-feed page-context and network-listener payloads into normalized home-feed candidates.

## Sprint 065B: Home-Feed Run Model

Define the home-feed run domain (state machine, retry budget, dedupe key, source-group candidate set) and the application use cases that orchestrate runs and observations.

## Sprint 065C: Manual Home-Feed Execution

Add a single manual home-feed operator command that exercises the run domain against synthetic fixtures, surfaces safe observations, and never launches a browser against Facebook.

## Sprint 066: Publisher Review API And UI

Expose the Publisher review surface (list, detail, approve, reject) through HTTP routes and a Web UI review page. Safe DTOs; minimal identifier exposure; null-vs-omission preserved.

## Sprint 067: Approved Group Promotion

Add the approved group promotion flow: a separate, auditable transition that promotes approved source groups into the Publisher production roster, scoped to operators with explicit recovery intent.

## Sprint 068: Feed Scheduling

Wire the Sprint 059 scheduled dispatch poller to feed discovery so a Publisher draft can be scheduled against an approved source group with bounded retries and a deterministic next-run timestamp.