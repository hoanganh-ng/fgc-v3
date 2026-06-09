# Sprint 023: Collector Runtime Profile Manager HTTP Adapter

## Goal

Implement the concrete Collector Runtime adapter for checking out and releasing Collector Profile Manager leases over HTTP.

This sprint connects the Sprint 022 runtime orchestration flow to the existing Profile Manager HTTP API. It does not add browser automation, Facebook login/navigation, network interception, scheduling, queues, direct database access, Web UI, Content Builder, or Publisher work.

## Scope

- Inspect and use the existing Profile Manager HTTP route contracts:
  - `POST /collector/profiles/checkout`
  - `POST /collector/profile-leases/:leaseId/release`
- Implement a runtime-owned HTTP adapter for the existing `ProfileLeasePort`.
- Add `PROFILE_MANAGER_BASE_URL` configuration for the adapter and avoid hard-coded service URLs.
- Map successful checkout responses to the runtime-owned checkout result.
- Map successful lease release responses to the runtime-owned release result.
- Map expected HTTP failures and network failures to structured runtime failures.
- Keep Profile Manager business rules, checkout eligibility, and leasing behavior in Collector Profile Manager.
- Add focused adapter tests using the existing fetch-mocking style.
- Add a small runtime orchestration test with fake capture/submission and the real Profile Manager HTTP client against a fake fetch implementation.
- Verify Collector Runtime does not import Profile Manager repositories, database adapters, Drizzle, PostgreSQL, or composition roots.
- Document current checkout response contents and the future need for a trusted runtime-profile configuration contract before browser capture.

## Out Of Scope

- Browser automation.
- Playwright, Puppeteer, Selenium, stealth plugins, CAPTCHA solving, bypass logic, rate-limit evasion, or access-control bypass.
- Real Facebook login, navigation, network interception, or payload capture.
- Schedulers or queues.
- Direct database access from Collector Runtime.
- Repository imports from Collector Profile Manager or Content Manager.
- Profile Manager business behavior changes.
- Content Manager business behavior changes.
- New database tables or migrations.
- New Fastify routes except tiny fake test servers if needed.
- Public read DTO expansion for cookies, local storage, proxy credentials, or raw session material.
- Web UI.
- Content Builder.
- Publisher.

## Runtime Profile Configuration Check

The current checkout HTTP response returns:

- `lease.id`, `lease.profileId`, `lease.leasedAt`, `lease.expiresAt`, `lease.releasedAt`, and `lease.status`.
- `profile.profileId`.
- Browser/runtime configuration groups, including `networkContext`, `hardwareFingerprint`, `authenticationState`, `behavioralPersona`, `temporalRoutine`, `safetyThresholds`, and `contentAffinities`.

Sprint 023 must not expand public read DTOs or expose cookies, local storage, proxy credentials, or raw session material through safe read APIs. The HTTP adapter may consume the checkout response internally, but the runtime port should return only the lease identity fields needed by the Sprint 022 orchestration flow.

Before real browser capture, add a future trusted internal runtime-profile configuration contract guarded by `leaseId` so sensitive runtime config can be fetched deliberately and audited.

## Acceptance Criteria

- Collector Runtime has a concrete HTTP adapter implementing the runtime-owned profile lease port.
- `PROFILE_MANAGER_BASE_URL` is required by adapter configuration and no production code hard-codes localhost.
- Checkout posts to `/collector/profiles/checkout` and maps success, validation/not-found/conflict/server failures, no-profile-available style failures, and network failures.
- Lease release posts to `/collector/profile-leases/:leaseId/release` and maps success, not-found/conflict/server failures, and network failures.
- Release failure remains representable to the Sprint 022 orchestration result.
- Tests cover the adapter request shape, response mapping, network failures, and import boundary guardrails.
- A small runtime orchestration test proves fake capture/submission can run with the real Profile Manager HTTP client and release the lease.
- No database, migration, browser automation, network interception, scheduler, queue, Web UI, Content Builder, or Publisher changes are introduced.
- Typecheck and default tests pass.

## Verification

```bash
pnpm run typecheck
pnpm test
git status --short
```
