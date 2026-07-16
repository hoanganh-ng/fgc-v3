# Content Manager

## Purpose and current capability

Content Manager is the durable store for collected Facebook content, managed source groups, discovered publishers, and review workflows. It validates normalized ingestion input, deduplicates by `platform + externalPostId`, tracks collection provenance, and exposes safe operator HTTP and Web UI surfaces for content and source review.

The accepted upstream for home-feed items, discovered-source review, and paused group promotion is documented in [COLLECTOR_BASELINE.md](../COLLECTOR_BASELINE.md).

## Owns

- Normalized content ingestion and validation
- Content item storage, deduplication, and lifecycle status
- Source groups, entry route metadata, and managed categories
- Engagement counts and top-comment normalization
- `SourcePublisher` identity, observation, status updates, and promotion to paused source groups
- `ContentCollectionProvenance` value object and durable persistence
- Home-feed ingestion (`IngestHomeFeedCollectedContentUseCase`) and source-group ingestion
- Safe read APIs and strict HTTP DTO allowlists

## Does not own

- Profile or session management
- Profile-source access state
- Browser automation, capture, or scraping
- Raw Facebook GraphQL parsing ([ADR-015](../DECISIONS/ADR-015-platform-extractor-boundary.md))
- Video generation or publishing pipelines
- Collection run orchestration

## Public ports, contracts, and cross-module communication

- **HTTP**: `/collector/content-items/*`, `/collector/source-groups/*`, `/collector/source-publishers/*` via `src/interfaces/http/routes/content-manager.routes.ts`
- **Inbound from Collector Runtime**: content ingestion and publisher observation HTTP clients
- **Outbound to Profile Manager**: source group existence validation for profile-source access workflows
- **Web client**: `apps/web/src/lib/api/content-manager-client.ts`

## Important source paths and entrypoints

- Domain: `src/content-manager/domain/`
- Application use cases: `src/content-manager/application/use-cases/`
- Composition: `src/composition/content-manager/`
- Persistence: `src/infrastructure/database/schema/content-manager.schema.ts`, Drizzle repositories
- HTTP schemas: `src/interfaces/http/schemas/content-manager.http-schemas.ts`
- Web pages: `apps/web/src/pages/content-items-page.tsx`, `source-groups-page.tsx`, `source-publishers-page.tsx`

## Critical invariants and sensitive-data rules

- Duplicate posts update metrics but preserve identity, first-seen timestamps, and manual review status
- `SourcePublisher` identity is `platform + kind + externalPublisherId`; observation never changes review status
- Provenance first surface is immutable; conflicting merges throw `ContentCollectionProvenanceConflictError`
- Safe reads omit raw payloads, cookies, tokens, and internal provenance JSON by default
- `collectionProvenance` is internal; HTTP DTOs expose optional `sourceGroupId` only when present

## Verification anchors

```bash
pnpm test src/content-manager
pnpm test:db src/content-manager
pnpm test:http:db src/content-manager
```

Boundary test: `src/composition/content-manager/content-manager.boundary.test.ts`

## Known change hotspots and limitations

- `src/interfaces/http/schemas/content-manager.http-schemas.ts` (~1,257 lines)
- `src/content-manager/application/source-publisher-application.test.ts` (~1,607 lines)
- `src/interfaces/http/routes/content-manager.routes.ts` (~831 lines)
- `apps/web/src/pages/source-groups-page.tsx` (~1,605 lines) — large operator form surface
- Content Builder handoff contracts remain undefined beyond safe read shapes
