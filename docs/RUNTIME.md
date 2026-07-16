# Full-Stack Runtime

Sprint 027 provides two Docker Compose runtimes for the current Content Collector management surface. Sprint 037B adds an opt-in containerized worker service for consuming queued collection runs from those stacks. Sprint 047A adds a separate opt-in containerized worker service for queued Account Exercise runs. Sprint 060 adds an opt-in containerized collection scheduler service that drives scheduled dispatch from those stacks. Sprint 068B2 adds separate opt-in profile home-feed scheduler and worker services for scheduled home-feed dispatch and queued home-feed execution.

For the accepted Profile Feed Collector MVP operator runbook (Playwright /
`DIRECT` / normal `https://www.facebook.com/` baseline, smoke test, recovery,
and maintenance boundary), see [`COLLECTOR_BASELINE.md`](COLLECTOR_BASELINE.md).
This file remains the full command and Compose reference; it does not duplicate
that runbook.

## Command Groups

Root `package.json` scripts are grouped by operational purpose. Sprint 073
removed the backward-compatible aliases listed in the "Removed legacy
aliases" section below; use the canonical names. README.md keeps the daily
subset; this file is the full reference.

### App Runtime

| Command | Purpose |
| --- | --- |
| `pnpm app:dev` | Run the API app in watch mode. |
| `pnpm app:start` | Run the API app once. |

### Web UI

| Command | Purpose |
| --- | --- |
| `pnpm web:dev` | Run the Vite Web UI. |
| `pnpm web:build` | Build the Web UI. |
| `pnpm web:typecheck` | Typecheck the Web UI. |

### Database

| Command | Purpose |
| --- | --- |
| `pnpm db:generate` | Generate Drizzle migrations. |
| `pnpm db:migrate` | Run Drizzle migrations. |

### Tests

| Command | Purpose |
| --- | --- |
| `pnpm typecheck` | Typecheck the backend/root TypeScript project. |
| `pnpm test` | Run default Vitest tests. |
| `pnpm test:db` | Run opt-in database integration tests. |
| `pnpm test:db:docker` | Run the canonical Docker-backed Layer 2 database integration test runner (isolated Postgres + Vitest). |
| `pnpm test:http:db` | Run opt-in DB-backed HTTP integration tests. |
| `pnpm test:e2e:docker` | Run the isolated Docker E2E stack and Playwright runner. The only operator-facing host command for the E2E harness. The container entrypoint invokes Playwright directly. |

`pnpm test:db:docker` accepts an optional `DB_TEST_ARGS` env var forwarded
into the runner container and split on whitespace into Vitest positional
arguments. Default is `src/infrastructure` (matches the host `pnpm test:db`
target). Example narrowing to one spec:

```bash
DB_TEST_ARGS="src/infrastructure/database/repositories/drizzle-transform-type.repository.integration.test.ts" \
  pnpm test:db:docker
```

### Operator Tools

| Command | Purpose |
| --- | --- |
| `pnpm operator:profile:provision` | Complete manual profile provisioning in a headed browser. |
| `pnpm operator:profile:exercise` | Run one read-only ambient account exercise attempt for a specified profile. |
| `pnpm operator:profile:exercise-worker` | Claim and execute queued Ambient Account and Category Browse exercise runs. |
| `pnpm operator:profile-source-access-check-worker` | Claim and execute queued Profile-Source Access Check runs. |
| `pnpm operator:profile:assisted-access` | Open one assisted group access browser session for manual operator inspection. |
| `pnpm operator:collector:facebook` | Run one manual Facebook collection for a source group. |
| `pnpm operator:collector:worker` | Claim and execute queued collection runs. |
| `pnpm operator:collector:scheduler` | Poll `DispatchNextDueCollectionScheduleUseCase` and dispatch due schedules. |
| `pnpm operator:profile-home-feed:scheduler` | Poll `DispatchNextDueProfileHomeFeedCollectionScheduleUseCase` and dispatch due profile home-feed schedules. |
| `pnpm operator:profile-home-feed-worker` | Claim and execute queued profile home-feed collection runs. |
| `pnpm operator:profile-home-feed:run-next` | Run one bounded profile home-feed collection (Sprint 065C3 one-shot executor). |
| `pnpm operator:browser:probe` | Probe a browser provider without backend or Facebook login. |

### Removed legacy aliases (Sprint 073)

The following backward-compatible alias scripts were removed from the root
`package.json`. Use the canonical names listed above instead:

| Old command | Canonical command |
| --- | --- |
| `pnpm dev` | `pnpm app:dev` |
| `pnpm start` | `pnpm app:start` |
| `pnpm dev:web` | `pnpm web:dev` |
| `pnpm build` | `pnpm web:build` |
| `pnpm build:web` | `pnpm web:build` |
| `pnpm typecheck:web` | `pnpm web:typecheck` |
| `pnpm profile:provision` | `pnpm operator:profile:provision` |
| `pnpm profile:provision:cloakbrowser-probe` | `pnpm operator:profile:provision:cloakbrowser-probe` |
| `pnpm profile:exercise:run` | `pnpm operator:profile:exercise` |
| `pnpm profile:exercise-worker:run` | `pnpm operator:profile:exercise-worker` |
| `pnpm profile:assisted-access:run` | `pnpm operator:profile:assisted-access` |
| `pnpm profile:home-feed:run-next` | `pnpm operator:profile-home-feed:run-next` |
| `pnpm collector:facebook:run` | `pnpm operator:collector:facebook` |
| `pnpm collector:worker:run` | `pnpm operator:collector:worker` |
| `pnpm collector:scheduler:run` | `pnpm operator:collector:scheduler` |
| `pnpm collector:browser:probe` | `pnpm operator:browser:probe` |
| `pnpm profile-home-feed:scheduler:run` | `pnpm operator:profile-home-feed:scheduler` |
| `pnpm profile-home-feed-worker:run` | `pnpm operator:profile-home-feed-worker` |
| `pnpm profile-source-access-check-worker:run` | `pnpm operator:profile-source-access-check-worker` |

### Docker Stacks

| Command | Purpose |
| --- | --- |
| `pnpm stack:dev:start` | Start the development Compose stack. |
| `pnpm stack:dev:stop` | Stop the development Compose stack. |
| `pnpm stack:dev:reset` | Stop the development stack and remove volumes. |
| `pnpm stack:preview:start` | Start the production-like preview Compose stack. |
| `pnpm stack:preview:stop` | Stop the preview Compose stack. |
| `pnpm stack:preview:reset` | Stop the preview stack and remove volumes. |
| `pnpm stack:service` | Typed worker/scheduler start, once, or logs for `dev` or `preview`. |

```bash
pnpm stack:service -- --stack <dev|preview> --service <service> --action <start|once|logs>
```

`--service` values: `collector-worker`, `account-exercise-worker`,
`collection-scheduler`, `profile-home-feed-scheduler`,
`profile-home-feed-worker`, `all`. `all` supports `start` and `logs` only.

### Removed stack service aliases (Sprint 078)

| Old command | New command |
| --- | --- |
| `pnpm stack:dev:worker:start` | `pnpm stack:service -- --stack dev --service collector-worker --action start` |
| `pnpm stack:dev:worker:once` | `pnpm stack:service -- --stack dev --service collector-worker --action once` |
| `pnpm stack:dev:worker:logs` | `pnpm stack:service -- --stack dev --service collector-worker --action logs` |
| `pnpm stack:dev:exercise-worker:*` | `--service account-exercise-worker` with the same `--action` |
| `pnpm stack:dev:scheduler:*` | `--service collection-scheduler` with the same `--action` |
| `pnpm stack:dev:profile-home-feed-scheduler:*` | `--service profile-home-feed-scheduler` with the same `--action` |
| `pnpm stack:dev:profile-home-feed-worker:*` | `--service profile-home-feed-worker` with the same `--action` |
| `pnpm stack:dev:workers:start` | `pnpm stack:service -- --stack dev --service all --action start` |
| `pnpm stack:dev:workers:logs` | `pnpm stack:service -- --stack dev --service all --action logs` |
| matching `stack:preview:*` aliases | same mapping with `--stack preview` |

