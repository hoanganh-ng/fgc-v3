# Full-Stack Runtime

Sprint 027 provides two Docker Compose runtimes for the current Content Collector management surface.

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
pnpm profile:provision -- --token <provisioning-token> --base-url http://localhost:8081
```

Run the CLI against the direct local API:

```bash
pnpm profile:provision -- --token <provisioning-token> --base-url http://localhost:3000
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

## Manual Facebook Collector Command

Sprint 032 added a manual/dev operator command for one Facebook group run using one existing `READY` profile. Sprint 034A makes `sourceGroupId` the normal source of truth for the group URL.

Prerequisites:

1. Start the dev or preview stack.
2. Complete profile provisioning so at least one profile is `READY`.
3. Ensure Content Manager has an `ACTIVE` Facebook source group record for the target Facebook group.
4. Copy the `sourceGroupId` from the Web UI Source Groups page.

Run against the preview gateway:

```bash
pnpm collector:facebook:run -- --source-group-id <source-group-id> --base-url http://localhost:8081 --max-scrolls 3 --max-duration-ms 30000
```

Use the preview gateway (`http://localhost:8081`) when running against the preview stack. This matches the Web UI entrypoint and lets Nginx proxy `/collector/*` to the API.

Run against the direct local API:

```bash
pnpm collector:facebook:run -- --source-group-id <source-group-id> --base-url http://localhost:3000
```

Use the direct API URL (`http://localhost:3000`) when you are running the API directly or intentionally bypassing the preview gateway. A base URL mismatch can make the CLI talk to a different API/database than the Web UI.

If `--base-url` is omitted, the command uses `COLLECTOR_FACEBOOK_BASE_URL`, then `PROFILE_MANAGER_BASE_URL`, then `CONTENT_MANAGER_BASE_URL`, then `http://localhost:3000`.

`--group-url` is only a development override. When it is provided, the CLI still requires `--source-group-id`, resolves and validates the stored source group first, then prints a warning before opening the override URL instead of the stored source URL.

Optional checkout diagnostics:

```bash
pnpm collector:facebook:run -- --source-group-id <source-group-id> --base-url http://localhost:8081 --diagnose-checkout
```

Diagnostic mode prints only safe aggregate profile status counts: total profiles, `READY`, `BUSY`, `PENDING_LOGIN`, and `PENDING_CONFIG`.

Expected operator flow:

1. The command resolves the source group through `GET /collector/source-groups/:sourceGroupId`.
2. It verifies the source group exists, uses platform `FACEBOOK`, is `ACTIVE`, and has a Facebook group URL before browser launch.
3. The command checks out one eligible `READY` profile through `POST /collector/profiles/checkout`.
4. It fetches trusted runtime configuration from `GET /collector/profile-leases/:leaseId/runtime-configuration`.
5. A headed Chromium browser opens with the profile cookies, localStorage, browser fingerprint, locale/language, timezone, viewport, and proxy settings where Playwright supports them.
6. The browser visits the stored Facebook group URL, unless `--group-url` was provided as a development override.
7. The adapter captures in-memory JSON responses whose URL contains `/api/graphql`.
8. Captured payloads are passed to the existing Facebook GraphQL extractor.
9. Normalized candidates are submitted to Content Manager through `POST /collector/content-items` using the same `sourceGroupId`.
10. The profile lease is released even when capture, extraction, or submission fails.

The safe summary prints counts only:

- Lease released yes/no.
- GraphQL responses captured.
- Extractor candidates produced.
- Content items submitted.
- Failed submissions.
- Warning count.
- Duration in milliseconds.

Current limitations:

- One profile.
- One Facebook group URL.
- One browser session.
- No scheduler, queue, `collection_runs` table, multi-group run, multi-profile run, Web UI trigger, source group selection UI, or automatic group discovery.
- Zero captured GraphQL responses or zero extracted candidates can happen if Facebook changes response shapes, the group is inaccessible, the page redirects to login, or no supported post payloads load during the stop window.
- A profile shown as `READY` is not always checkout-eligible. Checkout can still be blocked by temporal routine windows, cooldowns, daily safety thresholds, or an existing lease/BUSY state.
- `NO_ELIGIBLE_PROFILE_AVAILABLE` can also happen when the CLI `--base-url` points to a different API/database than the Web UI. For preview stack testing, prefer `--base-url http://localhost:8081`; use `--base-url http://localhost:3000` only for the direct API stack.

Safety boundaries:

- The command does not automate credentials, solve CAPTCHAs, use stealth plugins, bypass access controls, bypass rate limits, post, comment, like, or persist raw payloads.
- Captured GraphQL responses stay in memory and are not written to disk.
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
pnpm --filter @fgc/web build
```
