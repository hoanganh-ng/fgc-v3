# Sprint 004: Collector Profile Application Use Cases

## Goal

Add the Collector Profile Manager application layer that coordinates domain behavior through explicit ports, without introducing infrastructure adapters.

## Scope

- Create the Collector Profile Manager application source structure under `src/collector-profile-manager/application/`.
- Define application-owned ports for profile persistence, provisioning token generation, and clock access.
- Implement application use cases for:
  - Creating a pending profile shell.
  - Updating configurable profile groups.
  - Starting profile provisioning.
  - Reading provisioning configuration from a valid token.
  - Ingesting a provisioned authentication session.
- Keep orchestration in the application layer and business invariants in the domain layer.
- Validate profiles before saving through application use cases.
- Use in-memory fake port implementations only in tests.
- Add application-level errors for not found, conflicts, invalid configuration, invalid token state, expired or consumed tokens, and invalid operations.
- Add focused automated tests for the application use cases.
- Update project brain documentation for the active sprint.

## Out of Scope

- HTTP APIs or routes.
- Database repositories, schemas, migrations, or persistence adapters.
- ORM integration.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Checkout engine implementation.
- Profile leasing.
- Frontend UI.
- Content Builder or Content Publisher code.
- Production token generator adapters.
- Production clock adapters.
- External API integrations.

## Acceptance Criteria

- Application ports exist for profile repository, token generation, and clock access.
- `CreateProfileUseCase` creates a `PENDING_CONFIG` profile shell with all eight property groups initialized and no authentication session or provisioning token assigned.
- `UpdateProfileConfigurationUseCase` updates configurable groups without mutating authentication state and rejects hardware fingerprint overwrites.
- `StartProfileProvisioningUseCase` only starts from `PENDING_CONFIG`, checks required configuration, assigns a one-time provisioning token, transitions to `PENDING_LOGIN`, validates, and saves.
- `GetProvisioningConfigurationUseCase` returns only profile id, network context, and hardware fingerprint for a valid unexpired token.
- `IngestProfileSessionUseCase` accepts cookies and local storage for a valid pending-login token, consumes the token, transitions to `READY`, validates, and saves.
- Tests cover creation, provisioning success and failure cases, provisioning configuration shape, session ingestion, token reuse rejection, authentication-state preservation during configuration updates, and hardware fingerprint immutability.
- Existing domain state machine tests pass.
- Existing hardware fingerprint immutability tests pass.
- Typechecking passes.
- Tests pass.
- No out-of-scope application adapters, infrastructure, HTTP, database, queue, browser automation, frontend, Content Builder, or Content Publisher layers are introduced.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`

## Completion Notes

Sprint 004 is complete when Collector Profile Manager application use cases coordinate domain behavior through explicit ports, focused tests pass, and project brain docs point to this sprint.
