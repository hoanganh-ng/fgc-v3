# Sprint 055: Operator Authentication Recovery and Reprovisioning

## Goal

Close the recovery loop for Collector Profile Manager profiles whose
`authenticationHealth` is `REAUTH_REQUIRED` or `CHECKPOINT_REVIEW_REQUIRED`.

Operators must be able to:

1. See the current `authenticationHealth` in the Web UI on both the
   profile inventory and the profile detail.
2. Start guarded reprovisioning through the existing
   `POST /collector/profiles/:profileId/provisioning/start` endpoint.
3. Drive the existing headed provisioning CLI to capture a fresh
   Facebook session and submit it through the existing token-ingestion
   flow.
4. Restore the profile to `READY` and `authenticationHealth = HEALTHY`
   only after successful session ingestion.

The frontend remains an adapter/client. The backend remains the
authoritative owner of the recovery lifecycle. No automatic login,
credential entry, CAPTCHA solving, or checkpoint bypass is added.

## Scope

### Collector Profile Manager — Domain Invariant

- Add a domain-owned eligibility predicate
  `canStartProvisioning(profile)` in
  `src/collector-profile-manager/domain/profile-authentication-health.ts`:
  - `PENDING_CONFIG`: initial provisioning allowed.
  - `PENDING_LOGIN`: explicit token restart allowed.
  - `READY` with `authenticationHealth = REAUTH_REQUIRED`: recovery
    provisioning allowed.
  - `READY` with `authenticationHealth = CHECKPOINT_REVIEW_REQUIRED`:
    manual checkpoint recovery allowed (the operator must drive the
    existing CLI; there is no automated bypass).
  - `READY` with `authenticationHealth = HEALTHY` or
    `NOT_PROVISIONED`: rejected.
  - `BUSY`: rejected.
- Add `assertStartProvisioningEligibility(profile)` that throws
  `InvalidApplicationOperationError` with a clear backend-owned message
  for the rejected cases.
- `PENDING_LOGIN` restart does NOT mutate `authenticationHealth`,
  `authenticationHealthUpdatedAt`, `accountStage`, hardware fingerprint,
  configuration, or `authenticationState`. Only the provisioning-token
  state is replaced.
- `READY` recovery transitions `identity.status` to `PENDING_LOGIN`
  through the existing status machine and updates `updatedAt`. The
  health, health timestamp, account stage, hardware fingerprint,
  configuration, and authentication state are preserved unchanged.
- Successful session ingestion remains the only transition to
  `HEALTHY`. Starting or restarting provisioning must NEVER clear
  `REAUTH_REQUIRED` or `CHECKPOINT_REVIEW_REQUIRED`.

### Collector Profile Manager — Application Use Case

- Extend `StartProfileProvisioningUseCase` (no new use case, no new
  endpoint) in
  `src/collector-profile-manager/application/use-cases/start-profile-provisioning.use-case.ts`:
  - Validate the profile exists, then call
    `assertStartProvisioningEligibility(profile)`.
  - For `PENDING_CONFIG` and `READY` recovery: call the existing
    `transitionCollectorProfileStatus(profile, "PENDING_LOGIN", now)` to
    ensure required configuration is validated and the status machine
    allows the transition.
  - For `PENDING_LOGIN` restart: keep `identity.status` as
    `PENDING_LOGIN` and update only `updatedAt`. Do not call the status
    transition (a self-transition is not part of the existing
    `ALLOWED_PROFILE_STATUS_TRANSITIONS`).
  - Use the existing `TokenGenerator` and `PROVISIONING_TOKEN_TTL_MS`
    (15 minutes) to issue a new one-time token.
  - Replace the `provisioningToken` state with a new `ISSUED` token.
    The previous token (whether `ISSUED` or `NOT_ISSUED`) is
    superseded; reusing the previous token fails
    `findByProvisioningToken` and the `assertUsableProvisioningToken`
    policy.
  - Preserve `authenticationHealth`,
    `authenticationHealthUpdatedAt`, `accountStage`, hardware
    fingerprint, configuration, and `authenticationState`.
  - Return `{ profile, provisioningToken, expiresAt }` as before.
