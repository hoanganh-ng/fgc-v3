# Sprint 051 - Queued Profile-Source Access Check Worker

## Goal

Implement atomic claiming and browser-backed execution for queued
Profile-Source Access Check Runs while keeping browser execution, outcome
classification, and Profile-Source Access mutation separated behind Collector
Runtime application-owned ports.

## Scope

- [x] Add check-run `outcome` support with lifecycle invariants:
  - `SUCCEEDED` requires an outcome and no failure reason.
  - `FAILED` requires a failure reason and no outcome.
  - `QUEUED`, `RUNNING`, and `CANCELED` contain neither.
- [x] Persist nullable check-run outcome through Drizzle schema, mapper,
  repository, HTTP DTOs, and migration.
- [x] Add `claimNextQueued(startedAt)` for Profile-Source Access Check Runs
  using `FOR UPDATE SKIP LOCKED` in PostgreSQL and deterministic in-memory
  behavior in tests.
- [x] Add `ClaimNextProfileSourceAccessCheckRunUseCase`.
- [x] Add Collector Runtime application ports for browser check, outcome
  classification, and Profile-Source Access mutation.
- [x] Add `ExecuteProfileSourceAccessCheckRunUseCase`.
- [x] Add a browser-backed check adapter that uses assisted group access
  checkout, lease-scoped runtime configuration, the selected browser provider,
  the frozen run target URL, browser close, and lease release.
- [x] Add deterministic outcome classification.
- [x] Add a Profile Manager HTTP mutation adapter with fixed safe failure
  mappings, including `NEEDS_MANUAL_REVIEW -> ACCESS_CHECK_INCONCLUSIVE`.
- [x] Add a separate operator worker command:
  - `pnpm operator:profile-source-access-check-worker`
  - `pnpm profile-source-access-check-worker:run`
- [x] Support `--base-url`, `--browser-provider`, `--poll-interval-ms`,
  `--once`, and `--help`.
- [x] Update project, runtime, module-boundary, active sprint, and README
  documentation.

## Out Of Scope

- Redis, BullMQ, or generic worker abstractions.
- Automatic retries, stale `RUNNING` recovery, worker heartbeats, or worker
  leases.
- Web UI changes.
- Docker Compose services.
- New lease purposes.
- Account-stage mutation.
- Group joining or other Facebook write actions.
- CAPTCHA or checkpoint bypass.
- Content collection or network payload capture.
- Raw browser evidence storage.
- Collection or account-exercise worker semantic changes.
- Public lifecycle routes.
- Commits or pushes.

## Verification

- [x] `pnpm typecheck`
- [x] `pnpm test`
- [x] `pnpm web:typecheck`
- [x] `pnpm web:build`
- [x] `pnpm operator:profile-source-access-check-worker -- --help`
- [x] `pnpm profile-source-access-check-worker:run -- --help`
- [x] `git diff --check`

Database-backed checks remain conditional on `DATABASE_URL`; it was absent in
the implementation environment.
