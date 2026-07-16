# Architecture

## Style and dependency direction

The codebase uses hexagonal (ports and adapters) architecture. Business rules, use cases, and port contracts live in the application core. External technologies integrate through adapters and composition roots.

Dependencies point inward:

1. **Domain** — business concepts, invariants, and Zod-backed schemas ([ADR-0003](DECISIONS/ADR-0003-domain-schema-source-of-truth.md))
2. **Application** — use cases and application-owned ports
3. **Adapters** — HTTP ([ADR-0011](DECISIONS/ADR-0011-http-api-fastify-adapter.md)), PostgreSQL/Drizzle ([ADR-0007](DECISIONS/ADR-0007-postgresql-drizzle-foundation.md), [ADR-0008](DECISIONS/ADR-0008-postgresql-repository-adapters-and-transactions.md)), browser automation, operator CLIs
4. **Composition** — module wiring ([ADR-0010](DECISIONS/ADR-0010-composition-root-boundary.md))
5. **Runtime entrypoints** — `src/main.ts`, workers, schedulers, Web UI

Domain and application code must not import HTTP, database, composition, browser frameworks, or other adapter layers.

## Module topology

The Content Video Pipeline has three planned stages: **Content Collector**, **Content Builder**, and **Content Publisher**. The implemented system focuses on the Collector stage plus a parked Builder catalog.

| Module | Role | Primary source |
| --- | --- | --- |
| Collector Profile Manager | Profile lifecycle, leasing, provisioning, trusted runtime config | `src/collector-profile-manager/` |
| Content Manager | Collected content, source groups, publishers, ingestion | `src/content-manager/` |
| Collector Runtime | Collection execution, extractors, browser capture, run records | `src/collector-runtime/` |
| Content Builder | Transform Type catalog only (parked expansion) | `src/content-builder/` |
| Web UI | Operator presentation | `apps/web/` |
| Operator tools | CLIs, workers, schedulers, Docker stacks | `src/operator-tools/` |
| Shared infrastructure | PostgreSQL schema, Drizzle repositories, system adapters | `src/infrastructure/` |
| HTTP adapter | Fastify routes, schemas, error mapping | `src/interfaces/http/` |
| Composition | Per-module factories and containers | `src/composition/` |

See [MODULE_BOUNDARIES.md](MODULE_BOUNDARIES.md) for ownership matrices and [modules/](modules/) for module-specific detail.

## Layer responsibilities

### Domain

Owns business concepts and invariants. Types are inferred from Zod schemas where practical. Domain code is deterministic where possible and expresses business errors in domain terms.

Examples:

- Profile operational status vs account maturity stage
- Checkout eligibility and lease purpose rules
- Content deduplication, provenance, and `SourcePublisher` observation rules
- Collection run state machines and schedule cadence rules

### Application

Coordinates use cases and owns port interfaces. Orchestrates domain objects and calls ports for persistence, clocks, identity, and external services. Does not know concrete adapter implementations.

### Ports and adapters

Ports are abstract contracts owned by application layers. Adapters implement ports with concrete technologies:

- **Persistence** — Drizzle repositories under `src/infrastructure/database/`
- **HTTP** — Fastify route registrars under `src/interfaces/http/routes/`
- **Browser** — Playwright-backed providers under `src/collector-runtime/infrastructure/`
- **Cross-module HTTP clients** — runtime-owned clients calling Profile Manager and Content Manager APIs

### Composition

Each module has a composition root under `src/composition/<module>/` that wires use cases to concrete adapters. Composition is the only layer that connects application ports to infrastructure implementations. See [ADR-0010](DECISIONS/ADR-0010-composition-root-boundary.md).

`src/main.ts` composes all modules and starts the Fastify HTTP server.

### Operator tools and Web UI

Operator tools (`src/operator-tools/`) are thin CLIs and long-running workers that call the same HTTP boundaries as the Web UI. They do not embed domain rules.

The Web UI (`apps/web/`) consumes safe HTTP client DTOs only. It does not import backend `src/` modules.

## Cross-module communication

Modules communicate through explicit contracts, not shared repositories:

| From | To | Mechanism |
| --- | --- | --- |
| Collector Runtime | Collector Profile Manager | HTTP client ports (checkout, release, runtime config) |
| Collector Runtime | Content Manager | HTTP client ports (content ingestion, publisher observation) |
| Collector Profile Manager | Content Manager | Application port adapter for source group reference validation |
| Web UI / operator tools | All modules | HTTP via Nginx gateway to Fastify |
| Composition | Any module | Factory wiring only at startup |

Cross-module database foreign keys are avoided. External references use opaque string IDs validated through ports (for example `sourceGroupId` on profile-source access records).

