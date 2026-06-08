# ADR-015: Platform Extractor Boundary

## Status

Accepted

## Context

Sprint 014 introduced Content Manager as the next Content Collector module. Content Manager owns collected content, source groups, managed group categories, engagement fields, top high-engagement comments as normalized metadata, lifecycle status, deduplication/upsert behavior, safe read contracts, and the future Content Builder handoff shape.

During Sprint 014A planning, the project identified a missing boundary. Collector Runtime will capture Facebook GraphQL payloads that may include rich text group posts, engagement counts, and high-engagement comments. Those payloads are platform-specific artifacts with unstable field shapes, missing-field behavior, and extraction rules.

Putting raw Facebook GraphQL payload parsing inside Content Manager core would make the content domain depend on scraping details and platform response structure. That would violate the architecture rule that domain logic must not depend on browser automation, network capture, or outside technology details.

## Decision

Introduce a Platform Extractor boundary on the Collector Runtime side.

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

Content Manager owns:

- Validation of normalized content ingestion input.
- Content deduplication/upsert.
- Content lifecycle status.
- Source group records.
- Group categories.
- Engagement fields.
- Top comments as normalized metadata.
- Safe read APIs.

Content Manager does not own:

- Browser automation.
- Network payload capture.
- Raw Facebook GraphQL parsing.
- Scraping strategy.
- Platform-specific extraction rules.

The canonical ingestion flow is:

```text
raw GraphQL payload
-> Facebook GraphQL Payload Extractor
-> normalized Content Manager ingestion input
-> Content Manager validation/upsert/storage
```

Content Manager should not accept raw Facebook GraphQL payloads as its primary ingestion contract. A later implementation may optionally store sanitized raw payload data or a raw payload reference for trusted diagnostics or reprocessing, but that storage is not the canonical content model.

## Consequences

- Content Manager stays focused on normalized content rules instead of platform payload parsing.
- Collector Runtime can evolve platform-specific extraction behavior without changing Content Manager domain rules.
- Parser fixtures and extraction tests belong with the future extractor implementation, not the Content Manager core.
- Content Manager ingestion use cases can validate stable normalized input even if Facebook GraphQL response shapes change.
- Optional raw payload diagnostics require a dedicated storage/read contract and must not leak through safe Content Manager reads by default.