`pnpm test:e2e:container` was also removed. The E2E container invokes Playwright
directly; operators use `pnpm test:e2e:docker`.

## Development Stack

Start:

```bash
pnpm stack:dev:start
```

Equivalent command:

```bash
docker compose -f docker-compose.dev.yml up --build -d
```

Open:

- Web UI: `http://localhost:5173`
- API: `http://localhost:3000`
- PostgreSQL: `localhost:5433`

The API container connects to PostgreSQL at `postgres:5432` on the Docker network. The host port is `5433` to avoid collisions with existing local PostgreSQL services.

If a host port is already busy, override it when starting the stack:

```bash
WEB_DEV_PORT=5174 POSTGRES_HOST_PORT=5434 pnpm stack:dev:start
```

Stop:

```bash
pnpm stack:dev:stop
```

This also stops opt-in worker-profile services when they are running.

Reset the development database volume:

```bash
pnpm stack:dev:reset
```

In development, the browser calls relative API paths such as `/collector/profiles`. Vite proxies `/collector/*` to the API service. Inside Docker this target is `http://api:3000`; for non-Docker local Vite runs it defaults to `http://localhost:3000`.

## Preview Stack

Start:

```bash
pnpm stack:preview:start
```

Equivalent command:

```bash
docker compose -f docker-compose.preview.yml up --build -d
```

Open:

- Web Gateway: `http://localhost:8081`

The preview gateway uses host port `8081` because `8080` is commonly occupied by local admin tools. Inside Docker, Nginx still listens on port `80`.

If that host port is already busy, override it when starting the stack:

```bash
WEB_GATEWAY_PORT=8082 pnpm stack:preview:start
```

Stop:

```bash
pnpm stack:preview:stop
```

This also stops opt-in worker-profile services when they are running.

Reset the preview database volume:

```bash
pnpm stack:preview:reset
```

In preview, `apps/web` is built into static files and served by Nginx. The browser uses the Nginx entrypoint at `http://localhost:8081`. Nginx proxies `/collector/*` to `http://api:3000` before applying the React SPA fallback, so refreshing `http://localhost:8081/profiles` returns the React app.

## Containerized Worker Services

Sprint 037B adds an opt-in Docker Compose service named `collector-worker`. Sprint 047A adds a separate opt-in Docker Compose service named `account-exercise-worker`. Sprint 060 adds a third opt-in Docker Compose service named `collection-scheduler` that drives the scheduled dispatch poller described in Sprint 059. Sprint 068B2 adds `profile-home-feed-scheduler` and `profile-home-feed-worker` as separate opt-in services for profile home-feed scheduled dispatch and queued run execution. All five services are behind the Compose `worker` profile, expose no ports, and are not started by normal stack boot commands.

Start the development stack and collection worker:

```bash
pnpm stack:dev:start
pnpm stack:service -- --stack dev --service collector-worker --action start
pnpm stack:service -- --stack dev --service collector-worker --action logs
```

Start the development stack and account exercise worker:

```bash
pnpm stack:dev:start
pnpm stack:service -- --stack dev --service account-exercise-worker --action start
pnpm stack:service -- --stack dev --service account-exercise-worker --action logs
```

Start every development worker-profile service:

```bash
pnpm stack:dev:start
pnpm stack:service -- --stack dev --service all --action start
pnpm stack:service -- --stack dev --service all --action logs
```

Start the preview stack and collection worker:

```bash
pnpm stack:preview:start
pnpm stack:service -- --stack preview --service collector-worker --action start
pnpm stack:service -- --stack preview --service collector-worker --action logs
```

Start the preview stack and account exercise worker:

```bash
pnpm stack:preview:start
pnpm stack:service -- --stack preview --service account-exercise-worker --action start
pnpm stack:service -- --stack preview --service account-exercise-worker --action logs
```

Start every preview worker-profile service:

```bash
pnpm stack:preview:start
pnpm stack:service -- --stack preview --service all --action start
pnpm stack:service -- --stack preview --service all --action logs
```

Run one disposable collection-worker iteration through Docker:

```bash
pnpm stack:service -- --stack dev --service collector-worker --action once
pnpm stack:service -- --stack preview --service collector-worker --action once
```

Run one disposable account-exercise-worker iteration through Docker:

```bash
pnpm stack:service -- --stack dev --service account-exercise-worker --action once
pnpm stack:service -- --stack preview --service account-exercise-worker --action once
```

Run one disposable profile-home-feed scheduler or worker iteration through Docker:

```bash
pnpm stack:service -- --stack dev --service profile-home-feed-scheduler --action once
pnpm stack:service -- --stack dev --service profile-home-feed-worker --action once
pnpm stack:service -- --stack preview --service profile-home-feed-scheduler --action once
pnpm stack:service -- --stack preview --service profile-home-feed-worker --action once
```

Stop polling workers without stopping the whole stack:

```bash
docker compose -f docker-compose.dev.yml stop collector-worker
docker compose -f docker-compose.preview.yml stop collector-worker
docker compose -f docker-compose.dev.yml stop account-exercise-worker
docker compose -f docker-compose.preview.yml stop account-exercise-worker
docker compose -f docker-compose.dev.yml stop collection-scheduler
docker compose -f docker-compose.preview.yml stop collection-scheduler
docker compose -f docker-compose.dev.yml stop profile-home-feed-scheduler
docker compose -f docker-compose.preview.yml stop profile-home-feed-scheduler
docker compose -f docker-compose.dev.yml stop profile-home-feed-worker
docker compose -f docker-compose.preview.yml stop profile-home-feed-worker
```

Inside Docker, browser-backed worker containers use `http://api:3000` as their API base URL and `postgres:5432` through `DATABASE_URL`. Do not use `http://localhost:8081` or `http://localhost:3000` from inside worker containers; those are host entrypoints for browser/operator commands running on the host. The preview gateway remains the host browser entrypoint, while service-to-service Compose traffic goes directly to the `api` service.

The worker image uses the Playwright runtime base image aligned to the locked Playwright package version. Each browser-backed worker container entrypoint starts Xvfb and forwards `SIGINT`/`SIGTERM` to the existing worker CLI so the current headed Playwright path can launch Chromium in the container and still stop cleanly. Existing stack defaults are preserved: dev browser-backed workers use `BROWSER_PROVIDER=cloakbrowser`, and preview browser-backed workers use `BROWSER_PROVIDER=playwright`. CloakBrowser remains experimental; if an operator overrides `BROWSER_PROVIDER=cloakbrowser` without a working CloakBrowser installation, the existing provider boundary should fail with sanitized setup guidance.

When no jobs exist, the polling worker logs safe operational lines such as `Collector worker started.` and `No queued collection run found.`. The one-shot worker exits after a single no-job check. When a queued run exists, the worker claims the oldest `QUEUED` run, marks it `RUNNING`, executes the existing Facebook collector orchestration, and records either `SUCCEEDED` with safe summary counts or `FAILED` with a sanitized failure reason. Profile leases should be released by the existing collector flow when a profile was checked out.

When no account exercise jobs exist, the polling account exercise worker logs safe operational lines such as `Account exercise worker started.` and `No queued account exercise run found.`. The one-shot account exercise worker exits after a single no-job check. When a queued run exists, the worker claims the oldest `QUEUED` run, marks it `RUNNING`, executes the Ambient Account or Category Browse Exercise flow with the persisted profile id and action budget, and records either `SUCCEEDED` with safe summary counts or `FAILED` with sanitized failure data. Profile leases should be released by the existing ambient exercise executor when a profile was checked out.

## Containerized Collection Scheduler

Sprint 060 adds an opt-in Docker Compose service named `collection-scheduler`. It runs the Sprint 059 scheduled dispatch poller inside a lightweight `scheduler-runtime` image derived from the existing `app-deps` build stage. scheduler-runtime inherits workspace Node packages installed by app-deps, but it does not provision browser executables, Playwright browser downloads, Xvfb, browser-specific system packages, or a runnable CloakBrowser browser/system runtime, and the scheduler does not launch a browser.

Start the development stack and collection scheduler:

```bash
pnpm stack:dev:start
pnpm stack:service -- --stack dev --service collection-scheduler --action start
pnpm stack:service -- --stack dev --service collection-scheduler --action logs
```

