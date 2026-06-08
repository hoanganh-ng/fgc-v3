# Architecture

## Intended Style

The project will use hexagonal architecture, also called ports and adapters architecture. The application core owns domain rules, use cases, and port contracts. External technologies integrate through adapters.

## Dependency Direction

Dependencies must point inward:

1. Domain model and domain services
2. Application use cases and ports
3. Adapters for persistence, HTTP, browser automation, queues, scheduling, and UI frameworks
4. Composition root and runtime wiring

The domain must not import or depend on HTTP, database, browser automation, queues, or framework code.

## Domain Core

The domain core contains business concepts and invariants. For Collector Profile Manager, this includes profile state transitions, property invariants, provisioning token rules, session ingestion rules, and checkout eligibility rules.

For Content Manager, this includes source group rules, managed group category rules, content item lifecycle status, content deduplication/upsert rules, high-engagement top comment rules, engagement count invariants, and future builder handoff eligibility.

Content Manager domain core must work from normalized content ingestion input. It must not parse raw Facebook GraphQL payloads or own platform-specific extraction rules.

Domain code should be deterministic where possible and should express business errors in domain terms.

## Application Layer

The application layer coordinates use cases and owns port interfaces. It may orchestrate domain objects and call ports for persistence, token generation, clock access, identity, and external services.

Application code should not know concrete adapter details.

## Ports

Ports are abstract contracts owned by the core. Expected future port categories include:

- Profile repository.
- Content repository.
- Source group repository.
- Content category repository.
- Token generator.
- Clock.
- Fingerprint provider.
- Event publisher.
- Authorization or actor context.

These are not implementation commitments for Sprint 000. They are architectural placeholders for future design.

## Adapters

Adapters implement ports using concrete technologies. Expected future adapter categories include:

- Database persistence.
- HTTP API handlers.
- Browser automation integration.
- Queue or scheduler integration.
- Web UI integration.

Collector Runtime will be a future operational module that consumes Collector Profile Manager and Content Manager application contracts. Browser automation, network payload capture, scraping strategy, and raw platform payload parsing must remain outside the Content Manager domain and application rules.

## Platform Extractors

A Platform Extractor is a collection-side component that converts raw platform-specific artifacts, such as captured Facebook GraphQL payloads, into normalized Content Manager ingestion input.

The first extractor is the Facebook GraphQL Payload Extractor. It belongs to the Collector Runtime side and owns raw Facebook GraphQL payload interpretation, Facebook-specific field mapping, post extraction, high-engagement comment extraction, engagement count extraction, best-effort missing-field handling, and extractor fixtures and parser tests.

The extractor produces normalized Content Manager ingestion input candidates only. It does not submit to Content Manager, perform browser automation, intercept network traffic, check out profiles, or access storage.

The canonical flow is:

```text
raw GraphQL payload
-> Facebook GraphQL Payload Extractor
-> normalized Content Manager ingestion input
-> Content Manager validation/upsert/storage
```

Content Manager should not accept raw Facebook GraphQL payloads as its primary ingestion contract. Optional future storage of sanitized raw payload data or a raw payload reference must be diagnostic, must not become the canonical content model, and must not leak through safe reads by default.

Adapter selection is out of scope for Sprint 000.

## Validation

Runtime validation should protect data entering through public APIs and data leaving persistence before it reaches business use cases. The NFRs call for schemas that mirror compile-time TypeScript interfaces, but the exact tooling is not selected in Sprint 000.

Content Manager validation should validate normalized content ingestion input after platform extraction. Content Manager safe read contracts should avoid exposing optional sanitized raw payload diagnostics or raw payload references by default. If trusted diagnostics need sanitized raw payload data or raw payload references later, they should use a dedicated application contract.

## Sprint 000 Scope

Sprint 000 only establishes this project brain. It does not create architecture folders, packages, services, endpoints, database schemas, UI code, or automation code.
