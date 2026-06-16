# Sprint 054B: Runtime Authentication Health Reporting and Checkout Enforcement

## Goal

Extend the existing lease-release contract with an optional
`authenticationObservation` ("LOGIN_REQUIRED" or "CHECKPOINT_REQUIRED"),
persist it through the Collector Profile Manager domain-owned transition
policy, and enforce `authenticationHealth === HEALTHY` for every checkout
(COLLECTION, AMBIENT_EXERCISE, ASSISTED_GROUP_ACCESS).

Runtime observations are emitted only when a Collector Runtime consumer
captures the shared observer's exact blocking state. Cookies, localStorage,
tokens, raw payloads, and trusted runtime configuration remain excluded.

## Scope

### Collector Profile Manager

- Add a domain-owned transition policy in
  `src/collector-profile-manager/domain/profile-authentication-health.ts`:
  - `applyProfileAuthenticationHealthObservation(current, observation)`
    returns `{ nextHealth, changed }` and is pure.
  - `LOGIN_REQUIRED` → `REAUTH_REQUIRED`.
  - `CHECKPOINT_REQUIRED` → `CHECKPOINT_REVIEW_REQUIRED`.
  - `CHECKPOINT_REVIEW_REQUIRED` is sticky: a later `LOGIN_REQUIRED`
    observation cannot downgrade the checkpoint state.
  - Repeated equivalent observations are idempotent
    (`changed === false`).
  - Successful session ingestion remains the only recovery transition
    to `HEALTHY`.
- Extend `ReleaseProfileLeaseInput` with
  `authenticationObservation?: "LOGIN_REQUIRED" | "CHECKPOINT_REQUIRED"`.
- Within the existing release transaction:
  - Validate active, unexpired lease.
  - Validate the owning profile is `BUSY`.
  - Apply the optional health transition (idempotent when not provided).
  - Apply the normal profile and lease release.
  - Persist profile and lease atomically.
- Closed or expired leases must not change health.
- Release without the optional field must preserve health and timestamp
  (backward compatible).
- Add `AUTHENTICATION_HEALTH_NOT_HEALTHY` to the shared checkout
  eligibility policy for `COLLECTION`, `AMBIENT_EXERCISE`, and
  `ASSISTED_GROUP_ACCESS`.
- HTTP body schema `ReleaseProfileLeaseHttpBodySchema` (Zod) and JSON
  route schema accept the optional `authenticationObservation`. The
  strict Zod schema rejects unknown values and unknown properties.

### Collector Runtime

- Extend the application-owned `ProfileLeaseReleaseInput` with
  `authenticationObservation?: "LOGIN_REQUIRED" | "CHECKPOINT_REQUIRED"`.
- `ProfileManagerHttpClient.releaseProfileLease` serializes the optional
  field only when present.
- Collection (`RunFacebookGroupCollectionUseCase`): on exact capture
  errorCode `LOGIN_REQUIRED` or `CHECKPOINT_REQUIRED`, include that
  observation in the release call. The use case must not infer from
  `loginRedirectSuspected`, arbitrary messages, URLs, navigation
  errors, or missing payloads.
- Account exercise (`exercise-runner.ts`): include the shared
  observer's `LOGIN_REQUIRED` or `CHECKPOINT_REQUIRED` outcome in the
  release call. Preserves checkpoint precedence and existing cleanup /
  safe run summaries.
- Profile-source access browser check
  (`profile-source-access-browser-check.ts`): pass the shared
  observer's blocking state to `releaseLeaseSafely` before returning
  the existing safe observation. The existing source-access
  classification and mutation flow is preserved.
- Healthy and unrelated releases omit the field.
- Sensitive data rules (cookies, localStorage, raw payloads, proxy
  credentials, trusted runtime configuration, tokens, page text, raw
  HTML, screenshots) remain unchanged.

## Architecture Boundaries

- Domain owns the transition policy. Application and infrastructure ports
  call the policy without weakening it.
- No new event tables, retries, outbox work, or indexes are introduced.
- No manual health editing endpoint is added. Successful session
  ingestion remains the only recovery transition to `HEALTHY`.
- No automatic login, credential entry, CAPTCHA solving, or checkpoint
  bypass is added.
- No automatic account-stage changes are introduced.
- No source-access redesign or browser-provider redesign is performed.
- Sprint 054B stays within Collector Profile Manager, Collector Runtime
  (lease release wiring), the operator profile exercise runner, and the
  HTTP schema.

## Out Of Scope

- Web UI changes.
- Manual health editing.
- Automatic login, credential entry, CAPTCHA solving, or checkpoint
  bypass.
- Automatic account-stage changes.
- Clearing health after an ordinary successful browser run.
- New migrations, event tables, retries, outbox work, or indexes.
- Facebook detection heuristic changes.
- Source-access redesign.
- Browser-provider redesign.
- Unrelated refactoring or dependencies.
- Commits or pushes.

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

- Health transition mappings, precedence, idempotency, and timestamps.
- Release without observation preserves health and timestamp.
- Atomic release with `LOGIN_REQUIRED` and `CHECKPOINT_REQUIRED`
  observations.
- Closed / expired lease rejection without mutation.
- Strict HTTP request validation (unknown values, unknown properties,
  missing observation still works).
- Backward-compatible release requests.
- Checkout rejection for every non-HEALTHY state
  (`NOT_PROVISIONED`, `REAUTH_REQUIRED`, `CHECKPOINT_REVIEW_REQUIRED`)
  across all three purposes.
- Healthy checkout regressions for all three purposes.
- Collection exact-code mapping (`LOGIN_REQUIRED` → observation;
  `CHECKPOINT_REQUIRED` → observation; non-exact code → no observation;
  `loginRedirectSuspected` diagnostics → no observation).
- Exercise observation propagation (initial login wall, initial
  checkpoint wall, both observed → checkpoint wins, healthy release
  omits the field).
- Access-check propagation while preserving the existing source-access
  observation (`FACEBOOK_LOGIN`, `FACEBOOK_CHECKPOINT`).
- Healthy releases omitting the property in all three call sites.
- Sensitive-data exclusion (no cookies, localStorage, tokens, proxy
  credentials, raw payloads, page HTML, screenshots, fingerprint
  secrets).

## Sprint Status

Sprint 054A remains accepted. Sprint 054B is implemented as described
above. This sprint is not marked complete or advanced beyond its
declared scope.
