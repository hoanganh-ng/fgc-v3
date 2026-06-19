# Sprint 064A: Content Collection Provenance Model

## Goal

Add a pure Content Manager domain model that records, for a collected
content item, where the content came from on first observation and which
optional associations (a Content Manager-owned `SourcePublisher` identity
and a managed `SourceGroup`) are now known. The model separates the
first collection surface from later collection surfaces, never mutates
input data, and is intentionally limited to the domain layer. It does
not introduce persistence, HTTP, application, composition, runtime,
extractor, browser, scheduler, Docker, or Web UI behavior.

## Context

Sprint 063A introduced the Content Manager-owned `SourcePublisher`
identity. Sprint 063C exposed safe HTTP contracts for observing,
listing, and reading `SourcePublisher` aggregates. The collection
runtime (Sprint 065B and Sprint 065C) will produce content that may
arrive from more than one collection surface over time. The current
`ContentItem` aggregate does not model a stable first surface nor
optional association history.

Sprint 064A is documentation, design, and a focused domain-only
implementation. It defines the shape, validation, and merge behavior
of a small `ContentCollectionProvenance` value object. The model
intentionally does not add profile IDs, collection run IDs, URLs,
entry routes, raw publisher identities, raw payloads, observation
arrays, or event history.

## Capability Summary

- A `CollectionSurface` discriminated union with two branches:
  - `SOURCE_GROUP` carrying a single `sourceGroupId`.
  - `PROFILE_HOME_FEED` carrying no profile id, no source group id,
    and no other identifying information.
- A `CollectedContentProvenanceInput` value object composed of the
  collection surface, an optional `sourcePublisherId`, and an
  optional `managedSourceGroupId`. The input is strict, rejects
  unknown fields, rejects `null` for any optional field, and
  enforces the cross-field rule that for a `SOURCE_GROUP` input the
  `managedSourceGroupId` is required and must equal
  `collectionSurface.sourceGroupId`. A `PROFILE_HOME_FEED` input
  forbids a `managedSourceGroupId`.
- A `ContentCollectionProvenance` durable value object composed of
  the immutable `firstCollectionSurface`, an optional
  `sourcePublisherId`, and an optional `managedSourceGroupId`. The
  durable object is strict, rejects unknown fields, rejects `null`
  for any optional field, and mirrors the same cross-field rule
  between the first surface and `managedSourceGroupId`.
- Pure `createInitialContentCollectionProvenance` and
  `mergeContentCollectionProvenance` functions. Both are pure, do
  not mutate inputs, omit absent optional fields rather than
  serializing `null`, and produce a new durable value object on
  every call.
- A new typed Content Manager domain error
  `ContentCollectionProvenanceConflictError` with code
  `CONTENT_COLLECTION_PROVENANCE_CONFLICT`. The error carries the
  conflicting field, the existing value, and the incoming value.
- Surface helpers `isSourceGroupCollectionSurface`,
  `isProfileHomeFeedCollectionSurface`, and
  `collectionSurfaceEquals`.
- Exported from the Content Manager domain index and used by the
  Content Manager `validation.ts` parse / validate helpers.

## Merge Invariants

`mergeContentCollectionProvenance` enforces these rules:

- `firstCollectionSurface` is preserved. A later observation that
  uses a different surface does not change the first surface.
- A later `PROFILE_HOME_FEED` observation against a `SOURCE_GROUP`
  first surface keeps the original `managedSourceGroupId` and
  `sourcePublisherId`.
- A later `SOURCE_GROUP` observation against a `PROFILE_HOME_FEED`
  first surface fills the new `managedSourceGroupId` (and
  `sourcePublisherId` when supplied) without changing the first
  surface.
- Omitted `sourcePublisherId` or `managedSourceGroupId` on a later
  observation never clears the existing value.
- A later observation that supplies an absent association for the
  first time fills it.
- A later observation that supplies an identical association is
  idempotent.