Start the preview stack and collection scheduler:

```bash
pnpm stack:preview:start
pnpm stack:service -- --stack preview --service collection-scheduler --action start
pnpm stack:service -- --stack preview --service collection-scheduler --action logs
```

Start every dev opt-in worker service:

```bash
pnpm stack:dev:start
pnpm stack:service -- --stack dev --service all --action start
pnpm stack:service -- --stack dev --service all --action logs
```

Start every preview opt-in worker service:

```bash
pnpm stack:preview:start
pnpm stack:service -- --stack preview --service all --action start
pnpm stack:service -- --stack preview --service all --action logs
```

Run one disposable scheduler iteration through Docker:

```bash
pnpm stack:service -- --stack dev --service collection-scheduler --action once
pnpm stack:service -- --stack preview --service collection-scheduler --action once
```

The container entrypoint is `scripts/run-collection-scheduler-container.sh`. It polls the configured `COLLECTION_SCHEDULER_READINESS_URL` (default `http://api:3000/collector/collection-runs?limit=1`) until the API returns an HTTP status below 500, then `exec`s the scheduler CLI. Default scheduler mode is `--poll-interval-ms 5000`; override `COLLECTION_SCHEDULER_MODE_ARGS` to run `--once` or a different poll interval. The scheduler talks to PostgreSQL through the existing Collector Runtime composition root, so it needs `DATABASE_URL` and no other module base URL. It never logs `DATABASE_URL`, credentials, base URLs, or any other environment variable.

The scheduler container does not start Xvfb and does not manage a browser process. Compose `init: true` makes the small init process PID 1 of the container. The entrypoint script's final operation is `exec node --import tsx … cli.ts`, which replaces the shell with the Node process so there is no shell intermediary between init and Node; init forwards `SIGINT`/`SIGTERM` (e.g. from `docker compose stop collection-scheduler`) to the Node process, and the existing Sprint 059 CLI signal handlers perform the clean shutdown.

## Containerized Profile Home-Feed Scheduler And Worker

Sprint 068B2 adds two separate opt-in Docker Compose services:

- `profile-home-feed-scheduler` runs the existing profile home-feed
  scheduler CLI from the lightweight `scheduler-runtime` image.
- `profile-home-feed-worker` runs the existing profile home-feed
  worker CLI from the browser-capable `worker-runtime` image.

Start the development stack and profile home-feed scheduler:

```bash
pnpm stack:dev:start
pnpm stack:service -- --stack dev --service profile-home-feed-scheduler --action start
pnpm stack:service -- --stack dev --service profile-home-feed-scheduler --action logs
```

Start the development stack and profile home-feed worker:

```bash
pnpm stack:dev:start
pnpm stack:service -- --stack dev --service profile-home-feed-worker --action start
pnpm stack:service -- --stack dev --service profile-home-feed-worker --action logs
```

Start the preview stack and profile home-feed scheduler:

```bash
pnpm stack:preview:start
pnpm stack:service -- --stack preview --service profile-home-feed-scheduler --action start
pnpm stack:service -- --stack preview --service profile-home-feed-scheduler --action logs
```

Start the preview stack and profile home-feed worker:

```bash
pnpm stack:preview:start
pnpm stack:service -- --stack preview --service profile-home-feed-worker --action start
pnpm stack:service -- --stack preview --service profile-home-feed-worker --action logs
```

Run one disposable profile home-feed scheduler or worker iteration:

```bash
pnpm stack:service -- --stack dev --service profile-home-feed-scheduler --action once
pnpm stack:service -- --stack dev --service profile-home-feed-worker --action once
pnpm stack:service -- --stack preview --service profile-home-feed-scheduler --action once
pnpm stack:service -- --stack preview --service profile-home-feed-worker --action once
```

`profile-home-feed-scheduler` sets `DATABASE_URL`,
`PROFILE_HOME_FEED_SCHEDULER_MODE_ARGS`, and
`PROFILE_HOME_FEED_SCHEDULER_READINESS_URL`. Its entrypoint polls
the readiness URL, defaulting to
`http://api:3000/collector/profile-home-feed-collection-schedules?limit=1`,
until the API returns an HTTP status below 500, then `exec`s
`src/operator-tools/profile-home-feed-scheduler/cli.ts`. It does not
set `BROWSER_PROVIDER`, `DISPLAY`, Xvfb variables, or browser runtime
environment.

`profile-home-feed-worker` sets `DATABASE_URL`,
`PROFILE_HOME_FEED_WORKER_BASE_URL=http://api:3000`,
`PROFILE_HOME_FEED_WORKER_MODE_ARGS`, Xvfb display configuration, and
`BROWSER_PROVIDER`. Its entrypoint waits for
`/collector/profile-home-feed-collection-runs?limit=1` to answer
below 500, starts Xvfb, exports `DISPLAY`, starts the existing worker
CLI with `--base-url http://api:3000`, forwards `SIGINT` and
`SIGTERM`, cleans up Xvfb, and exits with the worker status.

The dev stack follows the existing dev browser-backed worker default
of `BROWSER_PROVIDER=cloakbrowser`; the preview stack follows the
existing preview default of `BROWSER_PROVIDER=playwright`. The
entrypoints print only static readiness/display messages and do not
log database URLs, API URLs, tokens, cookies, localStorage, proxy
values, trusted runtime configuration, raw payloads, screenshots, or
raw HTML.

## Profile Provisioning CLI

Sprint 030 adds an operator-only CLI for finishing Collector Profile Manager provisioning after the Web UI starts it.

Create and start provisioning:

1. Start the dev or preview stack.
2. Open the Web UI profile detail page.
3. Create a profile if needed.
4. Configure the required profile fields through the structured forms.
5. Use the Start Provisioning action on the profile detail page.
6. Copy the one-time provisioning token from the immediate success UI.

The token is shown only at the moment provisioning starts. It is one-time-use and should be treated as a secret. After successful session ingestion, reusing the same token should fail through the backend token validation rules.

Run the CLI against the preview gateway:

```bash
pnpm operator:profile:provision -- --token <provisioning-token> --base-url http://localhost:8081
```

Run the CLI against the direct local API:

```bash
pnpm operator:profile:provision -- --token <provisioning-token> --base-url http://localhost:3000
```

If `--base-url` is omitted, the CLI uses `PROFILE_PROVISIONING_BASE_URL`, then `PROFILE_MANAGER_BASE_URL`, then `http://localhost:3000`.

Select the browser provider explicitly:

```bash
pnpm operator:profile:provision -- --token <provisioning-token> --base-url http://localhost:8081 --browser-provider playwright
pnpm operator:profile:provision -- --token <provisioning-token> --base-url http://localhost:8081 --browser-provider cloakbrowser
```

If `--browser-provider` is omitted, the CLI uses `BROWSER_PROVIDER`, then
`playwright`. Supported values are `playwright` and `cloakbrowser`.
`playwright` maps to `PLAYWRIGHT_CHROMIUM` and remains the default.
`cloakbrowser` maps to `CLOAK_BROWSER` and remains experimental.

Provisioning CloakBrowser prerequisites:

- Source/package: `cloakbrowser` from
  `https://github.com/CloakHQ/CloakBrowser`, npm package `cloakbrowser`.
- Installed dependencies: root package dependencies include `cloakbrowser` and
  `playwright-core`.
- Runtime API: the provisioning adapter imports `launchContext` from
  `cloakbrowser`, passes headed launch options plus profile-owned context
  options, then exports cookies and localStorage from the returned
  Playwright-style context.
- Binary setup: run `pnpm exec cloakbrowser install` to pre-download the
  CloakBrowser Chromium binary, or allow the first CloakBrowser launch to
  download it into the local CloakBrowser cache.
- Runtime requirement: CloakBrowser's Node package requires Node.js 20 or
  newer.

Probe the provisioning CloakBrowser installation without opening Facebook:

```bash
pnpm operator:profile:provision:cloakbrowser-probe --
```

Run an opt-in real headed smoke launch without Facebook login or session
submission:

```bash
pnpm operator:profile:provision:cloakbrowser-probe -- --launch-headed
```

