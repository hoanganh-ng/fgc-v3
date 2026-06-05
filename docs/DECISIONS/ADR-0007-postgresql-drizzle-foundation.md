# ADR-0007: PostgreSQL Drizzle Foundation

## Status

Accepted

## Context

Sprint 006 established the Collector Profile Manager persistence boundary and documented a storage direction with root-level operational fields plus JSONB-style complex property groups. Sprint 007 needs a concrete schema and migration foundation while preserving the hexagonal boundary and deferring repository adapters.

The first persistence target should support indexed checkout/provisioning queries, relational lease constraints, and flexible storage for profile property groups that are validated by application/domain schemas before use cases interact with them.

## Decision

Select PostgreSQL as the first persistence target for the Collector Profile Manager.

Select Drizzle for TypeScript-owned schema definitions and migration generation. Drizzle schema code lives in infrastructure under `src/infrastructure/database/` and must not be imported by domain or application code.

Use `pg` / node-postgres as the PostgreSQL driver for future database access. Repository adapters are deferred to Sprint 008 or a later sprint, so Sprint 007 does not create `ProfileRepository` or `ProfileLeaseRepository` implementations.

Keep domain and application layers database-agnostic. The application continues to depend on repository ports only, and the domain continues to have no database, ORM, HTTP, browser automation, queue, or framework dependency.

## Consequences

- Migration files can be generated from TypeScript schema definitions.
- Checkout and provisioning lookup fields can be indexed in PostgreSQL without leaking SQL or ORM concepts into core code.
- JSONB columns keep complex profile property groups flexible while preserving application-level validation before use case orchestration.
- Future repository adapters still need transaction design for atomic checkout and active lease conflict prevention.