- A later observation that supplies a different
  `sourcePublisherId` or a different `managedSourceGroupId` throws
  `ContentCollectionProvenanceConflictError` with code
  `CONTENT_COLLECTION_PROVENANCE_CONFLICT`.
- Neither the existing provenance nor the incoming input is
  mutated.

## Architecture

```
Content Manager (domain)
  content-collection-provenance.ts
    createInitialContentCollectionProvenance
    mergeContentCollectionProvenance
    isSourceGroupCollectionSurface
    isProfileHomeFeedCollectionSurface
    collectionSurfaceEquals
  content-collection-provenance.schemas.ts
    CollectionSurfaceSchema (discriminated union: SOURCE_GROUP, PROFILE_HOME_FEED)
    SourceGroupCollectionSurfaceSchema
    ProfileHomeFeedCollectionSurfaceSchema
    CollectedContentProvenanceInputSchema
    ContentCollectionProvenanceSchema
    ProvenanceConflictFieldSchema
  content-errors.ts
    ContentCollectionProvenanceConflictError
      code CONTENT_COLLECTION_PROVENANCE_CONFLICT
      field, existing, incoming
  validation.ts
    validateCollectedContentProvenanceInput
    parseCollectedContentProvenanceInput
    validateContentCollectionProvenance
    parseContentCollectionProvenance
  index.ts
    re-exports the new domain contracts
```

The model lives entirely in the Content Manager domain layer. It does
not import HTTP, Fastify, PostgreSQL, Drizzle, browser automation,
queues, React, or any framework. The new contracts are additive
exports and do not change the public shape of any existing Content
Manager aggregate or use case.

## Out Of Scope

- Profile IDs, collection run IDs, URLs, or entry routes.
- Raw publisher identities or raw payloads.
- Observation arrays, event history, or audit trails.
- Persistence, Drizzle schema, migrations, or repository adapters.
- HTTP routes, DTOs, response schemas, or HTTP error mapping beyond
  the additive entry needed to keep the existing
  `Record<ContentManagerDomainErrorCode, number>` exhaustive.
- Application use cases, ports, composition wiring, or scheduler
  integration.
- Collector Runtime, extractor, browser, or feed execution.
- Web UI, Docker E2E, or scheduler changes.
- Modifying existing ingestion, persistence, HTTP, Collector
  Runtime, extractor, browser, Web UI, scheduler, or Docker
  behavior.

## File Manifest

### Create

- `docs/SPRINTS/SPRINT-064A-content-collection-provenance-model.md`
- `src/content-manager/domain/content-collection-provenance.ts`
- `src/content-manager/domain/content-collection-provenance.schemas.ts`
- `src/content-manager/domain/content-collection-provenance.test.ts`

### Modify

- `src/content-manager/domain/content-errors.ts` — add the
  `CONTENT_COLLECTION_PROVENANCE_CONFLICT` code to
  `ContentManagerDomainErrorCode` and add
  `ContentCollectionProvenanceConflictError`.
- `src/content-manager/domain/validation.ts` — add the parse /
  validate helpers for the new schemas.
- `src/content-manager/domain/index.ts` — re-export the new
  domain contracts.
- `src/interfaces/http/errors/http-error-mapper.ts` — add the
  additive `CONTENT_COLLECTION_PROVENANCE_CONFLICT: 409` entry
  required to keep the existing
  `Record<ContentManagerDomainErrorCode, number>` exhaustive. No
  other HTTP behavior changes.
- `docs/SPRINTS/active.md` — record Sprint 064A as active and
  authorized; keep Sprint 063C accepted.
- `docs/PROJECT_SNAPSHOT.md` — record the new domain capability.
- `docs/modules/content-manager.md` — record the provenance
  ownership boundary.
- `docs/MODULE_BOUNDARIES.md` — record the provenance ownership
  boundary.

### Do not touch

