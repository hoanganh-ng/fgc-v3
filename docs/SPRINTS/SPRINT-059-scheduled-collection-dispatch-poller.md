# Sprint 059: Scheduled Collection Dispatch Poller

## Goal

Introduce a dedicated scheduler process that periodically invokes the
existing `DispatchNextDueCollectionScheduleUseCase`. Each polling
cycle drains every enabled due `CollectionSchedule` into a queued
`SCHEDULED` `CollectionRun`; collection-run execution remains the
collector worker's responsibility and is unchanged.

Sprint 058 delivered the atomic dispatch use case, the dispatch port,
the Drizzle repository, the in-memory repository, and the wiring inside
`CollectorRuntimeContainer`. Sprint 059 closes the operational loop by
adding the polling process that drives that use case on an interval.

## Capability Summary

- A new CLI under `src/operator-tools/collection-scheduler/` with
  strict argument parsing, a runner, and an entrypoint that mirrors
  the operational discipline of the existing collector worker.
- The scheduler calls
  `DispatchNextDueCollectionScheduleUseCase.execute()` repeatedly
  inside one cycle until the use case returns `null`, indicating no
  more due schedules.
- `--once` performs exactly one complete drain cycle and exits.
- Continuous mode drains, waits `--poll-interval-ms` milliseconds, and
  repeats until aborted.
- The runner checks `AbortSignal` between dispatches and uses an
  abort-aware delay; SIGINT/SIGTERM stop the loop cleanly.
- Dependencies close exactly once through `finally`, even if a
  dispatch throws.
- The CLI never instantiates the Drizzle dispatch repository; it
  wires the runner through `createCollectorRuntimeFromEnv()` and the
  container's `dispatchNextDueCollectionSchedule.execute` plus its
  `close` member.

## Architecture

```
CLI (src/operator-tools/collection-scheduler/cli.ts)
  ├── parse args
  ├── SIGINT/SIGTERM → AbortController.abort()
  ├── createCollectorRuntimeFromEnv() → CollectorRuntimeContainer
  │     ├── dispatchNextDueCollectionSchedule.execute
  │     └── close
  └── runCollectionSchedulerCommand({ options, logger, dependencies, abortSignal })

Runner (scheduler-runner.ts)
  outer loop (--once breaks after cycle 1)
    inner drain loop
      if abortSignal?.aborted → break
      result = await dispatch()
      if result === null → break
      dispatchedRuns += 1
    cyclesCompleted += 1
    if --once → break
    if abortSignal?.aborted → break
    await delay(pollIntervalMs, abortSignal)  // resolves early on abort
  finally → await dependencies.close()        // exactly once
```

Domain and application code are not modified. No new ports, no new
use cases, no schema or migration changes.

## Lifecycle

1. CLI parses CLI options and prints usage on `--help`/`-h` or argument
   errors.
2. CLI installs `SIGINT` and `SIGTERM` handlers that abort an
   `AbortController`. The handlers are installed **before** runtime
   composition so they can be detached in a `finally` if composition
   throws.
3. CLI builds a `CollectorRuntimeContainer` via
   `createCollectorRuntimeFromEnv()`. The container owns the
   `DatabaseClient` and the Drizzle dispatch repository through the
   existing composition root.
4. Runner starts. Each outer iteration is one cycle. Each cycle calls
   the dispatch use case until it returns `null`, increments
   `cyclesCompleted`, and — unless `--once` was requested or the
   signal is set — sleeps for `pollIntervalMs` with an abort-aware
   delay.
5. On exit (normal or error), the runner's `finally` block awaits
   `dependencies.close()` exactly once. The CLI detaches its signal
   handlers in its own `finally`.

## Counting Semantics

`CollectionSchedulerCommandResult` exposes two fields:

- `cyclesCompleted` — incremented once per completed inner drain. A
  drain that exits because `dispatch()` returned `null` counts. A drain
  that exits because the abort signal was set also counts, keeping
  the field monotonic and easy to assert.
- `dispatchedRuns` — incremented only when `dispatch()` returns a
  non-null result.

`--once` exits after exactly one cycle; `cyclesCompleted === 1`.
Continuous mode increments `cyclesCompleted` per outer iteration.

Final-state rules:

