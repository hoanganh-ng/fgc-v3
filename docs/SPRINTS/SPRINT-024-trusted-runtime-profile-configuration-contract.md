# Sprint 024: Trusted Runtime Profile Configuration Contract

## Goal

Define and implement a trusted, lease-scoped runtime profile configuration contract so Collector Runtime can fetch the browser launch configuration it needs after a successful Profile Manager checkout.

This sprint does not add browser automation, Facebook login or navigation, network interception, scheduling, queues, direct database access from Collector Runtime, Web UI, Content Builder, or Publisher work.

## Checkout Response Inspection

The existing Profile Manager checkout route, `POST /collector/profiles/checkout`, currently returns:

- `lease.id`, `lease.profileId`, `lease.leasedAt`, `lease.expiresAt`, `lease.releasedAt`, and `lease.status`.
- `profile.profileId`.
- Runtime configuration groups: `networkContext`, `hardwareFingerprint`, `authenticationState`, `behavioralPersona`, `temporalRoutine`, `safetyThresholds`, and `contentAffinities`.

The response contains the core browser-relevant profile groups, including authentication state and network context. However, checkout mixes lease allocation with configuration delivery and does not provide a separate trusted runtime-configuration contract that can be requested, audited, or guarded by an active `leaseId` after checkout. Collector Runtime Sprint 023 also intentionally maps checkout to only `profileId`, `leaseId`, and optional lease expiry.

What remains missing before browser capture:

- A named runtime profile configuration DTO owned by Profile Manager application contracts.
- A lease-scoped access pattern for trusted runtime callers.
- Active lease validation at configuration-read time.
- Continued separation from public profile read DTOs, which must stay safe and omit sensitive authentication and proxy credential material.
- Future authentication, authorization, and audit controls for trusted internal runtime callers.

## Scope

- Add a Profile Manager application use case for runtime profile configuration lookup by `leaseId`.
- Return only the browser-runtime fields required by the current planned capture adapter:
  - `profileId`
  - `leaseId`
  - `leaseExpiresAt`
  - `hardwareFingerprint`
  - `networkContext`
  - `authenticationState`
  - `temporalRoutine`
  - `safetyThresholds`
  - `contentAffinities`
- Do not include provisioning token data, token hashes, raw provisioning tokens, or unrelated management read fields.
- Validate that the lease exists, is `ACTIVE`, is not expired, and belongs to a profile that is still `BUSY`.
- Add an internal HTTP route:
  - `GET /collector/profile-leases/:leaseId/runtime-configuration`
- Keep public profile read DTOs safe and unchanged.
- Extend the Collector Runtime `ProfileManagerHttpClient` with `getRuntimeProfileConfiguration(leaseId)`.
- Map success, 404, 409, server, invalid-response, and network failures to structured Collector Runtime results.
- Add focused application, HTTP, and Collector Runtime HTTP client tests.
- Document that browser automation remains deferred to Sprint 025.

## Out Of Scope

- Playwright, Puppeteer, Selenium, browserless, stealth plugins, CAPTCHA solving, bypass logic, rate-limit evasion, or access-control bypass.
- Real Facebook login, navigation, network interception, or payload capture.
- Schedulers or queues.
- Direct database access from Collector Runtime.
- Collector Runtime imports of Profile Manager repositories, database adapters, Drizzle, PostgreSQL, or composition roots.
- Profile Manager checkout eligibility or leasing behavior changes.
- Content Manager behavior changes.
- New database tables or migrations.
- Public read DTO expansion for cookies, local storage, proxy credentials, or raw session material.
- Web UI.
- Content Builder.
- Publisher.

## Acceptance Criteria

- Profile Manager exposes a trusted application use case for lease-scoped runtime profile configuration.
- Runtime configuration is returned only for an active, unexpired lease whose profile is still in the leased runtime state.
- Runtime configuration includes browser-relevant hardware, network, authentication, temporal, safety, and affinity fields.
- Runtime configuration omits provisioning token material and token hashes.
- `GET /collector/profile-leases/:leaseId/runtime-configuration` returns the trusted DTO for valid active leases.
- Missing, released, expired, or otherwise inactive leases map to expected HTTP failures.
- Public profile list/detail and provisioning configuration read contracts remain safe.
- Collector Runtime `ProfileManagerHttpClient` can fetch runtime configuration by `leaseId` without using public profile read endpoints.
- Browser automation and network capture are still not implemented.
- Typecheck and default tests pass.

## Verification

```bash
pnpm run typecheck
pnpm test
git status --short
```
