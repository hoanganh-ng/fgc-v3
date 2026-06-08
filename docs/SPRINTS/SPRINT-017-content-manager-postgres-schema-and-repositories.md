# Sprint 017: Content Manager PostgreSQL Schema and Repository Adapters

## Goal

Add PostgreSQL/Drizzle persistence for Content Manager and implement infrastructure repository adapters for the existing Content Manager application ports.

## Scope

- Inspect and follow existing Collector Profile Manager database, mapper, repository, migration, and gated integration test conventions.
- Add Drizzle schema for:
  - `content_categories`.
  - `source_groups`.
  - `content_items`.
- Add a Drizzle migration for the new Content Manager tables, constraints, and indexes.
- Implement PostgreSQL repository adapters for:
  - `ContentCategoryRepository`.
  - `SourceGroupRepository`.
  - `ContentItemRepository`.
- Add mappers between Drizzle rows and Content Manager domain/application types.
- Validate rows read from PostgreSQL before returning them to application code.
- Store v1 `topComments` as JSONB on `content_items`.
- Preserve optional `rawPayloadRef` only as a reference field, not canonical raw payload storage.
- Add optional PostgreSQL integration tests gated by the existing `RUN_DB_TESTS=true` convention.
- Update Content Manager storage documentation for the implemented v1 shape.

## Out Of Scope

- HTTP routes.
- Fastify schemas.
- Content Manager HTTP API.
- Composition root wiring, except harmless infrastructure exports if needed.
- Facebook GraphQL parsing.
- Collector Runtime implementation.
- Real GraphQL fixtures.
- Web UI.
- Content Builder.
- Publisher.
- New Content Manager use cases.
- Content Manager domain or application behavior changes beyond small export/type adjustments required by adapters.
- Collector Profile Manager behavior changes.
- Raw Facebook GraphQL payload storage as canonical content data.
- Deduplication merge logic inside repositories.

## Acceptance Criteria

- Active sprint documentation identifies Sprint 017 as the active sprint.
- Content Manager Drizzle schema defines `content_categories`, `source_groups`, and `content_items`.
- `content_categories` has `id`, `name`, `slug`, nullable `description`, `created_at`, `updated_at`, primary key `id`, and unique `slug`.
- `source_groups` has `id`, `platform`, `external_group_id`, `name`, `url`, `category_id`, `status`, `collection_priority`, nullable `notes`, `created_at`, `updated_at`, primary key `id`, foreign key `category_id`, unique `(platform, external_group_id)`, and indexes for platform, status, category, and priority.
- `content_items` has `id`, `platform`, `source_group_id`, `external_post_id`, `source_url`, nullable `title`, `body_text`, nullable author fields, nullable `posted_at`, collection timestamps, engagement counts, nullable `share_count`, JSONB `top_comments`, `status`, nullable `raw_payload_ref`, `created_at`, `updated_at`, primary key `id`, foreign key `source_group_id`, unique `(platform, external_post_id)`, and indexes for source group, status, latest collection time, reaction count, and comment count.
- Repository adapters implement the existing Content Manager repository ports without moving business deduplication or merge logic into infrastructure.
- Mappers convert snake_case database rows to camelCase domain objects, round-trip timestamps, map nullable fields to optional domain fields, map JSONB `top_comments` to `TopComment[]`, and map nullable `raw_payload_ref` to optional `rawPayloadRef`.
- Rows read from PostgreSQL are validated before returning to application code.
- Gated DB tests cover repository save/find/list behavior, lookup methods, filters, update-by-id behavior, JSONB and raw payload reference round trips, unique constraints, and foreign key constraints.
- Default tests remain database-free.
- No HTTP routes, parser/runtime code, composition root wiring, UI code, Content Builder, Publisher, or Collector Profile Manager behavior changes are added.

## Verification

```bash
pnpm run typecheck
pnpm test
docker compose up -d postgres
pnpm run db:migrate
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline RUN_DB_TESTS=true pnpm run test:db
git status --short
```
