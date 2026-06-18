# Sprint 062: Feed Discovery Delivery Plan And Docker E2E Foundation

## Goal

Before feed discovery implementation begins, Sprint 062 ships the
authoritative delivery roadmap that breaks feed discovery into small
sprints, defines the cross-cutting testing strategy, lands an isolated
production-like Docker E2E harness, and proves the current stack works
end-to-end through Nginx, the API, migrations, and PostgreSQL using only
synthetic fixtures.

The Sprint 061 schedule management surface is already implemented and
accepted. Sprint 062 publishes a plan; it does not begin any feed
discovery, publisher, or feed collection implementation.

## Capability Summary

- Documentation:
  - Sprint 062 is recorded as the active sprint; Sprint 061 is recorded
    as accepted.
  - A new authoritative testing strategy (`docs/TESTING_STRATEGY.md`)
    describes the five layers: unit, database integration, HTTP
    integration, Docker E2E, and manual live-Facebook validation. The
    E2E layer is owned by Sprint 062; the manual live-Facebook layer is
    opt-in and never automated.
  - The project snapshot (`docs/PROJECT_SNAPSHOT.md`) records the
    active sprint, the immediate next work, the new E2E capability, and
    the testing strategy summary.
  - The roadmap (`docs/ROADMAP.md`) replaces the outdated
    "Future: Collector Runtime / Builder / Publisher" placeholders with
    the Sprint 063A–068 sequence: `SourcePublisher` domain and
    application, `SourcePublisher` persistence and atomic observation,
    `SourcePublisher` HTTP contract and E2E, content collection
    provenance model, provenance persistence and compatibility,
    Facebook home-feed extractor fixtures, profile-bound home-feed run
    model, manual home-feed execution, `SourcePublisher` discovery
    review API and UI, approved group promotion, and home-feed
    scheduling. The long-term `Future: Content Builder` and
    `Future: Content Publisher` pipeline stages are retained.
  - Runtime documentation (`docs/RUNTIME.md`) documents the Docker E2E
    stack, the `pnpm test:e2e:docker` and `pnpm test:e2e:container`
    commands, troubleshooting, and the rules the harness enforces (no
    host port collisions, isolated volume, fresh database per run,
    deterministic readiness, sanitized logs, cleanup invariants).
- Docker E2E harness:
  - A new `docker-compose.e2e.yml` with exactly four services: `postgres`,
    `api`, `web-gateway`, and `e2e-runner`. No workers, schedulers, or
    exercise workers. No host port bindings. The runner addresses the
    gateway through Compose service DNS (`http://web-gateway`).
  - The `api` service runs `pnpm db:migrate && pnpm start` and exposes a
    Compose `healthcheck` that polls `http://localhost:3000/health`
    using the existing health route from `registerHealthRoutes`.
  - The `web-gateway` service reuses the production `nginx:1.27-alpine`
    image built from the existing `web-gateway` Dockerfile stage. The
    `e2e-runner` blocks on the gateway returning the React app HTML
    before running tests.
  - A new `e2e-runtime` Dockerfile stage from
    `mcr.microsoft.com/playwright:v1.60.0-noble` (the version already
    pinned in `pnpm-lock.yaml` and the `worker-runtime` stage). The
    stage installs the workspace with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
    (Chromium binaries come from the Playwright base image) and ships a
    `run-e2e-runner-container.sh` entrypoint that polls the gateway
    readiness URL until it returns 200, then `exec`s
    `playwright test`.
  - The host driver `scripts/test-e2e-docker.sh` performs
    teardown-build-up-execute-report-cleanup with a `trap` that always
    runs `docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml down -v
    --remove-orphans` on `EXIT INT TERM`. It prints sanitized
    `docker compose logs --no-color` for `api`, `web-gateway`, and
    `e2e-runner` on non-zero exit, and never prints `DATABASE_URL` or
    any environment values.
  - The harness reuses the existing `web-gateway` Nginx config; it adds
    no host ports. Dev and preview volumes are never reused or deleted.
- Baseline E2E flow (`tests/e2e/stack-baseline.spec.ts`):
  1. Open `http://web-gateway/` and assert the React app shell renders
     (title `Content Pipeline Dashboard`).
  2. Navigate directly to `http://web-gateway/source-groups` and assert
     the SPA fallback returns the React app.
  3. POST `/collector/content-categories` through Nginx with synthetic
     category data.
  4. POST `/collector/source-groups` through Nginx with synthetic source
     group data referencing the new category.
  5. GET `/collector/source-groups/:sourceGroupId` through Nginx and
     assert the round-trip DTO matches.
  6. Open `http://web-gateway/source-groups` in Chromium and assert the
     new source group name is visible.
  7. Reload the page and assert the new source group name remains
     visible.
  All API calls use `http://web-gateway` as the base URL; the spec never
  calls the API service directly.
