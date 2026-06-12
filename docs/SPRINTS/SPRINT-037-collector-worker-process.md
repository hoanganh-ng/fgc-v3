# Sprint 037: Collector Worker Process

## Goal

Add a Collector Runtime worker process that claims queued collection runs and executes them using the existing Facebook collector orchestration.

## Scope

- Add an operator worker command:
  - `pnpm collector:worker:run`
- Add one-shot worker mode for manual and automated verification.
- Add lightweight polling mode when no `--once` flag is provided.
- Add a Collector Runtime application use case that atomically claims the oldest queued collection run.
- Add a Collector Runtime application use case that executes a claimed run through a small executor port.
- Reuse the existing Facebook collector runner rather than duplicating manual collector logic or shelling out to the manual CLI.
- Persist successful run summaries with safe counts only.
- Persist failed run records with sanitized `{ code, message }` failure reasons.
- Keep collection execution out of HTTP routes.

## Claim Behavior

The worker must claim only `QUEUED` runs.

Claiming should:

1. Find the oldest queued run by `requestedAt`, then `createdAt`, then `id`.
2. Atomically transition that run to `RUNNING`.
3. Set `startedAt`.
4. Return the claimed run.
5. Return `null` when no queued run exists.

PostgreSQL implementations should use a transaction or conditional update so two workers cannot claim the same run. `FOR UPDATE SKIP LOCKED` is acceptable.

## Execution Behavior

For each claimed run:

1. Read `sourceGroupId` and collection parameters from the run.
2. Execute the existing Facebook group collection orchestration.
3. Pass `maxScrolls` and `maxDurationMs` from run parameters.
4. Mark the run `SUCCEEDED` when execution succeeds.
5. Store only safe summary counts:
   - `capturedPayloads`
   - `extractorCandidates`
   - `contentItemsSubmitted`
   - `failedSubmissions`
   - `leaseReleased`
6. Mark the run `FAILED` when execution fails.
7. Store only a sanitized failure reason:
   - `code`
   - `message`

For this sprint, only Facebook source groups are executable. Missing, inactive, archived, paused, unsupported, or non-Facebook source groups must fail the run with a sanitized failure reason.

## CLI Behavior

Recommended one-shot command:

```bash
pnpm collector:worker:run -- --base-url http://localhost:8081 --once
```

Recommended polling command:

```bash
pnpm collector:worker:run -- --base-url http://localhost:8081 --poll-interval-ms 5000
```

Polling mode should exit cleanly on `SIGINT` and `SIGTERM`.

## Cancellation

- Canceled queued runs must never be claimed.
- Canceling already running runs is out of scope unless it is trivial in existing code.
- Do not introduce complex cancellation or interrupt semantics.

## Out Of Scope

- Running collection from HTTP routes.
- Scheduler for active source groups.
- Run Now UI.
- Run history UI.
- Worker dashboard controls.
- Redis, BullMQ, or queue infrastructure.
- Multi-platform execution.
- Running multiple jobs concurrently.
- Retry policy.
- Stuck `RUNNING` recovery.
- Heartbeats or worker leases.
- Content review UI changes.
- Content Builder.
- Content Publisher.

## Security And Safety

Worker logs and persisted records must never include raw Facebook payloads, cookies, local storage, proxy credentials, session headers, provisioning token material, trusted runtime configuration, or browser session material.

Worker logs may include safe lifecycle messages, run ids, summary counts, sanitized failure codes, and whether lease release is known.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:http:db` when `DATABASE_URL` is available.
