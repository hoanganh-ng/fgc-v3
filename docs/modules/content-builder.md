# Content Builder

## Ownership

- Reusable building blocks for transforming collected content into future
  creative planning artifacts.
- `TransformType` catalog entries that define a reusable initial transform
  prompt.
- Transform Type lifecycle: create, list, read, update, and archive.
- Safe operator HTTP and Web UI surfaces for Transform Type catalog
  management.

## Does Not Own

- Content Manager source groups, source publishers, content items, ingestion,
  or review lifecycle.
- Collector Runtime execution, browser automation, Facebook capture,
  extractor orchestration, queues, schedulers, or workers.
- Profile/session management or checkout behavior.
- LLM provider configuration, prompt execution, prompt versioning, Content
  Briefs, Producer graphs, artifacts, or Content Publisher behavior.

## Important Source Paths

- `src/content-builder/domain/`
- `src/content-builder/application/`
- `src/composition/content-builder/`
- `src/infrastructure/database/schema/content-builder.schema.ts`
- `src/infrastructure/database/repositories/drizzle-transform-type.repository.ts`
- `src/interfaces/http/routes/content-builder.routes.ts`
- `src/interfaces/http/schemas/content-builder.http-schemas.ts`
- `apps/web/src/lib/api/content-builder-client.ts`
- `apps/web/src/features/content-builder/`
- `apps/web/src/pages/transform-types-page.tsx`

## Critical Invariants

- Domain code remains framework-free and database-free.
- Application code owns repository ports and typed errors.
- Optional descriptions are omitted when absent or empty.
- Archived Transform Types remain readable.
- Active normalized names are unique among non-archived Transform Types.
- No LLM call, prompt execution, runtime orchestration, or collected-content
  selection happens in the Transform Type catalog.

## Cross-Module Communication

- The Web UI consumes safe `/builder/*` HTTP contracts.
- Content Builder does not import Content Manager repositories, Collector
  Runtime internals, Profile Manager internals, browser providers, or LLM SDKs.

## Sensitive Data Rules

- Transform Type DTOs contain only catalog metadata and prompt text.
- Do not expose collector/profile/runtime data, cookies, localStorage, tokens,
  authorization headers, proxy credentials, browser fingerprints, raw Facebook
  payloads, screenshots, or viewer data through Content Builder DTOs, logs,
  tests, or docs.

## Relevant Verification Commands

```bash
pnpm typecheck
pnpm test
pnpm web:typecheck
pnpm web:build
pnpm test:db
```
