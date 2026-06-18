# Sprint 060: Collection Scheduler Containerization and Stack Integration

## Goal

Deploy the Sprint 059 collection scheduler as an opt-in Docker Compose
service in the development and preview stacks. Use a lightweight Node
runtime, not the Playwright worker image. Do not modify scheduling or
dispatch business behavior.

Sprint 059 delivered a dedicated CLI under
`src/operator-tools/collection-scheduler/` that drives the existing
`DispatchNextDueCollectionScheduleUseCase` on an interval. Sprint 060
containerizes that CLI so operators can run the scheduler in polling
mode inside the existing dev and preview Compose stacks alongside the
other opt-in worker-profile services.

The scheduler never opens a browser. It only talks to PostgreSQL via the
existing Collector Runtime composition root. The container image
therefore uses `app-deps` (a slim Node runtime with workspace
dependencies installed) instead of the Playwright `worker-runtime` base
image, and the container entrypoint does not start Xvfb or manage any
browser process. scheduler-runtime inherits workspace Node packages
installed by app-deps, but it does not provision browser executables,
Playwright browser downloads, Xvfb, browser-specific system packages,
or a runnable CloakBrowser browser/system runtime, and the scheduler
does not launch a browser.

## Capability Summary

- A new `scheduler-runtime` Docker image target built from `app-deps`
  with the full `src/` tree, `tsconfig.json`, `drizzle.config.ts`,
  `drizzle/`, and the entrypoint script. No browsers and no Xvfb are
  installed or configured.
- A new `scripts/run-collection-scheduler-container.sh` entrypoint
  script that waits for the API to answer before launching the
  scheduler CLI, then `exec`s the CLI so container signals reach Node
  directly.
- A new opt-in `collection-scheduler` Compose service in both
  `docker-compose.dev.yml` and `docker-compose.preview.yml`, behind the
  existing `worker` profile, depending on healthy PostgreSQL and the
  started API service.
- New dev and preview `pnpm` commands for starting, one-shot running,
  and tailing the scheduler service. The existing aggregate
  `workers:start` and `workers:logs` commands include the new
  scheduler service.
- Sprint 059 remains the implementation authority for scheduler
  business behavior. No scheduler, dispatch, or worker logic is
  modified.

## Architecture

```
scheduler-runtime image (app-deps + scheduler files)
  └── CMD ["sh", "scripts/run-collection-scheduler-container.sh"]

run-collection-scheduler-container.sh
  ├── resolve COLLECTION_SCHEDULER_MODE_ARGS / READINESS_URL
  ├── until API readiness probe returns status < 500
  └── exec node --import tsx \
        src/operator-tools/collection-scheduler/cli.ts \
        -- ${mode_args}

collection-scheduler service (profile: worker)
  ├── depends_on: postgres (healthy), api (service_started)
  ├── env: DATABASE_URL, COLLECTION_SCHEDULER_MODE_ARGS,
  │        COLLECTION_SCHEDULER_READINESS_URL
  └── image: scheduler-runtime
```

`cli.ts` is the executable bootstrap. `cli-command.ts` owns argument
parsing, signal handler installation, runtime composition, dependency
binding, and the runner invocation. The container entrypoint only
prepends a readiness wait and a Compose-controlled mode-arg variable;
it does not intercept, transform, or wrap the CLI.

## Image Design

The new `scheduler-runtime` target is built from the existing
`app-deps` stage. `app-deps` already installs all workspace
dependencies and the Node toolchain via Corepack, so the lighter base
is sufficient. scheduler-runtime inherits workspace Node packages
installed by app-deps, but it does not provision browser executables,
Playwright browser downloads, Xvfb, browser-specific system packages,
or a runnable CloakBrowser browser/system runtime, and the scheduler
does not launch a browser.

