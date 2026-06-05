# ADR-0003: Domain Schema Source of Truth

## Status

Accepted

## Context

The Collector Profile Manager domain model began with dependency-free TypeScript interfaces and lightweight hand-written runtime validation. Sprint 002 added TypeScript and Vitest tooling, making it practical to introduce a stronger runtime validation contract.

The non-functional requirements call for runtime validation schemas that mirror compile-time TypeScript interfaces. Data entering through future public APIs or leaving future persistence adapters must be validated before interacting with business use cases, while preserving the hexagonal boundary that keeps domain logic independent from HTTP, database, browser automation, queues, and framework code.

## Decision

Use Zod schemas in the Collector Profile Manager domain layer as the runtime schema source of truth. Domain types should be inferred from these schemas where practical, with existing type modules kept only where they improve readability and preserve clean public exports.

## Consequences

- Runtime validation and TypeScript domain shapes can stay synchronized through schema inference.
- The domain layer gains a small runtime dependency on Zod, but does not depend on adapter, framework, HTTP, database, browser automation, queue, or external API code.
- Validation helpers can return structured validation errors without requiring basic callers to catch schema exceptions.
- Future adapters and application use cases can validate inbound or persisted data against the same domain schemas.