- Existing `IngestProfileSessionUseCase` contract is unchanged:
  - Requires `PENDING_LOGIN`.
  - Validates the current usable token (`InvalidProvisioningTokenError`,
    `ProvisioningTokenConsumedError`, `ProvisioningTokenExpiredError`).
  - Rejects empty cookies.
  - Replaces session state, consumes the token, transitions to
    `READY`, sets `authenticationHealth = HEALTHY` and updates
    `authenticationHealthUpdatedAt`.
  - Preserves `accountStage` and hardware fingerprint.
- No migration or persistence redesign. Existing HTTP route
  `POST /collector/profiles/:profileId/provisioning/start` and existing
  schemas remain authoritative. No new endpoint is added.

### Collector Profile Manager — HTTP Contract

- Reuse the existing
  `startProfileProvisioningHttpRouteSchema` and the
  `StartProfileProvisioningResponseSchema` (profile summary plus
  one-time `provisioningToken` and `expiresAt`).
- Reuse the existing error mapping
  (`InvalidApplicationOperationError` → 409,
  `ProfileNotFoundError` → 404,
  `InvalidProfileConfigurationError` → 400,
  `InvalidProvisioningTokenError` → 400).
- The `provisioningToken` and `expiresAt` are only returned in the
  immediate response. They are not stored in the safe profile DTOs.

### Web UI

- Add a reusable `ProfileAuthenticationHealthBadge` in
  `apps/web/src/features/profiles/profile-authentication-health-badge.tsx`
  mapping the closed enum to operator-readable tones:
  - `NOT_PROVISIONED` → neutral
  - `HEALTHY` → success
  - `REAUTH_REQUIRED` → warning
  - `CHECKPOINT_REVIEW_REQUIRED` → danger
- Display `authenticationHealth`:
  - On the profile inventory row in
    `apps/web/src/pages/profiles-page.tsx`.
  - In the Status summary card and the Timestamps card on
    `apps/web/src/pages/profile-detail-page.tsx`.
- Display `authenticationHealthUpdatedAt` in the profile detail
  Timestamps card.
- Generalize the existing `StartProvisioningCard` on
  `apps/web/src/pages/profile-detail-page.tsx` to select the operator
  action and explanatory copy based on the profile state:
  - `PENDING_CONFIG`: **Start Provisioning** (unchanged behavior).
  - `PENDING_LOGIN`: **Issue New Provisioning Token**, with a warning
    that the previous token becomes invalid and is no longer
    acceptable for session ingestion.
  - `READY` + `REAUTH_REQUIRED`: **Start Reauthentication**, with a
    short explanation that the previous session was reported as
    login-required.
  - `READY` + `CHECKPOINT_REVIEW_REQUIRED`: **Start Manual Checkpoint
    Recovery**, with a warning that there is no automated bypass and
    the operator must drive the existing headed provisioning CLI.
  - `READY` + `HEALTHY` and `BUSY`: no provisioning action is offered.
- The existing immediate-only raw-token handling is preserved. The
  new "Issue New Provisioning Token" path uses the same component
  state (`provisioningSuccess`) and copy button. Tokens are never
  persisted in `localStorage`, `sessionStorage`, URL params, query
  state, profile detail state, or logs.
- Frontend status checks guide visibility only; backend validation
  remains authoritative.

## Architecture Boundaries

- The recovery eligibility predicate is domain-owned, so the backend
  remains the single source of truth.
- No migration, no new database column, no new index, no new event
  table, no outbox work, no new HTTP route.
- The Web UI consumes safe HTTP contracts; it does not import
  backend domain, repository, database, or composition modules.
- `accountStage`, hardware fingerprint, configuration, and
  `authenticationState` are never modified by
  `StartProfileProvisioningUseCase`. Successful session ingestion
  remains the only path that sets `HEALTHY`.
- No automatic login, credential entry, CAPTCHA solving, or
  checkpoint bypass.
- No manual authentication-health setter.
- Hardware fingerprint remains immutable.
- Cookies, localStorage, proxy credentials, provisioning token hashes,
  raw session state, trusted runtime configuration, screenshots,
  page text, and raw Facebook payloads remain excluded from logs,
  fixtures, and operator-visible UI.

## Out Of Scope

- Manual authentication-health editing.
- Automatic account-stage changes.
- Web UI session ingestion.
- Browser automation, browser-provider changes, or CLI changes.
- A new migration, new HTTP route, or persistence redesign.
- Source-access redesign or Content Manager changes.
- Future sprint work beyond Sprint 055.
- Commits or pushes.