The scheduler only consumes the full `src/` tree at runtime: the
existing `createCollectorRuntimeFromEnv` composition root imports the
`src/infrastructure/database` barrel, which itself re-exports
repository modules and schemas from sibling project modules. Slicing
the copy set narrower than `src/` ships an image that builds cleanly
but fails the first time the scheduler CLI imports its dependencies.
The image therefore copies the full `src/` tree (matching the
`api-runtime` source set), plus `tsconfig.json`, `drizzle.config.ts`,
`drizzle/`, and the `scripts/` entrypoint. scheduler-runtime inherits
workspace Node packages installed by app-deps, but it does not
provision browser executables, Playwright browser downloads, Xvfb,
browser-specific system packages, or a runnable CloakBrowser
browser/system runtime, and the scheduler does not launch a browser.
The image's default `CMD` is the new entrypoint script.

`api-runtime` is unchanged. The Playwright-based `worker-runtime`
remains the base for the existing collector and account-exercise
worker images. The scheduler never imports the worker entrypoints,
worker CLI, or any browser code.

## Container Entrypoint

`scripts/run-collection-scheduler-container.sh` is the entrypoint of
the `collection-scheduler` Compose service. The script:

- Uses `#!/bin/sh` and `set -eu` (matches the existing
  `run-collector-worker-container.sh` discipline).
- Defaults `COLLECTION_SCHEDULER_MODE_ARGS` to `"--poll-interval-ms 5000"`
  so a default `up` runs in continuous polling mode. Operators
  override it for a one-shot run, e.g. `--once`.
- Defaults `COLLECTION_SCHEDULER_READINESS_URL` to
  `http://api:3000/collector/collection-runs?limit=1` so the scheduler
  waits for the API to be live before starting. A different host or
  port can be supplied through the same environment variable.
- Polls the readiness URL with `node -e "fetch(...).then(...).catch(...)"`
  exactly like the existing worker entrypoints. The loop exits as soon
  as the API returns an HTTP status below 500. Status 4xx still counts
  as "API is up" — the scheduler does not care whether any collection
  runs exist yet.
- Never prints `DATABASE_URL`, `COLLECTOR_*_BASE_URL`, or any other
  environment variable. Readiness output is a single static
  `Waiting for scheduler API endpoint...` line; on success the script
  prints no further status before exec.
- Uses `exec node --import tsx src/operator-tools/collection-scheduler/cli.ts -- ${mode_args}`
  as its final operation. The shell is replaced by the Node process, so
  there is no shell intermediary between the Compose init process and
  Node. Compose `init: true` makes the init process PID 1 of the
  container; init forwards `SIGINT`/`SIGTERM` (e.g. from
  `docker compose stop collection-scheduler` or
  `docker compose down`) to the Node process, and the scheduler CLI's
  own signal handlers then run. The entrypoint does not need to
  forward signals manually and keeps no PID file.
- Does not start Xvfb, manage a browser process, or write any
  process-ID bookkeeping. There is nothing else to clean up after
  readiness.

## Compose Service

The new `collection-scheduler` service is added to both Compose
files. The service:

- Joins the existing `worker` profile so it is opt-in and not started
  by `stack:dev:start` or `stack:preview:start`.
- Builds from the new `scheduler-runtime` target.
- Sets `init: true` so the Compose init process is PID 1 of the
  container and forwards container signals (such as `SIGINT` and
  `SIGTERM`) to the scheduler CLI process that the entrypoint
  `exec`s.
- Declares no `ports`. The scheduler does not expose an HTTP server
  and does not need to be reached from the host.
- Declares no `BROWSER_PROVIDER`, no `DISPLAY`, no `*_XVFB_*`, and no
  other browser-related environment. It is a scheduler, not a
  browser-backed worker.
- Receives `DATABASE_URL` (pointing at the `postgres` service),
  `COLLECTION_SCHEDULER_MODE_ARGS`, and
  `COLLECTION_SCHEDULER_READINESS_URL` through `environment:`.
- Depends on `postgres` with `condition: service_healthy` and on `api`
  with `condition: service_started`. The scheduler's own readiness
  loop is a second, finer-grained check that the API can answer
  HTTP requests, not a replacement for Compose-level ordering.

