# Sprint 016: Content Manager Application Use Cases

## Goal

Create the Content Manager application layer and application tests for normalized collected content.

## Scope

- Add Content Manager application-owned repository ports:
  - ContentCategoryRepository.
  - SourceGroupRepository.
  - ContentItemRepository.
- Add Content Manager application-owned supporting ports:
  - Clock.
  - IdGenerator.
- Add Content Manager application errors.
- Add Content Manager application validation helpers.
- Add Content Manager application use cases:
  - CreateContentCategoryUseCase.
  - CreateSourceGroupUseCase.
  - UpdateSourceGroupStatusUseCase.
  - IngestCollectedContentUseCase.
  - UpdateContentStatusUseCase.
  - GetContentItemUseCase.
  - ListContentItemsUseCase.
  - ListSourceGroupsUseCase.
  - ListContentCategoriesUseCase.
- Add application tests using fake in-memory repositories, a fake clock, and a fake id generator.

## Out Of Scope

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

- Active sprint documentation identifies Sprint 016 as the active sprint.
- Content Manager application code has no dependency on HTTP, Fastify, PostgreSQL, Drizzle, browser automation, queues, external APIs, or Facebook GraphQL payload shapes.
- Content Manager application use cases receive normalized Content Manager input and do not introduce raw Facebook GraphQL payload types.
- Application-owned repository ports exist for content categories, source groups, and content items.
- Application-owned Clock and IdGenerator ports exist unless a clean shared port already exists.
- CreateContentCategoryUseCase validates input, assigns id and timestamps, rejects duplicate slugs, saves, and returns the category.
- CreateSourceGroupUseCase validates input, requires an existing category, rejects duplicate platform plus external group id, defaults status to ACTIVE, saves, and returns the source group.
- UpdateSourceGroupStatusUseCase updates status and updatedAt for existing groups and rejects missing groups.
- IngestCollectedContentUseCase validates normalized collected content, requires an existing source group, creates new COLLECTED content, and merges duplicates by platform plus external post id.
- Duplicate ingestion preserves content id, createdAt, firstCollectedAt, and current status while updating latest collected fields, engagement counts, top comments, lastCollectedAt, and updatedAt.
- Duplicate ingestion does not reset SELECTED, REJECTED, or USED content back to COLLECTED.
- UpdateContentStatusUseCase validates domain status transitions and rejects invalid transitions.
- GetContentItemUseCase returns an existing content item and rejects missing items.
- ListContentItemsUseCase supports optional status and sourceGroupId filters, limit and offset defaults, and max limit 100.
- ListSourceGroupsUseCase supports optional status and categoryId filters, limit and offset defaults, and max limit 100.
- ListContentCategoriesUseCase returns all categories.
- Application tests cover creation, duplicates, missing references, ingestion, merge preservation and updates, status transitions, get, and list behavior.
- No migrations, HTTP routes, DB adapters, parser code, runtime code, composition wiring, or Collector Profile Manager behavior changes are added.

## Verification

```bash
pnpm run typecheck
pnpm test
git status --short
```
