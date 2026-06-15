# Sprint 047: Queued Ambient Exercise Worker

## Goal

Add a PostgreSQL-backed worker for queued Ambient Account Exercise runs so
operator-requested `QUEUED` runs can execute outside the Web UI request path.

Sprint 046 lets operators create queued runs from the Web UI. Sprint 047 adds a
separate account-exercise worker process that claims those runs, checks out the
persisted profile for `AMBIENT_EXERCISE`, uses the persisted action budget, runs
the existing read-only browser exercise flow, releases the lease, and records
only safe summaries or sanitized failures.

## Scope

- Add atomic `claimNextQueued` behavior to `AccountExerciseRunRepository`.
- Implement in-memory/test and Drizzle repository claiming.
- PostgreSQL claiming must use row locking with `FOR UPDATE SKIP LOCKED`.
- Claim ordering is deterministic oldest-first:
  `requestedAt ASC`, `createdAt ASC`, `id ASC`.
- Add `ClaimNextAccountExerciseRunUseCase`.
- Add a focused operation for attaching a lease id to an already `RUNNING`
  account exercise run.
- Reject replacing an existing different lease id.
- Reuse the existing Ambient Account Exercise browser flow for already-running
  persisted runs.
- Preserve the one-shot `operator:profile:exercise` command by making it create
  and start exactly one run, then delegate to the shared executor.
- Add a separate account exercise worker command:

```bash
pnpm operator:profile:exercise-worker
```

- Add alias:

```bash
pnpm profile:exercise-worker:run
```

- Support `--base-url`, `--browser-provider`, `--poll-interval-ms`, `--once`,
  and `--help`.
- Once mode claims and executes at most one run.
- Polling mode continues after individual run failures and stops safely on
  `SIGINT` or `SIGTERM`.
- Reuse existing Profile Manager HTTP contracts, browser-provider boundary, safe
  summaries, sanitized failures, and terminal transition use cases.
- Always attempt browser close and lease release.

## Out Of Scope

- Collection worker semantic changes
- Redis, BullMQ, schedulers, or generic job abstractions
- New exercise types
- Web UI changes
- Docker Compose services
- Automatic account-stage changes
- Content submission
- Interactive Facebook actions
- Group joining, posting, commenting, liking, sharing, messaging
- CAPTCHA solving, checkpoint bypass, rate-limit bypass, credential automation
- Commits or pushes

## Safety Boundaries

The worker must not log, return, or persist:

- cookies
- localStorage contents
- proxy credentials
- trusted runtime configuration
- browser fingerprint secrets
- raw Facebook payloads
- raw page HTML
- screenshots
- session headers or authorization material

Worker output should remain limited to safe lifecycle lines, run ids, counts,
safe summary fields, lease-release status, and sanitized `{code,message}`
failures.

## Verification

Run:

- `pnpm typecheck`
- `pnpm test`
- `pnpm operator:profile:exercise-worker -- --help`
- `pnpm profile:exercise-worker:run -- --help`
- `git diff --check`
- `pnpm test:db` when `DATABASE_URL` is available
- `pnpm test:http:db` when `DATABASE_URL` is available

Targeted tests should cover:

- atomic oldest-first claim behavior
- transition timestamps
- concurrent claim safety
- lease attachment invariants
- once and polling worker behavior
- checkout and browser failures
- browser close and lease cleanup
- persisted action-budget usage
- CLI parser regression
- sensitive-log exclusion

Manual checks:

1. Start the API and PostgreSQL stack.
2. Create or request an Ambient Account Exercise run through the Web UI or API.
3. Confirm the run is `QUEUED`.
4. Run:

```bash
pnpm operator:profile:exercise-worker -- --base-url http://localhost:8081 --once
```

5. Confirm the oldest queued run is claimed and becomes `RUNNING`.
6. Confirm the browser exercise uses the run's persisted `profileId` and
   `actionBudget`.
7. Confirm the profile lease is released even when checkout, browser launch,
   navigation, or safe-state detection fails.
8. Confirm the run finishes `SUCCEEDED` or `FAILED` with only safe summary or
   sanitized failure data.
9. Confirm the collection worker still behaves as before.
