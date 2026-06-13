# Full-Stack Runtime

Sprint 027 provides two Docker Compose runtimes for the current Content Collector management surface. Sprint 037B adds an opt-in containerized worker service for consuming queued collection runs from those stacks.

## Command Groups

Root `package.json` scripts are grouped by operational purpose. New work should prefer the canonical names below; older names remain available as backward-compatible aliases.

### App Runtime

| Command | Purpose | Alias |
| --- | --- | --- |
| `pnpm app:dev` | Run the API app in watch mode. | `pnpm dev` |
| `pnpm app:start` | Run the API app once. | `pnpm start` |

### Web UI

| Command | Purpose | Alias |
| --- | --- | --- |
| `pnpm web:dev` | Run the Vite Web UI. | `pnpm dev:web` |
| `pnpm web:build` | Build the Web UI. | `pnpm build:web` |
| `pnpm web:typecheck` | Typecheck the Web UI. | `pnpm typecheck:web` |

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
| `pnpm test:http:db` | Run opt-in DB-backed HTTP integration tests. |

### Operator Tools

| Command | Purpose | Alias |
| --- | --- | --- |
| `pnpm operator:profile:provision` | Complete manual profile provisioning in a headed browser. | `pnpm profile:provision` |
| `pnpm operator:profile:exercise` | Run one read-only ambient account exercise attempt for a specified profile. | `pnpm profile:exercise:run` |
| `pnpm operator:profile:assisted-access` | Open one assisted group access browser session for manual operator inspection. | `pnpm profile:assisted-access:run` |
| `pnpm operator:collector:facebook` | Run one manual Facebook collection for a source group. | `pnpm collector:facebook:run` |
| `pnpm operator:collector:worker` | Claim and execute queued collection runs. | `pnpm collector:worker:run` |
| `pnpm operator:browser:probe` | Probe a browser provider without backend or Facebook login. | `pnpm collector:browser:probe` |

### Docker Stacks

| Command | Purpose |
| --- | --- |
| `pnpm stack:dev:start` | Start the development Compose stack. |
| `pnpm stack:dev:worker:start` | Start the development stack worker service in polling mode. |
| `pnpm stack:dev:worker:once` | Run one development stack worker iteration in a disposable container. |
| `pnpm stack:dev:worker:logs` | Follow development stack worker logs. |
| `pnpm stack:dev:stop` | Stop the development Compose stack. |
| `pnpm stack:dev:reset` | Stop the development stack and remove volumes. |
| `pnpm stack:preview:start` | Start the production-like preview Compose stack. |
| `pnpm stack:preview:worker:start` | Start the preview stack worker service in polling mode. |
| `pnpm stack:preview:worker:once` | Run one preview stack worker iteration in a disposable container. |
| `pnpm stack:preview:worker:logs` | Follow preview stack worker logs. |
| `pnpm stack:preview:stop` | Stop the preview Compose stack. |
| `pnpm stack:preview:reset` | Stop the preview stack and remove volumes. |

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

Reset the preview database volume:

```bash
pnpm stack:preview:reset
```

In preview, `apps/web` is built into static files and served by Nginx. The browser uses the Nginx entrypoint at `http://localhost:8081`. Nginx proxies `/collector/*` to `http://api:3000` before applying the React SPA fallback, so refreshing `http://localhost:8081/profiles` returns the React app.

## Containerized Collector Worker Service

Sprint 037B adds an opt-in Docker Compose service named `collector-worker`. It is behind the Compose `worker` profile, exposes no ports, and is not started by normal stack boot commands.

Start the development stack and worker:

```bash
pnpm stack:dev:start
pnpm stack:dev:worker:start
pnpm stack:dev:worker:logs
```

Start the preview stack and worker:

```bash
pnpm stack:preview:start
pnpm stack:preview:worker:start
pnpm stack:preview:worker:logs
```

Run one disposable worker iteration through Docker:

```bash
pnpm stack:dev:worker:once
pnpm stack:preview:worker:once
```

Stop the polling worker without stopping the whole stack:

```bash
docker compose -f docker-compose.dev.yml stop collector-worker
docker compose -f docker-compose.preview.yml stop collector-worker
```

Inside Docker, the worker uses `http://api:3000` as its API base URL and `postgres:5432` through `DATABASE_URL`. Do not use `http://localhost:8081` or `http://localhost:3000` from inside the worker container; those are host entrypoints for browser/operator commands running on the host. The preview gateway remains the host browser entrypoint, while service-to-service Compose traffic goes directly to the `api` service.