- A pre-aborted signal performs **zero** dispatches and reports
  **zero** completed cycles. The runner emits one info line for the
  pre-aborted startup so operators can see why nothing happened.
- An abort that lands during the inter-cycle delay does not begin
  or count a new cycle; the previous cycle is unchanged. The runner
  does **not** emit a final-state log line — the previously emitted
  per-cycle completion line is the operator-visible record.
- An abort that lands between two dispatches inside a drain stops the
  drain immediately; the runner does **not** continue draining until
  `null`. The drain may still be counted as one completed cycle (the
  counter increments once on the way out of the inner loop), but no
  extra log line is emitted beyond the per-cycle completion line.

## Dependency Contract

The runner accepts a narrow dependency contract:

```ts
interface CollectionSchedulerDependencies {
  dispatch: () => Promise<DispatchNextDueResult | null>;
  close: () => Promise<void>;
}
```

Production wiring in `cli.ts` binds:

- `dispatch = container.dispatchNextDueCollectionSchedule.execute.bind(container.dispatchNextDueCollectionSchedule)`
- `close = () => container.close()`

Tests inject a fake `dispatch` and a counting `close` directly; the
integration test wires the real `DispatchNextDueCollectionScheduleUseCase`
against `InMemoryDispatchNextDueCollectionScheduleRepository`.

## CLI Argument Grammar

| Flag                      | Default | Validation                                                       |
|---------------------------|---------|------------------------------------------------------------------|
| `--once`                  | false   | boolean, may appear once                                         |
| `--poll-interval-ms <n>`  | 5000    | positive integer (separated or inline), may appear once          |
| `--help`, `-h`            | n/a     | help requested; prints usage, exit 0                             |

Anything else (unknown flag, positional argument, duplicate flag,
missing value, nonnumeric value, fractional value, zero, negative
value, empty inline value) raises
`CollectionSchedulerCliArgumentError`. The CLI prints the message and
usage, sets `process.exitCode = 2`, and returns.

## Error And Shutdown Semantics

- A throw from `dispatch()` propagates out of the runner. The `finally`
  block awaits `close()` exactly once. Whether the dispatch error or
  the close error reaches the caller is governed by normal JavaScript
  `try/finally` semantics; the runner does not swallow either one.
- The CLI catches the re-raised error, prints its message, and sets
  `process.exitCode = 1`.
- SIGINT and SIGTERM trigger `abortController.abort()`. The runner
  observes the abort between dispatches — when an abort lands between
  dispatches, the current drain stops immediately and is not continued
  to the null terminator — and inside the inter-cycle delay. The
  completed cycle (if any) is counted; the outer loop then exits
  before the next cycle begins.
- The CLI installs signal handlers **before** runtime composition so
  it can detach them in its own `finally` if composition throws. The
  CLI never instantiates the Drizzle dispatch repository; it always
  wires through `createCollectorRuntimeFromEnv()`.
- `close()` is invoked by the runner, not by the CLI; the CLI never
  double-closes. The CLI never calls `close()` on a runtime that was
  never constructed.

## Logging Policy

- `info`: startup line, per-dispatch line (schedule source group id +
  run id), per-cycle completion line (cyclesCompleted +
  dispatchedRuns), shutdown line, final summary line.
- `warn`/`error`: not emitted on the happy path. The CLI uses
  `console.error` only for argument errors, signal-triggered shutdown
  notices, and uncaught runner errors.
- Never logs environment variables, database URLs, credentials,
  tokens, cookies, proxy configuration, runtime configuration, or
  raw payloads.

## File Manifest

### Create

- `src/operator-tools/collection-scheduler/cli-args.ts`
- `src/operator-tools/collection-scheduler/scheduler-runner.ts`
- `src/operator-tools/collection-scheduler/cli-command.ts`
- `src/operator-tools/collection-scheduler/cli.ts`
- `src/operator-tools/collection-scheduler/cli-args.test.ts`
- `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`
- `src/operator-tools/collection-scheduler/cli.test.ts`
- `docs/SPRINTS/SPRINT-059-scheduled-collection-dispatch-poller.md`

### Modify

- `package.json` — adds `operator:collector:scheduler` and
  `collector:scheduler:run` scripts.
- `docs/SPRINTS/active.md` — marks Sprint 058 accepted, Sprint 059
  active.
