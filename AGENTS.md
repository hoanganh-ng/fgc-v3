# AGENTS.md

## Project

Digital Twin Profile Manager is a strict TypeScript pnpm workspace for orchestrating automated browser profiles.

Use Node.js 24 LTS and pnpm 10. Do not create or maintain a `CLAUDE.md`; Codex project guidance lives in this file.

## Workspace Layout

- `packages/core`: framework-free domain logic, application use cases, and ports.
- `packages/contracts`: shared Zod API boundary contracts for API and Web UI.
- `apps/api`: Fastify HTTP adapter, Kysely/PostgreSQL persistence adapter, migrations, and OpenAPI.
- `apps/web`: Vue 3 + Vite admin console using PrimeVue and TanStack Query.
- `requirements/`: functional and non-functional requirements. Read these before changing behavior.

## Architecture Rules

- Keep `packages/core` independent of Fastify, Kysely, PostgreSQL, Vue, HTTP, environment variables, and runtime schemas from adapters.
- Own ports in the core/application layer; implement them only in adapters.
- Use Zod schemas in `packages/contracts` for public API boundary DTOs shared by API and UI.
- Validate public API input and database output before data reaches business use cases.
- Preserve the profile lifecycle state machine: `PENDING_CONFIG -> PENDING_LOGIN -> READY <-> BUSY`.
- Store provisioning tokens as hashes only; expose raw provisioning tokens only once when issued.
- Keep hardware fingerprints immutable after assignment.
- Use PostgreSQL root columns for indexed operational fields and JSONB for rich profile pillar data.

## Type Safety

- Keep TypeScript strictness enabled. Do not loosen `tsconfig.base.json` without a strong reason.
- Avoid `any`; prefer explicit types, `unknown` plus validation, or inferred Zod types at boundaries.
- With `exactOptionalPropertyTypes`, omit optional properties instead of passing explicit `undefined` unless the type allows it.
- Use structured validation/parsing instead of ad hoc string manipulation for persisted or external data.

## Backend Conventions

- Fastify code belongs in `apps/api/src/http`.
- PostgreSQL/Kysely code belongs in `apps/api/src/infra/persistence`.
- Security adapters, token generation, clocks, and ID generation belong under `apps/api/src/infra`.
- Domain errors should remain explicit and be mapped at the HTTP boundary.
- Add migrations under `apps/api/migrations` for schema changes.

## Frontend Conventions

- The Web UI is an internal admin console, not a marketing site.
- Keep UI dense, clear, and operational: profile list/detail, lifecycle visibility, provisioning, and checkout workflows.
- Use Vue 3 Composition API, PrimeVue components, Vue Router, TanStack Query, and lucide icons.
- Consume API contracts through shared Zod schemas from `@dtpm/contracts`.
- Keep API base URL and admin API key configurable through Vite environment variables.

## Commands

Run from the repository root unless scoped work makes a narrower command sufficient.

- Install: `pnpm install`
- Type check: `pnpm typecheck`
- Test: `pnpm test`
- Install Playwright browser: `pnpm playwright:install`
- E2E test: `pnpm test:e2e`
- Lint: `pnpm lint`
- Build: `pnpm build`
- API dev server: `pnpm dev:api`
- Web dev server: `pnpm dev:web`
- API migrations: `pnpm --filter @dtpm/api migrate`
- Docker stack: `docker compose up --build`

For local Postgres, use Docker Compose from the repo root. The Compose stack includes `postgres`, `api-migrate`, `api`, and `web`. The API should remain private to the Compose network by default; the Web nginx service proxies browser traffic from `/api` to `api:3000`. If Docker Hub credentials block pulling base images, report that clearly instead of changing credentials silently.

## Verification Expectations

- For domain or use-case changes, add or update `packages/core` tests.
- For API contract changes, update `packages/contracts` schemas and contract tests.
- For HTTP behavior changes, update `apps/api` route tests.
- For Web UI behavior changes, update `apps/web` tests when practical.
- For full browser workflow changes, update `e2e` Playwright tests when practical.
- Before handing work back, run at least `pnpm typecheck`, `pnpm test`, and `pnpm lint`; run `pnpm build` for scaffold, dependency, or frontend changes.

## Git Safety

- Do not revert user changes unless explicitly asked.
- Keep edits scoped to the requested task.
- Do not use destructive git commands such as `git reset --hard` or `git checkout --` without explicit user approval.
