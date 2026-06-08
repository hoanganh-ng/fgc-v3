# Sprint 016A: Content Manager Application Layer File Organization Cleanup

## Goal

Refactor or verify the Content Manager application layer file organization before PostgreSQL adapters and HTTP routes are added.

## Scope

- Inspect `src/content-manager/application/index.ts`.
- If `index.ts` is already only a barrel export, make no application code changes.
- If `index.ts` contains implementation details, split the application layer into focused files for errors, ports, validation or pagination helpers, and use cases.
- Keep public exports stable through `src/content-manager/application/index.ts`.
- Preserve all existing behavior and tests.

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
- New Content Manager use cases.
- Content Manager domain behavior changes.

## Acceptance Criteria

- Active sprint documentation identifies Sprint 016A as the active sprint.
- `src/content-manager/application/index.ts` is a barrel export only, or close to it.
- Repository ports, Clock and IdGenerator ports, application errors, validation helpers, and use cases are not implemented directly inside `index.ts`.
- Existing Content Manager application public exports remain stable.
- Existing Content Manager application behavior is unchanged.
- Existing tests pass.
- No migrations, HTTP routes, DB adapters, parser code, runtime code, composition wiring, UI code, or Collector Profile Manager behavior changes are added.

## Verification

```bash
pnpm run typecheck
pnpm test
git status --short
```
