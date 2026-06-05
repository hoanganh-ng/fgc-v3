# Sprint 010: Composition Root and Service Wiring

## Goal

Add the Collector Profile Manager composition root that wires application use cases to infrastructure adapters while preserving the hexagonal boundary.

## Scope

- Add a composition root under `src/composition/collector-profile-manager/`.
- Add a service/container factory that exposes the Collector Profile Manager application use cases.
- Wire the PostgreSQL database client, Drizzle profile repository, Drizzle profile lease repository, Drizzle transaction manager, clock, token generator, and lease id generator.
- Add simple production implementations for application-owned system ports.
- Add small environment configuration loading for `DATABASE_URL`.
- Expose a close function for database resource shutdown.
- Keep checkout and release transaction usage behind the existing application-owned `TransactionManager` port.
- Add database-free tests for composition wiring, config loading, system adapters, and boundary imports.
- Document that live PostgreSQL verification remains opt-in through Sprint 009's `RUN_DB_TESTS=true` flow.
- Update project brain documentation for the active sprint.

## Out of Scope

- HTTP APIs, controllers, routes, or framework wiring.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Frontend UI.
- Collector Runtime execution.
- Content Builder or Content Publisher code.
- Production dependency injection framework.
- Authentication or authorization systems.
- Database schema redesign.
- Requiring Docker or a live PostgreSQL database for the default test suite.

## Acceptance Criteria

- `docs/SPRINTS/active.md` identifies Sprint 010 as the active sprint.
- Composition root files exist under `src/composition/collector-profile-manager/`.
- The composition factory exposes all current Collector Profile Manager use cases.
- Production wiring uses the PostgreSQL database client, Drizzle repositories, and Drizzle transaction manager.
- Production system adapters implement `Clock`, `TokenGenerator`, and `LeaseIdGenerator` using Node.js built-ins.
- Config loading reads `DATABASE_URL`, does not hardcode credentials, and fails clearly when missing.
- The composed service exposes a `close()` function for database resource cleanup.
- Checkout and release use cases are composed with the transaction manager.
- Default tests do not require a live PostgreSQL database.
- Domain and application layers remain free of PostgreSQL, Drizzle, database clients, HTTP, browser automation, queue, framework, infrastructure, and composition dependencies.
- `pnpm run typecheck` passes.
- `pnpm test` passes.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`

## Optional Database Verification

Live PostgreSQL verification remains covered by the gated database test flow from Sprint 009:

```bash
DATABASE_URL=... RUN_DB_TESTS=true pnpm run test:db
```

Use only a local or disposable migrated PostgreSQL database for that command.

## Completion Notes

Sprint 010 is complete when the Collector Profile Manager can be composed from production infrastructure adapters through a single outer-layer factory, while domain and application code remain technology-agnostic.
