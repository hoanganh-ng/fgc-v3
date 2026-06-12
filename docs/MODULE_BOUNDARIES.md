# Module Boundaries

## Collector Profile Manager

Owns:

- Profile lifecycle and state machine rules.
- Account maturity/readiness stage and transition rules.
- Profile property model and invariants.
- Provisioning token lifecycle.
- Session ingestion rules.
- Checkout eligibility rules.
- Domain-level validation for profile readiness, busy state, cooldowns, temporal windows, and safety thresholds.
- Checkout eligibility gating for normal collection, including the requirement that `accountStage = COLLECTION_READY`.

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
- Browser provider orchestration and provider adapters inside infrastructure.
- Platform Extractors that convert raw platform artifacts into normalized Content Manager ingestion input.
- The Facebook GraphQL Payload Extractor that converts captured Facebook GraphQL response bodies into normalized Content Manager ingestion input candidates.
- Raw Facebook GraphQL payload interpretation.
- Facebook-specific field mapping.
- Post extraction.
- High-engagement comment extraction.
- Engagement count extraction.
- Best-effort handling of missing fields in captured platform payloads.
- Future extractor fixtures and parser tests.
- Submitting normalized collected content to Content Manager through the Content Manager HTTP API.
- Calling Collector Profile Manager checkout/release through runtime-owned ports and HTTP adapters.
- Requesting lease-scoped runtime profile configuration from Collector Profile Manager through trusted application/API contracts after checkout.
- Profile lease release orchestration.
- Returning profile usage outcomes and runtime metrics.

The Sprint 022 orchestration flow coordinates Profile Manager checkout/release behavior, captured payload collection, and Content Manager submission through Collector Runtime-owned ports and use cases. Payload capture is represented by a port only in Sprint 022; real browser automation, network interception, login, navigation, scheduling, queues, and database access remain out of scope.

Browser-provider hardening must stay inside Collector Runtime infrastructure. Providers consume Profile Manager trusted runtime configuration after checkout; they must not become a profile manager, randomly mutate profile identity, regenerate fingerprints outside Profile Manager, solve CAPTCHAs, automate credentials, bypass checkpoints, bypass rate limits/access controls, post, comment, or like.

Does not own:

- Profile property invariants.
- Provisioning token rules.
- Authentication session ingestion rules.
- Content item lifecycle rules.
- Content deduplication or upsert rules.
- Group category management.
- Direct database access.
- Direct Content Manager repository access.
- Collector Profile Manager repository access.
- Collector Profile Manager composition root wiring.
- Collector Profile Manager checkout eligibility or leasing business rules.
- Collector Profile Manager account maturity/readiness stage rules.
- Public Profile Manager read DTO expansion for sensitive runtime material.
- Authority over profile identity, session state, proxy configuration, or fingerprint configuration.
- Content building.
- Content publishing.

## Platform Extractor Boundary

A Platform Extractor is a collection-side component that converts raw platform-specific artifacts, such as captured Facebook GraphQL payloads, into normalized Content Manager ingestion input.

The first extractor is the Facebook GraphQL Payload Extractor under `src/collector-runtime/platform-extractors/facebook`.

The Sprint 020 extractor is extractor-only. It does not perform browser automation, network interception, profile checkout, HTTP submission to Content Manager, database access, or persistent deduplication.

The Sprint 021 submission flow accepts already-captured payloads only. It invokes the Facebook GraphQL Payload Extractor, submits normalized candidates to the Content Manager HTTP API, and reports per-candidate submission outcomes. It does not perform browser automation, network interception, profile checkout, lease release, scheduling, queueing, database access, or Content Manager business logic.

The Sprint 022 profile-orchestrated collection flow invokes the Sprint 021 submission flow for each captured payload. It does not move extractor rules, Content Manager deduplication/upsert behavior, or Profile Manager checkout eligibility/leasing rules into Collector Runtime.

The Sprint 024 trusted runtime profile configuration contract remains owned by Collector Profile Manager and is guarded by `leaseId`. Collector Runtime may consume that contract after checkout, but public profile read DTOs must continue to omit authentication state, local storage, proxy credentials, provisioning tokens, and token hashes.

Sprint 038 keeps profile operational status separate from account maturity. A profile may be `READY` after login/session ingestion while its `accountStage` remains `NEW_ACCOUNT`; Collector Runtime must still rely on Profile Manager checkout instead of interpreting or bypassing account-stage rules itself.

Extractor fixtures must be sanitized. They must not include cookies, tokens, authorization headers, viewer IDs, private user data, raw request headers, or sensitive account/session details. Synthetic fixtures should be clearly named as synthetic. Real payload fixtures must be sanitized before they are used in tests.

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