- `docs/modules/collector-runtime.md` — appends the scheduler note.

## Decisions Log

- **Narrow dependency contract**: tests inject only `{ dispatch,
  close }`. The runner never imports the use case or repository
  directly; production wiring binds them in `cli.ts` from the
  composition root.
- **No Drizzle instantiation in the scheduler**: the CLI uses
  `createCollectorRuntimeFromEnv()` and consumes only the container's
  `dispatchNextDueCollectionSchedule.execute` and `close` members.
- **Cycle counter on partial drain**: an aborted drain still counts
  as one cycle. This keeps `cyclesCompleted` monotonic and the test
  assertions simple.
- **Abort-aware delay**: the local `delay()` resolves early on abort
  and removes the AbortSignal listener on both normal completion
  and abort paths, so listeners never accumulate across cycles.
- **Exit codes**: argument error → 2; runtime error → 1; help → 0.

## Test Matrix

| Requirement                                                              | Test file                                                                       |
|--------------------------------------------------------------------------|---------------------------------------------------------------------------------|
| Defaults, --once, --poll-interval-ms parsing                             | `src/operator-tools/collection-scheduler/cli-args.test.ts`                      |
| Duplicate, unknown, positional, missing, nonnumeric, fractional, zero, negative, empty inline | `src/operator-tools/collection-scheduler/cli-args.test.ts`                      |
| Help text mentions every flag + DATABASE_URL requirement                  | `src/operator-tools/collection-scheduler/cli-args.test.ts`                      |
| `--once` exits after one drain                                            | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Inner drain loop dispatches until null                                    | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| No `setTimeout` call between dispatches inside one drain                  | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Exactly one delay between two completed continuous cycles                 | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Abort during the delay resolves promptly with no phantom cycle            | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Abort listener is removed on abort and on normal delay completion         | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Repeated normal delays do not retain abort listeners                      | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Pre-aborted signal performs zero dispatches and zero cycles               | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Pre-aborted signal logs "aborted before first cycle" once                 | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Abort during delay does not log "aborted before first cycle"              | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Abort mid-drain stops further dispatching                                 | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Abort mid-drain does not log a final-state "aborted mid-cycle" line       | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Dispatch errors propagate and close still runs once                      | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Close errors propagate                                                    | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Logger emits safe info lines and no warns/errors on happy path            | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| Real use case + in-memory repository integration                          | `src/operator-tools/collection-scheduler/scheduler-runner.test.ts`              |
| `--help` returns without constructing the runtime                         | `src/operator-tools/collection-scheduler/cli.test.ts`                           |
| Argument errors return without constructing the runtime                   | `src/operator-tools/collection-scheduler/cli.test.ts`                           |
| Signal handlers are installed and the AbortController path is exercised   | `src/operator-tools/collection-scheduler/cli.test.ts`                           |
| Signal handlers are detached when runtime composition throws              | `src/operator-tools/collection-scheduler/cli.test.ts`                           |
| Runtime `close()` is invoked exactly once (runner is sole closer)         | `src/operator-tools/collection-scheduler/cli.test.ts`                           |

## Out Of Scope

- Collector worker changes (`src/operator-tools/collector-worker/`).
- Docker, Compose, deployment manifests.
- HTTP routes or Web UI.
- Database schemas or migrations.
- Batch dispatch SQL.
- Parallel dispatch within one process.
- Leader election, retry/backoff systems, jitter.
- Browser execution.
- Metrics, notifications, observability surfaces.
- Shared polling-framework refactors.
- Commits or pushes.

## Verification

```bash
pnpm typecheck
pnpm test src/operator-tools/collection-scheduler
pnpm collector:scheduler:run -- --help
```

A live `DATABASE_URL` dispatch smoke run is **not** performed as part
of this sprint. Any database-backed verification is reported
separately and is not claimed here.

## Sprint Status

Sprint 058 is accepted and recorded as the atomic dispatch foundation
for Sprint 059. Sprint 059 is implemented as the scheduled collection
dispatch poller: a dedicated CLI that drives the existing
`DispatchNextDueCollectionScheduleUseCase` on an interval, drains
every due schedule inside one cycle, and leaves run execution to the
collector worker. It does not advance beyond its declared scope.