The worker image uses the Playwright runtime base image aligned to the locked Playwright package version. Its container entrypoint starts Xvfb and forwards `SIGINT`/`SIGTERM` to the existing worker CLI so the current headed Playwright path can launch Chromium in the container and still stop cleanly. `BROWSER_PROVIDER=playwright` is the default. CloakBrowser remains experimental and is not required for the worker container to start; if an operator overrides `BROWSER_PROVIDER=cloakbrowser` without a working CloakBrowser installation, the existing provider boundary should fail with sanitized setup guidance.

When no jobs exist, the polling worker logs safe operational lines such as `Collector worker started.` and `No queued collection run found.`. The one-shot worker exits after a single no-job check. When a queued run exists, the worker claims the oldest `QUEUED` run, marks it `RUNNING`, executes the existing Facebook collector orchestration, and records either `SUCCEEDED` with safe summary counts or `FAILED` with a sanitized failure reason. Profile leases should be released by the existing collector flow when a profile was checked out.

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

Expected operator flow:

1. The CLI fetches provisioning configuration from `GET /collector/provisioning/:token/configuration`.
2. A headed Chromium browser opens at `https://www.facebook.com/login`.
3. The operator logs in manually in the browser.
4. The operator returns to the terminal and presses Enter.
5. The CLI captures context cookies and localStorage snapshots for Facebook origins.
6. The CLI submits the captured session to `POST /collector/provisioning/:token/session`.
7. Profile Manager consumes the token and returns the profile in `READY` status.

The CLI does not automate credentials, store passwords, solve CAPTCHAs, add stealth tooling, capture Facebook content, capture GraphQL responses, implement collection runtime behavior, or write cookies/localStorage to disk.

The CLI prints only operational progress and counts. It must not print cookies, localStorage values, proxy passwords, token hashes, raw session material, or trusted runtime secrets. The one-time provisioning configuration route may include proxy credentials so Playwright can use the configured proxy, but public profile list/detail reads continue to omit proxy credentials and captured session state.

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
3. It checks out the specified profile through `POST /collector/profiles/:profileId/exercise-checkout`, which creates an `AMBIENT_EXERCISE` lease.
4. It fetches trusted runtime configuration from `GET /collector/profile-leases/:leaseId/runtime-configuration`.
5. The selected browser provider opens a headed browser with the profile runtime configuration it can honor.
6. The browser visits `https://www.facebook.com/`.
7. The command performs only read-only dwell and light scroll actions within the action budget.
8. It records only safe booleans/counts such as page loaded, login required, checkpoint detected, scroll count, duration, and lease released.
9. It marks the exercise run `SUCCEEDED` or `FAILED` with sanitized failure data.
10. The profile lease is released even when browser launch, navigation, or safe-state detection fails.

Exercise checkout eligibility:

- Normal collection checkout still requires `accountStage = COLLECTION_READY`.
- Ambient exercise checkout allows `NEW_ACCOUNT`, `WARMING`, `LIMITED`, and `COLLECTION_READY`.
- Ambient exercise checkout rejects `NEEDS_REVIEW` and `RETIRED`.

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
8. The existing Playwright network response listener remains enabled as secondary capture and diagnostics.
9. Captured page-context and network-listener payloads are deduplicated in memory and passed to the existing Facebook GraphQL extractor.
10. Normalized candidates are submitted to Content Manager through `POST /collector/content-items` using the same `sourceGroupId`.
11. The profile lease is released even when capture, extraction, or submission fails.

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

CloakBrowser is optional. If it is not installed or does not expose a supported launch/context/page API locally, the probe should fail with sanitized setup guidance and the collector should continue to use Playwright by default.

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

Current limitations:

- One profile.
- One Facebook group URL.
- One browser session.
- No scheduler, multi-group run, multi-profile run, Web UI trigger, source group selection UI, automatic group discovery, retry policy, stuck-run recovery, heartbeat, or worker lease.
- Zero page-context and network captures can happen if Facebook does not return matching JSON responses during the stop window, the group is inaccessible, the profile is redirected to login or checkpoint, the page has not loaded enough feed content, or Facebook changes response shapes.
- Non-zero captures with zero extracted candidates means the collector saw JSON payloads, but the current extractor did not find supported post candidates in those payloads.
- A profile shown as `READY` is not always checkout-eligible. Checkout also requires `accountStage = COLLECTION_READY` and can still be blocked by temporal routine windows, cooldowns, daily safety thresholds, or an existing lease/BUSY state.
- `NO_ELIGIBLE_PROFILE_AVAILABLE` can also happen when the CLI `--base-url` points to a different API/database than the Web UI. For preview stack testing, prefer `--base-url http://localhost:8081`; use `--base-url http://localhost:3000` only for the direct API stack.

Safety boundaries:

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