- Commands:
  - `pnpm test:e2e:docker` — the host driver. Cleans any prior E2E
    resources, builds the stack, runs the suite, returns the runner exit
    code, prints sanitized logs on failure, cleans up on success, failure,
    and interruption.
  - `pnpm test:e2e:container` — the in-container command, used by the
    host driver and available for direct invocation when the stack is
    already up. It runs `playwright test --config=tests/e2e/playwright.config.ts`.

## Architecture

```
Host command: pnpm test:e2e:docker
  └─ scripts/test-e2e-docker.sh
        ├─ cleanup (down -v --remove-orphans, project fgc-v3-e2e)
        ├─ docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml build
        ├─ docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml up -d
        │     ├─ postgres           isolated volume fgc_e2e_postgres_data
        │     │                     healthcheck pg_isready
        │     ├─ api                pnpm db:migrate && pnpm start
        │     │                     healthcheck node fetch /health
        │     ├─ web-gateway        production nginx image
        │     │                     no host port; depends_on api
        │     └─ e2e-runner         mcr.microsoft.com/playwright:v1.60.0-noble
        │                           waits gateway ready; exec playwright test
        ├─ wait_for_stack_ready (deterministic; no sleeps as readiness)
        ├─ capture runner exit code
        ├─ on non-zero: print sanitized logs for api / web-gateway / e2e-runner
        └─ trap EXIT INT TERM ⇒ docker compose ... down -v --remove-orphans
```

Readiness is deterministic:

- `postgres` is gated by `pg_isready` (mirrors dev and preview).
- `api` is gated by a Compose healthcheck that polls
  `http://localhost:3000/health`; the runner does not poll the API.
- `web-gateway` is gated by the runner polling
  `http://web-gateway/` until it returns the React app HTML. The runner
  uses `expect.poll` and never `waitForTimeout` for navigation correctness.

## Invariants

- The E2E harness never publishes a host port. `web-gateway` and
  `e2e-runner` reach services through Compose DNS only.
- The E2E harness never reuses `fgc_dev_postgres_data` or
  `fgc_preview_postgres_data`; the E2E volume is `fgc_e2e_postgres_data`
  under the E2E project.
- The E2E harness never starts the collection worker, the account
  exercise worker, or the collection scheduler.
- The E2E spec uses only synthetic fixtures. It does not connect to
  Facebook, fetch sessions, set cookies, set localStorage, store
  tokens, store proxy credentials, or read any environment values.
- The E2E harness never logs `DATABASE_URL`, base URLs, environment
  values, raw payloads, or any secret. Failure logs are limited to
  container stdout for `api`, `web-gateway`, and `e2e-runner`.
- Sprint 062 publishes the delivery plan; it does not start Sprint 063.
  Sprint 063A–068 are documented placeholders.

## Decisions Log

- **Reuse existing production surfaces**: the E2E harness reuses the
  production `web-gateway` Nginx image, the production `apps/web/nginx.conf`,
  the production API Dockerfile stage, the existing `/health` route, and
  the existing Content Manager source-group and content-category HTTP
  routes. No new HTTP route or schema is added by Sprint 062.
- **No host port collisions**: the E2E stack publishes no host ports.
  The E2E runner reaches the gateway through Compose service DNS so the
  harness can run alongside the dev and preview stacks on the same host.
- **Deterministic readiness**: API readiness comes from the existing
  health route and a Compose healthcheck. Gateway readiness is a short
  HTTP loop in the runner entrypoint; navigation correctness inside the
  spec uses `expect.poll`, never `waitForTimeout`.
- **Isolation by project name**: the host driver uses
  `-p fgc-v3-e2e` so its containers, networks, and volumes are scoped to
  the E2E run and cannot collide with `fgc-v3-dev` or `fgc-v3-preview`.
- **Reusable Playwright project**: `tests/e2e/playwright.config.ts` uses
  a dedicated `webServer` block (none, since the runner waits the gateway
  itself) and configures `baseURL: 'http://web-gateway'`. The vitest
  workspace is untouched, so `pnpm test` does not run Playwright tests.
- **Sanitized failure logs**: the host driver prints
  `docker compose ... logs --no-color` only for the three containers
  needed to debug, and never prints the API or gateway env files.

## File Manifest

### Create

- `docs/SPRINTS/SPRINT-062-feed-discovery-delivery-plan-and-docker-e2e-foundation.md`
- `docs/TESTING_STRATEGY.md`
- `docker-compose.e2e.yml`
- `scripts/run-e2e-runner-container.sh`
- `scripts/test-e2e-docker.sh`
- `tests/e2e/playwright.config.ts`
- `tests/e2e/stack-baseline.spec.ts`
- `tests/e2e/fixtures/synthetic-payloads.ts`
- `tests/tsconfig.json` (isolated typecheck config for the E2E sources)

### Modify