The probe reports sanitized reason codes such as
`CLOAK_BROWSER_AVAILABLE`, `CLOAK_BROWSER_MODULE_NOT_FOUND`,
`CLOAK_BROWSER_UNSUPPORTED_API`, `CLOAK_BROWSER_BINARY_INFO_FAILED`, and
`CLOAK_BROWSER_BINARY_NOT_INSTALLED`.

Expected operator flow:

1. The CLI fetches provisioning configuration from `GET /collector/provisioning/:token/configuration`.
2. A headed browser opens at the Facebook login entrypoint through the selected
   provider.
3. The operator logs in manually in the browser.
4. The operator returns to the terminal and presses Enter.
5. The CLI captures context cookies and localStorage snapshots for Facebook origins.
6. The CLI submits the captured session to `POST /collector/provisioning/:token/session`.
7. Profile Manager consumes the token and returns the profile in `READY` status.

The CLI does not automate credentials, store passwords, solve CAPTCHAs, capture Facebook content, capture GraphQL responses, implement collection runtime behavior, or write cookies/localStorage to disk.

The CLI prints only operational progress and counts. It must not print cookies, localStorage values, proxy passwords, token hashes, raw session material, or trusted runtime secrets. The one-time provisioning configuration route may include proxy credentials so the selected provider can use the configured proxy, but public profile list/detail reads continue to omit proxy credentials and captured session state.

Provisioning never automatically falls back from CloakBrowser to Playwright,
from a configured proxy to a direct connection, or from one proxy protocol to
another. Provider and proxy launch failures stop the command with sanitized
output. Empty or incomplete authentication-state capture is not submitted.

## Authentication Recovery Reprovisioning

Sprint 055 closes the recovery loop for `READY` profiles whose
`authenticationHealth` is `REAUTH_REQUIRED` (a previous session was
reported as login-required) or `CHECKPOINT_REVIEW_REQUIRED` (a
previous session was reported as checkpoint-required). The same
`POST /collector/profiles/:profileId/provisioning/start` endpoint
and the same `pnpm operator:profile:provision` CLI handle first-time
provisioning, token restart, and recovery reprovisioning; no new
endpoint or CLI is added.

The profile detail Web UI surfaces the current `authenticationHealth`
on the inventory row, the status summary card, and the timestamps
card. The provisioning card adapts to the profile state:

- `PENDING_CONFIG`: **Start Provisioning** (unchanged first-time flow).
- `PENDING_LOGIN`: **Issue New Provisioning Token**, with a warning
  that the previous token becomes invalid and is no longer
  acceptable for session ingestion. The new token replaces the
  previous one and supersedes it; reusing the previous token fails
  through the existing `findByProvisioningToken` and
  `assertUsableProvisioningToken` policy.
- `READY` + `REAUTH_REQUIRED`: **Start Reauthentication**; the
  backend transitions the profile back to `PENDING_LOGIN` while
  preserving `accountStage`, hardware fingerprint, configuration,
  `authenticationState`, `authenticationHealth`, and
  `authenticationHealthUpdatedAt`. The operator then captures a fresh
  Facebook session with the same CLI.
- `READY` + `CHECKPOINT_REVIEW_REQUIRED`: **Start Manual Checkpoint
  Recovery**, explicitly stating there is no automated bypass. The
  operator must drive the same headed provisioning CLI to perform the
  manual Facebook checkpoint flow.
- `READY` + `HEALTHY` and `BUSY`: no provisioning action is offered.

The health value is never restored to `HEALTHY` by `Start Provisioning`,
`Issue New Provisioning Token`, `Start Reauthentication`, or `Start
Manual Checkpoint Recovery`. The only path that sets `HEALTHY` is
successful session ingestion through the existing
`POST /collector/provisioning/:token/session` route, which consumes
the active token, transitions the profile to `READY`, and updates
`authenticationHealthUpdatedAt`.

Recovery operations use the same provisioning token redaction, the
same operator-only CLI, and the same Web UI safe-read rules. Cookies,
localStorage, proxy credentials, provisioning token hashes, raw
session state, trusted runtime configuration, screenshots, page
text, and raw Facebook payloads are never persisted, logged, or
rendered through the recovery flow.

## Ambient Profile Exercise Command

Sprint 039 adds an operator-only command for read-only ambient account exercise. It is intended for `READY` profiles whose account stage is not yet normal collection-ready.

Prerequisites:

1. Start the dev or preview stack.
2. Complete profile provisioning so the target profile is operational `READY`.
3. Keep or set the target profile `accountStage` to one of `NEW_ACCOUNT`, `WARMING`, `LIMITED`, or `COLLECTION_READY`.
4. Copy the profile id from the Web UI profile detail page or the safe profile API.

Run against the preview gateway:

```bash
pnpm operator:profile:exercise -- --profile-id <profile-id> --base-url http://localhost:8081 --max-duration-ms 120000 --max-scrolls 2 --browser-provider playwright
```

Use the preview gateway (`http://localhost:8081`) when running against the preview stack. This matches the Web UI entrypoint and lets Nginx proxy `/collector/*` to the API.

Run against the direct local API:

```bash
pnpm operator:profile:exercise -- --profile-id <profile-id> --base-url http://localhost:3000
```

Use the direct API URL (`http://localhost:3000`) only when you are running the API directly or intentionally bypassing the preview gateway. A base URL mismatch can make the CLI talk to a different API/database than the Web UI.

If `--base-url` is omitted, the command uses `PROFILE_EXERCISE_BASE_URL`, then `PROFILE_MANAGER_BASE_URL`, then `COLLECTOR_FACEBOOK_BASE_URL`, then `http://localhost:3000`.

If `--browser-provider` is omitted, the command uses `BROWSER_PROVIDER`, then `playwright`. Supported operator values are `playwright` and `cloakbrowser`. `playwright` maps to provider name `PLAYWRIGHT_CHROMIUM` and remains the default behavior. `cloakbrowser` maps to provider name `CLOAK_BROWSER` and is experimental.

Expected operator flow:

1. The command reads the profile's safe `accountStage`.
2. It creates an Ambient Exercise Run record through `POST /collector/account-exercise-runs`.
3. It starts that single run and delegates to the shared Ambient Exercise executor.
4. It checks out the specified profile through `POST /collector/profiles/:profileId/exercise-checkout`, which creates an `AMBIENT_EXERCISE` lease.
5. It attaches the lease id to the running exercise run.
6. It fetches trusted runtime configuration from `GET /collector/profile-leases/:leaseId/runtime-configuration`.
7. The selected browser provider opens a headed browser with the profile runtime configuration it can honor.
8. The browser visits `https://www.facebook.com/`.
9. The command performs only read-only dwell and light scroll actions within the run's action budget.
10. It records only safe booleans/counts such as page loaded, login required, checkpoint detected, scroll count, duration, and lease released.
11. It marks the exercise run `SUCCEEDED` or `FAILED` with sanitized failure data.
12. The profile lease is released even when browser launch, navigation, or safe-state detection fails.

Exercise checkout eligibility:

- Normal collection checkout still requires `accountStage = COLLECTION_READY`.
- Ambient exercise checkout allows `NEW_ACCOUNT`, `WARMING`, `LIMITED`, and `COLLECTION_READY`.
- Ambient exercise checkout rejects `NEEDS_REVIEW` and `RETIRED`.
- All three purposes (`COLLECTION`, `AMBIENT_EXERCISE`,
  `ASSISTED_GROUP_ACCESS`) additionally require
  `authenticationHealth === HEALTHY`. Profiles in `NOT_PROVISIONED`,
  `REAUTH_REQUIRED`, or `CHECKPOINT_REVIEW_REQUIRED` are rejected with the
  `AUTHENTICATION_HEALTH_NOT_HEALTHY` reason and must be reprovisioned
  before future automated checkout. Successful session ingestion remains
  the only recovery transition to `HEALTHY`.
- A shared Collector Runtime Facebook page-state observer checks for login and
  checkpoint walls after navigation, after dwell/scroll steps, and at the end.
  It detects structural authentication modals over Facebook pages, including
  localized login modals, and records only safe booleans/counts. When the
  observer reports `LOGIN_REQUIRED` or `CHECKPOINT_REQUIRED`, the
  exercise runner forwards that observation to the lease release so the
  profile's `authenticationHealth` is transitioned atomically. Checkpoint
  precedence is preserved when both walls are observed.

