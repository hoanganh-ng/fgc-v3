# Sprint 008: PostgreSQL Repository Adapters

## Goal

Implement PostgreSQL/Drizzle repository adapters for the Collector Profile Manager application ports while preserving the hexagonal boundary.

## Scope

- Add a database client factory that reads `DATABASE_URL`, creates a `pg` pool, and creates a Drizzle database instance without connecting during module import.
- Add deterministic infrastructure mappers for collector profiles and profile leases.
- Map root-level operational profile fields to columns and the eight profile property groups to JSONB columns.
- Validate database rows with Collector Profile Manager domain schemas before returning data to application code.
- Implement `ProfileRepository` with Drizzle, including save, id lookup, provisioning token lookup, checkout candidate lookup, and display-name existence checks.
- Implement `ProfileLeaseRepository` with Drizzle, including save, id lookup, active lease lookup, and status updates.
- Add an application-owned transaction boundary and a Drizzle transaction manager so checkout and release composition can run profile and lease writes atomically.
- Keep application-facing transaction abstractions database-agnostic.
- Add mapper and infrastructure unit tests that do not require Docker or a live PostgreSQL instance.
- Add an ADR for PostgreSQL repository adapters and transaction boundaries.
- Update project brain documentation for the active sprint.

## Out of Scope

- HTTP APIs, controllers, routes, or framework wiring.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Frontend UI.
- Collector Runtime execution.
- Content Builder or Content Publisher code.
- Production deployment configuration.
- Authentication or authorization systems.
- Requiring Docker or a live PostgreSQL database for the default test suite.
- Repository behavior outside the existing Collector Profile Manager application ports.

## Acceptance Criteria

- Infrastructure exports include a database client factory, profile repository adapter, profile lease repository adapter, and transaction manager.
- `DrizzleProfileRepository` implements the existing `ProfileRepository` port.
- `DrizzleProfileLeaseRepository` implements the existing `ProfileLeaseRepository` port.
- Profile mapper round-trips domain profiles through row-shaped data and preserves all eight profile property groups.
- Profile mapper rejects invalid JSONB data before it reaches application code.
- Lease mapper round-trips domain leases through row-shaped data and rejects invalid lease data.
- Provisioning token lookup uses deterministic infrastructure hashing when persisted token hashes are stored.
- Transaction support is application-owned and database-agnostic, with Drizzle implementation details confined to infrastructure.
- Default tests do not require a live PostgreSQL instance.
- Domain and application layers remain free of PostgreSQL, Drizzle, HTTP, browser automation, queue, and framework dependencies.
- `pnpm run typecheck` passes.
- `pnpm test` passes.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`

## Transaction Approach

Sprint 008 adds an application-owned `TransactionManager` port that exposes `ProfileRepository` and `ProfileLeaseRepository` instances scoped to a unit of work. The Drizzle implementation creates transaction-scoped PostgreSQL adapters inside `db.transaction(...)`.

Checkout and release use cases accept the transaction manager optionally. In-memory tests and simple composition can continue using repositories directly, while future PostgreSQL composition can pass `DrizzleTransactionManager` to run profile and lease writes atomically.

Concurrent active lease prevention still relies on the PostgreSQL partial unique index for active leases. Future runtime composition may add retry or adapter error translation around unique-conflict failures.

## Implementation Notes

- Database client creation lives in `src/infrastructure/database/client.ts` and reads `DATABASE_URL` without connecting during module import.
- Profile and lease mappers live under `src/infrastructure/database/mappers/` and validate reconstructed domain objects before returning them.
- Repository adapters live under `src/infrastructure/database/repositories/`.
- Persisted provisioning token lookup uses deterministic infrastructure SHA-256 hashes. The adapter hashes lookup inputs and never stores raw provisioning tokens.
- Default tests remain database-free; no gated PostgreSQL integration tests were added in this sprint.

## Completion Notes

Sprint 008 is complete when PostgreSQL repository adapters, deterministic mappers, transaction boundary documentation, and non-database mapper tests are in place while runtime/API/frontend work remains deferred.
