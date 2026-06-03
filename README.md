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
