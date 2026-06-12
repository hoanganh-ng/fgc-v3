# Sprint 036: Collection Run Records + API Trigger

## Goal

Add durable Collector Runtime collection-run records and an API that lets an operator request a collection run without executing browser collection inside the HTTP request.

## Scope

- Add Collector Runtime collection-run domain and application behavior.
- Add durable PostgreSQL storage for collection run records.
- Add HTTP endpoints:
  - `POST /collector/collection-runs`
  - `GET /collector/collection-runs`
  - `GET /collector/collection-runs/:collectionRunId`
  - `POST /collector/collection-runs/:collectionRunId/cancel` when small and consistent.
- Validate requested source groups through a Collector Runtime-owned application port.
- Implement source-group lookup through an existing Content Manager HTTP contract or adapter, not direct Content Manager repository access.
- Create requested runs with status `QUEUED` and trigger type `MANUAL_API`.
- Keep worker-oriented status transition use cases in the application layer for future execution.

## Collection Run Model

Statuses:

- `QUEUED`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`
- `CANCELED`

Allowed transitions:

- `QUEUED -> RUNNING`
- `QUEUED -> CANCELED`
- `RUNNING -> SUCCEEDED`
- `RUNNING -> FAILED`

Terminal statuses:

- `SUCCEEDED`
- `FAILED`
- `CANCELED`

Fields:

- `id`
- `sourceGroupId`
- `status`
- `triggerType`
- `parameters`
- `summary`
- `failureReason`
- `requestedAt`
- `startedAt`
- `finishedAt`
- `createdAt`
- `updatedAt`

For this sprint, `triggerType` is `MANUAL_API`.

## Request Behavior

`POST /collector/collection-runs` accepts:

```json
{
  "sourceGroupId": "string",
  "maxScrolls": 3,
  "maxDurationMs": 30000
}
```

The endpoint must:

1. Validate the request body.
2. Validate the source group exists through a Collector Runtime application port.
3. Validate the source group is `ACTIVE`.
4. Validate the source group platform is `FACEBOOK`.
5. Create a durable collection run with status `QUEUED`.
6. Return `201` with a safe run DTO.
7. Not execute the run.

## Out of Scope

- Worker process.
- Scheduler.
- Run Now UI.
- Run history UI.
- Actual browser execution from HTTP.
- Playwright launch from route handlers.
- Redis, BullMQ, or another queue system.
- Cron scheduling.
- Profile checkout execution.
- Manual collector CLI integration.
- Content item UI changes.
- Raw payload persistence.

## Security And Safety

Never store or return raw Facebook payloads, cookies, local storage, proxy credentials, session headers, provisioning token material, trusted runtime configuration, or browser session material.

Collection-run DTOs must contain only safe operator-facing fields.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm test:http:db` when a local disposable PostgreSQL database is available and configured.
