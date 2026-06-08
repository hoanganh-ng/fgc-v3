# Module Boundaries

## Collector Profile Manager

Owns:

- Profile lifecycle and state machine rules.
- Profile property model and invariants.
- Provisioning token lifecycle.
- Session ingestion rules.
- Checkout eligibility rules.
- Domain-level validation for profile readiness, busy state, cooldowns, temporal windows, and safety thresholds.

Does not own:

- Browser automation execution.
- Collection task orchestration.
- Web UI rendering.
- Database technology selection.
- HTTP framework implementation.
- Content building.
- Content publishing.

## Content Manager

Owns:

- Validation of normalized content ingestion input.
- Content item storage.
- Content deduplication and upsert rules.
- Content lifecycle status.
- Source group records.
- Group categories as managed entities.
- Engagement counts.
- Top comments as normalized metadata for each content item.
- Safe read APIs.
- Future handoff shape for Content Builder.

Does not own:

- Profile or session management.
- Browser automation.
- Network payload capture.
- Raw Facebook GraphQL parsing.
- Scraping strategy.
- Platform-specific extraction rules.
- Comment crawling strategy.
- Video generation.
- Publishing workflows.

Content Manager should not accept raw Facebook GraphQL payloads as its primary ingestion contract. Its canonical write contract is normalized Content Manager ingestion input. A future implementation may optionally store sanitized raw payload data or a raw payload reference for trusted diagnostics or reprocessing, but that storage is not the canonical content model.

## Collector Runtime

Owns:

- Future execution of collection workflows.
- Checking out eligible profiles from Collector Profile Manager.
- Visiting Facebook groups and posts.
- Browser automation and network payload capture.
- Platform Extractors that convert raw platform artifacts into normalized Content Manager ingestion input.
- Raw Facebook GraphQL payload interpretation.
- Facebook-specific field mapping.
- Post extraction.
- High-engagement comment extraction.
- Engagement count extraction.
- Best-effort handling of missing fields in captured platform payloads.
- Future extractor fixtures and parser tests.
- Submitting normalized collected content to Content Manager.
- Releasing profile leases.
- Returning profile usage outcomes and runtime metrics.

Does not own:

- Profile property invariants.
- Provisioning token rules.
- Authentication session ingestion rules.
- Content item lifecycle rules.
- Content deduplication or upsert rules.
- Group category management.
- Content building.
- Content publishing.

## Platform Extractor Boundary

A Platform Extractor is a collection-side component that converts raw platform-specific artifacts, such as captured Facebook GraphQL payloads, into normalized Content Manager ingestion input.

The first planned extractor is the Facebook GraphQL Payload Extractor.

Canonical collection ingestion flow:

```text
raw GraphQL payload
-> Facebook GraphQL Payload Extractor
-> normalized Content Manager ingestion input
-> Content Manager validation/upsert/storage
```

Platform Extractors belong to the Collector Runtime side of the Content Collector. They do not belong in the Content Manager domain core.

## Profile Manager Web UI

Owns:

- Future human-facing profile management screens.
- Future profile state inspection and operational controls.
- Calling application APIs to perform allowed profile operations.

Does not own:

- Profile domain rules.
- Direct persistence logic.
- Browser automation execution.
- Content building.
- Content publishing.

## Content Builder

Owns:

- Future transformation of collected material into video-ready assets and assembled video outputs.
- Future builder-specific validation, rendering, and quality workflows.

Does not own:

- Profile lifecycle.
- Profile provisioning.
- Collector runtime execution.
- Publishing workflows.

## Content Publisher

Owns:

- Future publishing workflows for completed video outputs.
- Future destination-specific publishing rules, scheduling, and status tracking.

Does not own:

- Profile lifecycle.
- Collection runtime execution.
- Video assembly.
- Collector profile provisioning.

## Boundary Rule

Shared behavior must be introduced only when it has a clear owner and does not leak adapter or framework concerns into domain logic. Cross-module communication should happen through explicit application contracts, not direct access to another module's internals.