The dev and preview services are otherwise identical. Both point at
`http://api:3000` because the scheduler only needs to confirm the API
container is responsive; it does not read or call any API endpoint on
its hot path — it only opens PostgreSQL through the existing
Collector Runtime composition root.

## Package Scripts

The new scripts mirror the existing per-worker script family. The
dev stack adds:

- `stack:dev:scheduler:start` — start the scheduler in polling mode.
- `stack:dev:scheduler:once` — run one scheduler iteration in a
  disposable container (passes `--once` through
  `COLLECTION_SCHEDULER_MODE_ARGS`).
- `stack:dev:scheduler:logs` — follow scheduler logs.

The preview stack adds the matching `stack:preview:scheduler:*`
scripts.

The existing aggregate commands are extended to include the new
service:

- `stack:dev:workers:start` now starts
  `collector-worker account-exercise-worker collection-scheduler`.
- `stack:dev:workers:logs` now follows logs for the same three
  services.
- `stack:preview:workers:start` and
  `stack:preview:workers:logs` mirror the same change.

All existing script names are preserved. The earlier per-worker
`*:start`, `*:once`, and `*:logs` scripts for `collector-worker` and
`account-exercise-worker` are unchanged.

## Readiness And Signal Behavior

The container entrypoint polls the readiness URL until the API
responds with a status below 500. Inside the loop, the script sleeps
one second between attempts and exits the loop as soon as the API
responds. No operator-visible state changes during the wait beyond
the static `Waiting for scheduler API endpoint...` line. After the
loop, the script `exec`s the scheduler CLI. The Compose init process
is PID 1 of the container; with `init: true`, it forwards Compose
`SIGINT`/`SIGTERM` (e.g. from `docker compose stop
collection-scheduler` or `docker compose down`) to the Node process
that the entrypoint `exec`d. The CLI's own `SIGINT`/`SIGTERM` handlers
then trigger the `AbortController`, and the runner stops cleanly
between cycles, after a single cycle if `--once` was passed. No
status file, log file, or process state is left behind because the
entrypoint does not maintain any.

## Logging Policy

The entrypoint prints only:

- `Waiting for scheduler API endpoint...` during the readiness loop.
- The scheduler's own safe info lines (startup, per-dispatch,
  per-cycle completion, shutdown, final summary).

The entrypoint never prints `DATABASE_URL`, base URLs, credentials,
tokens, or any other environment variable. The scheduler's own
logging policy from Sprint 059 is unchanged and is not affected by
containerization.

## File Manifest

### Create

- `scripts/run-collection-scheduler-container.sh`
- `docs/SPRINTS/SPRINT-060-collection-scheduler-containerization.md`

### Modify

- `Dockerfile` — add the `scheduler-runtime` target.
- `docker-compose.dev.yml` — add the `collection-scheduler` service.
- `docker-compose.preview.yml` — add the `collection-scheduler`
  service.
- `package.json` — add the dev and preview scheduler scripts and
  extend the aggregate `workers:start` / `workers:logs` scripts.
- `docs/SPRINTS/active.md` — mark Sprint 059 accepted and Sprint 060
  active.
- `docs/SPRINTS/SPRINT-059-scheduled-collection-dispatch-poller.md` —
  correct the `cli.ts` and `cli-command.ts` references so `cli.ts` is
  the executable bootstrap and `cli-command.ts` owns parsing, signal
  handling, composition, and dependency binding.
- `docs/modules/collector-runtime.md` — note the new
  containerized scheduler service.
- `docs/RUNTIME.md` — document the new scheduler service and
  commands.
- `README.md` — surface the new scheduler commands.

## Decisions Log

- **Lightweight Node image**: `scheduler-runtime` is built from
  `app-deps` instead of `worker-runtime`. The scheduler does not open
  a browser, so Playwright, Chromium, and Xvfb are not installed.
