# ADR-0006: Profile Storage Shape

## Status

Accepted

## Context

Sprint 006 prepares the Collector Profile Manager persistence boundary before a real storage adapter exists. Current use cases need profile lookup, provisioning token lookup, checkout candidate lookup, profile lease persistence, and lease status updates. Future adapters must support indexed checkout and provisioning queries without leaking database details into domain or application code.

The Collector Profile Manager profile model has a small set of query-critical operational fields and several complex property groups that are usually loaded and validated as a whole.

## Decision

Store query-critical operational fields as root-level columns in the eventual persistence model. This includes profile id, status, provisioning token lookup and lifecycle fields, checkout availability timestamps, daily safety counters, and future concurrency fields such as `version` and `updated_at`.

Prefer JSONB-style storage for complex profile property groups: network context, hardware fingerprinting, authentication state, behavioral persona, temporal routine, safety thresholds, content affinities, and non-query identity metadata. PostgreSQL is the likely database direction because it supports both indexed columns and JSONB.

Keep repository ports database-agnostic. Ports should express application needs, such as finding checkout candidates by operational fields, saving profiles, finding provisioning tokens, saving leases, finding active leases, and updating lease status. They must not expose SQL, ORM models, database transactions, or migration concepts.

Defer the real database adapter, schema migrations, transaction handling, ORM selection, and production token hashing implementation to later sprints.

## Consequences

- Checkout and provisioning queries can use indexes without forcing every profile property group into root-level columns.
- Complex profile groups can evolve with domain schemas while staying validated before use case orchestration.
- Application use cases remain portable across future persistence technologies.
- A future adapter will still need careful transaction design for atomic checkout and active lease conflict prevention.
