# Sprint 079 — Codebase Changeability Baseline

## Status

Active and approved for Builder execution. Sprint 078 was accepted on
2026-07-16 at commit `28bd08c`; its exact 35-script command surface is the
baseline this sprint must preserve.

## Goal

Make the codebase materially easier and safer to change by restoring one
truthful architecture reference and modularizing the highest-leverage shared
HTTP contract boundary, without changing product behavior.

## Capability Summary

> A maintainer can identify each module's ownership, ports, adapters,
> entrypoints, invariants, and verification commands from current Architect
> documents, then change one Collector Runtime resource family without editing
> three monolithic cross-feature boundary files. Existing import paths, HTTP
> routes, DTOs, validation, error mapping, Web client behavior, and runtime
> outcomes remain compatible.

## Evidence and Scope Decision

The accepted post-Sprint-078 repository contains 633 TypeScript/TSX files and
several concentrated change hotspots. The target chosen for this sprint is the
Collector Runtime HTTP contract surface because it has clear resource-family
seams and 43 current source/test consumers that require compatibility.

| Evidence | Current observation | Sprint decision |
| --- | --- | --- |
| `docs/ARCHITECTURE.md` | Still contains Sprint 000 placeholders and describes implemented adapters as future work; last substantive updates predate the accepted home-feed baseline. | Rewrite as current architecture truth. |
| `docs/MODULE_BOUNDARIES.md` | 405 lines mixing durable ownership with per-sprint implementation history. | Replace diary-style detail with a concise ownership/communication matrix. |
| `docs/modules/*.md` | Inconsistent depth and status language; Collector Runtime still says accepted Sprint 074 is unaccepted. | Normalize all six module references to one current-state structure. |
| `collector-runtime.http-schemas.ts` | 1,765 lines covering six separate resource families. | Split by resource family behind the existing import path. |
| `collector-runtime.routes.ts` | 1,168 lines covering service contract, registration, DTOs, and mapping for six families. | Split registration/contracts/mappers by resource family. |
| Web `collector-runtime-client.ts` | 1,289 lines covering schemas, types, query serialization, and HTTP calls for six families. | Split by resource family behind the existing import path. |
| Boundary tests | Four tests duplicate their recursive TypeScript-file collector. | Admit one test-support helper; do not create a production framework. |
| Other large files | Facebook extractors, capture adapters, exercise runner, and several Web pages/forms are 900–2,052 lines. | Record as ranked follow-up candidates only; do not refactor them here. |

The three admitted contract files total 4,222 lines. Line count alone is not a
defect; mixed ownership and repeated cross-feature editing are the defect. This
sprint is successful only if responsibilities become separable with exact
behavior and compatibility preservation.

## Required Context

Read only after Sprint 079 is activated:

- `AGENTS.md`;
- `docs/SPRINTS/active.md`;
- this sprint;
- the accepted Sprint 078 implementation report and final changed files;
- `docs/PROJECT_SNAPSHOT.md` and `docs/ROADMAP.md`;
- `docs/ARCHITECTURE.md`, `docs/MODULE_BOUNDARIES.md`, and
  `docs/GLOSSARY.md`;
- all six files under `docs/modules/`;
- accepted ADRs under `docs/DECISIONS/`, reading only those needed to confirm
  current module ownership, schema source-of-truth, composition, HTTP, Content
  Manager, and platform-extractor decisions;
- `src/interfaces/http/routes/collector-runtime.routes.ts`;
- `src/interfaces/http/schemas/collector-runtime.http-schemas.ts`;
- `apps/web/src/lib/api/collector-runtime-client.ts`;
- their direct imports, direct tests, server registration, and existing HTTP
  test support;
- existing architecture boundary tests only;
- TypeScript/Vitest configuration only when needed for extracted modules.

Do not read historical sprint documents to reconstruct current architecture.
Accepted source, current contracts, current baseline docs, and durable ADRs are
the authority. Do not scan implementation unrelated to the admitted boundary
except to verify a direct import or a statement proposed for the architecture
documents.

## Resource-Family Model

Partition the Collector Runtime HTTP surface into exactly these six cohesive
families:

1. collection runs;
2. account exercise runs;
3. profile-source access check runs;
4. profile home-feed collection runs, including diagnostics;
5. collection schedules;
6. profile home-feed collection schedules.

Shared primitives may live in one narrowly named shared file only when at least
two families genuinely use them. Do not move a family-specific schema, mapper,
constant, or error into shared code for convenience.

## Deliverables

### 1. Baseline characterization before movement

Before moving code, add or extend focused tests that capture:

- the exact registered Collector Runtime HTTP method/path inventory;
- the current route schema association for every registered route;
- representative success, validation failure, not-found/conflict mapping, and
  omission semantics for each family;
- the current Web client request method/path/query/body and response parsing for
  each family;
- the complete public named-export inventory of the three compatibility entry
  files used by current consumers.

