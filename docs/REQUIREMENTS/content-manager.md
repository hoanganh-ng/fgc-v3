# Requirements: Content Manager

## Purpose

Content Manager is the Content Collector module that owns collected content as the central business object of the pipeline. It records source groups, managed group categories, content items, engagement counts, selected high-engagement comments as normalized metadata, content lifecycle status, deduplication behavior, safe read contracts, and the future handoff shape for Content Builder.

Content Manager is introduced before Collector Runtime and Web UI so the project can define the content model and application boundary before adding scraping behavior or human-facing screens.

## Module Position

Content Manager is part of the Content Collector stage.

The Content Collector is separated into three core modules:

- `collector-profile-manager`: owns profile lifecycle, profile properties, provisioning, session ingestion, checkout eligibility, and leasing.
- `content-manager`: owns collected content, source groups, content categories, deduplication/upsert behavior, content lifecycle status, safe reads, and future builder handoff contracts.
- `collector-runtime`: will check out profiles, visit sources, capture platform artifacts, use Platform Extractors to produce normalized Content Manager ingestion input, submit normalized collected content to Content Manager, and release profile leases.

## Ownership

Content Manager owns:

- Validation of normalized content ingestion input.
- Content item storage.
- Content deduplication and upsert rules.
- Content lifecycle status.
- Source group records.
- Group categories as managed entities.
- Engagement counts.
- Top comments as normalized metadata for each content item.
- Safe read APIs for future interfaces.
- Future handoff shape for Content Builder.

Content Manager does not own:

- Profile or session management.
- Browser automation.
- Network payload capture.
- Raw Facebook GraphQL parsing.
- Scraping strategy.
- Platform-specific extraction rules.
- Comment crawling strategy.
- Video generation.
- Publishing workflows.

## Platform Extraction Boundary

A Platform Extractor is a collection-side component that converts raw platform-specific artifacts, such as captured Facebook GraphQL payloads, into normalized Content Manager ingestion input.

The first planned extractor is the Facebook GraphQL Payload Extractor.

Collector Runtime / Platform Extractor owns:

- Raw Facebook GraphQL payload interpretation.
- Facebook-specific field mapping.
- Post extraction.
- High-engagement comment extraction.
- Engagement count extraction.
- Best-effort handling of missing fields.
- Future extractor fixtures and parser tests.

Content Manager owns validation, deduplication, upsert, lifecycle state, managed records, and safe reads after extraction has produced normalized input.

Canonical ingestion flow:

```text
raw GraphQL payload
-> Facebook GraphQL Payload Extractor
-> normalized Content Manager ingestion input
-> Content Manager validation/upsert/storage
```

Content Manager should not accept raw Facebook GraphQL payloads as its primary ingestion contract. A future implementation may optionally store sanitized raw payload data or a raw payload reference for trusted diagnostics or reprocessing, but that storage is optional and is not the canonical content model.

## Normalized Content Manager Ingestion Input

The Content Manager ingestion contract should describe clean collected content, not platform response structure.

Expected normalized ingestion input includes:

- Platform and source group identity.
- External post identity and source URL.
- Rich text post body and optional title.
- Optional author display fields that are safe to retain.
- Optional posted timestamp.
- Engagement counts.
- Top comments as normalized metadata.
- Collection timestamp.

Facebook GraphQL field paths, nested response fragments, missing-field heuristics, and response-shape fallbacks belong to the Facebook GraphQL Payload Extractor, not this contract.

## First Platform And Source Type

The first platform is Facebook, represented as `FACEBOOK`.

The first source type is Facebook knowledge groups. These groups are configured as source group records and assigned to managed categories.

## Group Categories

Group categories are managed entities, not free text. A source group references a category by `categoryId`.

Initial group category fields:

- `id`
- `name`
- `slug`
- `description` optional
- `createdAt`
- `updatedAt`

Category names and slugs should be controlled by Content Manager use cases in a future implementation. Slugs should be stable enough for operational filtering and human-facing views.

## Source Groups

