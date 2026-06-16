# Sprint 054A: Profile Authentication Health Foundation

## Goal

Establish the profile authentication-health domain model in Collector Profile
Manager. A single high-confidence `LOGIN_REQUIRED` or `CHECKPOINT_REQUIRED`
observation will eventually block a profile from future automated checkout until
successful reprovisioning.

Sprint 054A only introduces the model, persistence, safe DTO exposure, and the
atomic provisioning update. Runtime reporting and checkout enforcement belong to
Sprint 054B.

## Scope

- [x] Add closed `ProfileAuthenticationHealth` enum:
  - `NOT_PROVISIONED`
  - `HEALTHY`
  - `REAUTH_REQUIRED`
  - `CHECKPOINT_REVIEW_REQUIRED`
- [x] Add `authenticationHealth` and `authenticationHealthUpdatedAt` to the
  persisted `CollectorProfile` domain type.
- [x] Creation defaults: `NOT_PROVISIONED` + `authenticationHealthUpdatedAt = createdAt`.
- [x] Successful session ingestion atomically sets `HEALTHY` + updated timestamp.
- [x] Starting provisioning, failed provisioning, and canceled provisioning
  preserve previous health and timestamp.
- [x] All other profile mutations (configuration, account-stage, checkout,
  lease, source-access) preserve health and timestamp unchanged.
- [x] Add `authentication_health` and `authentication_health_updated_at` columns
  to `collector_profiles`.
- [x] Write migration 0013 with backfill:
  - `READY`/`BUSY` -> `HEALTHY`
  - `PENDING_CONFIG`/`PENDING_LOGIN` -> `NOT_PROVISIONED`
  - health timestamp backfilled from `updated_at` (falling back to `created_at`)
  - both columns made `NOT NULL` after backfill
  - `NOT_PROVISIONED` as database default
- [x] Update mapper, Drizzle repository, in-memory repository.
- [x] Expose `authenticationHealth` and `authenticationHealthUpdatedAt` in safe
  profile list and detail DTOs.
- [x] Strict Zod/HTTP schemas.
- [x] No cookies, localStorage, provisioning tokens, proxy credentials, browser
  evidence, or detection details exposed.

## Architecture Boundaries

- `authenticationHealth` is separate from `profile.status` and `accountStage`.
- No generic unrestricted health setter.
- No worker reporting.
- No checkout eligibility changes.
- No Web UI changes.
- No browser/runtime behavior.

## Out Of Scope

- Sprint 054B: runtime reporting and checkout enforcement.
- Any automatic account-stage changes.
- Any worker integrations.
- Commits or pushes.

## Verification

Required:

- `pnpm typecheck`
- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm test`
- `git diff --check`

## Sprint Status

Sprint 054A is active.
