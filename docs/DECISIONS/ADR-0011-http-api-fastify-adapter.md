# ADR-0011: HTTP API Fastify Adapter

## Status

Accepted

## Context

The Collector Profile Manager has domain rules, application use cases, repository ports, PostgreSQL adapters, and an outer composition root. Sprint 011 introduces the first HTTP adapter so callers can invoke the current application use cases through routes.

The project must preserve the hexagonal boundary: domain and application code cannot depend on Fastify, HTTP, PostgreSQL, Drizzle, database clients, browser automation, queues, framework code, infrastructure, or composition.

Authentication and authorization are not designed yet, and provisioning/session routes handle sensitive tokens and captured authentication state.

## Decision

Use Fastify as the first HTTP framework under `src/interfaces/http/`.

The HTTP layer may depend on Fastify, application use-case contracts, domain schemas for edge validation, and the composition root type shape used by `createHttpServer({ collectorProfileManager })`. Domain and application layers must not import the HTTP adapter.

Route files do not create database clients, repositories, transactions, or system adapters. They accept a Collector Profile Manager service object and call use cases through `execute(...)`, which keeps the server factory testable with fake services.

Use simple Fastify JSON schemas for route params, bodies, and success/error response shapes. Use Zod parsing inside handlers to reuse the existing schema source of truth for Collector Profile Manager DTOs where practical.

Centralize error mapping in `src/interfaces/http/errors/http-error-mapper.ts`:

- Validation errors map to `400 Bad Request`.
- Invalid profile configuration maps to `400 Bad Request`.
- Invalid, expired, or consumed provisioning tokens map to `401 Unauthorized`.
- Profile and lease not found errors map to `404 Not Found`.
- Invalid state transitions, invalid application operations, checkout ineligibility, closed leases, and lease state conflicts map to `409 Conflict`.
- No eligible profile available maps to `404 Not Found`.
- Unexpected errors map to `500 Internal Server Error` without stack traces.

Management-style profile responses return profile summaries that omit authentication state and provisioning token internals. The checkout route returns authentication state as part of the operational lease payload because that is the application use case output required by a future collector caller. Provisioning configuration responses must not include authentication state, cookies, local storage, or provisioning token state.

Authentication is deferred. This HTTP adapter is not production-safe for public exposure until a future sprint adds access control. Fastify request logging remains disabled by default to avoid logging provisioning tokens in URLs.

`GET /collector/profiles/:profileId` is deferred because the current application layer does not have a dedicated read use case.

## Consequences

- The project gains an HTTP interface without changing domain or application dependencies.
- Default tests can cover HTTP behavior with fake services and no live PostgreSQL database.
- Route validation has two layers: lightweight Fastify schemas at the edge and Zod parsing before use-case invocation.
- Error responses are consistent and do not leak stack traces.
- Public deployment remains blocked on future authentication and authorization work.
