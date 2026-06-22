# Sprint 072 — Content Builder Transform Type Catalog

## Status

Active, not accepted.

## Goal

Introduce the first Content Builder-owned product model:
`TransformType`. A Transform Type defines a reusable initial transform prompt
for future Content Brief and Producer workflows. Operators can create, list,
view, update, and archive Transform Types from the Web UI.

No LLM execution is allowed in this sprint.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/ROADMAP.md`
- `README.md`
- `docs/modules/**`
- Existing module patterns in `src/content-manager/**`
- Existing HTTP route/schema patterns in `src/interfaces/http/**`
- Existing composition wiring
- Drizzle schema/migration/repository patterns under `drizzle/**` and `src/**/infrastructure/**`
- Web UI patterns under `apps/web/src/app`, `apps/web/src/lib/api`, `apps/web/src/features`, `apps/web/src/pages`

## Scope

- Add a new Content Builder module with a pure domain model,
  application use cases, repository port, typed application errors, and
  in-memory test support.
- Persist Transform Types in PostgreSQL with Drizzle through
  `content_builder_transform_types`.
- Expose safe operator HTTP routes under `/builder/transform-types`.
- Add a Web UI page at `/transform-types` with create, edit, list, status
  filter, archive action, and prompt preview.
- Update the sprint, module, README, and roadmap documentation narrowly.

## Domain Model

`TransformType` owns:

- `transformTypeId`
- `name`
- `description?`
- `initialPrompt`
- `status`: `ACTIVE | ARCHIVED`
- `createdAt`
- `updatedAt`

Rules:

- `name` is required, trimmed, and non-empty.
- `initialPrompt` is required, trimmed, and non-empty.
- `description` is optional and omitted when empty.
- Archived Transform Types remain readable.
- Active names are normalized and unique among non-archived Transform Types.

## HTTP API

- `POST /builder/transform-types`
- `GET /builder/transform-types`
- `GET /builder/transform-types/:transformTypeId`
- `PATCH /builder/transform-types/:transformTypeId`
- `POST /builder/transform-types/:transformTypeId/archive`

HTTP contracts use strict Zod schemas, reject unknown fields, reject blank
required strings, omit absent optional response fields, and expose only safe
Content Builder DTO fields.

## Out of Scope

- Content Brief
- Producer graph or pipeline visual editor
- Artifact model
- LLM provider integration
- Prompt execution
- Prompt versioning
- Collected content selection
- Content Publisher
- Collector Runtime changes
- Facebook capture/browser changes
- Profile checkout/session changes
- Scheduler/worker changes

## Verification

Run:

```bash
pnpm typecheck
pnpm test
pnpm web:typecheck
pnpm web:build
pnpm test:db
git diff --check
git status --short
```
