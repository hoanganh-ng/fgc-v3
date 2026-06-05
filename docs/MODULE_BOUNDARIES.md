# Module Boundaries

## Collector Profile Manager

Owns:

- Profile lifecycle and state machine rules.
- Profile property model and invariants.
- Provisioning token lifecycle.
- Session ingestion rules.
- Checkout eligibility rules.
- Domain-level validation for profile readiness, busy state, cooldowns, temporal windows, and safety thresholds.

Does not own:

- Browser automation execution.
- Collection task orchestration.
- Web UI rendering.
- Database technology selection.
- HTTP framework implementation.
- Content building.
- Content publishing.

## Collector Runtime

Owns:

- Future execution of collection workflows.
- Requesting eligible profile leases from Collector Profile Manager.
- Using automation adapters to perform collection tasks.
- Returning profile usage outcomes and runtime metrics.

Does not own:

- Profile property invariants.
- Provisioning token rules.
- Authentication session ingestion rules.
- Content building.
- Content publishing.

## Profile Manager Web UI

Owns:

- Future human-facing profile management screens.
- Future profile state inspection and operational controls.
- Calling application APIs to perform allowed profile operations.

Does not own:

- Profile domain rules.
- Direct persistence logic.
- Browser automation execution.
- Content building.
- Content publishing.

## Content Builder

Owns:

- Future transformation of collected material into video-ready assets and assembled video outputs.
- Future builder-specific validation, rendering, and quality workflows.

Does not own:

- Profile lifecycle.
- Profile provisioning.
- Collector runtime execution.
- Publishing workflows.

## Content Publisher

Owns:

- Future publishing workflows for completed video outputs.
- Future destination-specific publishing rules, scheduling, and status tracking.

Does not own:

- Profile lifecycle.
- Collection runtime execution.
- Video assembly.
- Collector profile provisioning.

## Boundary Rule

Shared behavior must be introduced only when it has a clear owner and does not leak adapter or framework concerns into domain logic. Cross-module communication should happen through explicit application contracts, not direct access to another module's internals.
