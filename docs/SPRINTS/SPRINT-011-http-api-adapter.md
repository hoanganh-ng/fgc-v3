# Sprint 011: HTTP API Adapter

## Goal

Add the first HTTP API adapter for the Collector Profile Manager so external callers can invoke existing application use cases through Fastify routes while preserving the hexagonal boundary.

## Scope

- Add Fastify as the HTTP framework.
- Add HTTP adapter code under `src/interfaces/http/`.
- Add a testable HTTP server factory that accepts the composed Collector Profile Manager service.
- Add `GET /health`.
- Add initial Collector Profile Manager routes for profile creation, profile configuration update, provisioning start, provisioning configuration lookup, session ingestion, profile checkout, and lease release.
- Defer `GET /collector/profiles/:profileId` unless a dedicated application read use case is added.
- Add request, params, and response validation for HTTP DTOs.
- Add centralized HTTP error mapping for application and domain errors.
- Add a minimal runtime entrypoint that loads environment config, composes the Collector Profile Manager, creates the HTTP server, and listens on host/port env settings.
- Add `HTTP_HOST` and `HTTP_PORT` to `.env.example`.
- Add package scripts for local HTTP runtime and build/type verification.
- Add database-free HTTP adapter tests with fake Collector Profile Manager services.
- Document the HTTP adapter decision, including validation, error mapping, and deferred authentication.
- Update project brain documentation for the active sprint.

## Out of Scope

- Frontend UI.
- Authentication or authorization systems.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Collector Runtime execution.
- Content Builder or Content Publisher code.
- OpenAPI generation unless it is trivial and does not expand scope.
- Production deployment configuration.
- Complex API versioning.
- Repository, database schema, domain, or application redesign unless required for route wiring.
- Requiring Docker or a live PostgreSQL database for the default test suite.

## Acceptance Criteria

- `docs/SPRINTS/active.md` identifies Sprint 011 as the active sprint.
- Fastify is added without introducing NestJS, Express, Hono, tRPC, or a dependency injection framework.
- `src/interfaces/http/` contains the server factory, routes, schemas, centralized error mapper, and public exports.
- `createHttpServer({ collectorProfileManager })` builds a Fastify server without opening database connections in route files.
- `GET /health` returns `{ "status": "ok" }`.
- Collector Profile Manager routes call application use cases/services rather than constructing repositories or performing domain work in handlers.
- HTTP DTO validation rejects invalid request input with 400 responses.
- Provisioning configuration responses do not include authentication state, provisioning token state, cookies, or local storage.
- Application and domain errors map to documented HTTP status codes without leaking stack traces.
- A minimal `src/main.ts` loads config, creates the composition root, creates the HTTP server, listens on env host/port defaults, and closes resources during shutdown.
- `.env.example` includes `HTTP_HOST` and `HTTP_PORT`.
- Default HTTP tests use fake services and do not require PostgreSQL.
- Domain and application layers remain free of Fastify, HTTP, PostgreSQL, Drizzle, database clients, browser automation, queues, framework code, infrastructure, and composition dependencies.
- `pnpm run typecheck` passes.
- `pnpm test` passes.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`

## Error Mapping Choices

- Validation errors map to `400 Bad Request`.
- Invalid profile configuration maps to `400 Bad Request`.
- Invalid, expired, or consumed provisioning tokens map to `401 Unauthorized` because the token is the only current credential for provisioning routes.
- Profile and lease not found errors map to `404 Not Found`.
- Invalid state transitions, invalid application operations, checkout ineligibility, closed leases, and lease state conflicts map to `409 Conflict`.
- No eligible profile available maps to `404 Not Found` because no checkout resource can currently be allocated.
- Unexpected errors map to `500 Internal Server Error` and omit stack traces.

## Security Notes

Authentication and authorization are deferred in this sprint. The HTTP adapter is not production-safe for public exposure until a future sprint adds a real access-control boundary. Route handlers must not log provisioning tokens, cookies, local storage, or other captured authentication state.

## Completion Notes

Sprint 011 is complete when the Collector Profile Manager can be exposed through a thin, testable Fastify adapter, with validation and error translation at the HTTP edge and no framework dependencies leaking into the domain or application layers.
