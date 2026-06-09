# Sprint 027: Dockerized Full-Stack Runtime

## Goal

Add repeatable Docker Compose runtimes for the current full-stack Content Collector management surface:

- Development mode with PostgreSQL, the Fastify API, and the Vite Web UI dev server.
- Production-like preview mode with PostgreSQL, the Fastify API, and an Nginx Web Gateway that serves the built Web UI and proxies API requests.

The browser should use one public entrypoint in preview mode. The Web UI must use relative Collector API paths so preview builds do not hardcode a localhost backend.

## Scope

- Add `docker-compose.dev.yml` with:
  - `postgres`.
  - `api`.
  - `web-dev`.
- Add `docker-compose.preview.yml` with:
  - `postgres`.
  - `api`.
  - `web-gateway`.
- Use a named PostgreSQL volume, local development credentials, and a practical PostgreSQL healthcheck.
- Configure the API through `DATABASE_URL` and the existing backend commands.
- Run the existing Drizzle migrations through the existing `pnpm db:migrate` command before API startup where appropriate.
- Keep Vite for development hot reload and expose the Web UI on `localhost:5173`.
- Build `apps/web` into static files for preview and serve them through Nginx on documented port `localhost:8081`.
- Proxy `/collector/*` from Nginx to `http://api:3000` before the React SPA fallback is evaluated.
- Set standard forwarded headers in the Nginx proxy.
- Ensure the React SPA fallback supports refreshing `/profiles` in preview mode.
- Update Web UI API configuration so relative `/collector/*` paths work in dev and preview.
- Add root scripts or documented commands for starting, stopping, and resetting both stacks.
- Document stack usage, URLs, API routing, migrations, database reset, and verification.

## Architecture Rules

- Do not change backend architecture or business logic.
- Domain logic must remain independent of Docker, HTTP, database, browser automation, queues, and UI framework details.
- The Web UI remains an adapter/client that consumes backend APIs as the source of truth.
- Use the existing Drizzle migration setup; do not introduce a separate migration system.

## Security Rules

- Do not expose cookies, local storage, proxy credentials, raw session material, provisioning token material, token hashes, or trusted runtime secrets.
- Use local development credentials only.

## Out Of Scope

- Production TLS.
- Real domain deployment.
- Kubernetes.
- CI/CD.
- Authentication or authorization.
- Profile forms.
- Provisioning UI.
- Browser login capture.
- Facebook content capture.
- Scheduler, queue, or collection runs.
- Backend business logic changes.

## Acceptance Criteria

- `docker compose -f docker-compose.dev.yml config` passes.
- `docker compose -f docker-compose.preview.yml config` passes.
- Dev stack starts and the Web UI is reachable at `http://localhost:5173`.
- Preview stack starts and the Nginx app is reachable at `http://localhost:8081`.
- Refreshing `/profiles` in preview mode returns the React app, not a 404.
- Calling `/collector/profiles` through Nginx reaches the Fastify API.
- The `/profiles` UI shows the real backend empty state or real data.
- `pnpm run typecheck` passes.
- `pnpm test` passes.
- `pnpm --filter @fgc/web build` passes.

## Verification

```bash
docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.preview.yml config
pnpm run typecheck
pnpm test
pnpm --filter @fgc/web build
```
