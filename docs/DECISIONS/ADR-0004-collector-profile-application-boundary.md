# ADR-0004: Collector Profile Application Boundary

## Status

Accepted

## Context

The Collector Profile Manager domain layer owns lifecycle rules, property invariants, provisioning token state shape, session state shape, and runtime schema validation. Sprint 004 introduces application use cases that must coordinate profile creation, configuration updates, provisioning, provisioning configuration reads, and session ingestion.

The architecture requires external technologies such as HTTP, persistence, browser automation, queues, and framework code to stay outside the application and domain core. Future adapters need stable contracts to persist profiles, generate tokens, and provide time without being imported by use cases.

## Decision

Define a Collector Profile Manager application layer under `src/collector-profile-manager/application/`. The application layer owns use cases and ports for profile repository, token generation, and clock access. Use cases may orchestrate domain functions and validation helpers, but they must depend only on domain code and application-owned port interfaces.

No database repository, HTTP handler, browser automation integration, production token generator, production clock, queue, framework, Content Builder, or Content Publisher implementation is introduced in Sprint 004.

## Consequences

- Use cases can be tested with in-memory fake ports without committing to infrastructure.
- Future adapters can implement the application-owned ports without changing domain rules.
- Data loaded from persistence can be validated before use case orchestration.
- Provisioning and session ingestion behavior remains centralized without leaking adapter concerns into the domain layer.
