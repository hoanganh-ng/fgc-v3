# Content Builder

## Purpose and current capability

Content Builder currently implements only the **Transform Type catalog** — reusable initial transform prompt records with create, list, read, update, and archive lifecycle. Operators manage the catalog through safe `/builder/transform-types` HTTP routes and the Web UI at `/transform-types`.

Broader Builder workflows (content selection, LLM execution, artifacts, publishing handoff) remain parked until explicit product discovery.

## Owns

- `TransformType` domain model and lifecycle rules
- Active normalized name uniqueness among non-archived records
- Safe HTTP contracts under `/builder/*`
- Web UI catalog management page
- PostgreSQL persistence for transform types

## Does not own

- Content Manager source groups, publishers, content items, or ingestion
- Collector Runtime execution, capture, or scheduling
- Profile/session management
- LLM provider configuration or prompt execution
- Content Briefs, Producers, artifacts, or publishing

## Public ports, contracts, and cross-module communication

- **HTTP**: `/builder/transform-types` via `src/interfaces/http/routes/content-builder.routes.ts`
- **Web client**: `apps/web/src/lib/api/content-builder-client.ts`
- **Cross-module**: none into other module repositories or runtime internals

## Important source paths and entrypoints

- Domain: `src/content-builder/domain/`
- Application: `src/content-builder/application/`
- Composition: `src/composition/content-builder/`
- Persistence: `src/infrastructure/database/schema/content-builder.schema.ts`
- Web page: `apps/web/src/pages/transform-types-page.tsx`

## Critical invariants and sensitive-data rules

- Domain and application layers remain framework-free and database-free
- Optional descriptions are omitted when absent or empty
- Archived Transform Types remain readable
- DTOs contain catalog metadata and prompt text only — no collector, profile, or raw payload data

## Verification anchors

```bash
pnpm test src/content-builder
pnpm test:db src/content-builder
pnpm test:http:db src/content-builder
pnpm web:typecheck
```

## Known change hotspots and limitations

- Small module surface today; expansion into collected-content selection will require new ports and safe DTO contracts
- Future Builder work must not import Content Manager repositories or Collector Runtime internals without an explicit approved contract
