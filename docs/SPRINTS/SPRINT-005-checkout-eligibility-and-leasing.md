# Sprint 005: Checkout Eligibility and Leasing

## Goal

Add Collector Profile Manager checkout eligibility and leasing behavior for READY profiles, without introducing infrastructure adapters or Collector Runtime execution.

## Scope

- Add domain checkout eligibility evaluation for profile readiness, authentication state, network context, hardware fingerprint assignment, temporal windows, cooldowns, and daily safety thresholds.
- Support active-window matching using the profile temporal routine timezone and local time, including same-day and overnight windows represented by the existing active window model.
- Add minimal operational metadata needed by checkout and future indexed queries:
  - `lastCheckoutAt`
  - `lastReleasedAt`
  - `nextAvailableAt`
  - daily usage counters for sessions, active duration, and macro actions.
- Define a domain-owned profile lease model with lease id, profile id, leased timestamp, expiry timestamp, release timestamp, and lease status.
- Add application-owned ports for profile lease persistence and lease id generation.
- Extend the profile repository port only as needed to locate READY checkout candidates.
- Implement `CheckoutProfileUseCase`.
- Implement `ReleaseProfileLeaseUseCase`.
- Add application errors for no eligible profile, profile ineligibility, missing leases, closed leases, and lease/profile state conflicts.
- Use in-memory fake port implementations only in tests.
- Add focused automated tests for checkout eligibility, lease creation, state transitions, cooldowns, daily session limits, missing authentication, and release behavior.
- Update public domain and application exports.
- Update project brain documentation for the active sprint.

## Out of Scope

- HTTP APIs or routes.
- Database repositories, schemas, migrations, or persistence adapters.
- ORM integration.
- Browser automation.
- Workers, queues, event buses, or schedulers.
- Collector Runtime execution.
- Frontend UI.
- Content Builder or Content Publisher code.
- Production lease id generator adapters.
- Production clock adapters.
- External API integrations.

## Acceptance Criteria

- Domain checkout eligibility evaluates READY status, authentication state, network context, hardware fingerprint, timezone validity, active windows, cooldowns, and daily safety thresholds.
- Same-day active windows such as `09:00 -> 17:00` are supported.
- Overnight active windows such as `22:00 -> 02:00` are supported with the existing active window model.
- Checkout metadata remains part of profile operational metadata and does not create a ninth profile property group.
- `ProfileLease` exists in the domain/application-owned core and includes lease id, profile id, leased at, expires at, optional released at, and `ACTIVE` / `RELEASED` / `EXPIRED` status.
- Application ports exist for profile lease repository and lease id generation.
- `CheckoutProfileUseCase` creates an active lease, transitions an eligible profile from `READY` to `BUSY`, updates checkout metadata, saves profile and lease, and returns only Collector Runtime configuration without exposing provisioning tokens.
- `ReleaseProfileLeaseUseCase` releases an active lease, transitions the profile from `BUSY` to `READY`, updates release/cooldown metadata, and saves profile and lease.
- Tests cover successful checkout, lease creation, `READY -> BUSY`, non-READY rejection, outside-window rejection, cooldown rejection, daily session limit rejection, missing authentication rejection, `BUSY -> READY` release, released lease state, and repeated release rejection.
- Existing state machine tests pass.
- Existing provisioning/session tests pass.
- Typechecking passes.
- Tests pass.
- No out-of-scope application adapters, infrastructure, HTTP, database, queue, browser automation, frontend, Collector Runtime execution, Content Builder, or Content Publisher layers are introduced.

## Implementation Notes

- Daily usage counters are intentionally simple and live in identity metadata so future persistence can index or project them without crossing module boundaries.
- The existing `maxSessionDurationMinutes` safety threshold is used for lease expiry and the active-duration cap because the current model does not define a separate max-total-active-duration-per-day field.
- Macro action usage is updated only from the release use case's `macroActionsPerformed` input. No Collector Runtime metrics, analytics pipeline, or event ingestion is introduced in this sprint.

## Verification Commands

- `pnpm run typecheck`
- `pnpm test`

## Completion Notes

Sprint 005 is complete when Collector Profile Manager checkout use cases coordinate domain checkout and lease behavior through explicit ports, focused tests pass, and project brain docs point to this sprint.
