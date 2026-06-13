# fgc-v3

`fgc-v3` is a Content Video Pipeline. The product is being built in stages: Content Collector, Content Builder, and Content Publisher.

The current focus is the Content Collector: collecting normalized content from configured sources while keeping profile/session management, collector runtime orchestration, and content management behind clear module boundaries.

## Current Modules

- Collector Profile Manager: profile lifecycle, provisioning, session ingestion, checkout eligibility, and trusted runtime profile configuration.
- Content Manager: content categories, source groups, normalized content ingestion, deduplication, safe reads, and review lifecycle status.
- Collector Runtime: profile checkout/release orchestration, Facebook collection, browser provider adapters, extraction, submission, and worker execution.
- Web UI: local management surface for profiles, source groups, content categories, content items, and provisioning actions.
- Operator tools: profile provisioning, manual Facebook collection, worker execution, and browser provider probing.

## Current Status

- Profile provisioning works through the Web UI plus operator browser CLI.
- Manual Facebook collection works against configured source groups with provisioned `READY` profiles.
- A collector worker exists for claiming and executing queued collection runs.
- The collector worker is available as an opt-in Docker Compose service for dev and preview stacks.
- A Collector Runtime browser provider boundary exists.
- CloakBrowser support is experimental and not yet production-proven; Playwright Chromium remains the default provider.

## Architecture

The project follows hexagonal architecture, also called ports and adapters. Domain logic must not depend on HTTP, database, browser automation, queues, or framework code.

Collector Profile Manager remains the source of truth for profile identity, session state, fingerprint settings, proxy configuration, and trusted runtime profile configuration. Collector Runtime owns browser orchestration and provider adapters, and it consumes Profile Manager runtime configuration after checkout.

## Quick Start

Install dependencies:

```bash
pnpm install
```

Start the development stack:

```bash
pnpm stack:dev:start
```

Open:

- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5433`

Run the core checks:

```bash
pnpm typecheck
pnpm test
```

Start the containerized worker when queued collection runs should be consumed automatically:

```bash
pnpm stack:dev:worker:start
pnpm stack:dev:worker:logs
```

## Commands

### App Runtime

- `pnpm app:dev`: run the API app in watch mode.
- `pnpm app:start`: run the API app once.
- Backward-compatible aliases: `pnpm dev`, `pnpm start`.

### Web UI

- `pnpm web:dev`: run the Vite Web UI.
- `pnpm web:build`: build the Web UI.
- `pnpm web:typecheck`: typecheck the Web UI.
- Backward-compatible aliases: `pnpm dev:web`, `pnpm build:web`, `pnpm typecheck:web`.

### Database

- `pnpm db:generate`: generate Drizzle migrations.
- `pnpm db:migrate`: run Drizzle migrations.

### Tests

- `pnpm typecheck`: typecheck the backend/root TypeScript project.
- `pnpm test`: run default Vitest tests.
- `pnpm test:db`: run opt-in database integration tests.
- `pnpm test:http:db`: run opt-in DB-backed HTTP integration tests.

### Operator Tools

- `pnpm operator:profile:provision -- --token <token> --base-url http://localhost:8081`
- `pnpm operator:profile:assisted-access -- --profile-id <profile-id> --source-group-id <source-group-id> --base-url http://localhost:8081`
- `pnpm operator:collector:facebook -- --source-group-id <source-group-id> --base-url http://localhost:8081`
- `pnpm operator:collector:worker -- --base-url http://localhost:8081 --once`
- `pnpm operator:browser:probe -- --browser-provider playwright`
- Backward-compatible aliases: `pnpm profile:provision`, `pnpm profile:assisted-access:run`, `pnpm collector:facebook:run`, `pnpm collector:worker:run`, `pnpm collector:browser:probe`.

### Docker Stacks

- `pnpm stack:dev:start`, `pnpm stack:dev:stop`, `pnpm stack:dev:reset`
- `pnpm stack:dev:worker:start`, `pnpm stack:dev:worker:once`, `pnpm stack:dev:worker:logs`
- `pnpm stack:preview:start`, `pnpm stack:preview:stop`, `pnpm stack:preview:reset`
- `pnpm stack:preview:worker:start`, `pnpm stack:preview:worker:once`, `pnpm stack:preview:worker:logs`

The `collector-worker` Compose service is behind the `worker` profile and exposes no ports. Inside Docker it talks to the API at `http://api:3000`; host commands still use `http://localhost:8081` for preview gateway access or `http://localhost:3000` for direct API access.

## Deeper Docs

- [Project State](docs/PROJECT_STATE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Module Boundaries](docs/MODULE_BOUNDARIES.md)
- [Runtime](docs/RUNTIME.md)
- [Active Sprint](docs/SPRINTS/active.md)

## Sprint Workflow

The Architect defines the sprint, the Builder implements only the active sprint, the result is reviewed, and project state/docs are updated before moving on.