## Collector flow into Content Manager

The accepted profile home-feed baseline ([COLLECTOR_BASELINE.md](COLLECTOR_BASELINE.md)) follows:

```text
operator queues ProfileHomeFeedCollectionRun (Web UI or HTTP)
  -> worker claims run
  -> Profile Manager checkout (HOME_FEED_COLLECTION lease)
  -> browser capture on https://www.facebook.com/
  -> Facebook home-feed GraphQL extractor
  -> SourcePublisher observation (Content Manager HTTP)
  -> home-feed content ingestion (Content Manager HTTP)
  -> lease release
  -> safe diagnostics on run record
```

Source-group collection follows the same pattern with group payload capture, the group GraphQL extractor, and source-group ingestion contracts.

Platform extractors belong to Collector Runtime, not Content Manager ([ADR-015](DECISIONS/ADR-015-platform-extractor-boundary.md)):

```text
raw GraphQL payload
  -> Platform Extractor (Collector Runtime)
  -> normalized Content Manager ingestion input
  -> Content Manager validation / upsert / storage
```

Content Manager does not accept raw Facebook GraphQL as its primary ingestion contract ([ADR-014](DECISIONS/ADR-014-content-manager-boundaries.md)).

## Profile readiness and leasing

Collector Profile Manager separates operational profile status from account maturity:

- `profile.status`: `PENDING_CONFIG`, `PENDING_LOGIN`, `READY`, `BUSY`
- `accountStage`: `NEW_ACCOUNT`, `WARMING`, `COLLECTION_READY`, `LIMITED`, `NEEDS_REVIEW`, `RETIRED`

Lease purposes include `COLLECTION`, `AMBIENT_EXERCISE`, `ASSISTED_GROUP_ACCESS`, and `HOME_FEED_COLLECTION`. Eligibility rules live in Profile Manager domain/application code; Collector Runtime consumes the resulting lease and trusted runtime configuration without bypassing those rules.

Network context uses explicit mode `UNCONFIGURED | DIRECT | PROXY`. Do not infer direct networking from a null proxy alone.

## Sensitive data boundaries

The following must never appear in logs, fixtures, safe read DTOs, or Web UI rendering:

- Cookies, localStorage values, tokens, authorization headers
- Proxy credentials, fingerprint secrets, trusted runtime configuration
- Raw Facebook payloads, raw page HTML, private screenshots, viewer data

Trusted runtime configuration is issued only inside an active lease context. Generic profile read DTOs omit authentication state and secret material ([ADR-0012](DECISIONS/ADR-0012-profile-read-api-sensitive-fields.md)).

Browser providers must not solve CAPTCHAs, automate credentials, bypass checkpoints, or perform social actions. Login and checkpoint states are surfaced safely, not bypassed.

## Content Builder boundary

Content Builder currently implements only the **Transform Type catalog** — reusable initial transform prompt records with safe HTTP and Web UI management. It does not execute LLM calls, select collected content, or produce video artifacts.

Future Builder workflows remain parked until explicit product discovery defines safe contracts. Builder must consume collected content through explicit Content Manager DTOs or Builder-owned ports, not through Content Manager repositories or raw collector internals.

## HTTP surface

Fastify registers module routes under `/collector/*` and `/builder/*`. Route handlers delegate to composed module services and map domain errors through `src/interfaces/http/errors/http-error-mapper.ts`.

Collector Runtime HTTP contracts cover six resource families: collection runs, account exercise runs, profile-source access check runs, profile home-feed collection runs (including diagnostics), collection schedules, and profile home-feed collection schedules. Server schemas and routes live under `src/interfaces/http/`; Web clients mirror shapes under `apps/web/src/lib/api/`.

## Verification and architecture guards

Architecture boundary tests under `src/test-support/` and module-local `*.boundary.test.ts` files enforce:

- Domain/application independence from HTTP, database, composition, and browser adapters
- No cross-module repository or schema imports
- Web UI independence from backend `src/` imports
- Acyclic compatibility barrels for Collector Runtime HTTP contracts

Run `pnpm test` for the full suite. Module-specific anchors are listed in each [modules/](modules/) reference.

## Related documents

- [MODULE_BOUNDARIES.md](MODULE_BOUNDARIES.md) — ownership matrix
- [CODEBASE_CHANGE_MAP.md](CODEBASE_CHANGE_MAP.md) — change hotspots and deferred cleanup
- [GLOSSARY.md](GLOSSARY.md) — domain vocabulary
- [COLLECTOR_BASELINE.md](COLLECTOR_BASELINE.md) — accepted Collector MVP baseline
- [DECISIONS/](DECISIONS/) — durable ADRs
