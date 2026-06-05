# Sprint 003: Domain Schema Source of Truth

## Goal

Make Collector Profile Manager runtime validation use an explicit schema source of truth that stays synchronized with TypeScript domain types.

## Scope

- Add a runtime schema validation library using the existing package manager.
- Use Zod unless another schema validation library already exists.
- Define Collector Profile Manager domain schemas under `src/collector-profile-manager/domain/`.
- Cover these domain shapes with schemas:
  - Profile status.
  - Identity & Metadata.
  - Network Context.
  - Hardware Fingerprinting.
  - Authentication State.
  - Behavioral Persona.
  - Temporal Routine.
  - Safety Thresholds.
  - Content Affinities.
  - Provisioning token state.
  - Full collector profile.
- Infer TypeScript types from schemas where practical while preserving domain readability.
- Replace or adapt existing validation helpers so the public validation API remains easy to use.
- Add focused automated tests for schema validation behavior.
- Preserve existing state machine behavior and hardware fingerprint immutability.
- Update project brain documentation for the active sprint.

## Out of Scope

- HTTP APIs or routes.
- Database repositories, schemas, migrations, or persistence adapters.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Checkout engine implementation.
- Provisioning token generation.
- Frontend UI.
- Content Builder or Content Publisher code.
- Application use cases.
- Major domain redesign unrelated to schema validation.
- Documentation or implementation for bypassing platform security, anti-abuse, CAPTCHA, or fraud-detection systems.

## Acceptance Criteria

- Zod or an equivalent existing schema validation library is available to domain code.
- Full Collector Profile Manager schema definitions exist in the domain layer.
- The full collector profile schema clearly preserves the eight property groups:
  - Identity & Metadata.
  - Network Context.
  - Hardware Fingerprinting.
  - Authentication State.
  - Behavioral Persona.
  - Temporal Routine.
  - Safety Thresholds.
  - Content Affinities.
- TypeScript domain types are synchronized with schemas where practical.
- Public validation helpers return typed parsed values or structured validation errors without requiring callers to catch basic validation failures.
- Tests cover valid profiles and invalid status, missing group, provisioning token, cookie/local storage, temporal window, and content affinity shapes.
- Existing state machine tests pass.
- Existing hardware fingerprint immutability tests pass.
- Typechecking passes.
- Tests pass.
- No out-of-scope application, adapter, infrastructure, HTTP, database, queue, browser automation, frontend, Content Builder, or Content Publisher layers are introduced.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`

## Completion Notes

Sprint 003 is complete when Collector Profile Manager validation is backed by readable domain schemas, the public validation API remains stable, schema-focused tests pass, and project brain docs point to this sprint.
