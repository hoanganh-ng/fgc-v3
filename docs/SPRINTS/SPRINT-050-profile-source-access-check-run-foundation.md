# Sprint 050: Profile-Source Access Check Run Foundation

## Goal

Add durable, queue-ready Profile-Source Access Check Run records and safe HTTP
APIs owned by Collector Runtime. Do not launch a browser, claim runs, create
leases, or mutate profile-source access state in this sprint.

## Scope

### Documentation
- Create this sprint document.
- Mark Sprint 049 complete and activate Sprint 050 in active.md,
  PROJECT_STATE.md, RUNTIME.md, and README.md.

### Domain
- Add `ProfileSourceAccessCheckRun` domain types, strict Zod schemas, statuses,
  target, sanitized failure reason, and lifecycle transitions.
- Statuses: `QUEUED`, `RUNNING`, `SUCCEEDED`, `FAILED`, `CANCELED`.
- Target: platform `FACEBOOK`, routeType `DIRECT_GROUP_URL`, credential-free
  HTTPS Facebook URL.
- Trigger type: `MANUAL`.
- Extract the existing Facebook URL canonicalization/validation utility from the
  Category Browse use case into a shared Collector Runtime utility without
  changing Category Browse behavior.

### Application
- Add application-owned `ProfileReferencePort` for reading a safe profile
  account stage from Profile Manager.
- Add `ProfileSourceAccessCheckRunRepository` port.
- Add request, get, list, cancel, mark-running, mark-succeeded, and
  mark-failed use cases.
- Validate the profile through the safe Profile Manager read contract and
  snapshot `accountStageAtRequest`.
- Validate the source group through the existing Content Manager-facing port:
  matching id, `FACEBOOK`, `ACTIVE`, safe HTTPS Facebook direct URL.
- Freeze the original managed direct URL into the run target.
- Prevent multiple QUEUED/RUNNING checks for the same `profileId +
  sourceGroupId` at the application layer.
- Use fixed safe public messages for Profile Manager and Content Manager
  failures. Do not expose raw upstream messages.

### Persistence
- Add Drizzle schema, PostgreSQL migration, mapper, Drizzle repository, and
  in-memory repository.
- Add a PostgreSQL partial unique index on `(profile_id, source_group_id) WHERE
  status IN ('QUEUED', 'RUNNING')`.

### HTTP
- `POST /collector/profile-source-access-check-runs`
- `GET /collector/profile-source-access-check-runs`
- `GET /collector/profile-source-access-check-runs/:runId`
- `POST /collector/profile-source-access-check-runs/:runId/cancel`
- Strict request/query/response schemas.
- Centralized 400/404/409/502 error mapping.

### Composition
- Wire through the composition root using existing HTTP clients, system clock,
  ID generator, and Drizzle database.

## Out Of Scope

- Browser automation or browser launch.
- Worker claiming or run execution.
- Profile lease creation.
- Profile-source access mutation.
- Scheduling, Redis, BullMQ.
- Raw evidence storage.
- Group actions, content collection.
- Web UI.
- Automatic account-stage changes.
- Retries.
- mark-running / mark-succeeded / mark-failed internal worker routes exposed
  publicly (they are internal lifecycle routes).

## Run Target

```
platform: FACEBOOK
routeType: DIRECT_GROUP_URL
url: <canonicalized HTTPS Facebook URL from the source group record>
```

## Lifecycle

```
QUEUED → RUNNING
QUEUED → CANCELED
RUNNING → SUCCEEDED
RUNNING → FAILED
```

Terminal statuses: `SUCCEEDED`, `FAILED`, `CANCELED`.

## Safety Boundaries

- Do not expose raw profile, source group, or upstream error messages.
- Do not store cookies, localStorage, proxy credentials, session headers,
  provisioning tokens, trusted runtime configuration, or fingerprint secrets.
- Do not implement browser automation, CAPTCHA solving, checkpoint bypass,
  credential automation, rate-limit bypass, group joining, posting, commenting,
  liking, sharing, or messaging.

## Verification

Run:
- `pnpm typecheck`
- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm test`
- `git diff --check`
- `DATABASE_URL=<isolated-test-db> pnpm db:migrate`
- `DATABASE_URL=<isolated-test-db> pnpm test:db`
- `DATABASE_URL=<isolated-test-db> pnpm test:http:db`
