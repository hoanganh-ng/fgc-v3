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

### Corrections Pass (June 2026)

We completed a narrow contract validation and correction pass with the following enhancements:
1. **Frontend compatibility**: Expose strict closed enum `KnownProfileAuthenticationHealthSchema` and type `ProfileAuthenticationHealth` in API client. Standardized Zod schemas. Added 35 frontend API parsing tests (`profile-manager-client.test.ts`).
2. **Safe HTTP Response schemas consistency**: Deriving required properties in `profileDetailJsonSchema` from `profileReadSummaryJsonSchema.required`, resolving the missing `accountStage` property validation.
3. **Strict cookie verification at Ingest boundary**: Session ingestion use case and schemas reject empty cookies.
4. **Hardened tests**: Enhanced domain/schema health type validation, empty cookies guards, mapper preservation tests, and HTTP route assertions.

### Completed verification commands

```bash
pnpm typecheck
pnpm web:typecheck
pnpm web:build
pnpm test
pnpm test:db
pnpm test:http:db
git diff --check
```

### Final test counts

- `pnpm test`: 926 passed
- `pnpm test:db`: 75 passed
- `pnpm test:http:db`: 114 passed
- Total: 1115 passed tests

### DB-backed verification results

All migrations applied successfully via `pnpm db:migrate`. Verified `toCollectorProfileRow` and `toCollectorProfileDomain` correctly map database rows, defaulting `null` states to `NOT_PROVISIONED` and fallback to `updatedAt` / `createdAt` for `authenticationHealthUpdatedAt`.

## Sprint Status

Sprint 054A is active.
## Required Context

To work on this sprint, read the following:
- `AGENTS.md` (root execution contract)
- `docs/PROJECT_SNAPSHOT.md` (concise current state)
- `docs/modules/collector-profile-manager.md` (owning module boundaries)
- Relevant Profile Manager implementation files and nearby tests.

Do not scan `Content Manager`, `Collector Runtime`, or `Web UI` modules by default, as they are out of scope for this foundation phase.
