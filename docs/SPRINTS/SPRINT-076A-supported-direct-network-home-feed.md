# Sprint 076A — Supported Direct-Network Home-Feed Baseline

## Status

Accepted by the Product Owner on 2026-07-14 at commit `f7a4970`. Sprint 076B —
Reviewable Discovered-Source Identity and Sprint 076 are also accepted. Sprint
077 is active.

## Acceptance Record

- Focused network-mode verification: 164 tests passed.
- Backend/Web typecheck and Web production build passed.
- Full unit suite: 1,965 passed, 18 skipped.
- HTTP DB suite: 214 passed; Docker E2E suite: 19 passed.
- Profile-focused Docker DB verification: 31 passed, including mapper, journal,
  repository, and migration `0029` coverage.
- Full Docker DB noise was separated as pre-existing isolated-database,
  shared-state, and concurrent-claim harness behavior; affected profile suites
  passed.
- Proposed `V06` used supported `DIRECT` configuration with no checkout bypass,
  reached `HOME_FEED`, captured 72 payloads, extracted/submitted six items, and
  released its lease.
- No proxy/session secrets were present in the safe runner output.

`V06` is the first Sprint 076 supported-baseline sample.

## Goal

Make a no-proxy collector profile an explicit, persisted, validated network
mode so the normal Facebook home-feed flow can run through standard checkout and
browser launch without temporary eligibility bypasses.

Keep the accepted normal home target:

```text
https://www.facebook.com/
```

Do not restore the chronological `?sk=h_chr` override.

## Why This Correction Exists

Sprint 076 exploratory samples proved capture, extraction, submission, review,
merge, and promotion behavior, but every sample temporarily bypassed the
accepted proxy-required checkout rule. Those samples cannot prove the supported
end-to-end path.

The existing contracts are internally inconsistent:

- `NetworkContextSchema` allows `proxy: null`;
- the Web UI already lets an operator choose proxy mode `None`;
- browser launch already omits proxy settings when the proxy is null;
- profile creation uses `proxy: null` for an unconfigured profile;
- provisioning and checkout treat every null proxy as missing configuration.

A persisted mode is required to distinguish an unconfigured profile from an
operator-approved direct-network profile.

## Capability Summary

> A profile explicitly configured with network mode `DIRECT`, no proxy, and no
> proxy killswitch passes normal checkout, receives a trusted runtime
> configuration that declares `DIRECT`, and launches Playwright/CloakBrowser
> without proxy settings. `UNCONFIGURED` still fails provisioning and checkout;
> `PROXY` still requires complete proxy routing and preserves fail-closed
> behavior.

This sprint also adopts the normal Facebook home URL change already present in
commit `ee0883b`, subject to the full verification required below.

## Network Mode Contract

Add the closed enum:

```text
UNCONFIGURED
DIRECT
PROXY
```

`NetworkContext` becomes:

```text
mode: UNCONFIGURED | DIRECT | PROXY
proxy: ProxyRouting | null
killswitch:
  enabled: boolean
  failClosed: boolean
```

Strict invariants:

- `UNCONFIGURED`: `proxy === null`; not provisionable or checkout eligible.
- `DIRECT`: `proxy === null`; `killswitch.enabled === false` and
  `killswitch.failClosed === false`.
- `PROXY`: `proxy !== null`; existing proxy validation is preserved.
- Unknown modes, contradictory proxy/mode combinations, and direct mode with
  proxy-killswitch flags enabled are rejected at domain, HTTP, persistence, and
  browser-launch boundaries.
- Proxy credentials remain trusted-only and never appear in generic read DTOs,
  logs, docs, errors, or Web UI responses.

Do not infer direct mode merely because `proxy` is null. It must be explicitly
persisted as `DIRECT`.

## Required Context

Read only:

