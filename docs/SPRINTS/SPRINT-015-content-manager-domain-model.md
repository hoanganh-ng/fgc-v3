# Sprint 015: Content Manager Domain Model

## Goal

Create the Content Manager domain model and domain tests for normalized collected content.

## Scope

- Add Content Manager domain concepts:
  - ContentPlatform.
  - ContentCategory.
  - SourceGroup.
  - SourceGroupStatus.
  - ContentItem.
  - ContentStatus.
  - TopComment.
  - CollectedContentInput.
- Define Facebook as the first content platform.
- Define Content Manager category, source group, content item, top comment, and normalized ingestion schemas.
- Add no-throw schema-backed validation helpers following existing domain conventions.
- Add content lifecycle transition helpers.
- Add top comment normalization by reaction count with default top N = 10.
- Add duplicate collected content merge behavior that preserves identity, first collection timestamp, creation timestamp, and current status.
- Add domain tests only.

## Out Of Scope

- Application use cases.
- Repository ports.
- PostgreSQL schema.
- Drizzle migrations.
- Repository adapters.
- HTTP routes.
- Fastify schemas.
- Composition root wiring.
- Facebook GraphQL parsing.
- Collector Runtime implementation.
- Real GraphQL fixtures.
- Web UI.
- Collector Profile Manager behavior changes.

## Acceptance Criteria

- Active sprint documentation identifies Sprint 015 as the active sprint.
- Content Manager domain code has no dependency on HTTP, Fastify, PostgreSQL, Drizzle, browser automation, queues, external APIs, or Facebook GraphQL payload shapes.
- Content Manager models accept normalized ingestion input, not raw Facebook GraphQL payloads.
- Optional raw-payload-related data is limited to an optional `rawPayloadRef`.
- Content category validation requires name, lowercase URL-safe slug, and timestamps.
- Source group validation supports one category per group and requires Facebook platform, external group identity, URL, status, and collection priority from 0 to 100.
- Content item validation requires Facebook platform, source group identity, external post identity, source URL, body text, collection timestamps, engagement counts, top comments, status, and timestamps.
- Top comment validation requires external comment identity, body text, non-negative counts, and collection timestamp.
- Content status transitions enforce the Sprint 015 rules.
- Duplicate collected content merge preserves `id`, `firstCollectedAt`, `createdAt`, and current status while updating latest collected fields.
- Domain tests cover validation, transitions, top comment normalization, and duplicate merge behavior.
- No migrations, HTTP routes, DB adapters, parser code, runtime code, application use cases, or Collector Profile Manager behavior changes are added.

## Verification

```bash
pnpm run typecheck
pnpm test
git status --short
```