## Required Context

To work on this sprint, read:

- `AGENTS.md` (root execution contract).
- `docs/PROJECT_SNAPSHOT.md` (concise current state).
- `docs/modules/collector-profile-manager.md` (owning module boundaries).
- `docs/SPRINTS/SPRINT-054A-profile-authentication-health-foundation.md`
  (health model).
- `docs/SPRINTS/SPRINT-054B-runtime-authentication-health-reporting-and-checkout-enforcement.md`
  (runtime observation + checkout enforcement).
- `docs/SPRINTS/SPRINT-029-start-provisioning-ui.md` (existing start
  provisioning UI).
- `docs/SPRINTS/SPRINT-030-profile-provisioning-browser-cli.md`
  (existing headed provisioning CLI).
- `docs/SPRINTS/SPRINT-053A-cloakbrowser-provisioning-support.md`
  (CLI browser-provider selection).
- Relevant Profile Manager implementation files and nearby tests:
  - `src/collector-profile-manager/domain/profile.ts`
  - `src/collector-profile-manager/domain/profile-authentication-health.ts`
  - `src/collector-profile-manager/domain/profile-state-machine.ts`
  - `src/collector-profile-manager/domain/checkout-eligibility.ts`
  - `src/collector-profile-manager/application/use-cases/start-profile-provisioning.use-case.ts`
  - `src/collector-profile-manager/application/use-cases/ingest-profile-session.use-case.ts`
  - `src/collector-profile-manager/application/provisioning-token-policy.ts`
  - `src/collector-profile-manager/application/profile-validation.ts`
  - `src/interfaces/http/routes/collector-profile-manager.routes.ts`
  - `src/interfaces/http/schemas/collector-profile-manager.http-schemas.ts`
  - `apps/web/src/pages/profile-detail-page.tsx`
  - `apps/web/src/pages/profiles-page.tsx`
  - `apps/web/src/lib/api/profile-manager-client.ts`
  - `apps/web/src/features/profiles/profile-mutations.ts`

Do not scan Content Manager, worker implementations, Facebook
extractors, browser providers, source-group management, migrations,
or unrelated modules unless a concrete dependency requires it.

## Verification

### Required checks

```bash
pnpm typecheck
pnpm web:typecheck
pnpm web:build
pnpm test
pnpm test:db
pnpm test:http:db
git diff --check
```

### Test coverage targets

- Domain eligibility predicate for the seven combinations
  (PENDING_CONFIG, PENDING_LOGIN, READY+HEALTHY, READY+NOT_PROVISIONED,
  READY+REAUTH_REQUIRED, READY+CHECKPOINT_REVIEW_REQUIRED, BUSY).
- Start-provisioning happy paths:
  - PENDING_CONFIG initial (existing).
  - PENDING_LOGIN restart preserves health, health timestamp, account
    stage, hardware fingerprint, configuration, authentication state,
    and supersedes the previous token.
  - READY+REAUTH_REQUIRED recovery preserves health, health timestamp,
    account stage, hardware fingerprint, configuration, authentication
    state, and transitions to PENDING_LOGIN.
  - READY+CHECKPOINT_REVIEW_REQUIRED recovery follows the same path.
- Start-provisioning rejection paths:
  - READY+HEALTHY.
  - READY+NOT_PROVISIONED.
  - BUSY.
  - Missing required configuration.
- Superseded token is not findable and rejects session ingestion with
  `InvalidProvisioningTokenError`.
- Health is never restored to HEALTHY except through successful
  session ingestion.
- No cookies, localStorage, tokens, proxy credentials, raw session
  state, trusted runtime configuration, screenshots, page text, or
  raw Facebook payloads in any new log, fixture, or visible UI text.
- Web UI badge renders all four health values with the documented
  tone, the inventory and detail pages display the badge, the detail
  page shows the health timestamp, and the provisioning card adapts
  its label and copy per state.
- DB-backed HTTP and `test:db` round-trip the new recovery paths
  without changing the persisted schema.

## Sprint Status

Sprint 054B is accepted as the runtime authentication health
foundation for Sprint 055. Sprint 055 is implemented as described
above. This sprint is not marked complete or advanced beyond its
declared scope.
