# Sprint 019: Content Manager HTTP API

## Goal

Expose Content Manager application use cases through the existing Fastify HTTP adapter while preserving hexagonal boundaries and safe read contracts.

## Scope

- Inspect and follow existing Collector Profile Manager HTTP adapter conventions.
- Register Content Manager routes in the existing Fastify server.
- Add Content Manager HTTP request schemas, response schemas, DTO mapping, and route tests.
- Add routes for content categories:
  - `POST /collector/content-categories`.
  - `GET /collector/content-categories`.
- Add routes for source groups:
  - `POST /collector/source-groups`.
  - `GET /collector/source-groups?status&categoryId&limit&offset`.
  - `PATCH /collector/source-groups/:sourceGroupId/status`.
- Add routes for content items:
  - `POST /collector/content-items`.
  - `GET /collector/content-items?status&sourceGroupId&limit&offset`.
  - `GET /collector/content-items/:contentItemId`.
  - `PATCH /collector/content-items/:contentItemId/status`.
- Accept normalized Content Manager ingestion input on content item ingestion.
- Keep public Content Manager read DTOs free of raw Facebook GraphQL payloads and omit `rawPayloadRef` from normal read responses.
- Extend centralized HTTP error mapping for Content Manager validation, not found, duplicate, and invalid status transition errors.
- Add HTTP adapter tests with fake Content Manager services.
- Add a small gated HTTP/PostgreSQL integration test using the existing `RUN_HTTP_DB_TESTS=true` convention.
- Update project state documentation for the new active sprint.

## Out Of Scope

- Facebook GraphQL parser code.
- Collector Runtime implementation.
- Browser automation.
- Network payload capture.
- Web UI.
- Content Builder.
- Publisher.
- New database tables.
- New Content Manager use cases.
- Domain or application dependencies on Fastify, HTTP, PostgreSQL, Drizzle, browser automation, queues, external APIs, or Facebook GraphQL payload shapes.
- Business logic in HTTP route handlers.
- Raw Facebook GraphQL payloads as Content Manager HTTP contracts.
- Collector Profile Manager behavior changes beyond harmless server route registration and test setup changes.

## Acceptance Criteria

- Active sprint documentation identifies Sprint 019 as the active sprint.
- Content Manager routes are registered through the existing Fastify server factory.
- Route handlers call Content Manager use cases from the composition service and do not contain business rules.
- Request bodies, params, query strings, and success/error response shapes are validated using existing HTTP schema conventions.
- Source group and content item list routes use limit default `50`, offset default `0`, and max limit `100`.
- Content category routes can create and list category DTOs.
- Source group routes can create, list with filters/pagination, and update status.
- Content item routes can ingest normalized collected content, list with filters/pagination, get by id, and update lifecycle status.
- Content item ingestion does not require or accept raw Facebook GraphQL payloads as its primary shape.
- Content item read DTOs do not expose raw Facebook GraphQL payloads and omit `rawPayloadRef`.
- Centralized error mapping maps Content Manager validation errors to `400`, not found errors to `404`, duplicate errors to `409`, invalid content status transitions to `409`, and unexpected errors to the existing generic `500`.
- Fake-service HTTP tests cover the route and error cases named in this sprint.
- A gated DB-backed HTTP test covers category creation, source group creation, content ingestion, content reads/lists, status update to `SELECTED`, duplicate ingestion update, status preservation, engagement count updates, and top comment updates.
- Default tests remain database-free.
- No parser/runtime/UI code is added.

## Verification

```bash
pnpm run typecheck
pnpm test
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline pnpm run db:migrate
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline RUN_DB_TESTS=true pnpm run test:db
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline RUN_HTTP_DB_TESTS=true pnpm run test:http:db
git status --short
```
