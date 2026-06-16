# Content Manager

## Ownership
- Validation of normalized content ingestion input.
- Content item storage.
- Content deduplication and upsert rules (e.g. by `platform + externalPostId`).
- Content lifecycle status (review, approval, selection).
- Source group records and metadata.
- Source group entry route metadata for access paths.
- Group categories.
- Engagement counts and top comments normalization.
- Safe read APIs for content and sources.
- Future handoff shape for Content Builder.

## Does Not Own
- Profile or session management.
- Profile-source access state for individual profiles.
- Browser automation or network payload capture.
- Raw Facebook GraphQL parsing or scraping strategy.
- Platform-specific extraction rules.

## Important Source Paths
- `src/content-manager/domain/`
- `src/content-manager/application/`
- `src/content-manager/infrastructure/`
- `src/content-manager/interface/`
- `src/content-manager/composition/`

## Important Entrypoints
- `Fastify API`: `src/content-manager/interface/http/` (e.g. `/content/items`, `/content/source-groups`)
- `Composition Root`: `src/content-manager/composition/root.ts`

## Critical Invariants
- Must validate data upon ingestion and return structured failures.
- Duplicate content items must retain originally assigned IDs, timestamps, and manual review status while updating changing metrics.

## Cross-Module Communication
- Acts as the receiving end of the Collector Runtime submission pipeline via HTTP API boundaries.
- Provides explicit validation of source group references to Collector Profile Manager.

## Sensitive Data Rules
- Canonical content model must not expose raw diagnostic payloads (like full Facebook GraphQL trees) by default on safe reads.

## Relevant Verification Commands
```bash
pnpm test src/content-manager
pnpm test:db src/content-manager
pnpm test:http:db src/content-manager
```
