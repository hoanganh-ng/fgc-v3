# Sprint 012: Profile Query Use Cases and Read API

## Goal

Add application-owned profile query use cases and expose safe Collector Profile Manager read APIs for the future Profile Manager Web UI.

## Scope

- Add dedicated application use cases for getting a profile by id and listing profiles.
- Extend the application-owned `ProfileRepository` port with simple profile listing support.
- Support list filtering by profile status with limit/offset pagination.
- Return explicit read DTOs that omit authentication state, cookies, local storage, provisioning token internals, token hashes, and proxy credentials.
- Implement the new repository query method in the in-memory test repository and PostgreSQL/Drizzle repository adapter.
- Wire `getProfile` and `listProfiles` through the Collector Profile Manager composition container.
- Add `GET /collector/profiles` and `GET /collector/profiles/:profileId` to the Fastify HTTP adapter.
- Validate read route params and query strings at the HTTP edge.
- Add database-free application and HTTP tests for profile reads, pagination, status filtering, error mapping, and sensitive-field omission.
- Optionally extend gated PostgreSQL integration verification for simple profile listing.
- Update project brain documentation for the active sprint.

## Out of Scope

- Frontend UI.
- Authentication or authorization systems.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Collector Runtime execution.
- Content Builder or Content Publisher code.
- Complex search, full-text search, or generic query builders.
- API versioning.
- Production audit logging.
- Repository, database schema, domain, or application redesign unless required for query wiring.
- Requiring Docker or a live PostgreSQL database for the default test suite.

## Acceptance Criteria

- `docs/SPRINTS/active.md` identifies Sprint 012 as the active sprint.
- `GetProfileUseCase` and `ListProfilesUseCase` exist in the application layer.
- The `ProfileRepository` port supports simple `listProfiles` queries by status, limit, and offset.
- The PostgreSQL repository lists profiles using root-level operational fields and avoids deep JSONB querying.
- In-memory test repositories implement the list query contract.
- The composition root exposes `getProfile` and `listProfiles`.
- `GET /collector/profiles` supports `status`, `limit`, and `offset` query params.
- `GET /collector/profiles/:profileId` returns a safe profile detail DTO.
- Invalid read params map to `400 Bad Request`.
- Missing profiles map to `404 Not Found`.
- Read responses omit authentication state, cookies, local storage, raw provisioning tokens, token hashes, and proxy credentials.
- Default tests remain database-free.
- Domain and application layers remain free of Fastify, HTTP, PostgreSQL, Drizzle, database clients, browser automation, queues, framework code, infrastructure, and composition dependencies.
- `pnpm run typecheck` passes.
- `pnpm test` passes.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`

## Optional Database Verification

Live PostgreSQL verification may be extended through the existing gated flow:

```bash
DATABASE_URL=... RUN_DB_TESTS=true pnpm run test:db
```

Use only a local or disposable migrated PostgreSQL database for that command.

## Security Notes

Read APIs are intended for a future management surface but authentication and authorization remain deferred. They must not be exposed publicly until a future sprint adds access control.

List and detail DTOs are explicit read models. They may expose safe operational metadata and configuration groups, but they must not expose captured session state, provisioning token state, persisted token hashes, raw token values, or proxy credentials.

## Completion Notes

Sprint 012 is complete when callers can list profiles and read profile details through application-owned query use cases and thin HTTP routes, with sensitive fields removed from read DTOs and no framework or persistence dependencies leaking inward.
