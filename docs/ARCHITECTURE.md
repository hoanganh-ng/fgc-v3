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

Domain code should be deterministic where possible and should express business errors in domain terms.

## Application Layer

The application layer coordinates use cases and owns port interfaces. It may orchestrate domain objects and call ports for persistence, token generation, clock access, identity, and external services.

Application code should not know concrete adapter details.

## Ports

Ports are abstract contracts owned by the core. Expected future port categories include:

- Profile repository.
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

Adapter selection is out of scope for Sprint 000.

## Validation

Runtime validation should protect data entering through public APIs and data leaving persistence before it reaches business use cases. The NFRs call for schemas that mirror compile-time TypeScript interfaces, but the exact tooling is not selected in Sprint 000.

## Sprint 000 Scope

Sprint 000 only establishes this project brain. It does not create architecture folders, packages, services, endpoints, database schemas, UI code, or automation code.