- `AGENTS.md`;
- `docs/SPRINTS/active.md`;
- this sprint;
- `docs/SPRINTS/SPRINT-076-repeated-live-collector-validation.md`;
- `docs/SPRINTS/SPRINT-076-live-validation-evidence.md`;
- `docs/PROJECT_SNAPSHOT.md`;
- `docs/ROADMAP.md`;
- `docs/ARCHITECTURE.md`;
- `docs/MODULE_BOUNDARIES.md`;
- `docs/TESTING_STRATEGY.md`;
- `docs/STORAGE/collector-profile-manager-storage-mapping.md`;
- `docs/modules/collector-profile-manager.md`;
- `docs/modules/collector-runtime.md`;
- `src/collector-profile-manager/domain/profile-properties.ts`;
- `src/collector-profile-manager/domain/profile.schemas.ts`;
- `src/collector-profile-manager/domain/profile.ts`;
- `src/collector-profile-manager/domain/checkout-eligibility.ts`;
- directly related domain/application tests;
- `src/collector-profile-manager/application/profile-read-dtos.ts`;
- `src/collector-profile-manager/application/use-cases/get-runtime-profile-configuration.use-case.ts`;
- Collector Profile Manager HTTP routes and strict schemas;
- the Collector Profile persistence mapper/schema and directly related tests;
- `src/collector-runtime/infrastructure/browser-providers/browser-provider-launch-config.ts`;
- Playwright, CloakBrowser, and provisioning browser-provider launch tests
  directly affected by network configuration;
- `apps/web/src/lib/api/profile-manager-client.ts` and tests;
- `apps/web/src/features/profiles/profile-configuration-form.tsx` and directly
  related tests;
- `src/collector-runtime/infrastructure/facebook-home-feed-browser-payload-capture.ts`
  and its focused test only to retain the normal home URL;
- the latest Drizzle journal/snapshot/migration files.

Do not scan unrelated collector behavior, Content Manager, Content Builder, or
historical sprints.

## Requirements

### Domain and provisioning

- Add and export the closed network-mode enum, schema, type, and type guard.
- New profiles start with `mode: UNCONFIGURED`, `proxy: null`, and the
  existing safe unconfigured values.
- Required-profile configuration treats `UNCONFIGURED` as missing.
- Required-profile configuration accepts a valid explicit `DIRECT` context.
- Existing valid `PROXY` behavior remains unchanged.
- Add accept/reject tests for every mode/invariant combination.

### Checkout eligibility

- Standard checkout for every existing lease purpose accepts valid `DIRECT`
  and valid `PROXY` contexts.
- `UNCONFIGURED` remains ineligible with the existing safe
  `NETWORK_CONTEXT_MISSING` reason.
- Invalid contradictory states never become eligible.
- Remove no other readiness, authentication-health, account-stage, temporal,
  cooldown, safety, source-access, fingerprint, or lease rule.
- Add focused coverage for `HOME_FEED_COLLECTION` and the shared eligibility
  function, including proof that no comment/bypass is required.

### Persistence compatibility

Add one forward migration for the `network_context` JSONB shape:

- rows with non-null `proxy` become `mode: PROXY`;
- rows with null `proxy` and profile status `READY` or `BUSY` become
  `mode: DIRECT`, with proxy-killswitch flags set to `false/false`;
- rows with null `proxy` in `PENDING_CONFIG` or `PENDING_LOGIN` become
  `mode: UNCONFIGURED`;
- no proxy credentials or other network fields are logged or copied into
  migration output;
- migration is idempotent in result and registered in the Drizzle journal;
- mapper/schema tests reject unknown or contradictory persisted modes.

No new table or column is required; this is a JSONB contract migration.

### Trusted runtime and browser launch

- Trusted runtime configuration carries the explicit network mode.
- `DIRECT` produces no browser-provider proxy settings.
- `PROXY` produces the existing proxy settings unchanged.
- `UNCONFIGURED` or contradictory configuration fails closed with the existing
  safe browser-configuration error family.
- Playwright, CloakBrowser, provisioning, source-group, exercise, assisted
  access, and home-feed consumers continue to use the shared launch-config seam.
- Do not expose trusted proxy credentials through generic DTOs or errors.

### HTTP and Web UI

- Strict request/response/OpenAPI schemas include the network mode.
- Generic profile reads expose only the safe mode, non-secret proxy metadata
  when present, and killswitch flags; credentials remain omitted.
- Configuration UI offers `Direct network` and `Proxy`.
- An unconfigured profile shows an explicit unconfigured state until the
  operator chooses.
- Choosing `Direct network` submits `mode: DIRECT`, `proxy: null`, and
  disables/clears proxy-only and proxy-killswitch controls.
- Choosing `Proxy` submits `mode: PROXY` and preserves existing validation.
- Profile detail displays `Direct network` or `Proxy` without displaying
  secrets.
- No new endpoint is required.

### Normal home URL

