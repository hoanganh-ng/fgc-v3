# fgc-v3

`fgc-v3` is a Content Video Pipeline. The product is being built in stages: Content Collector, Content Builder, and Content Publisher.

The current focus is the **Profile Feed Collector MVP** — proving one operator-usable loop end to end before resuming Content Builder or Content Publisher expansion. Sprint 073 narrows docs, navigation, and command surfaces to that loop. Sprint 072's Content Builder Transform Type catalog is parked, not deleted.

## Current Modules

- Collector Profile Manager: profile lifecycle, provisioning, session ingestion, checkout eligibility, and trusted runtime profile configuration.
- Content Manager: content categories, source groups, normalized content ingestion, deduplication, safe reads, review lifecycle status, and discovered-source review/promotion.
- Collector Runtime: profile checkout/release orchestration, Facebook collection, browser provider adapters, extraction, submission, and worker execution.
- Content Builder: parked. Reusable Transform Type catalog entries may exist from Sprint 072 but are not the current focus.
- Web UI: local management surface for the Profile Feed Collector MVP — profiles, profile feed runs, content items, source groups/categories, and discovered sources.
- Operator tools: profile provisioning, manual profile home-feed collection, worker execution, and browser provider probing.

## Current Status

- Profile provisioning works through the Web UI plus operator browser CLI.
- Manual profile home-feed collection works for `READY` profiles through bounded browser execution and operator command.
- The manual collector command for source-group Facebook collection still works but is not the MVP operator loop.
- A collector worker exists for claiming and executing queued collection runs.
- An account exercise worker exists for claiming and executing queued Account Exercise runs (Ambient and Category Browse).
- A profile-source access check worker exists for claiming and executing queued browser-backed access checks.
- A collection scheduler exists for polling `DispatchNextDueCollectionScheduleUseCase` and dispatching due schedules.
- A profile home-feed scheduler exists for polling `DispatchNextDueProfileHomeFeedCollectionScheduleUseCase` and dispatching due profile home-feed schedules.
- A profile home-feed worker exists for claiming and executing queued profile home-feed collection runs.
- The collector worker is available as an opt-in Docker Compose service for dev and preview stacks.
- The account exercise worker is available as a separate opt-in Docker Compose service for dev and preview stacks.
- The collection scheduler is available as a separate opt-in Docker Compose service for dev and preview stacks.
- The profile home-feed scheduler and worker are available as separate opt-in Docker Compose services for dev and preview stacks.
- A Collector Runtime browser provider boundary exists.
- The parked Transform Type catalog model and its Web UI surface remain implemented but are hidden from primary navigation until Content Builder resumes.
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

Start containerized workers only when queued jobs should be consumed automatically:

```bash
pnpm stack:dev:workers:start
pnpm stack:dev:workers:logs
```

## Commands

Daily-use commands only. Advanced/operator commands live in [`docs/RUNTIME.md`](docs/RUNTIME.md); legacy operator aliases (e.g. `pnpm dev`, `pnpm profile:provision`, `pnpm collector:facebook:run`) were removed in Sprint 073 and must be replaced with their canonical names listed there.

### App Runtime

- `pnpm app:dev`: run the API app in watch mode.
- `pnpm app:start`: run the API app once.

### Web UI

- `pnpm web:dev`: run the Vite Web UI.
- `pnpm web:build`: build the Web UI.
- `pnpm web:typecheck`: typecheck the Web UI.

### Database

- `pnpm db:generate`: generate Drizzle migrations.
- `pnpm db:migrate`: run Drizzle migrations.

### Tests

- `pnpm typecheck`: typecheck the backend/root TypeScript project.
- `pnpm test`: run default Vitest tests.
- `pnpm test:db`: run opt-in database integration tests.
- `pnpm test:http:db`: run opt-in DB-backed HTTP integration tests.

### Profile Feed Collector MVP

- `pnpm operator:profile:provision -- --token <token> --base-url http://localhost:8081 --browser-provider playwright`
- `pnpm operator:profile-home-feed-worker -- --base-url http://localhost:8081 --once`
- `pnpm operator:browser:probe -- --browser-provider playwright`

Operator browser-backed commands that accept `--browser-provider` use `BROWSER_PROVIDER`, then `playwright` when the option is omitted. Supported values are `playwright` and experimental `cloakbrowser`.

CloakBrowser provisioning uses the Node package `cloakbrowser` from `CloakHQ/CloakBrowser` plus `playwright-core`; preinstall the binary with `pnpm exec cloakbrowser install` or let the first probe/launch download it.

### Docker Stacks

- `pnpm stack:dev:start`, `pnpm stack:dev:stop`, `pnpm stack:dev:reset`
- `pnpm stack:dev:worker:start`, `pnpm stack:dev:worker:once`, `pnpm stack:dev:worker:logs`
- `pnpm stack:dev:exercise-worker:start`, `pnpm stack:dev:exercise-worker:once`, `pnpm stack:dev:exercise-worker:logs`
- `pnpm stack:dev:scheduler:start`, `pnpm stack:dev:scheduler:once`, `pnpm stack:dev:scheduler:logs`
- `pnpm stack:dev:profile-home-feed-scheduler:start`, `pnpm stack:dev:profile-home-feed-scheduler:once`, `pnpm stack:dev:profile-home-feed-scheduler:logs`
- `pnpm stack:dev:profile-home-feed-worker:start`, `pnpm stack:dev:profile-home-feed-worker:once`, `pnpm stack:dev:profile-home-feed-worker:logs`
- `pnpm stack:dev:workers:start`, `pnpm stack:dev:workers:logs`
- `pnpm stack:preview:start`, `pnpm stack:preview:stop`, `pnpm stack:preview:reset`
- `pnpm stack:preview:worker:start`, `pnpm stack:preview:worker:once`, `pnpm stack:preview:worker:logs`
- `pnpm stack:preview:exercise-worker:start`, `pnpm stack:preview:exercise-worker:once`, `pnpm stack:preview:exercise-worker:logs`
- `pnpm stack:preview:scheduler:start`, `pnpm stack:preview:scheduler:once`, `pnpm stack:preview:scheduler:logs`
- `pnpm stack:preview:profile-home-feed-scheduler:start`, `pnpm stack:preview:profile-home-feed-scheduler:once`, `pnpm stack:preview:profile-home-feed-scheduler:logs`
- `pnpm stack:preview:profile-home-feed-worker:start`, `pnpm stack:preview:profile-home-feed-worker:once`, `pnpm stack:preview:profile-home-feed-worker:logs`
- `pnpm stack:preview:workers:start`, `pnpm stack:preview:workers:logs`

The `collector-worker`, `account-exercise-worker`, `collection-scheduler`, `profile-home-feed-scheduler`, and `profile-home-feed-worker` Compose services are behind the `worker` profile and expose no ports. Inside Docker, worker services talk to the API at `http://api:3000`; host commands still use `http://localhost:8081` for preview gateway access or `http://localhost:3000` for direct API access. The `collection-scheduler` and `profile-home-feed-scheduler` services do not open a browser and use the lightweight `scheduler-runtime` image that installs no Playwright runtime or Xvfb. Browser-backed workers use `worker-runtime`.

## Deeper Docs

- [Project Snapshot](docs/PROJECT_SNAPSHOT.md)
- [Project History](docs/PROJECT_HISTORY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Module Boundaries](docs/MODULE_BOUNDARIES.md)
- [Runtime](docs/RUNTIME.md)
- [Active Sprint](docs/SPRINTS/active.md)

## Sprint Workflow

The Architect defines the sprint, the Builder implements only the active sprint, the result is reviewed, and project state/docs are updated before moving on.
