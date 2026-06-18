# Testing Strategy

Sprint 062 defines the cross-cutting testing strategy used by every
sprint in the feed discovery sequence (063A–068). The strategy is
authoritative for new work; existing sprints are not retroactively
changed by this document.

The strategy is layered. Each layer has a clear owner, a clear scope,
and a clear failure mode. Layers build on top of each other: a failure
in a lower layer must be reproduced and fixed in that layer before the
higher layer can attribute the failure correctly.

## Layer 1 — Unit Tests

- Runner: Vitest (`pnpm test`).
- Scope: pure functions, view-model helpers, domain logic, schema
  parsing, HTTP route handlers with stub services, React component
  behavior with React Testing Library.
- No databases, no Docker, no network. No real Facebook.
- Speed budget: full suite under a few minutes on a developer machine.
- Owner: every sprint that touches a domain, application, route
  handler, view model, or React component.

## Layer 2 — Database Integration Tests

- Runner: Vitest with `RUN_DB_TESTS=true` (`pnpm test:db`).
- Scope: Drizzle repository adapters against a real PostgreSQL
  instance, exercised through the existing Sprint 057 / Sprint 058
  atomic dispatch fixtures and isolation helpers.
- Database: a developer-managed test database reachable through
  `DATABASE_URL` (or `SPRINT_058_DATABASE_URL` for Sprint 058 atomic
  dispatch tests). The repository layer applies migrations and resets
  state per spec.
- No HTTP server, no browser, no real Facebook.
- Owner: every sprint that adds or changes a repository adapter,
  schema, migration, or atomic transition.

## Layer 3 — HTTP Integration Tests

- Runner: Vitest with `RUN_HTTP_DB_TESTS=true` (`pnpm test:http:db`).
- Scope: full Fastify request lifecycle against the in-memory test
  support services (`src/interfaces/http/test-support/...`) plus, for
  selected specs, a real PostgreSQL instance behind the same
  application use cases.
- Verifies routing, body validation, status codes, error mapping,
  DTO mapping, and the safe-read contract.
- No browser, no real Facebook.
- Owner: every sprint that adds or changes HTTP routes, DTOs, or
  request/response schemas.

## Layer 4 — Docker End-to-End Tests

- Runner: Playwright in the `e2e-runtime` Docker image (`pnpm test:e2e:docker`,
  with `pnpm test:e2e:container` as the in-container command).
- Scope: end-to-end flows through the production-like stack
  (`postgres`, `api`, `web-gateway`, and the E2E runner) using only
  synthetic fixtures. No workers, schedulers, or exercise workers run
  inside the E2E stack.
- Stack isolation: the harness uses its own Compose project
  (`fgc-v3-e2e`), its own named volume (`fgc_e2e_postgres_data`), and
  its own network. It never publishes a host port, never reuses dev or
  preview volumes, and never touches dev or preview resources.
- Readiness: `postgres` is gated by `pg_isready`; `api` is gated by a
  Compose healthcheck that polls the existing `GET /health` route;
  the E2E runner polls `http://web-gateway/` until it returns the
  React app HTML. The harness uses no `waitForTimeout` for navigation
  correctness inside the spec; navigation uses `expect.poll`.
- Cleanup: the host driver traps `EXIT INT TERM` and always runs
  `docker compose -p fgc-v3-e2e -f docker-compose.e2e.yml down -v
  --remove-orphans`. Cleanup runs on success, failure, and interruption.
- Logs: on non-zero exit, the host driver prints
  `docker compose logs --no-color` for `api`, `web-gateway`, and
  `e2e-runner`. The driver never prints `DATABASE_URL` or any
  environment value.
- Security: no Facebook connection; no real sessions, cookies,
  localStorage, tokens, proxies, account IDs, or payloads. Fixtures
  are deterministic strings.
- Owner: Sprint 062 introduces the harness; every sprint that adds or
  changes a top-level flow that crosses Nginx → API → database adds
  one focused spec.

## Layer 5 — Manual Live-Facebook Validation

- Operator-driven. Never automated. Never part of CI.
- Scope: confirms that a real Facebook login, a real navigation, and a
  real capture still behave as expected against the live platform.
