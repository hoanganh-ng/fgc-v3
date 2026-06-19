# Sprint 065A: Facebook Home-Feed Extractor Fixtures

## Goal

Add a separate, pure, fixture-driven Facebook home-feed GraphQL
extractor for group and page posts. The extractor derives stable
publisher observation data, excludes explicitly sponsored content,
excludes explicit personal-profile posts, safely handles malformed
payloads, and preserves the existing source-group extractor contract
unchanged.

Sprint 065A is an extractor-only unit/fixture sprint. It makes no
claim that live Facebook home-feed browser execution has been
validated. Manual live-Facebook validation remains mandatory in Sprint
065C.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_SNAPSHOT.md`
- `docs/TESTING_STRATEGY.md`
- `docs/SPRINTS/SPRINT-020-facebook-graphql-payload-extractor.md`
- `docs/SPRINTS/SPRINT-064A-content-collection-provenance-model.md`
- `docs/SPRINTS/SPRINT-064B-provenance-persistence-and-compatibility.md`
- `src/collector-runtime/platform-extractors/facebook/**`
- `src/content-manager/domain/source-publisher.ts`
- `src/content-manager/domain/source-publisher-kind.ts`
- `src/content-manager/domain/source-publisher.schemas.ts`
- `src/content-manager/domain/content-collection-provenance.ts`

## Capability Summary

- Adds `FacebookHomeFeedGraphQLPayloadExtractor` beside the existing
  source-group `FacebookGraphQLPayloadExtractor`.
- Adds a dedicated home-feed input/result/candidate contract. The
  input accepts only `capturedAt`, `payload`, and optional
  `sourceUrlHint`; it does not accept or invent `sourceGroupId`.
- Emits normalized content candidate fields without `sourceGroupId`:
  platform, external post id, source URL, optional title, body text,
  optional author metadata, optional posted timestamp, collected
  timestamp, engagement counts, optional share count, and sorted top
  comments.
- Emits a required `publisherObservation` on every candidate:
  `platform: FACEBOOK`, `kind: GROUP | PAGE`,
  `externalPublisherId`, `observedAt`, and optional `displayName`
  and `canonicalUrl`.
- Reuses Sprint 020 normalization behavior for body text, post
  identity, URLs, engagement counts, top comments, deduplication,
  malformed payload safety, and omission of raw payload data.
- Keeps the existing source-group extractor public input, result,
  candidate, and warning contracts unchanged. `sourceGroupId` remains
  required on the source-group extractor.

## Publisher Rules

- For group posts, the `SourcePublisher` observation represents the
  group, even when the post author is an individual member.
- For page posts, the `SourcePublisher` observation represents the
  page.
- The home-feed extractor requires explicit GROUP/PAGE publisher
  classification and a stable external publisher id.
- Display names are never used as identity.
- Arbitrary GraphQL `id` values are never used as identity.
- Mutable URL slugs are never used as the sole identity.
- Ambiguous publishers are skipped with typed warnings:
  `UNKNOWN_PUBLISHER_KIND` or `MISSING_STABLE_PUBLISHER_ID`.
- The extractor does not generate a durable `sourcePublisherId`;
  durable identity ownership remains in Content Manager.

## Exclusion Rules

- Sponsored posts are excluded only when explicit sponsorship/ad
  metadata is present, such as `isSponsored`, `sponsoredData`, or
  ad metadata fields.
- A post is not excluded merely because its body text contains the
  word "sponsored".
- Explicit personal-profile posts are excluded with
  `EXCLUDED_PERSONAL_PROFILE_POST`.
- Valid group posts are not excluded merely because their author is an
  individual profile.
- Excluded posts are never returned as candidates.

## Architecture

```text
Collector Runtime / Platform Extractors
  facebook-home-feed-extractor.types.ts
    dedicated home-feed input/result/candidate/warning contracts
  facebook-home-feed-graphql-payload-extractor.ts
    pure fixture-driven GraphQL payload extractor
  facebook-home-feed-graphql-payload-extractor.test.ts
    focused unit coverage
  __fixtures__/synthetic-home-feed.fixture.ts
    compact synthetic/sanitized home-feed fixtures
```

No Content Manager repositories, use cases, HTTP routes,
infrastructure adapters, or composition wiring are imported. No
browser, persistence, HTTP, worker, scheduler, Docker, or Web UI
behavior is added.

## File Manifest

### Create

- `docs/SPRINTS/SPRINT-065A-facebook-home-feed-extractor-fixtures.md`
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-extractor.types.ts`
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.ts`
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.test.ts`
- `src/collector-runtime/platform-extractors/facebook/__fixtures__/synthetic-home-feed.fixture.ts`

### Modify

- `src/collector-runtime/platform-extractors/facebook/index.ts` -
  export the new home-feed extractor contract and implementation.
- `src/collector-runtime/platform-extractors/facebook/__fixtures__/index.ts` -
  export the new synthetic home-feed fixtures.
- `src/collector-runtime/platform-extractors/facebook/facebook-graphql-payload-extractor.test.ts` -
  add a regression assertion that source-group extraction still
  requires `sourceGroupId`.
- `docs/SPRINTS/active.md` - record Sprint 065A as active and
  authorized; keep Sprint 064B accepted.
- `docs/PROJECT_SNAPSHOT.md` - record the active 065A capability and
  no-live-Facebook claim.
- `docs/TESTING_STRATEGY.md` - clarify that 065A is fixture/unit
  verified and live validation remains mandatory in 065C.

### Do Not Touch

- The existing source-group extractor public types.
- `sourceGroupId` requiredness on the existing source-group extractor.
- Content Manager repositories, use cases, HTTP routes,
  infrastructure, composition wiring, schemas, migrations, or DTOs.
- Browser automation, persistence, HTTP, workers, scheduler, Docker,
  or Web UI behavior.
- Sprint 065B or Sprint 065C activation.

## Testing

`pnpm exec vitest run
src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.test.ts
src/collector-runtime/platform-extractors/facebook/facebook-graphql-payload-extractor.test.ts`
covers:

- Group post authored by an individual where the group is the
  publisher.
- Page post where the page is the publisher.
- Sponsored group and page posts excluded from explicit metadata.
- Explicit personal-profile post exclusion.
- Unknown publisher kind warning.
- Missing stable publisher id warning.
- Malformed payload safety.
- Duplicate candidate deduplication.
- Body text containing "sponsored" without sponsored metadata.
- Unrelated nested profile data that does not invalidate a group/page
  post.
- No raw or sensitive payload data in output or fixtures.
- Existing source-group extractor behavior remains separate and still
  requires `sourceGroupId`.

## Verification Commands

```bash
pnpm typecheck
pnpm exec vitest run \
  src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.test.ts \
  src/collector-runtime/platform-extractors/facebook/facebook-graphql-payload-extractor.test.ts
pnpm test
git diff --check
git status --short
```

No database, HTTP integration, Docker E2E, browser, or live-Facebook
verification is required for Sprint 065A.

## Status

Sprint 065A is **active and authorized**. It is not accepted and does
not activate Sprint 065B or Sprint 065C.
