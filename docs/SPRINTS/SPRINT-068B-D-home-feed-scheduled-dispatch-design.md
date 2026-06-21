# Sprint 068B-D: Home-Feed Scheduled Dispatch Design

## Goal

Design scheduled dispatch of durable
`ProfileHomeFeedCollectionSchedule` rows into queued, profile-bound
`ProfileHomeFeedCollectionRun` records.

This sprint is documentation-only. It does not implement runtime
behavior, add migrations, add trigger enum values, add dispatch
repositories, change pollers or workers, add Docker services, add
browser code, add Web UI behavior, or expose execution routes. Manual
live-Facebook validation remains separate from this design.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/ROADMAP.md`
- `docs/modules/collector-runtime.md`
- `docs/SPRINTS/SPRINT-058-atomic-scheduled-collection-dispatch.md`
- `docs/SPRINTS/SPRINT-059-scheduled-collection-dispatch-poller.md`
- `docs/SPRINTS/SPRINT-065B-profile-bound-home-feed-run-model.md`
- `docs/SPRINTS/SPRINT-065C3-bounded-facebook-home-feed-execution.md`
- `docs/SPRINTS/SPRINT-068A-profile-home-feed-schedule-foundation.md`
- `src/collector-runtime/domain/profile-home-feed-collection-run*`
- `src/collector-runtime/domain/profile-home-feed-collection-schedule*`
- `src/collector-runtime/application/use-cases/request-profile-home-feed-collection-run.use-case.ts`
- `src/collector-runtime/application/ports/profile-reference.port.ts`
- `src/collector-runtime/application/ports/profile-home-feed-collection-schedule-repository.port.ts`
- `src/collector-runtime/application/ports/profile-home-feed-collection-run-repository.port.ts`
- `src/collector-runtime/domain/collection-schedule-cadence.ts`
- `src/infrastructure/database/repositories/drizzle-dispatch-next-due-collection-schedule.repository.ts`
- `src/operator-tools/collection-scheduler/**` as a scheduler-loop pattern
  reference only

## Scope Boundaries

- Do not reuse `DispatchNextDueCollectionScheduleUseCase` for home-feed
  schedules.
- Do not create fake `SourceGroup` rows for home-feed schedules or runs.
- Do not generalize source-group `CollectionRun` into home-feed runs.
- Do not call Profile Manager from inside a PostgreSQL transaction.
- Do not connect dispatch to browser execution. The existing one-shot
  home-feed runner remains the execution boundary.
- Do not add a scheduler process or Docker service in this design sprint.

## Design Decisions

### 1. Dispatch ownership and name

Collector Runtime owns scheduled home-feed dispatch.

The future implementation should add a separate application use case:

```text
DispatchNextDueProfileHomeFeedCollectionScheduleUseCase
```

It should use a separate application-owned port, tentatively:

```text
DispatchNextDueProfileHomeFeedCollectionScheduleRepositoryPort
```

The use case owns the orchestration policy: get the current time, choose
one due profile-home-feed schedule candidate, handle profile-reference
lookup, generate a run id, and ask the repository to perform the final
compare-and-set dispatch or skip operation.

The repository owns only persistence and atomicity. It must not call
Profile Manager, Content Manager, browser adapters, workers, or HTTP
clients.

The result type should distinguish:

- `DISPATCHED` - one queued `ProfileHomeFeedCollectionRun` was created.
- `SKIPPED_ACTIVE_RUN` - a queued or running run already exists for the
  same profile and the due boundary was skipped.
- `PROFILE_NOT_FOUND` - the schedule references a missing profile and
  was disabled.
- `PROFILE_LOOKUP_FAILED` - Profile Manager could not be safely queried;
  the schedule remains due but is temporarily backed off.
- `RACE_LOST` - another dispatcher changed or locked the candidate first.
- `NO_DUE_SCHEDULE` - no eligible due schedule is available.

This distinction matters because a poller should continue draining after
skip/race outcomes, but should stop the cycle on `NO_DUE_SCHEDULE`.

### 2. Future `SCHEDULED` trigger

The future implementation sprint should add `SCHEDULED` to
`ProfileHomeFeedCollectionRunTriggerType`.

Scheduled home-feed runs should not be recorded as `MANUAL_API`.
`MANUAL_API` means an operator or API caller requested the run directly;
`SCHEDULED` means the run was produced by the schedule dispatcher.

The implementation sprint should update:

- `PROFILE_HOME_FEED_COLLECTION_RUN_TRIGGER_TYPES`
- `ProfileHomeFeedCollectionRunTriggerTypeSchema`
- the PostgreSQL enum
  `profile_home_feed_collection_run_trigger_type`
- mappers, HTTP DTO validation, and tests that currently expect only
  `MANUAL_API`

No enum change or migration is part of Sprint 068B-D.

### 3. Due schedule selection order

The due candidate query should consider only schedules that are:

- `enabled = true`
- `next_run_at <= dispatchAt`
- not currently held by a retry/backoff delay after a transient lookup
  failure

Ordering must be deterministic:

```text
next_run_at ASC, profile_id ASC
```

This matches the source-group dispatcher pattern while keeping the
home-feed schedule identity as `profileId`.

Candidate selection must not hold a row lock across Profile Manager
lookup. The final persistence operation must re-check that the same
schedule is still enabled, due, and at the expected `nextRunAt` before
it inserts or skips.

### 4. Cadence advancement rule

Successful dispatch advances from the schedule's previous `nextRunAt`,
not from wall-clock "now".

For a schedule due at `previousNextRunAt`, with `intervalMinutes`, and
dispatch time `dispatchAt`, the next boundary is:

```text
nextDispatchBoundary(previousNextRunAt, intervalMinutes, dispatchAt)
```

That is the first cadence boundary strictly after `dispatchAt`, using
the existing pure cadence policy from `collection-schedule-cadence.ts`.

The queued run should record:

- `triggerType = "SCHEDULED"`
- `status = "QUEUED"`
- `requestedAt = previousNextRunAt`
- `createdAt = dispatchAt`
- `updatedAt = dispatchAt`
- the schedule's configured home-feed run parameters
- strict target `{ platform: "FACEBOOK", surface: "PROFILE_HOME_FEED" }`
- `accountStageAtRequest` from the Profile Manager lookup performed
  immediately before the final CAS dispatch

An active-run skip also advances `nextRunAt` to the first boundary
strictly after `dispatchAt`; the due boundary is intentionally skipped
instead of retried immediately.

### 5. Missed interval behavior

Missed intervals must not burst.

One `execute()` call may create at most one queued home-feed run for one
due schedule, no matter how many cadence intervals were missed. After a
successful dispatch, the schedule jumps to the first boundary after
`dispatchAt`.

If a transient Profile Manager lookup failure occurs, the cadence is not
advanced because no dispatch decision was safely made. The schedule
keeps its due `nextRunAt`, records the failed attempt, and is excluded
from immediate retry until the backoff window expires. Once lookup
recovers, a single run is created for the outstanding due boundary and
the schedule then jumps forward.

### 6. Active queued or running run behavior

The existing partial unique index on
`profile_home_feed_collection_runs(profile_id)` where status is
`QUEUED` or `RUNNING` remains the hard guard.

The dispatcher must not cancel, replace, update, or execute an active
run. If a due schedule targets a profile that already has a queued or
running home-feed run, the dispatcher should:

- create no new run
- advance the schedule to the next cadence boundary after `dispatchAt`
- record `lastDispatchStatus = "SKIPPED_ACTIVE_RUN"`
- clear any transient failure reason for the schedule
- return a skip result so the poller can continue draining other due
  schedules

This prevents hot loops and prevents scheduled runs from piling up
behind a long-running or manually queued home-feed run.

### 7. Profile reference and account-stage lookup timing

Sprint 068A validates profile existence when a schedule is created or
updated. Dispatch must still re-check the profile because schedules can
outlive profile records and account stages.

The future use case should perform lookup in this order:

1. Select one due schedule candidate from Collector Runtime storage.
2. Optionally perform a local active-run skip check before any external
   lookup.
3. Call `ProfileReferencePort.getProfileAccountStage(profileId)` outside
   any database transaction.
4. Reject mismatched returned profile ids as
   `PROFILE_REFERENCE_LOOKUP_FAILED`.
5. Pass the returned `accountStage` into the final CAS dispatch so it is
   persisted as `accountStageAtRequest`.

Dispatch does not perform checkout eligibility checks and does not
change account stage. Checkout remains the execution use case's job.

### 8. PostgreSQL atomicity requirements

The successful final dispatch must be atomic in PostgreSQL:

1. Lock the expected schedule row by `profile_id` and expected
   `next_run_at`.
2. Re-check `enabled = true` and `next_run_at <= dispatchAt`.
3. Check that no queued or running home-feed run exists for that
   `profileId`.
4. Insert one `QUEUED` `SCHEDULED`
   `ProfileHomeFeedCollectionRun`.
5. Advance the schedule's `next_run_at`.
6. Update schedule dispatch tracking columns.

If any step fails, no partial run or partial schedule advance should
commit.

The active-run skip must also be atomic:

1. Lock the expected schedule row.
2. Confirm the schedule is still due.
3. Confirm an active run exists for the same profile.
4. Advance the schedule and record the skip status in the same
   transaction.

Profile-not-found and transient-lookup outcomes should update the
schedule with a CAS condition on the expected `profile_id` and
`next_run_at`, so stale candidates do not overwrite newer schedule
state.

### 9. Work outside database transactions

The following must stay outside PostgreSQL transactions:

- Profile Manager calls through `ProfileReferencePort`
- browser launch, capture, page interaction, and payload parsing
- Content Manager calls
- profile checkout and lease release
- scheduler sleeps, signal handling, and logging
- Docker/runtime composition
- external retry delays

The transaction may call pure, deterministic local code such as the
cadence boundary policy, but must not perform network or browser I/O.

### 10. Retry, backoff, and skip behavior

`active run conflict`

- Treat as an operational skip, not a failure.
- Advance `nextRunAt` to the next cadence boundary.
- Set `lastDispatchStatus = "SKIPPED_ACTIVE_RUN"`.
- Clear `lastFailureReason`.
- Do not increment `consecutiveFailures`.

`profile not found`

- Treat as permanent until operator intervention.
- Disable the schedule with an atomic CAS update.
- Set `lastDispatchStatus = "PROFILE_NOT_FOUND"`.
- Store a sanitized `lastFailureReason` such as
  `{ code: "PROFILE_NOT_FOUND", message: "Profile not found." }`.
- Do not create a run and do not retry while disabled.

`Profile Manager transient lookup failure`

- Treat as retryable.
- Do not advance `nextRunAt`.
- Set `lastAttemptedAt = dispatchAt`.
- Set `lastDispatchStatus = "PROFILE_LOOKUP_FAILED"`.
- Store only a sanitized failure code/message and optional safe status
  code. Do not store raw upstream response bodies or exception text.
- Increment `consecutiveFailures`.
- Exclude the schedule from due selection until a deterministic capped
  backoff window expires. The implementation sprint should use a
  no-jitter policy so tests are deterministic, for example
  `1m, 2m, 4m, 8m, 15m cap`.

`duplicate or racing dispatcher`

- If another dispatcher advances or locks the candidate first, return
  `RACE_LOST`.
- Do not record a failure, do not increment failure counters, and do
  not advance cadence from the losing dispatcher.
- If a manual or scheduled run appears between checks, the final CAS
  path should classify it as an active-run skip when it can do so
  atomically. Otherwise the next polling cycle will observe the active
  run and skip safely.

### 11. Sprint 068A schema sufficiency

Sprint 068A's schema is not enough for robust scheduled dispatch.

The existing columns store schedule configuration only:

- `profile_id`
- `enabled`
- `interval_minutes`
- `next_run_at`
- `parameters`
- `created_at`
- `updated_at`

The implementation sprint should add dispatch tracking columns before
poller integration:

- `last_attempted_at TIMESTAMPTZ NULL`
- `last_dispatch_status TEXT NULL` or a small checked enum-like field
- `last_failure_reason JSONB NULL`, containing only a sanitized
  `{ code, message }` shape and optional safe status code
- `consecutive_failures INTEGER NOT NULL DEFAULT 0`

These columns are needed to avoid hot loops, distinguish skipped
cadence boundaries from successful dispatch, expose safe operator
diagnostics, and support deterministic transient-failure backoff
without overloading `next_run_at`.

The initial implementation does not need to store raw upstream errors,
profile details, cookies, browser diagnostics, or payload data.

### 12. Scheduler poller integration plan

Do not create a separate profile-home-feed scheduler process as the
first choice.

The preferred future plan is one combined polling loop in the existing
`collection-scheduler` process, with two separate dispatch
dependencies:

- source-group dispatch:
  `DispatchNextDueCollectionScheduleUseCase`
- profile-home-feed dispatch:
  `DispatchNextDueProfileHomeFeedCollectionScheduleUseCase`

This reuses the existing lightweight scheduler process and signal/
delay/close lifecycle while keeping source-group and home-feed
dispatch use cases separate.

The combined runner should drain both dispatch dependencies during a
cycle. It must log the schedule kind so operators can distinguish
source-group scheduled runs from profile-home-feed scheduled runs.

The implementation should not fake source-group schedules, should not
make home-feed dispatch depend on `CollectionRun`, and should not add
browser execution to the scheduler. Execution remains with the
home-feed runner/worker boundary.

### 13. Observability and safe logging

Dispatch observability should be safe and low-cardinality:

- count dispatched runs
- count skipped active-run boundaries
- count profile-not-found disables
- count transient profile lookup failures
- count race-lost outcomes
- log schedule type, `profileId`, run id when created, outcome kind,
  and sanitized error code

Logs must not include:

- Profile Manager raw response bodies
- raw exception messages from upstream services
- cookies, localStorage, tokens, authorization headers, proxy
  credentials, or trusted runtime configuration
- browser payloads, raw HTML, screenshots, viewer data, or Facebook
  private payloads

Schedule status fields should contain sanitized dispatch outcomes, not
execution summaries. Browser execution failures belong to the
`ProfileHomeFeedCollectionRun` terminal failure fields.

### 14. Security constraints

Scheduled dispatch is a queueing operation only.

It must not:

- automate Facebook login, checkpoint bypass, group joining, posting,
  commenting, liking, sharing, or messaging
- run browser code
- expose profile secrets, proxy details, fingerprint values, cookies,
  tokens, localStorage, raw GraphQL, raw HTML, screenshots, or viewer
  data
- create or mutate Content Manager records
- mutate Profile Manager account stage
- weaken profile checkout or lease rules
- create fake `SourceGroup` rows

The only cross-module data needed at dispatch time is the safe profile
reference result: matching `profileId` and `accountStage`.

### 15. Proposed implementation sprint split

Recommended follow-up split after this design:

1. `Sprint 068B1 - Home-Feed Scheduled Dispatch Persistence`
   - Add the `SCHEDULED` home-feed run trigger enum value and
     migration.
   - Add schedule dispatch tracking columns.
   - Add domain/application validation for new trigger and tracking
     fields.
   - Add the application use case and repository port.
   - Add the Drizzle CAS dispatch adapter and focused unit/integration
     tests.
   - Do not change scheduler processes, workers, Docker, browser
     execution, Web UI, or execution routes.

2. `Sprint 068B2 - Home-Feed Scheduler Poller Integration`
   - Extend the existing collection scheduler runner into a combined
     polling loop with separate source-group and profile-home-feed
     dispatch dependencies.
   - Add CLI/runner tests for mixed dispatch outcomes, skip outcomes,
     shutdown, and safe logging.
   - Keep execution outside the scheduler.
   - Add Docker or deployment changes only if the sprint explicitly
     authorizes them.

3. `Sprint 068B3 - Scheduled Home-Feed Operational Review`
   - Optional, only if operators need read surfaces for dispatch status
     fields after the persistence and poller work.
   - Keep browser/live-Facebook validation separate unless explicitly
     authorized.

## Verification

Sprint 068B-D verification is documentation review only:

```bash
git diff --check
```

Run markdown or link checks only if existing repository scripts support
them.

## Status

Sprint 068B-D is **active and authorized**.

It is design-only and is **not accepted**.