The characterization must be green before structural edits. Do not update an
expected value merely to make a post-refactor difference pass; explain any
difference and stop.

### 2. Server HTTP boundary modularization

Create a `collector-runtime/` subdirectory under both the routes and schemas
directories. Give each resource family its own route registration and schema
module. Separate shared service contracts/DTO primitives only where doing so
reduces coupling.

Keep these existing files as compatibility entrypoints:

- `src/interfaces/http/routes/collector-runtime.routes.ts`;
- `src/interfaces/http/schemas/collector-runtime.http-schemas.ts`.

The route entrypoint should compose/delegate to the six registrars and re-export
the same public names. The schema entrypoint should be a compatibility barrel
that re-exports the same public names. Existing imports must continue to
typecheck without bulk consumer rewrites.

Preserve registration order unless a test proves order is irrelevant. Preserve
Fastify schema object identity/association where current tests or registration
depend on it. Do not introduce a second DTO model or generate schemas in this
sprint.

### 3. Web client boundary modularization

Create a `collector-runtime/` subdirectory beside the current Web client. Give
each resource family its own schemas/types and client operations. Put shared
request/transport behavior in one small internal module.

Keep `apps/web/src/lib/api/collector-runtime-client.ts` as the compatibility
entrypoint. It must continue to export the same public schemas, types,
constants, query serializers, client interface, factory, and singleton used by
current consumers. Do not migrate the 40+ consumers merely to demonstrate the
new file layout.

Do not merge backend and frontend schemas or import server code into the Web
application. They are separate runtime trust boundaries even when their shapes
match.

### 4. Architecture boundary test support

Extract the duplicated recursive TypeScript-file discovery helper from the four
existing architecture boundary tests into one test-only support module. Keep
each module's forbidden-import policy local and explicit. Do not build a generic
architecture-rule DSL and do not add a dependency.

Add only the boundary checks needed to protect current durable rules documented
by this sprint. At minimum, verify:

- domain and application layers do not import HTTP, database, composition, or
  browser-framework adapters;
- modules do not import another module's repositories or database schema;
- the Web application does not import backend source;
- the new compatibility barrels do not create circular imports.

If a proposed rule fails on the accepted baseline, document the exact existing
violation and stop. Do not silently whitelist it or expand into an unrelated
repair.

### 5. Architect-document reconciliation

Update `docs/ARCHITECTURE.md` to describe the implemented system in present
tense. It must include:

- module topology and inward dependency direction;
- the distinction between domain, application/ports, adapters, composition,
  operator tools, and Web UI;
- current cross-module communication paths;
- trusted profile/runtime configuration and sensitive-data boundaries;
- the accepted Collector flow into Content Manager;
- the parked Content Builder boundary without inventing future design;
- links to durable ADRs and module references rather than sprint diaries.

Rewrite `docs/MODULE_BOUNDARIES.md` as a concise ownership matrix. For every
module, record owned data/rules, non-ownership, inbound contracts, outbound
contracts, and prohibited dependencies.

Normalize all six `docs/modules/*.md` files to this structure:

1. purpose and current capability;
2. owns;
3. does not own;
4. public ports/contracts and cross-module communication;
5. important source paths and entrypoints;
6. critical invariants and sensitive-data rules;
7. verification anchors;
8. known change hotspots or limitations.

Remove stale active/unaccepted sprint language and compress implementation
diaries into durable rules. Preserve compatibility constraints that are still
enforced by source or tests. Do not change accepted product state, evidence, or
future roadmap decisions.

Create `docs/CODEBASE_CHANGE_MAP.md` containing:

- the measurement method and date;
- ranked production-file hotspots by responsibility and change risk, not just
  line count;
- why each hotspot is or is not safe to split;
- the recommended next three cleanup slices with separate acceptance gates;
- explicit deferral of Facebook extractor/capture refactors until fixture and
  live-baseline protections are sufficient;
- a rule that cleanup follows product work when it is not blocking safe change.

This map is a planning aid, not authorization to implement later slices.

## Compatibility Contract

This sprint is a structural refactor. It must preserve:

- every HTTP method, path, request schema, response schema, status code, DTO
  field, omission/null rule, error code, and pagination default/ceiling;
- every current public named export from the three compatibility entry files;
- Web client method names, arguments, return types, request construction,
  response validation, and singleton behavior;
- Fastify registration and composition behavior;
- all domain/application/infrastructure ownership and dependency direction;
- the post-Sprint-078 root script count and command names.

No deprecation aliases are added beyond retaining the three existing entry
paths. No new public abstraction is introduced merely to make files smaller.

## No-Change Boundary

Do not change:

- product behavior, business rules, DTO shapes, HTTP semantics, database
  schemas, migrations, repositories, or persisted data;
- Collector capture, extraction, Facebook fixtures, diagnostics meaning,
  browser/provider behavior, profile/session/lease behavior, scheduling, or
  workers;