- **Full `src/` tree in the image**: the scheduler's
  `createCollectorRuntimeFromEnv` composition root imports the
  `src/infrastructure/database` barrel, which re-exports repository
  modules and schemas from sibling project modules. Copying only the
  scheduler's own files would produce an image that builds cleanly but
  fails the first time the CLI imports its transitive dependencies.
  The image therefore copies the full `src/` tree (matching the
  `api-runtime` source set) while still using `app-deps` as its base
  so no Playwright runtime is installed.
- **Readiness via HTTP status below 500**: the entrypoint's probe
  considers any non-5xx response "API is up." Status 4xx is the
  normal response from an empty collection-runs list; the scheduler
  does not need to wait for a specific body shape.
- **`exec` the CLI**: the entrypoint `exec`s the Node process so the
  shell is replaced; the Compose init process is PID 1 and forwards
  container signals to Node. The CLI's existing signal handlers are
  the only signal path. No manual forwarding, no PID file, no extra
  process supervision.
- **No browser environment in Compose**: the `collection-scheduler`
  service intentionally omits `BROWSER_PROVIDER`, `DISPLAY`, and the
  Xvfb variables that the worker services declare. The scheduler
  does not need them, and including them would obscure the intent of
  the new service.
- **Aggregate workers commands include the scheduler**: the
  `workers:start` and `workers:logs` commands already aggregate the
  opt-in worker-profile services. Adding the scheduler there matches
  the existing operational pattern and avoids a second aggregate
  command for the same profile.
- **Sprint 059 corrections**: Sprint 059's sprint document originally
  framed `cli.ts` as the parser and runner entry. The implementation
  moved parsing, signal handling, composition, and dependency binding
  to `cli-command.ts` and reduced `cli.ts` to an executable bootstrap
  that delegates. Sprint 060 corrects the Sprint 059 narrative so the
  documentation matches the code.

## Test Matrix

No new automated tests are introduced by Sprint 060. The Sprint 059
scheduler tests under `src/operator-tools/collection-scheduler/`
continue to cover the scheduler's argument parsing, runner, and CLI
lifecycle. They are the canonical proof that the scheduler business
behavior is unchanged; the containerization only adds an image, a
Compose service, and an entrypoint around that CLI.

## Out Of Scope

- Scheduler domain, application, or CLI behavior changes.
- Dispatch SQL, schedule cadence policy, or Drizzle repository
  changes.
- Database schemas or migrations.
- Collector or account-exercise worker changes.
- Browser automation, Xvfb, or Playwright runtime changes.
- HTTP routes or Web UI changes.
- Leader election, retry/backoff, jitter, or shared entrypoint
  refactors.
- Commits, pushes, marking the sprint complete, or moving to the
  next sprint.

## Verification

```bash
sh -n scripts/run-collection-scheduler-container.sh
docker compose -f docker-compose.dev.yml --profile worker config
docker compose -f docker-compose.preview.yml --profile worker config
docker build --target scheduler-runtime -t fgc-v3-collection-scheduler:test .
docker run --rm \
  --entrypoint node \
  fgc-v3-collection-scheduler:test \
  --import tsx \
  src/operator-tools/collection-scheduler/cli.ts \
  -- --help
pnpm typecheck
pnpm test src/operator-tools/collection-scheduler
pnpm collector:scheduler:run -- --help
```

When Docker resources permit:

```bash
pnpm stack:dev:start
pnpm stack:dev:scheduler:once
pnpm stack:dev:scheduler:start
pnpm stack:dev:scheduler:logs
docker compose -f docker-compose.dev.yml stop collection-scheduler
```

## Sprint Status

Sprint 059 is accepted and recorded as the scheduled dispatch poller
foundation for Sprint 060. Sprint 060 is implemented as the
containerized collection scheduler: an opt-in `collection-scheduler`
Compose service behind the existing `worker` profile, built from a
new lightweight `scheduler-runtime` image, and fronted by a small
`sh` entrypoint that waits for API readiness and `exec`s the
scheduler CLI. It does not advance beyond its declared scope.
