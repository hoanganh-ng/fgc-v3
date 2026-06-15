# Sprint 047A: Containerized Account Exercise Worker Runtime

## Goal

Add opt-in Docker Compose support for the existing queued Ambient Account
Exercise worker so it can run beside the already-containerized collection
worker in development and preview stacks.

Sprint 047 completed the separate PostgreSQL-backed account exercise worker
process. Sprint 047A only adds the container runtime wrapper, Compose services,
root scripts, and runtime documentation needed to operate that worker from
Docker Compose.

## Scope

- Add a dedicated Xvfb-aware container entrypoint for the account exercise
  worker.
- Wait for the account-exercise HTTP API endpoint before launching the worker.
- Start Xvfb, export `DISPLAY`, forward `SIGINT` and `SIGTERM`, stop Xvfb, and
  preserve the worker exit code.
- Support polling mode and one-shot mode through environment-provided mode
  arguments.
- Add an `account-exercise-worker` service to development and preview Compose
  stacks.
- Keep the service behind the existing Compose `worker` profile.
- Use the existing `worker-runtime` image target.
- Use internal Compose networking: API at `http://api:3000`, PostgreSQL at
  `postgres:5432`.
- Keep `BROWSER_PROVIDER=playwright` as the default container provider.
- Add root scripts for starting, one-shot running, and logging the
  account-exercise worker.
- Add root scripts for intentionally starting/logging both worker services.
- Keep normal `stack:dev:start` and `stack:preview:start` worker-free.
- Preserve all existing collection-worker commands and behavior.
- Update the root README, runtime docs, project state, and active sprint gate.

## Out Of Scope

- Collection worker behavior changes.
- Combining workers into one process or one container.
- Generic schedulers, retries, concurrency changes, Redis, or BullMQ.
- New exercise types.
- Web UI changes.
- Database migrations.
- Account-stage automation.
- Browser provider behavior changes.
- Commits or pushes.

## Implementation Notes

- Compose service name: `account-exercise-worker`.
- Compose profile: `worker`.
- Internal worker API base URL: `http://api:3000`.
- Internal worker database URL host: `postgres:5432`.
- Default browser provider: `BROWSER_PROVIDER=playwright`.
- Runtime wrapper: `scripts/run-account-exercise-worker-container.sh`.
- Environment variables:
  - `ACCOUNT_EXERCISE_WORKER_BASE_URL`
  - `ACCOUNT_EXERCISE_WORKER_MODE_ARGS`
  - `ACCOUNT_EXERCISE_WORKER_DISPLAY`
  - `ACCOUNT_EXERCISE_WORKER_XVFB_SCREEN`
  - `DATABASE_URL`
  - `BROWSER_PROVIDER`
- Root development scripts:
  - `stack:dev:exercise-worker:start`
  - `stack:dev:exercise-worker:once`
  - `stack:dev:exercise-worker:logs`
  - `stack:dev:workers:start`
  - `stack:dev:workers:logs`
- Root preview scripts:
  - `stack:preview:exercise-worker:start`
  - `stack:preview:exercise-worker:once`
  - `stack:preview:exercise-worker:logs`
  - `stack:preview:workers:start`
  - `stack:preview:workers:logs`

## Verification

Run:

- `pnpm typecheck`
- `pnpm test`
- `docker compose -f docker-compose.dev.yml config`
- `docker compose -f docker-compose.preview.yml config`
- `pnpm stack:dev:worker:start`
- `pnpm stack:dev:exercise-worker:start`
- `pnpm stack:dev:workers:start`
- `pnpm stack:dev:exercise-worker:once`
- `git diff --check`

Manual checks:

1. Confirm the collection worker still starts.
2. Confirm the account-exercise worker starts and reports an idle state safely.
3. Confirm both workers appear in Compose `ps`.
4. Confirm Compose shutdown stops both workers cleanly.
5. If a suitable profile exists, create one queued Ambient Exercise Run through
   the Web UI, confirm the containerized worker consumes it, and confirm the
   profile lease is released.