## Account Exercise Worker Command

Sprint 047 adds a separate operator command for consuming queued Ambient Account and Category Browse
Exercise runs created by the Web UI or API.

Run once against the preview gateway:

```bash
pnpm operator:profile:exercise-worker -- --base-url http://localhost:8081 --once --browser-provider playwright
```

Run in polling mode against the direct local API:

```bash
pnpm operator:profile:exercise-worker -- --base-url http://localhost:3000 --poll-interval-ms 5000
```

Alias:

The backward-compatible alias `pnpm profile:exercise-worker:run` was removed in Sprint 073. Use the canonical `pnpm operator:profile:exercise-worker --` form above.

If `--base-url` is omitted, the worker uses
`ACCOUNT_EXERCISE_WORKER_BASE_URL`, then `PROFILE_EXERCISE_BASE_URL`, then
`PROFILE_MANAGER_BASE_URL`, then `http://localhost:3000`.

If `--browser-provider` is omitted, the worker uses `BROWSER_PROVIDER`, then
`playwright`. Supported operator values are `playwright` and `cloakbrowser`.
`cloakbrowser` remains experimental.

Expected worker flow:

1. It atomically claims the oldest queued account exercise run from PostgreSQL.
2. Claiming transitions the run from `QUEUED` to `RUNNING` and sets
   `startedAt`.
3. Once mode exits after at most one claim and execution.
4. Polling mode sleeps between no-job or completed-job iterations and continues
   after individual run failures.
5. The shared Ambient Exercise executor uses the persisted `profileId` and
   `actionBudget` from the claimed run.
6. It checks out the profile for `AMBIENT_EXERCISE`, attaches the lease id to
   the running run, fetches runtime configuration, launches the selected browser
   provider, visits the Facebook home surface, performs only read-only dwell and
   light scrolls, closes the browser, releases the lease, and marks the run
   `SUCCEEDED` or `FAILED`.
7. `SIGINT` and `SIGTERM` stop polling safely after the current delay or
   in-flight operation has observed the abort signal.

Worker logs are limited to safe lifecycle lines, run ids, summary counts,
lease-release status, and sanitized failure codes/messages. They must not
include cookies, localStorage, proxy credentials, trusted runtime
configuration, raw Facebook payloads, raw page HTML, screenshots, session
headers, or browser fingerprint secrets.

## Assisted Group Access Browser Command

Sprint 043A adds an operator-only command for manually inspecting access to one
Facebook source group using an `ASSISTED_GROUP_ACCESS` lease.

Prerequisites:

1. Start the dev or preview stack.
2. Complete profile provisioning so the target profile is operational `READY`.
3. Set the target profile `accountStage` to `WARMING` or `COLLECTION_READY`.
4. Copy the profile id and source group id from safe operator surfaces.

Run against the preview gateway:

```bash
pnpm operator:profile:assisted-access -- --profile-id <profile-id> --source-group-id <source-group-id> --base-url http://localhost:8081 --browser-provider playwright
```

Run against the direct local API:

```bash
pnpm operator:profile:assisted-access -- --profile-id <profile-id> --source-group-id <source-group-id> --base-url http://localhost:3000
```

If `--browser-provider` is omitted, the command uses `BROWSER_PROVIDER`, then
`playwright`. Supported operator values are `playwright` and `cloakbrowser`.
`--max-duration-ms` defaults to `600000` and accepts `30000-1800000`.

Expected operator flow:

1. The command reads the source group and safe entry-route metadata from Content
   Manager.
2. It selects an explicit route by `--entry-route-id`, or the single default
   route, or a derived `DIRECT_GROUP_URL` route from the source group URL.
3. It rejects inactive/non-Facebook groups, multiple defaults, malformed or
   non-HTTP(S) routes, and `HIGH` risk routes unless
   `--allow-high-risk-route` is present.
4. It checks out the specified profile through
   `POST /collector/profiles/:profileId/assisted-group-access/checkout`.
5. It fetches trusted runtime configuration through the returned lease id.
6. It opens only the selected route URL in a headed browser configured from the
   profile runtime configuration.
7. The operator manually inspects the browser and presses Enter in the terminal
   to finish, or the command times out.
8. The command closes the browser and releases the lease.

The command does not join groups, send join requests, click, search, submit
forms, like, comment, post, share, message, capture or submit content, detect or
mutate access state, create run records, update `accountStage`, or update
profile-source access. Safe output is limited to profile/source ids, selected
route id/type/risk, page-loaded status, completion reason, lease-release status,
duration, and sanitized errors.
- Exercise does not automatically promote or demote `accountStage`.

Safety boundaries:

- The command does not submit content items.
- The command does not join groups, post, comment, like, share, message, send friend requests, solve CAPTCHAs, bypass checkpoints, bypass rate limits/access controls, or automate credentials.
- CLI output and exercise run records must not include cookies, localStorage, raw Facebook payloads, proxy credentials, session headers, provisioning tokens, trusted runtime configuration, browser fingerprint secrets, or checkpoint page HTML.

## Manual Facebook Collector Command

## Assisted Group Access Checkout Foundation

Sprint 043 adds a Profile Manager checkout contract for future
operator-assisted Facebook group access sessions:

```text
POST /collector/profiles/:profileId/assisted-group-access/checkout
```

The request body must contain only a non-empty `sourceGroupId`. The route
validates that the source group exists before entering the Profile Manager
transaction, then checks out the specified profile with lease purpose
`ASSISTED_GROUP_ACCESS` when the profile is `READY`, the account stage is
`WARMING` or `COLLECTION_READY`, and the ordinary session, configuration,
temporal, cooldown, daily safety, and active-lease gates pass.

This checkout does not launch a browser, consume entry routes, create run
records, require successful profile-source access, store `sourceGroupId` on the
generic lease, or create/update profile-source access records. Existing lease
release and trusted runtime profile configuration routes work for active
assisted leases and reject released or expired leases.

Sprint 032 added a manual/dev operator command for one Facebook group run using one existing `READY` profile. Sprint 034A makes `sourceGroupId` the normal source of truth for the group URL. Sprint 034B adds page-context `fetch`/XHR capture while keeping the Playwright network listener as secondary diagnostics.

Prerequisites:

1. Start the dev or preview stack.
2. Complete profile provisioning so at least one profile is `READY`.
3. Promote the profile account stage through valid manual transitions to `COLLECTION_READY`.
4. Ensure Content Manager has an `ACTIVE` Facebook source group record for the target Facebook group.
5. Copy the `sourceGroupId` from the Web UI Source Groups page.

Run against the preview gateway:

```bash
pnpm operator:collector:facebook -- --source-group-id <source-group-id> --base-url http://localhost:8081 --max-scrolls 8 --max-duration-ms 60000 --browser-provider playwright
```

Use the preview gateway (`http://localhost:8081`) when running against the preview stack. This matches the Web UI entrypoint and lets Nginx proxy `/collector/*` to the API.

Run against the direct local API:

```bash
pnpm operator:collector:facebook -- --source-group-id <source-group-id> --base-url http://localhost:3000
```

Use the direct API URL (`http://localhost:3000`) when you are running the API directly or intentionally bypassing the preview gateway. A base URL mismatch can make the CLI talk to a different API/database than the Web UI.

If `--base-url` is omitted, the command uses `COLLECTOR_FACEBOOK_BASE_URL`, then `PROFILE_MANAGER_BASE_URL`, then `CONTENT_MANAGER_BASE_URL`, then `http://localhost:3000`.

If `--browser-provider` is omitted, the command uses `BROWSER_PROVIDER`, then `playwright`. Supported operator values are `playwright` and `cloakbrowser`. `playwright` maps to provider name `PLAYWRIGHT_CHROMIUM` and remains the default behavior. `cloakbrowser` maps to provider name `CLOAK_BROWSER` and is experimental.

`--group-url` is only a development override. When it is provided, the CLI still requires `--source-group-id`, resolves and validates the stored source group first, then prints a warning before opening the override URL instead of the stored source URL.

