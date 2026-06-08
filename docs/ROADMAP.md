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

## Sprint 018: Content Manager HTTP API

Add HTTP adapter routes for Content Manager use cases and safe read APIs, with route handlers kept free of business logic.

## Sprint 019: Facebook GraphQL Payload Extractor

Implement the collection-side extractor that converts captured Facebook GraphQL payloads into normalized Content Manager ingestion input, with parser fixtures and extractor tests owned by the Collector Runtime side.

## Sprint 020: Collector Runtime Submission Flow

Implement the Collector Runtime flow that checks out profiles, visits configured Facebook sources, captures payloads, invokes the Facebook GraphQL Payload Extractor, submits normalized ingestion input to Content Manager, and releases profile leases through explicit application contracts.

## Sprint 021: Profile + Content Manager Web UI Foundation

Start the deferred Web UI foundation for profile and content management, consuming application/API contracts instead of owning domain rules or persistence logic.

## Future: Collector Runtime

Define and implement additional runtime behavior that checks out eligible profiles, visits Facebook groups and posts, captures platform artifacts, invokes Platform Extractors, submits normalized content to Content Manager, and releases profile leases through explicit application contracts.

## Future: Content Builder

Define and implement the pipeline stage that converts collected material into video outputs.

## Future: Content Publisher

Define and implement the pipeline stage that publishes completed videos to target destinations.
