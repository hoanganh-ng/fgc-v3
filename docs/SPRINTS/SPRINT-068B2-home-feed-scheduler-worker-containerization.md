# Sprint 068B2: Home-Feed Scheduler and Worker Containerization

## Goal

Containerize the existing profile home-feed scheduler and profile
home-feed worker as two separate opt-in Docker Compose services in the
development and preview stacks.

This is a runtime wiring sprint only. It does not change domain
behavior, persistence behavior, scheduled dispatch rules, worker
execution logic, browser capture behavior, HTTP routes, Web UI,
Content Manager behavior, Profile Manager checkout rules, or Content
Builder / Publisher behavior.

## Capability Summary

- Adds a `profile-home-feed-scheduler` service behind the existing
  Compose `worker` profile in both dev and preview stacks.
- Adds a `profile-home-feed-worker` service behind the same `worker`
  profile in both stacks.
- Reuses the lightweight `scheduler-runtime` image for the scheduler.
  The scheduler service does not set browser provider, display, Xvfb,
  or browser runtime environment variables.
- Reuses the browser-capable `worker-runtime` image for the worker.
  The worker entrypoint waits for API readiness, starts Xvfb, exports
  `DISPLAY`, starts the existing home-feed worker CLI, forwards
  `SIGINT` / `SIGTERM`, and cleans up Xvfb.
- Adds stack start, one-shot, and log scripts for both services in dev
  and preview.
- Extends aggregate worker-profile scripts to include:
  `collector-worker`, `account-exercise-worker`,
  `collection-scheduler`, `profile-home-feed-scheduler`, and
  `profile-home-feed-worker`.

## Runtime Shape

```text
profile-home-feed-scheduler service
  -> scheduler-runtime
  -> scripts/run-profile-home-feed-scheduler-container.sh
  -> src/operator-tools/profile-home-feed-scheduler/cli.ts

profile-home-feed-worker service
  -> worker-runtime
  -> scripts/run-profile-home-feed-worker-container.sh
  -> src/operator-tools/profile-home-feed-worker/cli.ts
```

The scheduler entrypoint resolves
`PROFILE_HOME_FEED_SCHEDULER_MODE_ARGS` with a default of
`--poll-interval-ms 5000`, waits until the configured readiness URL
returns an HTTP status below 500, and then `exec`s the scheduler CLI.
The default readiness URL is
`http://api:3000/collector/profile-home-feed-collection-schedules?limit=1`.

The worker entrypoint resolves `PROFILE_HOME_FEED_WORKER_BASE_URL`
with a default of `http://api:3000`, resolves
`PROFILE_HOME_FEED_WORKER_MODE_ARGS` with a default of
`--poll-interval-ms 5000`, waits for the profile home-feed collection
run list endpoint to answer below 500, starts Xvfb, exports
`DISPLAY`, and runs:

```bash
node --import tsx src/operator-tools/profile-home-feed-worker/cli.ts -- --base-url "${api_base_url}" ${mode_args}
```

## Compose Services

Both services:

- Are behind Compose profile `worker`.
- Use `init: true`.
- Expose no ports.
- Set `DATABASE_URL`.
- Depend on healthy PostgreSQL and a started API service.

`profile-home-feed-scheduler` additionally sets
`PROFILE_HOME_FEED_SCHEDULER_MODE_ARGS` and
`PROFILE_HOME_FEED_SCHEDULER_READINESS_URL`.

`profile-home-feed-worker` additionally sets
`PROFILE_HOME_FEED_WORKER_BASE_URL`,
`PROFILE_HOME_FEED_WORKER_MODE_ARGS`, display/Xvfb environment, and
`BROWSER_PROVIDER`. The dev stack follows the existing dev
browser-backed worker default (`cloakbrowser`), and the preview stack
follows the existing preview default (`playwright`).

## Logging Policy

The container entrypoints print only static readiness or display-server
messages. They do not print `DATABASE_URL`, readiness URLs, API base
URLs, tokens, cookies, localStorage, proxy values, trusted runtime
configuration, raw payloads, screenshots, raw HTML, or browser
fingerprint secrets.

## File Manifest

### Create

- `scripts/run-profile-home-feed-scheduler-container.sh`
- `scripts/run-profile-home-feed-worker-container.sh`
- `docs/SPRINTS/SPRINT-068B2-home-feed-scheduler-worker-containerization.md`

### Modify

- `docker-compose.dev.yml`
- `docker-compose.preview.yml`
- `package.json`
- `docs/SPRINTS/active.md`
- `docs/RUNTIME.md`
- `docs/modules/collector-runtime.md`
- `README.md`

## Verification

Run or report why unavailable:

```bash
sh -n scripts/run-profile-home-feed-scheduler-container.sh
sh -n scripts/run-profile-home-feed-worker-container.sh

docker compose -f docker-compose.dev.yml --profile worker config
docker compose -f docker-compose.preview.yml --profile worker config

docker build --target scheduler-runtime -t fgc-v3-profile-home-feed-scheduler:test .
docker build --target worker-runtime -t fgc-v3-profile-home-feed-worker:test .

docker run --rm \
  --entrypoint node \
  fgc-v3-profile-home-feed-scheduler:test \
  --import tsx \
  src/operator-tools/profile-home-feed-scheduler/cli.ts \
  -- --help

docker run --rm \
  --entrypoint node \
  fgc-v3-profile-home-feed-worker:test \
  --import tsx \
  src/operator-tools/profile-home-feed-worker/cli.ts \
  -- --help

pnpm typecheck
pnpm test src/operator-tools/profile-home-feed-scheduler src/operator-tools/profile-home-feed-worker
```

When Docker resources permit:

```bash
pnpm stack:dev:start
pnpm stack:dev:profile-home-feed-scheduler:once
pnpm stack:dev:profile-home-feed-worker:once
pnpm stack:dev:profile-home-feed-scheduler:start
pnpm stack:dev:profile-home-feed-worker:start
pnpm stack:dev:profile-home-feed-scheduler:logs
pnpm stack:dev:profile-home-feed-worker:logs
docker compose -f docker-compose.dev.yml stop profile-home-feed-scheduler profile-home-feed-worker
```

## Sprint Status

Sprint 068B1 is accepted per Product Owner decision. Sprint 068B2 is
active and limited to containerizing the existing profile home-feed
scheduler and worker as separate opt-in stack services. Do not mark
Sprint 068B2 complete or advance beyond it from this sprint.
