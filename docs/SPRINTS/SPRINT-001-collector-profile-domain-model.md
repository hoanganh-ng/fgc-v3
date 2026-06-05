# Sprint 001: Collector Profile Domain Model

## Goal

Create the framework-independent domain model foundation for the Collector Profile Manager.

## Scope

- Add the Collector Profile Manager domain source structure under `src/collector-profile-manager/domain/`.
- Define the four profile statuses: `PENDING_CONFIG`, `PENDING_LOGIN`, `READY`, and `BUSY`.
- Implement the allowed profile state transitions:
  - `PENDING_CONFIG -> PENDING_LOGIN`
  - `PENDING_LOGIN -> READY`
  - `READY -> BUSY`
  - `BUSY -> READY`
- Reject unexpected state transitions with a domain error.
- Define the Collector Profile model with the eight required property groups:
  - Identity & Metadata
  - Network Context
  - Hardware Fingerprinting
  - Authentication State
  - Behavioral Persona
  - Temporal Routine
  - Safety Thresholds
  - Content Affinities
- Add domain errors for invalid state transitions, missing required profile configuration, invalid provisioning token state, and immutable fingerprint violations.
- Add lightweight runtime validation that mirrors the TypeScript model without introducing new dependencies.

## Out of Scope

- HTTP APIs or routes.
- Database repositories, schemas, migrations, or persistence adapters.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Checkout engine implementation.
- Provisioning token generation.
- Frontend UI.
- Content Builder or Content Publisher code.
- Package, runtime, or tooling setup unless already required by the repository.

## Acceptance Criteria

- The domain source files exist under `src/collector-profile-manager/domain/`.
- The four profile statuses are defined.
- The state machine accepts only the allowed transitions.
- Invalid transitions are rejected with a Collector Profile domain error.
- The profile model clearly contains all eight property groups.
- Provisioning token state and authentication/session state shapes are represented.
- Hardware fingerprint assignment is modeled as immutable once set.
- Runtime validation exists without external dependencies.
- Domain code does not import HTTP, database, browser automation, queue, framework, or external API code.
- No out-of-scope application, adapter, infrastructure, or UI layer is created.

## Test Plan

No test framework exists in the repository during Sprint 001, and this sprint must not add package or tooling setup. When a test framework is introduced, add state-machine tests covering:

- `PENDING_CONFIG -> PENDING_LOGIN` is accepted.
- `PENDING_LOGIN -> READY` is accepted.
- `READY -> BUSY` is accepted.
- `BUSY -> READY` is accepted.
- Same-state transitions are rejected.
- Skipped transitions such as `PENDING_CONFIG -> READY` are rejected.
- Reverse transitions such as `READY -> PENDING_LOGIN` are rejected.

## Completion Notes

Sprint 001 is complete when the Collector Profile Manager domain model foundation is present, project brain docs point to this sprint, and no application or adapter layers have been introduced.
