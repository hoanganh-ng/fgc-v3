# Operator Tools and Infrastructure

## Purpose and current capability

Operator tools provide command-line and containerized execution paths for provisioning, manual collection, exercise, schedulers, workers, and stack lifecycle. Docker Compose stacks in `docker-compose.dev.yml` and `docker-compose.preview.yml` run the API, database, Web UI gateway, and opt-in worker/scheduler services.

The root manifest exposes 35 scripts including `pnpm stack:service` for typed service control (accepted Sprint 078 baseline).

## Owns

- Profile provisioning CLI and browser probe tools
- Manual Facebook collection and bounded home-feed runner CLIs
- Collection scheduler, collector worker, home-feed scheduler/worker, account exercise worker, profile-source access check worker
- Stack lifecycle commands (`stack:dev:*`, `stack:preview:*`, `stack:service`)
- Docker images: API runtime, worker runtime, scheduler runtime, web gateway

## Does not own

- Domain rules or use-case business logic
- HTTP route registration or DTO mapping
- Persistent source of truth for profile or content data
- Bypass of leasing, cooldown, or readiness gates

## Public ports, contracts, and cross-module communication

- **Preferred pattern**: call the same HTTP APIs as the Web UI
- **Direct composition**: some workers compose Collector Runtime modules at startup (same boundaries as `src/main.ts` wiring)
- **Environment**: `DATABASE_URL`, browser provider settings, service URLs from Compose

## Important source paths and entrypoints

- Tools: `src/operator-tools/` (profile-provisioning, facebook-collector, collection-scheduler, profile-home-feed-worker, stack-service, etc.)
- Docker: `docker/`, `docker-compose.dev.yml`, `docker-compose.preview.yml`
- Scripts: root `package.json` (35 commands)

Key commands:

```bash
pnpm operator:profile:provision
pnpm operator:profile-home-feed:run-next
pnpm operator:collector:worker
pnpm stack:dev:start
pnpm stack:service --help
```

## Critical invariants and sensitive-data rules

- Manual tools must respect the same checkout and readiness rules as automated workers
- Provisioning captures sessions through secure HTTP contracts only
- CLI output must not print proxy credentials, tokens, cookies, or raw payloads
- Sanitize captured fixtures before test or diagnostic reuse

## Verification anchors

```bash
pnpm typecheck
pnpm test src/operator-tools
pnpm test:e2e:docker
```

## Known change hotspots and limitations

- `src/operator-tools/profile-exercise/exercise-runner.ts` (~1,499 lines)
- `src/operator-tools/profile-provisioning/provisioning-browser-provider.ts` (~928 lines)
- `src/operator-tools/facebook-collector/collector-runner.ts` (~530 lines)
- Exercise and provisioning runner splits are deferred ([CODEBASE_CHANGE_MAP.md](../CODEBASE_CHANGE_MAP.md))
