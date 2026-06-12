# Sprint 037B: Containerized Collector Worker Runtime

## Goal

Add an opt-in Docker Compose worker service that runs the existing Collector Worker Process in polling mode so queued collection runs can be consumed from the development and preview stacks.

## Scope

- Add a `collector-worker` service to the Docker Compose development runtime.
- Add a `collector-worker` service to the Docker Compose preview runtime when consistent with the existing stack shape.
- Keep the worker behind a Docker Compose `worker` profile so normal stack startup remains focused on API, Web UI, and PostgreSQL.
- Use internal Compose networking from the worker to the API at `http://api:3000`; do not use host `localhost` or the preview gateway from inside the worker container.
- Keep Playwright as the default browser provider through `BROWSER_PROVIDER=playwright`.
- Ensure the worker container can launch Playwright Chromium in the default provider path.
- Add root `package.json` scripts, using the Sprint 037A.1 canonical naming style, to start and inspect the worker service intentionally.
- Update runtime documentation, the root README, project state, and active sprint documentation.

## Out Of Scope

- Scheduler.
- Run History UI.
- Run Now UI.
- BullMQ, Redis, or any queue technology change.
- Collection-run domain behavior changes.
- Worker execution behavior changes beyond container runtime configuration.
- Worker concurrency, retries, backoff, heartbeat, stuck-run recovery, or multiple replicas.
- Web UI changes.
- CloakBrowser production integration or making CloakBrowser the default.
- Profile checkout, source group, profile health, or content model changes.

## Implementation Notes

- Compose service name: `collector-worker`.
- Compose profile: `worker`.
- Internal worker API base URL: `http://api:3000`.
- Internal worker database URL host: `postgres:5432`.
- Default browser provider: `BROWSER_PROVIDER=playwright`.
- Browser runtime approach: worker image uses the Playwright runtime base image aligned to the locked Playwright package version. Its container entrypoint starts Xvfb and forwards `SIGINT`/`SIGTERM` to the existing worker CLI for the current headed Playwright path.
- Root worker scripts: `stack:dev:worker:start`, `stack:dev:worker:once`, `stack:dev:worker:logs`, `stack:preview:worker:start`, `stack:preview:worker:once`, and `stack:preview:worker:logs`.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm operator:browser:probe -- --browser-provider playwright`
- `docker compose -f docker-compose.dev.yml config`
- `docker compose -f docker-compose.preview.yml config`
- Build the worker service image.
- Start the worker service with the default Playwright provider.
- Confirm the worker uses `http://api:3000` internally.
- Confirm a safe "no queued collection run found" message, or equivalent, when no queued runs exist.
- Confirm clean shutdown.

If a real provisioned profile and active Facebook source group are available, also verify one queued run is claimed and reaches `SUCCEEDED` or `FAILED` with only safe summary or sanitized failure output. If they are not available, report that real collection was not run.
