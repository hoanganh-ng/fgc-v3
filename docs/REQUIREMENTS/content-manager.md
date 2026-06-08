# Requirements: Content Manager

## Purpose

Content Manager is the Content Collector module that owns collected content as the central business object of the pipeline. It records source groups, managed group categories, content items, engagement counts, selected high-engagement comments, content lifecycle status, deduplication behavior, safe read contracts, and the future handoff shape for Content Builder.

Content Manager is introduced before Collector Runtime and Web UI so the project can define the content model and application boundary before adding scraping behavior or human-facing screens.

## Module Position

Content Manager is part of the Content Collector stage.

The Content Collector is separated into three core modules:

- `collector-profile-manager`: owns profile lifecycle, profile properties, provisioning, session ingestion, checkout eligibility, and leasing.
- `content-manager`: owns collected content, source groups, content categories, deduplication/upsert behavior, content lifecycle status, safe reads, and future builder handoff contracts.
- `collector-runtime`: will check out profiles, visit sources, extract source data, submit collected content to Content Manager, and release profile leases.

## Ownership

Content Manager owns:

- Content item storage.
- Content deduplication and upsert rules.
- Content lifecycle status.
- Facebook source group records.
- Group categories as managed entities.
- Engagement counts.
- Top N high-engagement comments for each content item.
- Safe read APIs for future interfaces.
- Future handoff shape for Content Builder.

Content Manager does not own:

- Profile or session management.
- Browser automation.
- Actual scraping behavior.
- Comment crawling strategy.
- Video generation.
- Publishing workflows.

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
- `rawPayload` optional
- `createdAt`
- `updatedAt`

Content statuses:

- `COLLECTED`: ingested and available for review or downstream selection.
- `SELECTED`: selected for future Content Builder handoff.
- `REJECTED`: intentionally excluded from downstream use.
- `USED`: already consumed by a future Content Builder or publishing workflow.

## High-Engagement Comments

Content Manager stores only the top N high-engagement comments for a content item in v1.

Rules:

- Top comments are selected by reaction count.
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

Future Content Manager read APIs should expose operational and review-friendly content data without leaking unnecessary raw source payloads.

Safe read contracts may include:

- Source group summaries and details.
- Category summaries and details.
- Content item summaries for filtering and review.
- Content item details with body text, source context, engagement counts, lifecycle status, and top comments.

Safe read contracts should not expose `rawPayload` by default. If a future trusted diagnostics workflow needs raw source payload data, it should use a dedicated contract.

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

