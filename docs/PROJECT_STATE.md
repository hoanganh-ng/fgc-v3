# Project State

## Current Focus

The project is a Content Video Pipeline with three stages:

1. Content Collector
2. Content Builder
3. Content Publisher

The current focus is the Content Collector stage. The first core module is the Collector Profile Manager, responsible for profile lifecycle, profile properties, provisioning, session ingestion, checkout eligibility, and leasing contracts.

## Current Sprint

Sprint 009: PostgreSQL Repository Integration Verification

Active sprint file: `docs/SPRINTS/SPRINT-009-postgresql-repository-integration-verification.md`

Sprint 009 adds optional PostgreSQL integration verification for the Collector Profile Manager repository adapters and transaction manager while keeping the default test suite database-free. It may add `RUN_DB_TESTS=true` gated infrastructure integration tests, a `test:db` package script, local database setup documentation, and repository or mapper fixes only when a real adapter integration bug is found. No HTTP route, browser automation, worker, queue, frontend UI, Collector Runtime execution, Content Builder code, Content Publisher code, production deployment configuration, or authentication system should happen in this sprint.

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

## Not Decided Yet

- Backend runtime and framework outside the current domain source.
- Frontend runtime, framework, and component system.
- Browser automation framework.
- Queue, event bus, or scheduler technology.
- Deployment platform and infrastructure.
- Authentication and authorization approach for management interfaces.
- Observability stack.
- Concrete API contracts.
- Backend runtime and framework outside TypeScript domain tooling.

## Open Questions

- What retry or error-translation policy should future runtime composition use for active lease unique-conflict failures?
- What actor or system is authorized to create, provision, modify, and check out profiles?
- How will provisioning tokens be delivered to trusted consumers?
- What audit trail is required for profile lifecycle changes and session ingestion?
- Which target platforms or collector behaviors impose additional safety constraints?
- What is the expected scale for profile count and checkout frequency?
- How will Content Collector outputs be handed off to Content Builder?
