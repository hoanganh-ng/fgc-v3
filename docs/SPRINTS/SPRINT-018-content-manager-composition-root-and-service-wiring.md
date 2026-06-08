# Sprint 018: Content Manager Composition Root and Service Wiring

## Goal

Wire Content Manager application use cases to real infrastructure through the composition root while preserving hexagonal boundaries.

## First Sanity Check

Sprint 017 migration `drizzle/0001_colossal_jack_murdock.sql` was inspected before Sprint 018 implementation. It creates only Content Manager enums, tables, foreign keys, unique indexes, and lookup indexes for `content_categories`, `source_groups`, and `content_items`. It does not recreate, drop, or destructively alter existing Collector Profile Manager tables.

## Scope

- Inspect and follow existing Collector Profile Manager composition root conventions.
- Add Content Manager service wiring in the composition layer.
- Construct and expose:
  - `CreateContentCategoryUseCase`.
  - `ListContentCategoriesUseCase`.
  - `CreateSourceGroupUseCase`.
  - `UpdateSourceGroupStatusUseCase`.
  - `ListSourceGroupsUseCase`.
  - `IngestCollectedContentUseCase`.
  - `UpdateContentStatusUseCase`.
  - `GetContentItemUseCase`.
  - `ListContentItemsUseCase`.
- Wire Sprint 017 PostgreSQL repository adapters:
  - `DrizzleContentCategoryRepository`.
  - `DrizzleSourceGroupRepository`.
  - `DrizzleContentItemRepository`.
- Wire supporting ports:
  - `Clock`.
  - `IdGenerator`.
- Reuse existing generic infrastructure where appropriate.
- Add or update composition exports so a future HTTP adapter can access Content Manager use cases cleanly.
- Add focused composition tests.
- Add a small optional DB-backed application integration test if it fits existing gated DB test conventions.
- Update project state and roadmap documentation for the new sprint order.

## Out Of Scope

- HTTP routes.
- Fastify schemas.
- Content Manager HTTP API.
- Facebook GraphQL parsing.
- Collector Runtime implementation.
- Real GraphQL fixtures.
- Web UI.
- Content Builder.
- Publisher.
- New database tables.
- New Content Manager use cases.
- Content Manager domain or application behavior changes beyond harmless export/type adjustments required by composition.
- Repository business behavior changes.
- Collector Profile Manager behavior changes beyond harmless composition-root organization if needed.
- Raw Facebook GraphQL payload storage as canonical content data.

## Acceptance Criteria

- Active sprint documentation identifies Sprint 018 as the active sprint.
- Sprint 017 migration has been inspected and documented as non-destructive to existing Collector Profile Manager tables.
- Content Manager composition constructs all expected use cases.
- Content Manager composition wires real PostgreSQL repository adapters from Sprint 017.
- Content Manager composition wires clock and ID generator ports without importing Collector Profile Manager internals.
- Content Manager composition does not import HTTP/Fastify route handlers, Facebook GraphQL parser types, Collector Runtime code, or UI code.
- Composition root does not contain business logic.
- Future HTTP adapters can import Content Manager service types and constructors from composition exports.
- Composition tests cover successful service construction and expected exposed use cases.
- Composition tests cover that Content Manager services can be constructed without HTTP/Fastify.
- Existing Collector Profile Manager composition tests continue to pass.
- Optional DB-backed application integration test is gated by `RUN_DB_TESTS=true` and covers category creation, source group creation, first content ingestion, readback, duplicate ingestion update, and status preservation.
- Default tests remain database-free.
- No HTTP routes, parser/runtime code, UI code, Content Builder, Publisher, or Collector Profile Manager behavior changes are added.

## Verification

```bash
pnpm run typecheck
pnpm test
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline pnpm run db:migrate
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5432/content_pipeline RUN_DB_TESTS=true pnpm run test:db
git status --short
```
