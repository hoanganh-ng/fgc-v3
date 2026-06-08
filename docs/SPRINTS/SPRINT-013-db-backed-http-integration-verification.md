# Sprint 013: DB-backed HTTP Integration Verification

## Goal

Add opt-in integration verification for the full Collector Profile Manager backend slice:

HTTP route -> composition root -> use case -> repository -> PostgreSQL.

## Scope

- Keep default tests database-free.
- Add gated HTTP/PostgreSQL integration tests that run only when `RUN_HTTP_DB_TESTS=true`.
- Require `DATABASE_URL` when DB-backed HTTP tests are explicitly requested.
- Add a `test:http:db` package script without changing the existing `test:db` script.
- Create HTTP servers through the real Collector Profile Manager composition root and real PostgreSQL repositories.
- Use Fastify `inject()` instead of starting a network listener.
- Cover health, profile creation, profile detail reads, profile lists, configuration persistence, provisioning start, provisioning configuration reads, session ingestion, provisioning token replay failure, checkout, and lease release.
- Assert read and provisioning HTTP responses omit cookies, local storage, raw provisioning token internals, token hashes, and proxy credentials.
- Keep integration rows isolated with unique IDs and cleanup where practical.
- Fix small integration bugs found in composition wiring, mappers, repositories, route DTOs, or use-case orchestration.
- Document the local DB and DB-backed HTTP test flow.

## Out of Scope

- Frontend UI.
- Authentication or authorization systems.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Collector Runtime execution.
- Content Builder or Content Publisher code.
- API versioning.
- Deployment configuration.
- Performance or load testing.
- Complex seed frameworks.
- Repository, domain, or storage redesign unless required to fix a real integration bug.
- Requiring Docker or a live PostgreSQL database for the default test suite.

## Acceptance Criteria

- `docs/SPRINTS/active.md` identifies Sprint 013 as the active sprint.
- `docs/PROJECT_STATE.md` identifies Sprint 013 as the current sprint.
- `pnpm test` remains database-free and does not require Docker or PostgreSQL.
- `test:http:db` exists and runs the HTTP DB integration suite with `RUN_HTTP_DB_TESTS=true`.
- The HTTP DB suite skips cleanly when `RUN_HTTP_DB_TESTS` is not set.
- The HTTP DB suite fails clearly when `RUN_HTTP_DB_TESTS=true` but `DATABASE_URL` is missing.
- DB-backed HTTP tests use `DATABASE_URL` and do not hardcode credentials.
- DB-backed HTTP tests create the server from the real composition root and real PostgreSQL repositories.
- Tests use Fastify `inject()` and do not open a network listener.
- Tests cover the full persisted HTTP lifecycle from creation through lease release.
- Read and provisioning responses do not expose cookies, local storage, raw provisioning token state, token hashes, or proxy credentials.
- Rows created by tests use unique profile IDs/names and are cleaned up where practical.
- Domain and application layers remain free of Fastify, HTTP, PostgreSQL, Drizzle, database clients, browser automation, queues, framework code, infrastructure, and composition dependencies.
- `pnpm run typecheck` passes.
- `pnpm test` passes.

## Verification Commands

Default verification:

```bash
pnpm run typecheck
pnpm test
```

Optional PostgreSQL verification:

```bash
docker compose up -d postgres
cp .env.example .env
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline pnpm run db:migrate
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline pnpm run test:db
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline pnpm run test:http:db
```

The opt-in DB tests insert, update, and delete rows whose IDs are generated for the test run, but `DATABASE_URL` should point only at a local or disposable PostgreSQL database.

## Security Notes

Authentication and authorization remain deferred. These routes must not be exposed publicly until a future sprint adds access control.

Read and provisioning HTTP responses must keep sensitive session and provisioning data out of response bodies. Checkout responses may still include authentication state because checkout is the trusted operational lease contract for a future collector caller.

## Completion Notes

Sprint 013 is complete when the DB-backed HTTP integration suite verifies the backend slice end to end while remaining fully opt-in, and the default typecheck and test suite still pass without PostgreSQL.
