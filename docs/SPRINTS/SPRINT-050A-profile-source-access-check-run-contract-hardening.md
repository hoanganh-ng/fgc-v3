# Sprint 050A: Profile-Source Access Check Run Contract Hardening

## Goal
Harden the Profile-Source Access Check Run HTTP layer and domain types to safely encapsulate execution state and map upstream failures securely.

## Scope

### Remove Public Lifecycle Routes
- Remove `POST /collector/profile-source-access-check-runs/:checkRunId/running`.
- Remove `POST /collector/profile-source-access-check-runs/:checkRunId/succeed`.
- Remove `POST /collector/profile-source-access-check-runs/:checkRunId/fail`.
- Remove corresponding HTTP schemas and route registrations.
- Retain the internal `mark-running`, `mark-succeeded`, and `mark-failed` application use cases.

### Type Hardening
- Define a Collector Runtime-owned `accountStage` union containing `NEW_ACCOUNT`, `WARMING`, `COLLECTION_READY`, `LIMITED`, `NEEDS_REVIEW`, and `RETIRED`.
- Refactor the application logic, `ProfileReferencePort`, and downstream components to use the new union instead of loosely typed strings.
- Add `ProfileSourceAccessCheckRunConflictError` to map PostgreSQL `23505` constraint violations to a safe 409 status code.

### Hardening Upstream Contracts
- Enforce that the Profile Manager returns the correct requested profile ID.
- Enforce that the Content Manager returns the correct requested source-group ID.
- Return `502` representations (`SourceGroupLookupFailedError`, `ProfileReferenceLookupFailedError`) if upstream lookups mismatch or fail, rather than forwarding raw internal error payloads.

### Repository and Endpoint Validation
- Make `total` mandatory in `ProfileSourceAccessCheckRunRepository` `list` responses.
- Catch unique constraint exceptions during DB insert and map them to `ProfileSourceAccessCheckRunConflictError`.
- Ensure endpoints strictly accept structured request bodies and reject invalid or malformed data natively.

## Verification
- HTTP integration tests correctly handle 409 Conflict constraints.
- Removed lifecycle routes return 404 Not Found.
- Endpoints gracefully handle mapping to 502 Bad Gateway for upstream reference resolution issues.
- Successful executions of `pnpm typecheck`, `pnpm test`, and `pnpm web:build`.