A source group represents a configured external group that Collector Runtime may visit in the future.

Initial source group fields:

- `id`
- `platform = FACEBOOK`
- `externalGroupId`
- `name`
- `url`
- `categoryId`
- `status`
- `collectionPriority`
- `notes`
- `createdAt`
- `updatedAt`

Source group statuses:

- `ACTIVE`: eligible for future collection work.
- `PAUSED`: retained but temporarily excluded from future collection work.
- `ARCHIVED`: retained for history and references, but not eligible for future collection work.

## Content Items

The first content type is Facebook rich text post.

Initial content item fields:

- `id`
- `platform = FACEBOOK`
- `sourceGroupId`
- `externalPostId`
- `sourceUrl`
- `title` optional
- `bodyText`
- `authorDisplayName` optional
- `authorExternalId` optional
- `postedAt` optional
- `firstCollectedAt`
- `lastCollectedAt`
- `reactionCount`
- `commentCount`
- `shareCount` optional
- `topComments`
- `status`
- `createdAt`
- `updatedAt`

Optional future diagnostics fields, if explicitly introduced by a later sprint:

- `sanitizedRawPayload`
- `rawPayloadRef`

Diagnostics fields must not become the primary ingestion contract or canonical content model.

Content statuses:

- `COLLECTED`: ingested and available for review or downstream selection.
- `SELECTED`: selected for future Content Builder handoff.
- `REJECTED`: intentionally excluded from downstream use.
- `USED`: already consumed by a future Content Builder or publishing workflow.

## High-Engagement Comments

Content Manager stores only the top N high-engagement comments for a content item in v1. These comments arrive as normalized metadata in the ingestion input after platform extraction.

Rules:

- The Facebook GraphQL Payload Extractor extracts high-engagement comments from raw payloads.
- Top comments are selected by reaction count before ingestion.
- Default N is 10.
- A future ingestion request may make N configurable.
- Full comment history is out of scope for v1.
- The top comment set is replaced by the latest top N set when duplicate content is upserted.

Initial top comment fields:

- `externalCommentId`
- `bodyText`
- `authorDisplayName` optional
- `authorExternalId` optional
- `reactionCount`
- `replyCount` optional
- `postedAt` optional
- `collectedAt`

## Deduplication And Upsert

Content Manager deduplicates duplicate collected content by platform and external post identity.

V1 deduplication key:

- `platform`
- `externalPostId`

Duplicate content updates the existing content item rather than creating another item.

Upsert behavior:

- Preserve `id`.
- Preserve `firstCollectedAt`.
- Preserve `createdAt`.
- Update `bodyText` if changed.
- Update latest engagement counts.
- Replace `topComments` with the latest top N set.
- Update `lastCollectedAt`.
- Update `updatedAt`.
- Preserve existing manual status unless a separate status use case changes it.

Status preservation means an item marked `SELECTED`, `REJECTED`, or `USED` does not return to `COLLECTED` merely because Collector Runtime sees it again.

## Safe Reads

Future Content Manager read APIs should expose operational and review-friendly content data without leaking unnecessary raw source payloads or platform extraction internals.

Safe read contracts may include:

- Source group summaries and details.
- Category summaries and details.
- Content item summaries for filtering and review.
- Content item details with body text, source context, engagement counts, lifecycle status, and top comments.

Safe read contracts should not expose `sanitizedRawPayload`, `rawPayloadRef`, or any future raw source diagnostics by default. If a future trusted diagnostics workflow needs sanitized raw payload data or a raw payload reference, it should use a dedicated contract.

## Future Content Builder Handoff

Content Manager owns the future shape that Content Builder will consume, but it does not implement Content Builder behavior.

A future handoff contract should likely include:

- Content item identity.
- Platform and source group context.
- Category context.
- Source URL.
- Title when available.
- Body text.
- Selected top comments.
- Engagement counts.
- Posted and collected timestamps.
- Lifecycle status or explicit handoff state.

The first handoff candidates are likely content items in `SELECTED` status.