- `docs/SPRINTS/active.md` — accept Sprint 061 and mark Sprint 062 active.
- `docs/PROJECT_SNAPSHOT.md` — update current sprint, immediate next
  work, currently available capabilities, and verification commands.
- `docs/ROADMAP.md` — replace the "Future: Collector Runtime / Builder /
  Publisher" placeholders with the Sprint 063A–068 sequence and add a
  note pointing to `docs/TESTING_STRATEGY.md`.
- `docs/RUNTIME.md` — add a `## Docker End-to-End Testing` section with
  the commands, the architecture summary, the readiness contract, the
  cleanup contract, and troubleshooting.
- `Dockerfile` — add the `e2e-runtime` stage and a comment that locks the
  Playwright base image to the existing `v1.60.0-noble` tag.
- `package.json` — add `test:e2e:docker` and `test:e2e:container`
  scripts and add `@playwright/test@1.60.0` (exact pin) to
  `devDependencies` so the test runner matches the existing
  `playwright@^1.60.0` runtime and the Playwright base image tag in the
  `e2e-runtime` Dockerfile stage.

### Do not touch

- `docker-compose.dev.yml` and `docker-compose.preview.yml` volumes or
  services.
- `src/interfaces/http/**`, `apps/web/src/**`, or any Sprint 061
  schedule code path.
- `vitest.workspace.ts`, `apps/web/vitest.config.ts`, or any
  Vitest configuration.
- Drizzle migrations, drizzle config, or any database schema.

## Test Matrix

| Requirement                                                                 | Test file                                                                                       |
|-----------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------|
| Production React app loads through Nginx                                   | `tests/e2e/stack-baseline.spec.ts`                                                              |
| Direct `/source-groups` navigation returns the SPA through Nginx           | `tests/e2e/stack-baseline.spec.ts`                                                              |
| Synthetic category created through Nginx                                   | `tests/e2e/stack-baseline.spec.ts`                                                              |
| Synthetic source group created through Nginx                                | `tests/e2e/stack-baseline.spec.ts`                                                              |
| Source group read back through Nginx matches the synthetic DTO              | `tests/e2e/stack-baseline.spec.ts`                                                              |
| Chromium opens `/source-groups` and confirms the new group is visible       | `tests/e2e/stack-baseline.spec.ts`                                                              |
| Reload of `/source-groups` still shows the new group                        | `tests/e2e/stack-baseline.spec.ts`                                                              |
| All API traffic goes through `web-gateway` (never direct to `api`)         | `tests/e2e/stack-baseline.spec.ts` (asserts baseURL + uses web-gateway only)                    |
| Harness never reuses dev or preview volumes                                | `scripts/test-e2e-docker.sh` (uses an isolated project + isolated named volume)                 |
| Harness always cleans up on EXIT INT TERM                                   | `scripts/test-e2e-docker.sh` (trap-driven `down -v --remove-orphans`)                           |
| Sanitized logs on failure (no env values)                                   | `scripts/test-e2e-docker.sh` (logs are `docker compose logs --no-color`; no env dumps)          |

## Out Of Scope

- Publisher or feed discovery implementation.
- Sprint 063A–068 implementation; the roadmap placeholders are
  documentation only.
- Modifying Content Manager HTTP routes, schemas, the source-groups
  page, the API server, or Drizzle migrations.
- Modifying dev or preview Compose volumes or services.
- Running the E2E harness against an existing dev or preview database.
- Real Facebook connection, sessions, cookies, localStorage, tokens,
  proxies, account IDs, or payloads.
- Adding new dependencies beyond `@playwright/test` (the existing
  `playwright@^1.60.0` package and base image already supply the
  Chromium runtime).
- Commits, pushes, marking the sprint complete, or moving to the next
  sprint.

## Verification

```bash
pnpm typecheck
pnpm test
pnpm web:typecheck
pnpm web:build
pnpm test:e2e:docker
pnpm test:e2e:docker
docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.preview.yml config
```

Temporary failure probe:

```bash
# Edit tests/e2e/stack-baseline.spec.ts and add `expect(1).toBe(2);`
# Run pnpm test:e2e:docker; observe nonzero exit + sanitized logs + cleanup.
# Revert the assertion.
```

Manual Docker verification when local runtime resources permit:

```bash
docker volume ls               # fgc_dev_postgres_data, fgc_preview_postgres_data unchanged
docker ps -a                   # no leftover fgc-v3-e2e containers after the run
```

## Sprint Status

Sprint 061 is accepted and recorded as the operator collection schedule
management surface foundation for Sprint 062. Sprint 062 is implemented
as the feed discovery delivery plan, the cross-cutting testing strategy,
the isolated Docker E2E harness, and a deterministic baseline E2E flow
that proves the production-like stack works through Nginx → API →
migrations → PostgreSQL using only synthetic fixtures. It does not
begin feed discovery implementation and does not advance beyond its
declared scope.