Sprint 040 adds source group entry route metadata to Content Manager source group reads. The current manual collector command still validates and opens the source group `url`; it does not choose from `entryRoutes`. Entry routes are for future access onboarding and exercise flows only. They do not grant access, imply profile eligibility, join groups, run search behavior, or change profile account stage.

Optional checkout diagnostics:

```bash
pnpm operator:collector:facebook -- --source-group-id <source-group-id> --base-url http://localhost:8081 --diagnose-checkout
```

Diagnostic mode prints only safe aggregate profile status counts: total profiles, `READY`, `BUSY`, `PENDING_LOGIN`, and `PENDING_CONFIG`.

Expected operator flow:

1. The command resolves the source group through `GET /collector/source-groups/:sourceGroupId`.
2. It verifies the source group exists, uses platform `FACEBOOK`, is `ACTIVE`, and has a Facebook group URL before browser launch.
3. The command checks out one eligible `READY` and `COLLECTION_READY` profile through `POST /collector/profiles/checkout`.
4. It fetches trusted runtime configuration from `GET /collector/profile-leases/:leaseId/runtime-configuration`.
5. The selected browser provider opens a headed browser with the profile cookies, localStorage, browser fingerprint, locale/language, timezone, viewport, and proxy settings it can honor from Profile Manager runtime configuration.
6. The browser visits the stored Facebook group URL, unless `--group-url` was provided as a development override.
7. Before navigation, the adapter injects page-context instrumentation that patches `window.fetch` and XHR to capture parsed JSON response bodies from `/api/graphql`, `/graphql`, `/ajax/`, and JSON content-type responses.
8. The shared Facebook page-state observer checks for login and checkpoint
   walls before scrolling, during scroll/dwell, and at the end. Login or
   checkpoint walls fail capture with `LOGIN_REQUIRED` or
   `CHECKPOINT_REQUIRED`.
9. The existing Playwright network response listener remains enabled as secondary capture and diagnostics.
10. Captured page-context and network-listener payloads are deduplicated in memory and passed to the existing Facebook GraphQL extractor.
11. Normalized candidates are submitted to Content Manager through `POST /collector/content-items` using the same `sourceGroupId`.
12. The profile lease is released even when capture, extraction, or submission fails. When capture fails with the exact error code `LOGIN_REQUIRED` or `CHECKPOINT_REQUIRED`, the lease release forwards that observation to Profile Manager, which atomically transitions the profile's `authenticationHealth` (`REAUTH_REQUIRED` or `CHECKPOINT_REVIEW_REQUIRED`) alongside the lease release. The observation is never inferred from `loginRedirectSuspected`, URLs, navigation errors, or missing payloads.

The safe summary prints counts only:

- Lease released yes/no.
- GraphQL responses captured.
- Page-context fetch captures.
- Page-context XHR captures.
- Network listener captures.
- Capture parse failures.
- Payloads passed to extractor.
- Final page URL with query string and fragment removed.
- Login redirect suspected yes/no.
- Extractor candidates produced.
- Content items submitted.
- Failed submissions.
- Warning count.
- Duration in milliseconds.

## Browser Provider Selection And Probe

Sprint 037A adds a Collector Runtime browser provider boundary. Browser-provider hardening is allowed only inside Collector Runtime infrastructure. Profile Manager remains the authority for profile identity, session state, proxy configuration, and fingerprint configuration.

Sprint 053A applies the same operator selection values to the profile
provisioning CLI through a provisioning-specific boundary because provisioning
must export cookies and localStorage after manual login. That export capability
is not exposed through the unrelated Collector Runtime browser provider port.
Provisioning CloakBrowser support uses the documented Node `launchContext`
API from `cloakbrowser`; runtime collection providers remain behind the
Collector Runtime provider boundary.

Default provider:

```bash
BROWSER_PROVIDER=playwright
pnpm operator:collector:facebook -- --source-group-id <source-group-id> --base-url http://localhost:8081
```

Experimental CloakBrowser provider:

```bash
BROWSER_PROVIDER=cloakbrowser
pnpm operator:collector:facebook -- --source-group-id <source-group-id> --base-url http://localhost:8081
```

Probe the default provider without Facebook login:

```bash
pnpm operator:browser:probe -- --browser-provider playwright
```

Probe CloakBrowser setup:

```bash
pnpm operator:browser:probe -- --browser-provider cloakbrowser
```

The probe builds a synthetic safe runtime profile configuration, launches the selected provider, creates one page, and verifies init-script plus binding instrumentation. It does not check out a profile, visit Facebook, automate credentials, or persist session material.

CloakBrowser is installed through the `cloakbrowser` Node package and its
`playwright-core` peer. Pre-download the binary with
`pnpm exec cloakbrowser install` when operators need deterministic setup. If it
is not installed or does not expose a supported launch/context/page API locally,
the probe should fail with sanitized setup guidance and browser-backed commands
should continue to use Playwright only when Playwright is explicitly selected or
defaulted. No selected CloakBrowser command falls back to Playwright.

Provider safety boundaries:

- Browser providers consume Profile Manager trusted runtime configuration after checkout.
- Browser providers must not randomize or mutate profile identity outside Profile Manager.
- Browser providers must not regenerate fingerprints outside Profile Manager; provider fingerprint seed/config must come from Profile Manager runtime config or a stable profile-id mapping.
- Browser providers must not solve CAPTCHAs, automate credentials, bypass checkpoints, bypass rate limits or access controls, post, comment, or like.
- Login, checkpoint, and session-expired states must be surfaced as profile/session health issues such as `LOGIN_REQUIRED`, `CHECKPOINT_REQUIRED`, or `SESSION_EXPIRED`.
- Browser-provider output must not include cookies, localStorage, raw Facebook payloads, proxy credentials, session headers, trusted runtime configuration, checkpoint HTML, or fingerprint secrets.

## Collection Run API Trigger

Sprint 036 adds durable collection run records and an API trigger that queues a run request without executing browser collection inside the HTTP request.

Request a queued run through the preview gateway:

```bash
curl -X POST http://localhost:8081/collector/collection-runs \
  -H 'content-type: application/json' \
  -d '{"sourceGroupId":"<source-group-id>","maxScrolls":8,"maxDurationMs":60000}'
```

Use the preview gateway (`http://localhost:8081`) when running against the preview stack.

Request a queued run through the direct local API:

```bash
curl -X POST http://localhost:3000/collector/collection-runs \
  -H 'content-type: application/json' \
  -d '{"sourceGroupId":"<source-group-id>"}'
```

Use the direct API URL (`http://localhost:3000`) only when you are running the API directly or intentionally bypassing the preview gateway.

The request endpoint validates that the source group exists, is `ACTIVE`, and uses platform `FACEBOOK`. A successful request returns `201` with a safe collection run DTO whose status is `QUEUED` and trigger type is `MANUAL_API`.

Read queued and historical run records:

```bash
curl http://localhost:8081/collector/collection-runs
curl http://localhost:8081/collector/collection-runs/<collection-run-id>
```

Cancel a queued run:

```bash
curl -X POST http://localhost:8081/collector/collection-runs/<collection-run-id>/cancel
```

Current API trigger limitations:

- It creates durable run records only.
- It does not launch Playwright.
- It does not check out a profile.
- It does not execute browser collection.
- The Collector Worker Process claims and executes queued runs outside HTTP.

## Collector Worker Process

Sprint 037 adds an operator worker command that claims queued collection runs and executes them through the existing Facebook collector orchestration.

Run one queued collection run through the preview gateway:

```bash
pnpm operator:collector:worker -- --base-url http://localhost:8081 --once --browser-provider playwright
```

Use the preview gateway (`http://localhost:8081`) when running against the preview stack.

Run one queued collection run through the direct local API:

```bash
pnpm operator:collector:worker -- --base-url http://localhost:3000 --once
```

Use the direct API URL (`http://localhost:3000`) only when you are running the API directly or intentionally bypassing the preview gateway.

Run the worker in polling mode:

```bash
pnpm operator:collector:worker -- --base-url http://localhost:8081 --poll-interval-ms 5000 --browser-provider playwright
```

The worker:

