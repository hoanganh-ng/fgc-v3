# ADR-0012: Profile Read API Sensitive Fields

## Status

Accepted

## Context

Sprint 012 introduces profile query use cases and read HTTP routes for the future Profile Manager Web UI. Collector profiles contain operational metadata, configuration groups, captured authentication state, provisioning token internals, and network proxy credentials.

The project needs read APIs that are useful for management views without leaking sensitive session data or provisioning secrets.

## Decision

Create explicit application-level read DTOs for profile summaries and profile details.

List responses return operational summaries only: profile id, display name, status, timezone, timestamps, availability metadata, daily usage, and boolean readiness signals. They do not include authentication state or provisioning token state.

Detail responses may include configuration groups, but network proxy credentials are omitted from the network context. Detail responses also omit captured cookies, local storage, authentication state payloads, provisioning token status, raw provisioning tokens, and token hashes.

HTTP routes return these read DTOs directly instead of serializing raw `CollectorProfile` objects.

## Consequences

- The future Profile Manager Web UI receives useful operational data without direct access to session secrets.
- The application layer owns the read model shape, so non-HTTP callers get the same sensitive-field boundary.
- Future authentication and authorization can build on these DTOs without changing the domain model.
- If a future trusted operational caller needs raw authentication state, it must use a dedicated use case with a separate contract.
- Sprint 024 adds that separate trusted contract for Collector Runtime: runtime profile configuration is fetched by `leaseId` through a dedicated internal route and application use case. This does not change the public list/detail/provisioning read DTOs. The runtime configuration contract may include browser-required authentication state and proxy credentials, but it must omit provisioning token material and must validate an active lease before returning configuration.
