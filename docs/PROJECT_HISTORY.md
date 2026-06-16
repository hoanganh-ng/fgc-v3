# Project History

The project is a Content Video Pipeline built in three major stages:
1. Content Collector
2. Content Builder
3. Content Publisher

## Milestone History

- **Sprints 001-013**: Collector Profile Manager domain, persistence, use cases, and DB-backed HTTP integration.
- **Sprints 014-019**: Content Manager domain, schema, and API for normalized content and deduplication.
- **Sprints 020-024**: Collector Runtime platform extractors, HTTP submission flow, and profile orchestration contracts.
- **Sprints 025-031**: Web UI foundation and comprehensive operator provisioning flows (Web UI to CLI manual login).
- **Sprints 032-034B**: Facebook browser payload capture, group source management, and page-context fetch/XHR interception.
- **Sprints 035-037B**: Content review UI, durable collection run records, and containerized Collector Worker process.
- **Sprints 038-039**: Profile account maturity separate from operational status, and read-only Ambient Account Exercise.
- **Sprints 040-043B**: Source Group Entry Routes, Profile-Source Access domain, Source-Aware Collection Checkout, and Operator-Assisted Group Access.
- **Sprints 044-049**: UI monitors for Collection and Exercise runs, Queued Ambient Exercise Worker, and Category Browse Foundation.
- **Sprints 050-053B**: Profile-Source Access Check Runs, automated check worker, Facebook auth wall detection hardening, and CloakBrowser provisioning support.
- **Sprint 054A**: Profile Authentication Health domain foundation (current).

## Key Architectural Decisions Over Time
- Migration to Hexagonal Architecture with clear ports and adapters.
- Use of PostgreSQL via Drizzle ORM as the persistence target.
- Web UI built via Vite/React/TanStack Query avoiding raw JSON forms.
- Separation of operational profile status (`READY`, `BUSY`) from account stage (`WARMING`, `COLLECTION_READY`).
- Extractors defined purely as platform-to-normalized-schema mappings without persistence access.