- Claims only `QUEUED` runs.
- Atomically transitions the oldest queued run to `RUNNING`.
- Executes the existing Facebook collector runner and browser provider boundary.
- Passes `maxScrolls` and `maxDurationMs` from the run record.
- Marks successful runs `SUCCEEDED` with safe summary counts.
- Marks failed runs `FAILED` with a sanitized failure code and message.
- Exits cleanly on `SIGINT` and `SIGTERM` in polling mode.

Worker logs and collection-run records never include raw Facebook payloads, cookies, local storage, proxy credentials, session headers, provisioning tokens, trusted runtime configuration, or browser session material.

## Profile-Source Access Check Worker Command

Sprint 051 adds a separate operator command for consuming queued
Profile-Source Access Check Runs. It does not add public lifecycle endpoints;
the worker claims and updates runs through Collector Runtime application code.
This is currently an operator command only. The development and preview
Compose worker profiles do not include a `profile-source-access-check-worker`
service or stack command; add Compose wiring only if a later sprint explicitly
requires it.

Run once against the preview gateway:

```bash
pnpm operator:profile-source-access-check-worker -- --base-url http://localhost:8081 --once --browser-provider playwright
```

Alias:

The backward-compatible alias `pnpm profile-source-access-check-worker:run` was removed in Sprint 073. Use the canonical `pnpm operator:profile-source-access-check-worker --` form above.

Run in polling mode against the direct local API:

```bash
pnpm operator:profile-source-access-check-worker -- --base-url http://localhost:3000 --poll-interval-ms 5000
```

Expected worker flow:

1. Atomically claim the oldest queued check run from PostgreSQL.
2. Check out the exact requested profile for assisted group access.
3. Fetch lease-scoped runtime configuration and launch the selected browser
   provider headless.
4. Navigate only to the run's frozen Facebook `DIRECT_GROUP_URL`.
5. Use the shared Facebook page-state observer before group-content
   classification so login modals over `/groups/...` become `LOGIN_REQUIRED`
   and checkpoint evidence takes precedence.
6. Collect sanitized observation booleans/enums only.
7. Close the browser and release the lease before classification and mutation.
8. Classify the observation into a safe outcome, mutate Profile Manager
   profile-source access through HTTP, then mark the check run `SUCCEEDED`.
9. Mark the check run `FAILED` with a sanitized reason when browser,
   cleanup, classification, or mutation fails.

Logs may include run IDs, safe outcomes, sanitized failure codes, and lifecycle
lines only. The worker must not log or persist cookies, localStorage, proxy
credentials, headers, raw page text, raw HTML, screenshots, network payloads,
trusted runtime configuration, token material, or full redirected URLs.

Collector worker current limitations:

- One profile.
- One Facebook group URL.
- One browser session.
- No scheduler, multi-group run, multi-profile run, Web UI trigger, source group selection UI, automatic group discovery, retry policy, stuck-run recovery, heartbeat, or worker lease.
- Zero page-context and network captures can happen if Facebook does not return matching JSON responses during the stop window, the group is inaccessible, the profile is redirected to login or checkpoint, the page has not loaded enough feed content, or Facebook changes response shapes.
- Non-zero captures with zero extracted candidates means the collector saw JSON payloads, but the current extractor did not find supported post candidates in those payloads.
- A profile shown as `READY` is not always checkout-eligible. Checkout also requires `accountStage = COLLECTION_READY` and can still be blocked by temporal routine windows, cooldowns, daily safety thresholds, or an existing lease/BUSY state.
- `NO_ELIGIBLE_PROFILE_AVAILABLE` can also happen when the CLI `--base-url` points to a different API/database than the Web UI. For preview stack testing, prefer `--base-url http://localhost:8081`; use `--base-url http://localhost:3000` only for the direct API stack.

Collector worker safety boundaries:

- The command does not automate credentials, solve CAPTCHAs, bypass access controls, bypass rate limits, post, comment, like, or persist raw payloads.
- Captured page-context and network-listener payloads stay in memory and are not written to disk.
- Raw response bodies are parsed inside the browser page context or in memory for the network listener; raw payload text is not logged or persisted.
- CLI output must not include cookies, localStorage, proxy credentials, raw GraphQL payloads, request or response headers, authorization/session headers, viewer/account identifiers, trusted runtime config, token material, or hashes.

## Migrations

The existing migration system is Drizzle:

- Migration config: `drizzle.config.ts`
- Migration files: `drizzle/`
- Migration command: `pnpm db:migrate`

Both Docker API services run `pnpm db:migrate` before starting the existing backend command. The command uses `DATABASE_URL`; in Docker Compose, that URL points to the `postgres` service.

To run migrations manually against a local database:

```bash
DATABASE_URL=postgres://content_pipeline:content_pipeline@localhost:5433/content_pipeline pnpm db:migrate
```

## Verification

Validate Compose files:

```bash
docker compose -f docker-compose.dev.yml config
docker compose -f docker-compose.preview.yml config
```

Verify preview routing:

```bash
pnpm stack:preview:start
curl -i http://localhost:8081/profiles
curl -i http://localhost:8081/collector/profiles
```

`/profiles` should return the React app HTML. `/collector/profiles` should return the Fastify API response through Nginx.

Verify the real backend is powering `/profiles`:

1. Start the dev or preview stack.
2. Open `/profiles` in the Web UI.
3. Confirm the page renders the real backend empty state or real profile data.
4. Confirm the same data shape is available from `/collector/profiles` through the same stack entrypoint.

Run repository checks:

```bash
pnpm run typecheck
pnpm test
pnpm web:build
```

## Docker End-to-End Testing

Sprint 062 adds an isolated production-like Docker E2E harness. The
harness is the only test layer that runs the full production surface
(`web-gateway` → `api` → `postgres`) inside Docker. The only
operator-facing host command is:

```bash
pnpm test:e2e:docker
```

The E2E container entrypoint
(`scripts/run-e2e-runner-container.sh`) invokes Playwright directly with
`pnpm exec playwright test --config=tests/e2e/playwright.config.ts`. That
invocation is not a host package script; operators should run
`pnpm test:e2e:docker` only. The runner is not directly usable from the host
because `http://web-gateway` is Docker-only and no host port is published.

### What the harness does

The host driver (`scripts/test-e2e-docker.sh`) runs inside its own
Compose project (`fgc-v3-e2e`) and its own named volume
(`fgc_e2e_postgres_data`). It performs, in order:

1. Cleanup of any prior E2E resources:
   `docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml down -v
   --remove-orphans`.
2. Build:
   `docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml build`.
3. Start `postgres`, `api`, and `web-gateway` in detached mode only:
   `docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml up -d
   postgres api web-gateway`. The E2E runner is not started in this
   step.
4. Start the `e2e-runner` exactly once, in attached mode, with
   `--abort-on-container-exit --exit-code-from e2e-runner`:
   `docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml up
   --abort-on-container-exit --exit-code-from e2e-runner e2e-runner`.
5. Capture the runner's exit code.
6. On non-zero exit, print sanitized
   `docker compose logs --no-color` for `api`, `web-gateway`, and
   `e2e-runner`. The driver never prints `DATABASE_URL` or any
   environment value.
7. Return the runner's exit code as the host driver exit code.

The driver installs a `trap` on `EXIT INT TERM` that always runs
`docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml down -v
--remove-orphans`. Cleanup runs on success, failure, and interruption
(including `Ctrl+C`).

### What the harness does not do

The harness is intentionally small:

- It does not publish a host port. `web-gateway` and `e2e-runner`
  reach services through Compose service DNS only.
- It does not reuse `fgc_dev_postgres_data` or
  `fgc_preview_postgres_data`. The E2E volume is `fgc_e2e_postgres_data`
  under the E2E project.
- It does not start the collection worker, the account exercise worker,
  or the collection scheduler.
- It does not connect to Facebook. The Playwright spec uses only
  synthetic fixtures and never touches the platform.
- It does not log `DATABASE_URL`, base URLs, raw payloads, cookies,
  localStorage, proxy credentials, session headers, or environment
  values from any container.
- It does not use arbitrary sleeps as the readiness mechanism. The
  only waits are `pg_isready`, the `api` `/health` healthcheck (which
  requires exact `200` with `{ "status": "ok" }`), and the runner's
  HTTP poll against `http://web-gateway/` (which requires exact
  `200` plus a stable React app-shell marker) followed by a safe API
  read through Nginx (for example `GET /collector/content-categories`
  returning exact `200`).
