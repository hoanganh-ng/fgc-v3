# Module Boundaries

Concise ownership and communication matrix for the implemented modules. For layer detail see [ARCHITECTURE.md](ARCHITECTURE.md); for module depth see [modules/](modules/).

## Collector Profile Manager

| Aspect | Detail |
| --- | --- |
| **Owns** | Profile lifecycle; account stage rules; property invariants; provisioning tokens; session ingestion; checkout eligibility; lease purposes; profile-source access state; trusted runtime configuration; authentication-health transitions |
| **Does not own** | Browser execution; collection orchestration; Content Manager source records; Web UI; HTTP framework; content building or publishing |
| **Inbound** | HTTP checkout/release/configure/provision routes; operator provisioning CLI |
| **Outbound** | Source group existence validation via Content Manager port adapter |
| **Prohibited imports** | Content Manager repositories/schema; Collector Runtime internals; Fastify; Drizzle from domain/application |

## Content Manager

| Aspect | Detail |
| --- | --- |
| **Owns** | Normalized content ingestion; content items; deduplication/upsert; lifecycle status; source groups and entry routes; categories; engagement and top comments; `SourcePublisher` identity and observation; collection provenance; safe reads; approved-group promotion to paused source groups |
| **Does not own** | Profiles/sessions; browser automation; raw GraphQL parsing; scraping; video generation; publishing pipelines |
| **Inbound** | Collector Runtime HTTP ingestion and publisher observation; Web UI CRUD/review; operator tools |
| **Outbound** | Source group reference validation responses to Profile Manager adapter |
| **Prohibited imports** | Profile Manager repositories/schema; Collector Runtime internals; browser providers from domain/application |

## Collector Runtime

| Aspect | Detail |
| --- | --- |
| **Owns** | Collection/exercise/access-check/home-feed run records; schedules and dispatch use cases; browser capture; platform extractors; HTTP submission to Content Manager; Profile Manager checkout/release clients; safe diagnostics |
| **Does not own** | Profile invariants; checkout eligibility rules; content lifecycle/deduplication; source group metadata ownership; direct database access to other modules' tables |
| **Inbound** | HTTP run/schedule management; worker/scheduler/operator CLIs |
| **Outbound** | Profile Manager HTTP (checkout, release, config); Content Manager HTTP (ingest, observe publisher) |
| **Prohibited imports** | Any module's repositories, composition roots, or database schema; browser automation in application/domain/extractor layers |

## Content Builder

| Aspect | Detail |
| --- | --- |
| **Owns** | Transform Type catalog (create/list/read/update/archive); safe `/builder/transform-types` HTTP; Web UI management |
| **Does not own** | Content Manager entities; Collector execution; LLM execution; collected-content selection; publishing |
| **Inbound** | Web UI and HTTP catalog operations |
| **Outbound** | None to other module internals |
| **Prohibited imports** | Content Manager/Profile Manager/Collector Runtime repositories, schema, or runtime internals |

## Web UI

| Aspect | Detail |
| --- | --- |
| **Owns** | Operator presentation; routing/layout; client validation; TanStack Query state; API client wrappers |
| **Does not own** | Domain rules; persistence; browser execution; secret storage |
| **Inbound** | Operator interaction |
| **Outbound** | HTTP to `/collector/*` and `/builder/*` via typed clients in `apps/web/src/lib/api/` |
| **Prohibited imports** | Backend `src/` modules; direct database or Fastify usage |

## Operator Tools and Infrastructure

| Aspect | Detail |
| --- | --- |
| **Owns** | CLIs (provision, collect, exercise, schedulers, workers); Docker Compose stacks; stack lifecycle commands |
| **Does not own** | Domain rules; HTTP route logic; bypass of leasing/readiness |
| **Inbound** | Operator invocation |
| **Outbound** | Same HTTP boundaries as Web UI where possible |
| **Prohibited imports** | Other modules' repositories from tool code; embedding business rules outside use-case calls |

## Shared infrastructure

| Aspect | Detail |
| --- | --- |
| **Owns** | PostgreSQL schemas; Drizzle repositories; mappers; transaction helpers; system clock/token adapters |
| **Does not own** | Business rules; HTTP routing; module-specific use-case orchestration |
| **Used by** | Composition roots only — not domain/application layers |

## HTTP adapter (`src/interfaces/http/`)

| Aspect | Detail |
| --- | --- |
| **Owns** | Fastify server factory; route registration; HTTP schemas/DTO mapping; centralized error mapping |
| **Does not own** | Use-case business logic; repository queries; browser behavior |
| **Depends on** | Composed module service interfaces from composition roots |

## Boundary rule

Shared behavior requires a clear owner. Cross-module work uses explicit application contracts, HTTP APIs, or composition adapters — never another module's repositories, database tables, or composition root.

Architecture boundary tests in `src/test-support/` and `*.boundary.test.ts` files enforce these rules. Violations found on baseline are documented, not silently whitelisted.
