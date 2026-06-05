# ADR-0010: Composition Root Boundary

## Status

Accepted

## Context

The Collector Profile Manager now has domain rules, application use cases, application-owned ports, PostgreSQL/Drizzle repository adapters, and optional PostgreSQL integration verification. A production caller needs one place to assemble those pieces without leaking PostgreSQL, Drizzle, node-postgres, or system APIs into the domain or application layers.

Checkout and release write both profile and lease state. Sprint 008 already introduced an application-owned `TransactionManager` port so composition can provide transaction behavior without exposing database details to use cases.

## Decision

Create a composition root under `src/composition/collector-profile-manager/`.

The composition root is the only project layer responsible for connecting Collector Profile Manager application use cases to concrete infrastructure adapters. It may depend on application contracts and infrastructure implementations. Domain and application code must not depend on composition, PostgreSQL, Drizzle, database clients, HTTP, browser automation, queues, framework code, or external APIs.

Provide simple production system adapters under `src/infrastructure/system/` for clock, token generation, and lease id generation. These adapters implement application-owned ports using Node.js built-ins.

Provide a small config loader for `DATABASE_URL` and keep resource lifecycle explicit by exposing a `close()` function from the composed service.

## Consequences

- Future runtimes can obtain Collector Profile Manager capabilities from one outer-layer factory.
- The application layer remains portable because it still depends only on ports.
- Database resource ownership is visible to callers through an explicit close hook.
- HTTP, worker, frontend, and Collector Runtime concerns remain deferred until a sprint explicitly introduces them.
