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

## Sprint 063A: Source Publisher Domain And Application

Define the Content Manager-owned `SourcePublisher` identity and observation behavior for Facebook groups and pages. Include statuses such as `discovered`, `approved`, `ignored`, and `blocked`. No persistence, no HTTP, no UI, no browser, no feed execution. `SourcePublisher` is a durable publishing-source identity, not the future Content Publisher pipeline module: it does not model drafts, publications, videos, publishing schedules, or published artifacts.

## Sprint 063B: Source Publisher Persistence And Atomic Observation

Add `SourcePublisher` PostgreSQL persistence, mapper, repository adapter, unique identity, and concurrency-safe observation / upsert behavior. Keep domain and application layers database-free.

## Sprint 063C: Source Publisher HTTP Contract And E2E

Add safe observation and required list / get HTTP contracts for `SourcePublisher`, composition wiring, and Docker E2E coverage. Do not add a review UI yet.

## Sprint 064A: Content Collection Provenance Model

Define the content collection provenance model that separates: the collection surface (such as a configured source group or a profile home feed); the publishing source, represented by an optional `SourcePublisher`; and the managed `SourceGroup` association. Do not model video publishing or published artifacts.

## Sprint 064B: Provenance Persistence And Compatibility

Persist collection provenance, migrate existing group-sourced content safely, and preserve current ingestion, deduplication, APIs, and source-group collection behavior. Keep domain and application layers database-free.

## Sprint 065A: Facebook Home-Feed Extractor Fixtures

Add sanitized, fixture-driven extraction for Facebook group posts, page posts, stable publisher identity, sponsored-content exclusion, personal-profile exclusion, and malformed payload handling. No browser execution.

## Sprint 065B: Profile-Bound Home-Feed Run Model

Introduce a profile-bound home-feed collection target and run lifecycle. Do not overload `sourceGroupId` and do not create a fake "Home Feed" source group.

## Sprint 065C: Manual Home-Feed Execution

Implement actual bounded browser execution against the collector profile's Facebook home feed: profile checkout, feed navigation, max-scroll / max-duration / max-post bounds, payload capture, extraction, source-publisher observation, content submission, lease release, and sanitized summaries. Finish with opt-in manual live-Facebook validation. This sprint must not claim that it only runs synthetic fixtures.

## Sprint 066: Source Publisher Discovery Review API And UI

Add the discovered `SourcePublisher` review queue with approve, ignore, and block behavior, exposed through HTTP routes and a Web UI review page.

## Sprint 067: Approved Group Promotion

Promote an approved discovered Facebook group into a paused managed `SourceGroup`. Require category selection and existing-source matching. Do not automatically join, activate, or schedule the promoted group.

## Sprint 068: Home-Feed Scheduling

Generalize scheduling for profile-bound home-feed collection only after Sprint 065C's manual feed execution is validated. Wire the Sprint 059 scheduled dispatch poller to feed discovery so a home-feed run can be scheduled against a profile with bounded retries and a deterministic next-run timestamp.

## Future: Content Builder

Retain the long-term Content Builder pipeline stage. The Content Builder stage is not redefined or removed by the feed discovery sequence.

## Future: Content Publisher

Retain the long-term Content Publisher pipeline stage. The Content Publisher stage is the downstream video-publication pipeline and is not the `SourcePublisher` durable publishing-source identity introduced by Sprint 063A. The Content Publisher stage is not redefined or removed by the feed discovery sequence.