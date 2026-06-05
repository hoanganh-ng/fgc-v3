# Project State

## Current Focus

The project is a Content Video Pipeline with three stages:

1. Content Collector
2. Content Builder
3. Content Publisher

The current focus is the Content Collector stage. The first core module is the Collector Profile Manager, responsible for profile lifecycle, profile properties, provisioning, session ingestion, and checkout eligibility.

## Current Sprint

Sprint 005: Checkout Eligibility and Leasing

Active sprint file: `docs/SPRINTS/SPRINT-005-checkout-eligibility-and-leasing.md`

Sprint 005 adds Collector Profile Manager checkout eligibility and leasing behavior for READY profiles. It may add domain checkout logic, profile lease models, application-owned lease ports, checkout and release use cases, minimal operational metadata, and in-memory fakes only in tests. No HTTP routes, database repository implementations, browser automation, workers, queues, frontend UI, Collector Runtime execution, Content Builder code, Content Publisher code, production lease id generator adapters, or production clock adapters should happen in this sprint.

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

## Not Decided Yet

- Backend runtime and framework outside the current domain source.
- Frontend runtime, framework, and component system.
- Database engine, schema strategy, and migration tooling.
- Browser automation framework.
- Queue, event bus, or scheduler technology.
- Deployment platform and infrastructure.
- Authentication and authorization approach for management interfaces.
- Observability stack.
- Concrete API contracts.
- Backend runtime and framework outside TypeScript domain tooling.

## Open Questions

- What profile storage model best supports lifecycle state, serialized session data, and indexed checkout eligibility?
- What actor or system is authorized to create, provision, modify, and check out profiles?
- How will provisioning tokens be delivered to trusted consumers?
- What audit trail is required for profile lifecycle changes and session ingestion?
- Which target platforms or collector behaviors impose additional safety constraints?
- What is the expected scale for profile count and checkout frequency?
- How will Content Collector outputs be handed off to Content Builder?
