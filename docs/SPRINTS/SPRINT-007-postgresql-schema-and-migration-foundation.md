# Sprint 007: PostgreSQL Schema and Migration Foundation

## Goal

Add the first PostgreSQL schema and migration foundation for the Collector Profile Manager without implementing repository adapters.

## Scope

- Add Drizzle and PostgreSQL tooling using pnpm.
- Add `drizzle.config.ts` using `DATABASE_URL` without hardcoded credentials.
- Add `.env.example` with local development database settings.
- Add an optional development-only `docker-compose.yml` for PostgreSQL.
- Add infrastructure database schema code under `src/infrastructure/database/`.
- Define Drizzle tables for collector profiles and profile leases based on the Sprint 006 storage mapping.
- Keep query-critical operational fields as root-level columns and complex profile property groups as JSONB columns.
- Add indexes for status, provisioning token lookup, checkout availability, lease id, and active lease lookup.
- Add package scripts for migration generation and migration execution.
- Generate the initial migration when the environment allows it, or document why generation could not be completed.
- Add a schema smoke test that does not require Docker or a live PostgreSQL instance.
- Add an ADR for selecting PostgreSQL, Drizzle, and node-postgres.
- Update project brain documentation for the active sprint.

## Out of Scope

- Profile repository implementation.
- Profile lease repository implementation.
- Real database integration tests.
- Running migrations against a real database unless a local database is available and clearly configured.
- HTTP APIs or routes.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Frontend UI.
- Collector Runtime execution.
- Content Builder or Content Publisher code.
- Production deployment configuration.
- Authentication or authorization systems.

## Acceptance Criteria

- Drizzle and PostgreSQL tooling are added.
- `drizzle.config.ts` exists and uses `DATABASE_URL`.
- `.env.example` exists and no real `.env` file is created.
- Optional local `docker-compose.yml` exists for PostgreSQL development only.
- Collector Profile Manager profile and lease tables are defined in infrastructure schema code.
- Profile table includes root-level operational columns for id, status, provisioning token lookup/lifecycle, checkout availability, daily usage counters, version, `created_at`, and `updated_at`.
- Profile table includes JSONB columns for the eight profile property groups.
- Lease table includes id, profile id, status, leased/release/expiry timestamps, `created_at`, and `updated_at`.
- Query-critical indexes are defined with Drizzle-supported schema definitions where practical.
- Package scripts exist for migration generation and migration execution.
- Initial migration files are generated or the limitation is documented here.
- Schema smoke test can import key table exports without connecting to PostgreSQL.
- Domain and application layers remain database-agnostic and do not import infrastructure code.
- `pnpm run typecheck` passes.
- `pnpm test` passes.

## Verification Commands

- `pnpm run db:generate`
- `pnpm run typecheck`
- `pnpm test`

## Migration Status

Initial migration generation succeeded in this environment.

Generated files:

- `drizzle/0000_steep_screwball.sql`
- `drizzle/meta/0000_snapshot.json`
- `drizzle/meta/_journal.json`

## Completion Notes

Sprint 007 is complete when the PostgreSQL schema foundation, migration setup, generated migration or documented limitation, ADR, and project brain updates are in place while repository adapters remain deferred.
