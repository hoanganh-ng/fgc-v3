# Digital Twin Profile Manager

Strict TypeScript scaffold for a profile manager that keeps domain logic framework-free and exposes Fastify, PostgreSQL, and Vue as adapters.

## Workspace

- `packages/core`: framework-free domain, use cases, and ports.
- `packages/contracts`: shared Zod API boundary contracts for the API and Web UI.
- `apps/api`: Fastify HTTP adapter, Kysely/PostgreSQL persistence adapter, OpenAPI, and local migrations.
- `apps/web`: Vue 3 admin console consuming the shared API contracts.

## Local Development

Use Node.js 24 LTS and pnpm 10.

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL with Docker Compose.
3. Install dependencies with pnpm.
4. Run API migrations.
5. Start the API and Web UI dev servers.

The API listens on `http://localhost:3000` by default. The Web UI listens on `http://localhost:5173` by default.

## Docker

The repository includes Docker images for the API and Web UI plus Compose orchestration for Postgres, migrations, API, and web.

```bash
docker compose up --build
```

Compose exposes:

- Web UI: `http://localhost:8081`
- API proxy: `http://localhost:8081/api`
- API docs: `http://localhost:8081/api/docs`
- Postgres: `localhost:5432`

The `api-migrate` service runs `apps/api/migrations` before the API starts. The API is private to the Compose network and is reached by the browser through the Web container's `/api` nginx proxy. The Web UI writes `/config.js` at container startup from `API_BASE_URL` and `ADMIN_API_KEY`, so the same built image can point at different API deployments.

For local Compose, the default admin API key is `change-me-development-key`. Do not use that value in production.

## E2E Tests

Playwright E2E tests run against an isolated Docker Compose project named `dtpm-e2e`. The suite exposes the Web UI on `http://127.0.0.1:18081`, uses a separate Postgres host port `15432`, and tears the stack down with volumes when tests finish.

```bash
pnpm playwright:install
pnpm test:e2e
```

Set `E2E_KEEP_STACK=1` to keep the Compose stack running after a test failure for inspection.
