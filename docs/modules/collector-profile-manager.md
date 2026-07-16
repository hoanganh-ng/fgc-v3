# Collector Profile Manager

## Purpose and current capability

Collector Profile Manager is the identity and readiness authority for automated Facebook profiles. It manages profile lifecycle, provisioning, session ingestion, checkout eligibility, leasing, profile-source access state, and lease-scoped trusted runtime configuration consumed by browser providers.

## Owns

- Profile operational status and account maturity stage transitions
- Profile property invariants and hardware fingerprint rules
- Provisioning token lifecycle and session ingestion
- Checkout eligibility (temporal windows, cooldowns, safety thresholds, authentication health)
- Profile lease purposes: `COLLECTION`, `AMBIENT_EXERCISE`, `ASSISTED_GROUP_ACCESS`, `HOME_FEED_COLLECTION`
- Profile-source access records (`profileId + sourceGroupId`)
- Trusted runtime configuration for active leases
- Authentication-health transitions on lease release

## Does not own

- Browser automation execution
- Collection task orchestration or run records
- Content Manager source groups, publishers, or content items
- Web UI rendering
- HTTP framework implementation
- Content building or publishing

## Public ports, contracts, and cross-module communication

- **HTTP**: `/collector/profiles/*` routes via `src/interfaces/http/routes/collector-profile-manager.routes.ts`
- **Outbound port**: source group reference validation through `ContentManagerSourceGroupReferenceAdapter` in composition — not Content Manager repositories
- **Consumed by**: Collector Runtime HTTP clients, operator provisioning CLI, Web UI profile pages

## Important source paths and entrypoints

- Domain: `src/collector-profile-manager/domain/`
- Application: `src/collector-profile-manager/application/`
- Composition: `src/composition/collector-profile-manager/`
- HTTP schemas: `src/interfaces/http/schemas/collector-profile-manager.http-schemas.ts`
- Web client: `apps/web/src/lib/api/profile-manager-client.ts`

## Critical invariants and sensitive-data rules

- Checkout is atomic; one active lease per profile
- Collection checkout requires `status = READY` and `accountStage = COLLECTION_READY`
- Network context mode is explicit: `UNCONFIGURED | DIRECT | PROXY` — never infer direct from null proxy
- Never expose cookies, localStorage, proxy credentials, tokens, or fingerprint secrets in safe read DTOs or logs
- Trusted runtime configuration is available only within an active matching lease

## Verification anchors

```bash
pnpm test src/collector-profile-manager
pnpm test:db src/collector-profile-manager
pnpm test:http:db src/collector-profile-manager
```

Boundary test: `src/composition/collector-profile-manager/collector-profile-manager.boundary.test.ts`

## Known change hotspots and limitations

- `src/collector-profile-manager/application/checkout-use-cases.test.ts` (~1,982 lines) — broad checkout matrix coverage
- `src/collector-profile-manager/domain/checkout-eligibility.ts` — central eligibility logic
- `src/interfaces/http/schemas/collector-profile-manager.http-schemas.ts` (~1,123 lines) — HTTP schema surface
- HTTP authentication/authorization remains deferred; routes are not production-public without future access control
