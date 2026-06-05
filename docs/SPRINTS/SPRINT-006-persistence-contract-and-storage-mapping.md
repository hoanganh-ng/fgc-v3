# Sprint 006: Persistence Contract and Storage Mapping

## Goal

Prepare the Collector Profile Manager persistence boundary for a future database adapter without implementing the adapter.

## Scope

- Review and refine application repository ports for the current use cases.
- Replace broad READY profile lookup with an explicit checkout candidate query based on query-friendly operational fields.
- Add explicit lease status update behavior to the lease repository port.
- Add focused repository contract tests using in-memory fakes only in tests.
- Document the expected profile and lease storage mapping for a likely PostgreSQL implementation.
- Add an ADR for the profile storage shape.
- Update project brain documentation for the active sprint.

## Out of Scope

- Real database adapters.
- PostgreSQL clients.
- ORM integration.
- Migrations or schema files.
- Docker Compose or infrastructure.
- HTTP APIs or routes.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Frontend UI.
- Collector Runtime execution.
- Content Builder or Content Publisher code.
- Production token hashing implementation unless a later sprint introduces that boundary.

## Acceptance Criteria

- Profile repository contract supports saving profiles, finding by id, finding by provisioning token, checking display-name existence, and finding checkout candidates by root-level operational fields.
- Lease repository contract supports saving leases, finding by id, finding active leases by profile id, and updating lease status.
- Repository contracts remain database-agnostic and expose no database client, ORM, SQL, migration, or transaction types.
- Storage mapping document exists at `docs/STORAGE/collector-profile-manager-storage-mapping.md`.
- Storage mapping covers profile ids, status, provisioning lookup and lifecycle fields, checkout availability, daily safety metrics, all profile property groups, version or `updated_at`, lease fields, and indexes.
- ADR exists at `docs/DECISIONS/ADR-0006-profile-storage-shape.md`.
- Contract-style tests cover profile id lookup, provisioning token lookup, checkout candidate lookup by status and availability, lease save/load, active lease lookup, and lease status update.
- Existing state machine, provisioning, session, checkout, and leasing tests pass.
- Typechecking passes.
- Tests pass.
- No out-of-scope adapter, infrastructure, HTTP, database, queue, browser automation, frontend, Collector Runtime, Content Builder, or Content Publisher layers are introduced.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`

## Completion Notes

Sprint 006 is complete when the Collector Profile Manager repository contracts and storage direction are documented, repository contract tests pass, and the project brain points to this sprint.