- It does not start the E2E runner during the detached dependency
  startup; the runner is started exactly once in attached mode.

### E2E stack

```
postgres    postgres:16-alpine     no host port; isolated named volume
api         api-runtime stage      pnpm db:migrate && pnpm start
                                  healthcheck GET /health requires exact 200 + {"status":"ok"}
web-gateway web-gateway stage      nginx:1.27-alpine; no host port
e2e-runner  e2e-runtime stage      mcr.microsoft.com/playwright:v1.60.0-noble
                                  Playwright Chromium runner
                                  started exactly once, in attached mode
```

The `e2e-runtime` Dockerfile stage reuses the same Playwright base
image tag as the existing `worker-runtime` stage so browser binaries
are already installed. The workspace is installed with
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`; the base image supplies Chromium.

### Running

```bash
pnpm test:e2e:docker
pnpm test:e2e:docker   # repeat for determinism
```

The second run uses the same isolated volume and starts from a fresh
database because the host driver always runs `down -v` before bringing
up `postgres`, `api`, and `web-gateway` again.

### Troubleshooting

- `no such service: web-gateway` — the host driver is being run from
  the wrong directory. `cd` to the repo root.
- E2E stack starts but the runner reports `Could not reach
  web-gateway` — the gateway container is not yet ready. Run
  `docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml logs
  web-gateway` and check the Nginx config.
- E2E stack starts but the runner reports API errors — the API
  container is unhealthy. Run
  `docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml logs api`
  and check `pnpm db:migrate` output.
- The E2E runner was started more than once — check
  `docker ps -a --filter
  "label=com.docker.compose.project=fgc-v3-e2e" --filter
  "label=com.docker.compose.service=e2e-runner"`. There should be at
  most one container per run; the host driver starts the runner
  exactly once.
- Leftover containers after a forced kill — the host driver `trap`
  ran `down -v`. Verify with
  `docker ps -a --filter "label=com.docker.compose.project=fgc-v3-e2e"`
  (should be empty) and `docker volume ls` (should not list
  `fgc-v3-e2e_fgc_e2e_postgres_data`).
- The driver prints `Cleanup failed: …` — the underlying `docker
  compose down -v` failed. Run it manually:
  `docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml down -v
  --remove-orphans`.

### Verifying isolation

```bash
docker volume ls               # fgc_dev_postgres_data, fgc_preview_postgres_data unchanged
docker ps -a                   # no leftover fgc-v3-e2e containers
docker network ls              # no leftover fgc-v3-e2e_default network
```

## Docker Database Integration Testing

Sprint 072B adds an isolated Docker-backed Layer 2 (database
integration) test runner. The harness boots an isolated PostgreSQL,
applies Drizzle migrations inside the runner container, and executes
the existing Vitest DB specs through `RUN_DB_TESTS=true` against the
in-network Postgres. The only operator-facing host command is:

```bash
pnpm test:db:docker
```

The host driver (`scripts/test-db-docker.sh`) runs inside its own
Compose project (`fgc-v3-db-test`) and its own named volume
(`fgc_db_test_postgres_data`). It performs, in order:

1. Cleanup of any prior DB test resources:
   `docker compose -p fgc-v3-db-test -f docker-compose.db-test.yml
   down -v --remove-orphans`.
2. Build: `docker compose -p fgc-v3-db-test -f docker-compose.db-test.yml build`.
3. Start `postgres` in detached mode only:
   `docker compose -p fgc-v3-db-test -f docker-compose.db-test.yml up
   -d postgres`. The DB test runner is not started in this step.
4. Start the `db-test-runner` exactly once, in attached mode, with
   `--abort-on-container-exit --exit-code-from db-test-runner`:
   `docker compose -p fgc-v3-db-test -f docker-compose.db-test.yml up
   --abort-on-container-exit --exit-code-from db-test-runner
   db-test-runner`.
5. Capture the runner's exit code.
6. On non-zero exit, print sanitized
   `docker compose logs --no-color db-test-runner postgres`. The
   driver never prints `DATABASE_URL` or any environment value.
7. Return the runner's exit code as the host driver exit code.

The driver installs a `trap` on `EXIT INT TERM` that always runs
`docker compose -p fgc-v3-db-test -f docker-compose.db-test.yml down -v
--remove-orphans`. Cleanup runs on success, failure, and interruption
(including `Ctrl+C`).

The container entrypoint (`scripts/run-db-test-container.sh`) runs
`pnpm db:migrate` then `pnpm exec vitest run
${DB_TEST_ARGS:-src/infrastructure}` with `RUN_DB_TESTS=true` and
`DATABASE_URL` set to the in-network Postgres. The runner image is a
dedicated `db-test-runtime` Dockerfile stage that copies the
workspace deps, `tsconfig.json`, `drizzle.config.ts`, `drizzle/`,
`scripts/`, and `src/`. The `e2e-runtime` stage is intentionally not
reused because it omits `src/` and `drizzle/`.

### What the DB test harness does not do

The harness is intentionally narrow:

- It does not publish a host port. The runner reaches the database
  through Compose service DNS only.
- It does not reuse `fgc_dev_postgres_data`, `fgc_preview_postgres_data`,
  or `fgc_e2e_postgres_data`. The DB test volume is
  `fgc_db_test_postgres_data` under the DB test project.
- It does not start the API, web gateway, collection worker, account
  exercise worker, or collection scheduler.
- It does not start a browser, does not use Playwright, and does not
  connect to Facebook.
- It does not log `DATABASE_URL`, base URLs, raw payloads, cookies,
  localStorage, proxy credentials, session headers, or environment
  values from any container.
- It does not use arbitrary sleeps as the readiness mechanism. The
  only wait is the `pg_isready` healthcheck; the runner applies
  migrations and starts Vitest only after `depends_on:
  service_healthy`.
- It does not start the DB test runner during the detached dependency
  startup; the runner is started exactly once in attached mode.

### DB test stack

```text
postgres         postgres:16-alpine     no host port; isolated named volume
db-test-runner   db-test-runtime stage  pnpm db:migrate && pnpm exec vitest run ${DB_TEST_ARGS:-src/infrastructure}
                                       with RUN_DB_TESTS=true
                                       started exactly once, in attached mode
```

### Running the DB test harness

```bash
pnpm test:db:docker
pnpm test:db:docker   # repeat for determinism
DB_TEST_ARGS="src/infrastructure/database/repositories/drizzle-transform-type.repository.integration.test.ts" pnpm test:db:docker
```

The second run uses the same isolated volume and starts from a fresh
database because the host driver always runs `down -v` before bringing
up `postgres` and the runner again.

### DB test troubleshooting

- `no such service: db-test-runner` — the host driver is being run
  from the wrong directory. `cd` to the repo root.
- DB test runner exits non-zero — check
  `docker compose -p fgc-v3-db-test -f docker-compose.db-test.yml
  logs db-test-runner` for the sanitized Vitest output and
  `pnpm db:migrate` result.
- The DB test runner was started more than once — check
  `docker ps -a --filter
  "label=com.docker.compose.project=fgc-v3-db-test" --filter
  "label=com.docker.compose.service=db-test-runner"`. There should
  be at most one container per run; the host driver starts the runner
  exactly once.
- Leftover containers after a forced kill — the host driver `trap`
  ran `down -v`. Verify with
  `docker ps -a --filter
  "label=com.docker.compose.project=fgc-v3-db-test"` (should be empty)
  and `docker volume ls` (should not list
  `fgc-v3-db-test_fgc_db_test_postgres_data`).
- The driver prints `Cleanup failed: …` — the underlying `docker
  compose down -v` failed. Run it manually:
  `docker compose -p fgc-v3-db-test -f docker-compose.db-test.yml
  down -v --remove-orphans`.

### Verifying DB test isolation

```bash
docker volume ls               # fgc_dev_postgres_data, fgc_preview_postgres_data, fgc_e2e_postgres_data unchanged
docker ps -a                   # no leftover fgc-v3-db-test containers
docker network ls              # no leftover fgc-v3-db-test_default network
```
