# ADR-0008: PostgreSQL Repository Adapters and Transactions

## Status

Accepted

## Context

Sprint 007 created the PostgreSQL/Drizzle schema and migration foundation for the Collector Profile Manager. Sprint 008 implements repository adapters for the existing application-owned persistence ports.

Checkout and release flows each write both a profile and a lease. The application layer must remain database-agnostic, but future composition needs a way to run those paired writes atomically when PostgreSQL is used.

The profile schema stores provisioning token lookup data in `provisioning_token_hash`; adapters must not persist or expose raw stored tokens.

## Decision

Implement `DrizzleProfileRepository` and `DrizzleProfileLeaseRepository` in infrastructure under `src/infrastructure/database/repositories/`. These adapters implement the existing application repository ports and keep Drizzle/PostgreSQL types out of the domain and application model.

Add deterministic mapper modules under `src/infrastructure/database/mappers/`. Mappers convert between domain objects and Drizzle row shapes, keep query-critical profile fields in root columns, keep the eight profile property groups in JSONB columns, and validate reconstructed objects with domain schemas before returning them to application code.

Add an application-owned `TransactionManager` port that exposes repository contexts, not database clients or ORM transactions. Implement `DrizzleTransactionManager` in infrastructure by creating transaction-scoped Drizzle repository adapters inside `db.transaction(...)`.

Make checkout and release use cases accept the transaction manager optionally. Existing in-memory tests and non-transactional composition remain simple, while PostgreSQL composition can run profile and lease writes inside one database transaction.

Hash persisted provisioning tokens in infrastructure with deterministic SHA-256 lookup hashes. `findByProvisioningToken` hashes the presented token for lookup and reconstructs the returned profile with the already-presented token for application validation. The adapter never stores raw tokens and does not expose a raw token loaded from persistence.

## Consequences

- Domain and application code remain free of PostgreSQL, Drizzle, database clients, HTTP, browser automation, queues, and framework dependencies.
- Future composition can use one transaction for checkout and release write pairs without exposing ORM concepts to use cases.
- The active lease partial unique index remains the database-level conflict guard for concurrent checkouts; future composition may add retry or error translation around unique-conflict failures.
- Mapper tests can validate persistence shape and JSONB parsing without requiring Docker or a live PostgreSQL database.
- Repository integration tests remain deferred or must be explicitly gated so the default test suite stays database-free.