- UI page layout, components, forms, query behavior, or visual design;
- Compose files, deployment, runtime commands, package scripts, dependencies,
  or lockfiles;
- Content Builder or Content Publisher behavior;
- `docs/SPRINTS/active.md`, `docs/PROJECT_SNAPSHOT.md`, `docs/ROADMAP.md`, sprint
  evidence, or historical sprint documents;
- accepted Collector baseline evidence or `docs/COLLECTOR_BASELINE.md`.

Do not split the large Facebook extractors, browser capture adapters, exercise
runner, Web pages, forms, or test suites in this sprint.

## Changeability Rules

- Organize by resource family first, layer responsibility second.
- Prefer explicit imports/exports over wildcard cycles.
- A compatibility barrel may re-export; it must not regain business logic.
- Avoid files named `utils.ts`, `helpers.ts`, `common.ts`, or `types.ts` unless
  the name communicates an actual bounded responsibility.
- Do not duplicate schemas, DTO mappers, constants, or query serializers during
  extraction.
- Do not weaken types with `any`, broad assertions, or nullable fallbacks.
- Do not change tests from behavior assertions to implementation-detail tests.
- Do not use line-count reduction as justification for indirection.

## Verification

Run and report:

```bash
pnpm typecheck
pnpm web:typecheck
pnpm web:build
pnpm test
pnpm test:http:db
pnpm test:e2e:docker
git diff --check
```

Also report:

- pre/post route inventory and public export inventory with zero differences;
- pre/post root script inventory with zero differences from accepted Sprint
  078;
- the changed production-file dependency graph and cycle result;
- focused server and Web client contract-test results for all six families;
- internal Markdown link audit for every changed architecture document;
- a stale-status phrase audit across current architecture/module docs;
- before/after line counts for the three compatibility entrypoints, used only
  as supporting evidence;
- the exact list of direct consumers that required no import change.

Per `AGENTS.md`, run GitNexus impact analysis before moving or changing every
existing exported symbol. Warn and stop for Product Owner review on HIGH or
CRITICAL impact. Run change detection before any commit and confirm only the
admitted HTTP boundary, tests, test support, and architecture documents are
affected.

If a required database/browser/Docker verification command cannot run because
of an environment prerequisite, report it separately with the exact missing
prerequisite. Do not describe inspection or a substituted command as passing
verification.

## Acceptance Gate

Sprint 079 is complete only when:

- all six resource families have separate server schema, server route/DTO, and
  Web client ownership;
- the three existing compatibility paths retain an identical public export
  inventory and contain only composition/re-export responsibilities;
- the exact HTTP route/schema inventory and Web client behavior are unchanged;
- no new dependency cycle or architecture-boundary violation exists;
- duplicated architecture-test file discovery is replaced by one test-only
  helper without weakening any rule;
- architecture, module boundaries, and all six module references describe the
  current accepted implementation without stale sprint status;
- `docs/CODEBASE_CHANGE_MAP.md` ranks future cleanup without authorizing it;
- package scripts/dependencies and all no-change boundaries remain unchanged;
- required verification passes or the Product Owner explicitly accepts a
  documented environment-only omission;
- the Product Owner accepts the changeability baseline.

Acceptance does not authorize the next cleanup slice and does not begin Content
Builder implementation.

## Stop Conditions

Stop and report instead of expanding scope when:

- Sprint 078 is not yet accepted or its implementation is not in the working
  baseline;
- GitNexus reports HIGH or CRITICAL impact for a proposed symbol move;
- preserving a public export, route, schema association, omission rule, or Web
  client behavior is not possible through the compatibility entrypoint;
- baseline characterization exposes an existing failing contract;
- route/schema/client movement requires a domain, application, database,
  runtime, or UI behavior change;
- a proposed architecture statement cannot be proven from accepted source,
  tests, baseline docs, or a durable ADR;
- a new dependency, package script, code generator, generic framework, or
  repository-wide rename appears necessary;
- the work expands into extractor, capture, UI-page, test-suite, or unrelated
  module refactoring.

## Builder Handoff Prompt

Do not execute this sprint until `docs/SPRINTS/active.md` names Sprint 079 as
active after Sprint 078 acceptance.

When activated, implement Sprint 079 — Codebase Changeability Baseline from
`docs/SPRINTS/SPRINT-079-codebase-changeability-baseline.md`.

Start with GitNexus impact analysis and green baseline characterization for the
three admitted compatibility files. Then modularize only the six named
Collector Runtime HTTP resource families, consolidate only the duplicated
architecture-test file walker, and reconcile only the named current
architecture documents. Preserve public exports and every behavior exactly.

Return: files changed; impact results; pre/post route/export/script inventories;
focused contract evidence for all six families; architecture-boundary and cycle
evidence; document link/status audits; full verification; and any stop
condition. Stop for Product Owner review. Do not accept Sprint 079, advance the
active pointer, implement a later cleanup slice, or begin Content Builder.