- Collector Runtime, extractor, browser, scheduler, Docker, Web UI.
- Existing ingestion, persistence, HTTP routes, DTOs, composition
  wiring, or application use cases beyond the additive entry
  required to keep the existing
  `Record<ContentManagerDomainErrorCode, number>` exhaustive.
- Drizzle schema, migrations, or repository adapters.
- `tests/e2e/`, `docker-compose.e2e.yml`, Playwright config, or
  the Docker E2E harness.

## Testing Layers

### Layer 1 — Unit (Vitest)

`pnpm test src/content-manager/domain/content-collection-provenance.test.ts`
covers:

- Strict Zod validation of both `CollectionSurface` branches
  (`SOURCE_GROUP`, `PROFILE_HOME_FEED`).
- Rejection of unknown surface kinds, missing or blank
  `sourceGroupId` on `SOURCE_GROUP`, and rejected profile ids or
  source group ids on `PROFILE_HOME_FEED`.
- Rejection of unknown fields, `null` optional fields, and blank
  `sourcePublisherId` on the input schema.
- The cross-field rule that `managedSourceGroupId` is required and
  must equal `collectionSurface.sourceGroupId` for `SOURCE_GROUP`
  inputs and is forbidden for `PROFILE_HOME_FEED` inputs.
- The same cross-field rule on the durable provenance schema.
- Validation result helpers return issues on the
  `managedSourceGroupId` path.
- Initial creation omits absent `sourcePublisherId` and
  `managedSourceGroupId` (no `null`).
- Enrichment fills an absent `sourcePublisherId` or
  `managedSourceGroupId` on a later observation and keeps existing
  values when later observations omit them.
- Idempotency for identical SOURCE_GROUP and PROFILE_HOME_FEED
  observations.
- Preservation of `firstCollectionSurface` when a later observation
  uses a different surface.
- Typed `ContentCollectionProvenanceConflictError` with code
  `CONTENT_COLLECTION_PROVENANCE_CONFLICT` on conflicting
  `sourcePublisherId` and on conflicting `managedSourceGroupId`,
  including the typed `field`, `existing`, and `incoming` fields.
- Conflict on a later `SOURCE_GROUP` observation against a
  different source group.
- No mutation of the existing provenance or the incoming input
  when merge throws.
- No mutation of the existing provenance or the incoming input on
  successful merge.
- Surface helpers classify and compare surfaces correctly.

The full Content Manager domain suite is exercised by
`pnpm test src/content-manager/domain` and must remain green.

## Verification Commands

```bash
pnpm test src/content-manager/domain/content-collection-provenance.test.ts
pnpm test src/content-manager/domain
pnpm typecheck
git diff --check
```

## Verification Results

Recorded at Sprint 064A implementation:

- `pnpm test src/content-manager/domain/content-collection-provenance.test.ts`
  exited 0; 42 tests passed, 0 failed.
- `pnpm test src/content-manager/domain` exited 0; 94 tests passed,
  0 failed.
- `pnpm typecheck` exited 0.
- `git diff --check` exited 0.

No persistence, HTTP, runtime, extractor, browser, UI, scheduler,
Docker, commit, or push work was performed. Sprint 064A is not
claimed to be accepted or complete. Sprint 064B is not started.

## Assumptions and Deviations

The HTTP error mapper
(`src/interfaces/http/errors/http-error-mapper.ts`) is an
exhaustive `Record<ContentManagerDomainErrorCode, number>`. Adding
the new `CONTENT_COLLECTION_PROVENANCE_CONFLICT` code to the
`ContentManagerDomainErrorCode` union would otherwise have left
that record incomplete and broken the typecheck. The mapper gains
a single additive entry (`CONTENT_COLLECTION_PROVENANCE_CONFLICT:
409`) so the existing exhaustive record remains complete. No
other HTTP behavior is changed, and no new route, DTO, response
schema, or route handler is added.

## Status

Sprint 064A is **active and authorized**. It is not accepted and is
not complete. Sprint 063C remains accepted; Sprint 064B is not
started.
