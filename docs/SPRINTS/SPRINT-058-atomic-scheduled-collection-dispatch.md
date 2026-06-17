# Sprint 058: Atomic Scheduled Collection Dispatch

## Goal

Atomically convert at most one enabled due `CollectionSchedule` into one queued
`SCHEDULED` `CollectionRun` and advance that schedule to its next cadence
boundary. Sprint 057 introduced the persisted schedule; Sprint 058 makes it
operationally meaningful by providing an atomic, concurrency-safe dispatch
operation while leaving the polling trigger (a future scheduler) out of scope.

## Capability Summary

- A pure, inward-facing cadence policy anchored to the schedule's previous
  `nextRunAt` computes the next dispatch boundary as the first cadence
  boundary strictly after the dispatch timestamp.
- Missed intervals never burst: a single `dispatchNextDue` call inserts at
  most one `CollectionRun` regardless of how many intervals were missed.
- The dispatch runs in a single PostgreSQL transaction:
  1. `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` from
     `collector_collection_schedules` ordered by `next_run_at ASC,
     source_group_id ASC`, filtered by `enabled = true` and
     `next_run_at <= dispatchAt`.
  2. INSERT into `collector_collection_runs` with
     `status = 'QUEUED'`, `trigger_type = 'SCHEDULED'`,
     `requested_at = previous nextRunAt`,
     `created_at = updated_at = dispatchAt`, no started/finished/summary/
     failure columns.
  3. UPDATE `collector_collection_schedules` advancing `next_run_at` to the
     cadence boundary and bumping `updated_at` to `dispatchAt`.
- Any failure rolls back the entire operation; no partial state is committed.
- Concurrency: multiple dispatchers safely share due schedules. Each racing
  transaction takes a different row (or finds none and returns `null`).
- A new `SCHEDULED` value is added to the `collection_run_trigger_type`
  PostgreSQL enum without disturbing `MANUAL_API` compatibility.

## Architecture

```
Domain (inward-facing)
  collection-schedule-cadence.ts — pure function `nextDispatchBoundary`
  collection-run-trigger-type.ts — extends enum to include "SCHEDULED"
  validation.ts — unchanged; re-validates after persistence round-trip

Application (port ownership)
  ports/dispatch-next-due-collection-schedule-repository.port.ts — port
  use-cases/dispatch-next-due-collection-schedule.use-case.ts — use case
  test-support/in-memory-dispatch-next-due-collection-schedule.repository.ts
  collection-schedule-validation.ts — re-used to validate mapped domain values

Infrastructure (adapter)
  drizzle-dispatch-next-due-collection-schedule.repository.ts — single-tx adapter
  drizzle-dispatch-next-due-collection-schedule.repository.integration.test.ts
```

## Migration

`drizzle/0016_collection_run_trigger_scheduled.sql`:

```sql
ALTER TYPE "public"."collection_run_trigger_type" ADD VALUE IF NOT EXISTS 'SCHEDULED';
```

`drizzle/meta/_journal.json` gains entry `idx: 16`,
`tag: 0016_collection_run_trigger_scheduled`. No new snapshot file is
generated because the change is an enum-only extension and the schema
itself is unchanged.

## Cadence Examples

`previousNextRunAt = T0`, `intervalMinutes = 30`:

| dispatchTime              | new nextRunAt           |
|---------------------------|-------------------------|
| T0                        | T0 + 30min              |
| T0 + 1ms                  | T0 + 30min              |
| T0 + 29min 59s 999ms      | T0 + 30min              |
| T0 + 35min                | T0 + 60min (one miss)   |
| T0 + 90min                | T0 + 120min (multi)     |

Interval is bounded to `1..10080` minutes (matching the existing schedule
CHECK constraint). Out-of-range, non-integer, or `NaN` intervals throw
`CollectionScheduleCadencePolicyError`.

## Composition Wiring

`CollectorRuntimeDependencies` gains
`dispatchNextDueCollectionSchedules: DispatchNextDueCollectionScheduleRepositoryPort`.
`CollectorRuntimeContainer` exposes
`dispatchNextDueCollectionSchedule: DispatchNextDueCollectionScheduleUseCase`.
`createCollectorRuntimeFromDatabaseClient` constructs
`new DrizzleDispatchNextDueCollectionScheduleRepository(databaseClient.db)`
and threads it into the dependencies.

## Decisions Log

- **IdGenerator placement**: the use case owns id generation and passes the
  resulting `CollectionRunId` into the port, keeping the adapter a pure
  persistence operation (consistent with `claimNextQueued`).
- **Raw SQL**: the adapter uses raw SQL for the SELECT/UPDATE/INSERT so
  `FOR UPDATE SKIP LOCKED` and explicit column omissions stay legible, and
  the style matches the existing `CollectionRunRepository.claimNextQueued`.
- **Cadence policy in domain**: `nextDispatchBoundary` lives in the domain
  layer with no Drizzle/PostgreSQL imports; the adapter calls it inside the
  transaction to compute the next anchor.
- **Rollback evidence**: a primary-key collision on the inserted collection
  run forces the transaction to fail and roll back, demonstrating that the
  schedule update never persists when run insertion fails.

## Test Matrix

| Requirement                                                | Test file                                                                                                    |
|------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| Cadence boundary and miss behavior                         | `src/collector-runtime/domain/collection-schedule-cadence.test.ts`                                           |
| Dispatch happy/null paths                                  | `src/collector-runtime/application/dispatch-next-due-collection-schedule.test.ts`                            |
| Disabled / future schedules ignored                        | `src/collector-runtime/application/dispatch-next-due-collection-schedule.test.ts` (and integration)         |
| Deterministic ordering                                     | `src/infrastructure/database/repositories/drizzle-dispatch-next-due-collection-schedule.repository.integration.test.ts` |
| Exact parameters / timestamps                              | `src/collector-runtime/application/dispatch-next-due-collection-schedule.test.ts`                            |
| Concurrent dispatch on one due schedule → one run          | integration test "concurrent dispatchers against one due schedule..."                                       |
| Concurrent dispatch on two due schedules → both claimed    | integration test "concurrent dispatchers claim separate due schedules..."                                   |
| Insert/update failure rolls back                           | integration test "rolls back the schedule update when the run insert collides on primary key"               |
| MANUAL_API compatibility                                   | integration test "leaves pre-existing MANUAL_API collection runs untouched"                                   |
| Migration exposes `SCHEDULED`                              | integration test "exposes SCHEDULED in the collection_run_trigger_type enum"                                  |

## Out Of Scope

- Scheduler process / polling loop.
- Worker changes (`src/operator-tools/collector-worker/worker-runner.ts`).
- Browser, HTTP, Web UI, CLI, Docker, notification changes.
- Content Manager persistence changes or cross-module foreign keys.
- Reverse migrations (removing `SCHEDULED` from the enum).

## Sprint Status

Sprint 057 is accepted and recorded as the persistence foundation for Sprint
058. Sprint 058 is implemented as the atomic dispatch use case, port, and
Drizzle adapter. It provides the `dispatchNextDueCollectionSchedule` use case
plus the `SCHEDULED` enum value, ready for a future sprint to introduce a
scheduler loop that drives the polling trigger. It does not advance beyond
its declared scope.