- Operator tools: `pnpm operator:profile:provision`,
  `pnpm operator:profile:exercise`,
  `pnpm operator:profile:assisted-access`,
  `pnpm operator:collector:facebook`,
  `pnpm operator:collector:worker`, and the corresponding `--once`
  worker invocations.
- Sandbox: a developer-managed real Facebook account with the
  Facebook app and a configured proxy. The operator collects
  safe summary counts only; the operator never logs raw payloads,
  cookies, localStorage, proxy credentials, or session headers.
- Owner: Sprint 046 introduced manual live-Facebook validation; every
  sprint that changes browser provider behavior or page-state
  observation documents the manual validation step it added.

## Layer Ordering

When a failure happens, the Builder fixes the lowest failing layer
first:

1. Unit test fails → fix the helper, domain rule, schema, or component.
2. Database test fails → fix the repository adapter, schema, migration,
   or atomic transition.
3. HTTP integration test fails → fix the route handler, DTO mapper,
   error mapper, or request/response schema.
4. Docker E2E fails → fix the production-like surface (Nginx, API,
   database) only after Layers 1–3 are green.
5. Manual live-Facebook validation fails → file a separate report; this
   is expected to surface drift that requires a follow-up sprint.

## Acceptance Gates

The change being made determines which layers must pass before the
sprint can be marked complete. These gates are mandatory; skipping a
layer is a sprint-scope violation.

- **Domain or application changes** (new domain rules, application
  use cases, value objects, ports, view-model helpers, schema
  parsing): unit tests. A sprint that only touches these layers does
  not need to extend the database, HTTP, Docker E2E, or manual
  live-Facebook layers.
- **Persistence, migration, or concurrency changes** (new Drizzle
  schema, new migration, repository adapter, mapper, unique
  constraint, atomic upsert, lease or run state transition): unit
  tests plus Layer 2 (database integration). Concurrency changes
  also require explicit contention coverage in the database
  integration layer.
- **HTTP contract changes** (new route, new DTO, request/response
  schema change, error mapping change): unit tests, Layer 3 (HTTP
  integration), and a focused Layer 4 (Docker E2E) spec that proves
  the route through Nginx, the API, and the database. Sprint 063C
  follows this gate for the `SourcePublisher` observation, list, and
  get HTTP contracts; the Layer 4 spec is
  `tests/e2e/source-publisher-http.spec.ts`, which exercises the
  flow through `http://web-gateway` only, asserts that every
  response is a safe allowlist (no raw payloads, sessions, tokens,
  proxies, viewer IDs, account IDs, or diagnostic data), and
  creates and owns its own synthetic fixtures independent from
  `tests/e2e/stack-baseline.spec.ts`.
- **Web UI or top-level product flows** (new page, new form, new
  navigation entry, new product flow that crosses Nginx → API →
  database): Layer 4 (Docker E2E). The Web UI's accessible
  selectors, not `data-testid`, are the source of the E2E
  assertions.
- **Real Facebook or browser-behavior changes** (new page-state
  observer, new extraction rule that runs against captured
  Facebook payloads, new browser-bound run lifecycle, new
  sponsored-content or personal-profile exclusion, new
  publisher-identity derivation): opt-in manual live-Facebook
  validation only after Layers 1–4 are green. A sprint that changes
  real Facebook or browser behavior does not claim success on
  synthetic fixtures alone.

A sprint that adds, removes, or renames a public API surface, a
schema, a migration, or a top-level flow must update this document
and the affected layers' specs in the same sprint.

## Non-Goals

The strategy does not authorize:

- Replacing manual live-Facebook validation with automated tests
  against the real Facebook platform.
- Running the Docker E2E harness against the dev or preview databases.
- Sharing state between the E2E harness and any other stack.
- Logging raw payloads, cookies, localStorage, proxy credentials, or
  environment values from any test layer.
- Adding CAPTCHA solving, checkpoint bypass, credential automation,
  rate-limit bypass, group joining, posting, commenting, liking,
  sharing, or messaging in any layer.

## Test Identifiers

The strategy prefers accessible selectors (`getByRole`, `getByLabel`,
`getByText`) over `data-testid`. A `data-testid` is added only when no
stable accessible selector exists. The schedules page and source-groups
page already expose stable accessible selectors for the forms and lists
the E2E spec exercises.