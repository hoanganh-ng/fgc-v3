# ADR-014: Content Manager Boundaries

## Status

Accepted

## Context

The project is a Content Video Pipeline with three stages: Content Collector, Content Builder, and Content Publisher. The current product focus remains the Content Collector stage.

Collector Profile Manager is complete through Sprint 013 and has established the backend slice for profile lifecycle, provisioning, session ingestion, checkout eligibility, leasing, PostgreSQL persistence, Fastify HTTP routes, and opt-in DB-backed HTTP verification.

The project is intentionally deferring Web UI. Collector Runtime is also not ready to implement because the central content object, its source records, its deduplication rules, and its future handoff boundary are not yet defined.

## Decision

Introduce Content Manager as the next Content Collector module before Web UI and Collector Runtime implementation begins.

Content Manager owns collected content as the central business object of the pipeline. It owns content item records, Facebook source group records, managed group categories, engagement counts, top N high-engagement comments, content lifecycle status, deduplication/upsert behavior, safe read contracts, and the future handoff shape for Content Builder.

The first platform is Facebook. The first source type is Facebook knowledge groups. The first content type is Facebook rich text posts.

Content Manager does not own profile/session management, browser automation, scraping behavior, comment crawling strategy, video generation, or publishing.

Collector Runtime will later own operational collection flow: check out a profile, visit Facebook groups and posts, extract post data, extract top comments, submit collected content to Content Manager, and release the profile lease.

Content Manager must follow the existing hexagonal architecture:

- Domain rules stay in the domain core.
- Application use cases own ports and orchestration.
- PostgreSQL/Drizzle remains infrastructure.
- HTTP remains an adapter.
- Composition root wires concrete dependencies.
- Route handlers and repositories must not contain business logic.

## Consequences

- Content becomes explicit before scraping, UI, or builder work starts.
- Collector Runtime can later depend on Content Manager application contracts instead of inventing content rules inside automation code.
- Future Web UI work can read from stable Content Manager contracts instead of raw storage structures.
- Content Builder can later receive selected content through an intentional handoff shape.
- Facebook-specific fields are allowed in the first Content Manager model, but platform ownership remains inside Content Manager instead of leaking into unrelated modules.
- Storage work, repositories, HTTP routes, and tests are deferred to later sprints.

