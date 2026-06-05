# Sprint 009: PostgreSQL Repository Integration Verification

## Goal

Add optional PostgreSQL integration verification for the Collector Profile Manager repository adapters and transaction manager while keeping the default test suite database-free.

## Scope

- Add gated infrastructure integration tests that run only when `RUN_DB_TESTS=true`.
- Read the integration test database connection from `DATABASE_URL`.
- Keep `pnpm test` fast and free of Docker or live PostgreSQL requirements.
- Add a `test:db` package script for explicit PostgreSQL verification.
- Verify `DrizzleProfileRepository` against a real migrated PostgreSQL database.
- Verify `DrizzleProfileLeaseRepository` against a real migrated PostgreSQL database.
- Verify `DrizzleTransactionManager` commit and rollback behavior.
- Keep integration tests isolated with unique row identifiers and cleanup of created rows.
- Document local setup commands and warn that `DATABASE_URL` should point at a local or disposable test database.
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
- Schema redesign unless required to fix a real repository integration bug.
- Requiring Docker or a live PostgreSQL database for the default test suite.

## Acceptance Criteria

- `docs/SPRINTS/active.md` identifies Sprint 009 as the active sprint.
- `package.json` includes an explicit `test:db` script.
- Database integration tests are skipped unless `RUN_DB_TESTS=true`.
- Database integration tests use `DATABASE_URL` and do not hardcode credentials.
- Profile repository integration coverage includes save/find by id, provisioning token hash lookup, consumed or expired token non-match behavior, checkout candidate lookup, JSONB property group round-trip, and persisted JSONB rejection on read.
- Lease repository integration coverage includes save/find by id, active lease lookup by profile id, status update, and active lease uniqueness enforcement.
- Transaction integration coverage includes commit and rollback of profile plus lease writes.
- Integration tests use unique IDs and clean up rows created during tests where practical.
- Default tests do not require a live PostgreSQL database.
- Domain and application layers remain free of PostgreSQL, Drizzle, HTTP, browser automation, queue, and framework dependencies.
- `pnpm run typecheck` passes.
- `pnpm test` passes.
- `pnpm run test:db` runs the gated database integration tests when a migrated PostgreSQL database is available.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`
- `pnpm run db:migrate`
- `pnpm run test:db`

## Local Integration Test Setup

Use a local or disposable PostgreSQL database. The integration tests insert, update, and delete rows whose IDs are generated for the test run, but `DATABASE_URL` should not point at production or shared operational data.

Preferred local flow:

```bash
docker compose up -d postgres
cp .env.example .env
pnpm run db:migrate
pnpm run test:db
```

The tests themselves do not start Docker and do not run migrations.

## Completion Notes

Sprint 009 is complete when repository and transaction integration verification is in place, remains opt-in through `RUN_DB_TESTS=true`, and the default typecheck and test suite still pass without PostgreSQL.
