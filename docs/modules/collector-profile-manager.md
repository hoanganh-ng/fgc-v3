# Collector Profile Manager

## Ownership
- Profile identity and operational lifecycle (status transitions).
- Account maturity/readiness stage and transition rules.
- Profile property invariants.
- Provisioning token lifecycle.
- Session ingestion rules.
- Checkout eligibility rules (including temporal windows, cooldowns, safety thresholds, and `authenticationHealth === HEALTHY` for every checkout purpose).
- Profile lease management and lease purpose rules (`COLLECTION`, `AMBIENT_EXERCISE`, `ASSISTED_GROUP_ACCESS`, `HOME_FEED_COLLECTION`).
- Profile authentication-health transition policy (`REAUTH_REQUIRED`, `CHECKPOINT_REVIEW_REQUIRED`) driven only by the optional `authenticationObservation` accepted on lease release.
- Guarded reprovisioning eligibility (`StartProfileProvisioningUseCase`): `PENDING_CONFIG` initial, `PENDING_LOGIN` token restart, and `READY` recovery only when `authenticationHealth` is `REAUTH_REQUIRED` or `CHECKPOINT_REVIEW_REQUIRED`. `READY` with `HEALTHY` or `NOT_PROVISIONED` and `BUSY` are rejected. `accountStage`, hardware fingerprint, configuration, and `authenticationState` are never modified by start or restart. Successful session ingestion is the only path that restores `HEALTHY`.
- Profile-source access state (mapping profileId + sourceGroupId).
- Trusted runtime configuration provisioning for browsers.

## Does Not Own
- Browser automation execution.
- Collection task orchestration.
- Content Manager source group records or entry route metadata.
- Web UI rendering.
- Content building or publishing.

## Important Source Paths
- `src/collector-profile-manager/domain/`
- `src/collector-profile-manager/application/`
- `src/collector-profile-manager/infrastructure/`
- `src/collector-profile-manager/interface/`
- `src/collector-profile-manager/composition/`

## Important Entrypoints
- `Fastify API`: `src/collector-profile-manager/interface/http/` (e.g. `/collector/profiles`)
- `Composition Root`: `src/collector-profile-manager/composition/root.ts`

## Critical Invariants
- Checkout rules must be respected; profiles are leased atomically to prevent concurrent access.
- `accountStage` is independent of operational `status`. Collection checkout requires `accountStage = COLLECTION_READY`.
- Network context uses an explicit mode `UNCONFIGURED | DIRECT | PROXY`. Do not
  infer direct networking from a null proxy alone. `UNCONFIGURED` fails required
  configuration and checkout (`NETWORK_CONTEXT_MISSING`). Valid `DIRECT` and
  `PROXY` pass provisioning and standard checkout. Contradictory mode/proxy/
  killswitch combinations are rejected at domain, HTTP, persistence, and launch
  boundaries. Generic read DTOs expose `mode` and non-secret proxy metadata only.

## Cross-Module Communication
- Does not import Content Manager repositories or runtime implementation directly.
- Communicates with Content Manager via explicit application ports (e.g., validating `sourceGroupId` existence).

## Sensitive Data Rules
- Never expose raw cookies, localStorage values, proxy credentials, tokens, or fingerprint secrets in logs, generic read DTOs, or the Web UI.
- Trusted runtime configurations are only generated within a lease context.

## Relevant Verification Commands
```bash
pnpm test src/collector-profile-manager
pnpm test:db src/collector-profile-manager
pnpm test:http:db src/collector-profile-manager
```
