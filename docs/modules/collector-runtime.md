# Collector Runtime

## Ownership
- Execution of collection workflows (queues, workers).
- Durable run records for collection, ambient exercise, and profile-source access checks.
- Orchestrating profile checkout from Collector Profile Manager.
- Orchestrating browser automation, network payload capture, and page context interaction.
- Platform Extractors (e.g. Facebook GraphQL Payload Extractor) converting raw artifacts to normalized inputs.
- Submitting normalized collected content to Content Manager.
- Processing lease-scoped runtime profile configuration.
- Detecting authentication walls (login, checkpoints).
- Owns the `CollectionSchedule` aggregate (one schedule per source group; persisted schedule, not yet driving dispatch).
- Atomic scheduled dispatch: `DispatchNextDueCollectionScheduleUseCase` selects one enabled due schedule with `FOR UPDATE SKIP LOCKED`, inserts a `QUEUED` `SCHEDULED` `CollectionRun`, and advances the schedule's `next_run_at` per the cadence policy, all in a single PostgreSQL transaction. Missed intervals produce one run only. See [Sprint 058](../SPRINTS/SPRINT-058-atomic-scheduled-collection-dispatch.md).
- Scheduled dispatch poller: the **collection scheduler** (`src/operator-tools/collection-scheduler/`) is a sibling CLI that polls `DispatchNextDueCollectionScheduleUseCase` on an interval; it dispatches due schedules into runs but never executes them — execution remains the collector worker's job. See [Sprint 059](../SPRINTS/SPRINT-059-scheduled-collection-dispatch-poller.md).

## Does Not Own
- Profile property invariants, session ingestion rules, or checkout eligibility.
- Content item lifecycle, deduplication, or storage.
- Source group entry route metadata mutations.
- Automatic profile account stage promotion or demotion.
- Authority over profile identity or proxy/fingerprint secrets.

## Important Source Paths
- `src/collector-runtime/`
- `src/collector-runtime/platform-extractors/`
- `src/collector-runtime/workers/`
- `src/collector-runtime/infrastructure/adapters/browser/`

## Important Entrypoints
- `Workers`: `src/collector-runtime/workers/` (e.g. `start-collector-worker.ts`)
- `Orchestration`: Collection flow use cases invoking HTTP clients to other modules.
- `Platform Extractors`: Pure domain logic mapping raw JSON to normalized types.

## Critical Invariants
- Must release profile leases accurately, specifically in error or interruption paths.
- Extractor rules must yield data complying with the Content Manager schema.
- Must safely detect and yield on authentication issues, relying on Profile Manager to handle health states.

## Cross-Module Communication
- Uses explicit HTTP or adapter contracts to interface with Profile Manager (for leases/config) and Content Manager (for submission).
- Does not import repositories from other modules.

## Sensitive Data Rules
- Browser provider execution must not leak runtime config, cookies, or payloads to logs.
- Extractor test fixtures must use synthetic or sanitized real data.

## Relevant Verification Commands
```bash
pnpm test src/collector-runtime
pnpm test:db src/collector-runtime
pnpm test:http:db src/collector-runtime
```