- Keep `FACEBOOK_HOME_FEED_URL === "https://www.facebook.com/"`.
- Keep/update the focused navigation assertion.
- Do not add a URL-mode setting or return to the chronological override.
- Record V01–V03 as chronological exploratory evidence and V04–V05 as
  normal-home exploratory evidence; none count as final supported-path baseline
  because all used a temporary checkout bypass.

### Documentation

Update durable module/storage/runtime documentation with the explicit mode and
compatibility behavior. Update project snapshot and roadmap only with
implemented, verified facts. Keep Sprint 076 paused until Product Owner review
accepts Sprint 076A.

## Out of Scope

- Proxy acquisition, rotation, testing, geolocation, or credential management.
- VPN support or host-network manipulation.
- Enforcing a network-level killswitch outside the existing browser launch
  seam.
- Authentication/session reprovisioning.
- Provider-default changes.
- Capture/extraction changes beyond retaining the normal home URL.
- Execution-bound changes.
- Content Manager, discovered-source, promotion, or Content Builder behavior.
- Any attempt to count bypassed samples as final supported-path evidence.

## Verification

Builder must run and report exact results:

```bash
pnpm exec vitest run   src/collector-profile-manager/domain/profile-domain.test.ts   src/collector-profile-manager/domain/checkout-eligibility.test.ts   src/collector-profile-manager/application/checkout-use-cases.test.ts   src/collector-runtime/infrastructure/browser-providers/browser-provider-launch-config.test.ts   src/collector-runtime/infrastructure/facebook-home-feed-browser-payload-capture-adapter.test.ts

pnpm typecheck
pnpm test
pnpm web:typecheck
pnpm web:build
pnpm test:db:docker
pnpm test:http:db
pnpm test:e2e:docker
git diff --check
```

If an exact focused path differs, use the nearest existing directly related test
and report the substitution. Do not suppress or relabel failures. Pre-existing
environment/harness failures must be separated with baseline evidence.

## Required Live Proof

After automated verification, execute exactly one Playwright home-feed run using
the existing profile configured through supported UI/API as `DIRECT`:

- no source comment or temporary bypass;
- normal `https://www.facebook.com/` target;
- standard checkout succeeds;
- capture page state is `HOME_FEED`;
- terminal status and safe aggregate counts are recorded;
- lease releases;
- trusted/runtime output and logs expose no proxy/session secrets.

This proof validates only Sprint 076A. Preserve its safe facts as proposed
sample `V06`; it becomes the first final-baseline sample only after the Product
Owner accepts Sprint 076A and Sprint 076B.

## Acceptance Gate

Sprint 076A is complete only when:

- the explicit three-state network contract and invariants are implemented;
- legacy JSONB rows are backfilled according to the approved rules;
- valid `DIRECT` passes provisioning and checkout without bypasses;
- `UNCONFIGURED` remains blocked;
- valid `PROXY` behavior remains unchanged;
- browser launch omits proxy settings only for valid `DIRECT`;
- all contradictory and unknown states fail closed;
- HTTP/UI safely support explicit direct selection;
- the normal home URL remains the accepted target;
- focused, typecheck, unit, Web, DB, HTTP DB, and E2E verification is reported;
- one clean supported `DIRECT` Playwright live run succeeds and releases its
  lease;
- no sensitive data is exposed;
- Product Owner review accepts the result.

## Stop Conditions

Stop and report instead of implementing when:

- direct mode requires bypassing another accepted readiness/safety rule;
- a new endpoint or browser-provider-specific direct-mode fork appears
  necessary;
- migration cannot distinguish legacy rows using the approved status rule;
- proxy credentials would enter a generic DTO, log, fixture, or error;
- runtime launch cannot fail closed for contradictory network configuration;
- a defect outside this network-mode/home-target scope is discovered.

## Builder Handoff Prompt

Implement Sprint 076A —
`docs/SPRINTS/SPRINT-076A-supported-direct-network-home-feed.md`.

Use the exact Network Mode Contract and Required Context. Make direct networking
an explicit supported profile configuration, not a null-proxy bypass. Preserve
all non-network checkout gates and existing proxy behavior. Keep the normal
Facebook home URL already present in commit `ee0883b`.

Run every required verification command. Then configure the existing profile as
`DIRECT` through supported UI/API and perform exactly one clean Playwright
home-feed run with no temporary source edits. Return exact files changed,
migration/backfill evidence, verification results, and the safe live-run
summary.

Do not commit or push. Do not accept Sprint 076A, activate Sprint 076B, resume
Sprint 076, activate Sprint 077, or begin Content Builder.
