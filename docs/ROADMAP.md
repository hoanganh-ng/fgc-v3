# Roadmap

## Current Product Direction

The immediate product goal is a reliable **Facebook Profile Home-Feed Collector**.

The project must first prove one operator-usable loop:

1. Provision an authenticated collector profile.
2. Request a profile home-feed collection run.
3. Capture current Facebook home-feed payloads through bounded browser execution.
4. Extract useful Facebook group/page text posts.
5. Store or merge normalized content items.
6. Review collected content and discovered sources in the Web UI.
7. Promote approved Facebook group sources into paused managed source groups.

Content Builder and Content Publisher remain parked until this loop is reliable, useful, explainable, and repeatable against live Facebook.

## Delivery Principle

Reach actual working behavior as soon as possible.

- Prefer manual, operator-driven validation before autonomous operation.
- Change capture or extraction only when diagnostics and sanitized real-shape fixtures identify a concrete failure.
- Use narrow correction sprints when live validation reveals a defect.
- Do not expand scheduling, account exercise, source-group collection, Content Builder, or Content Publisher unless required to complete the home-feed loop.
- Do not redesign established modules or remove parked code during this validation sequence.

## Collector Completion Gate

The Collector MVP is ready to lock only when all of the following have evidence.

### Reliability

- At least five live home-feed runs have been completed on more than one day.
- Preferably at least two provisioned profiles have been exercised.
- Eligible feeds repeatedly produce useful content candidates.
- Successful, failed, interrupted, and zero-yield outcomes are distinguishable.
- Leases are released correctly on success, failure, and interruption.
- Duplicate posts merge instead of creating duplicate review items.

### Content quality

- Accepted posts have stable post identity, stable group/page publisher identity, and meaningful body text.
- Sponsored posts and personal-profile posts are excluded.
- Source URL and engagement data are preserved when available.
- Discovered publishers are created or updated correctly.
- Operator review confirms that collected posts are useful inputs for future Content Builder workflows.

### Observability and safety

- Every run safely explains capture, parsing, extraction, rejection, publisher observation, submission, and merge counts.
- Zero-candidate and low-yield runs explain why without exposing raw payloads or sensitive browser/profile data.
- Logs, HTTP DTOs, fixtures, and Web UI do not expose cookies, localStorage, tokens, headers, proxy credentials, fingerprint secrets, viewer data, screenshots, raw HTML, or private response bodies.

### Operator usability

- An operator can request a run, observe status and diagnostics, review
  collected content, open a safe Facebook destination for each approval
  candidate, review discovered sources, and promote an eligible group through
  the Web UI.
- CLI may remain for provisioning, diagnostics, recovery, and deliberate live validation; routine content review must not require database access.

## Immediate Sprints

### Sprint 074 — Home Feed Extraction Diagnostics

Status: **accepted**.

Make every profile home-feed run explain its result safely without changing capture or extraction behavior.

Expected outcome: distinguish capture failure, parse failure, unsupported payload shape, extraction rejection, publisher-resolution rejection, submission failure, duplicate merge, and a legitimately low-yield feed.

### Sprint 075 — Real-Shape Home Feed Extractor Calibration

Status: **accepted**.

Used Sprint 074 diagnostics and an admitted sanitized real-shape fixture to
calibrate the exact Group-qualified GraphQL publisher-id paths while preserving
off-path and unstable-identity exclusions.

Expected outcome achieved: the admitted fixture extracts one expected
`GROUP` candidate, focused and full-unit verification passes, and the repeated
live run improved from zero to five candidates with five submissions.

### Sprint 076A — Supported Direct-Network Home-Feed Baseline

Status: **accepted**.

Make direct networking an explicit persisted profile mode so standard
provisioning, checkout, trusted runtime configuration, and browser launch work
without a proxy bypass.

Expected outcome achieved: explicit direct-network configuration passes the
supported path, and accepted sample `V06` completed one clean normal-home
Playwright run with no bypass and a released lease.

### Sprint 076B — Reviewable Discovered-Source Identity

Status: **accepted**.

Give every approval candidate a safe Facebook review destination, keep opaque
IDs as technical details, and reject approval when no safe destination exists.

Expected outcome achieved: the Product Owner opened and recognized an existing
ID-only Facebook group through the safe link, approved it, confirmed the
`APPROVED` state and safe promotion default, and recorded no sensitive
evidence. Unsafe persisted canonical URLs remain compatible but are not
clickable or used as promotion defaults.

### Sprint 076 — Repeated Live Collector Validation

Status: **accepted**.

Supported samples `V06`–`V10` span two UTC dates. Four runs succeeded with
candidates, three yielded useful content, one natural cooldown failure was
explained without a lease leak, duplicate merge was proven, and one eligible
approved group was promoted into a paused managed source.

Expected outcome achieved: the Collector Completion Gate passes with no
unresolved supported-path blocker.

### Sprint 077 — Collector MVP Baseline Lock

Status: **active and approved for Builder execution**.

Record the supported baseline, known limitations, regression fixtures,
provider choice, recovery guidance, and manual smoke test without changing
runtime behavior.

Expected outcome: the Collector becomes a stable upstream source and active
product development moves to Content Builder.

## Correction Sprint Rule

If Sprint 075 or Sprint 076 reveals a blocking defect, insert a narrowly named correction sprint before advancing. It must:

- cite diagnostic and live-validation evidence;
- change the lowest responsible layer;
- preserve security and module ownership;
- add a regression fixture or test when possible;
- avoid unrelated refactoring;
- repeat the affected live validation afterward.

## Parked Until Collector Lock

- Content Builder Transform Type expansion.
- Content Briefs, Producers, Producer Sets, graphs, artifacts, and LLM execution.
- Content Publisher and publication scheduling.
- Broad autonomous-operation improvements not required for manual validation.
- Broad UI redesign or module cleanup.

## After the Collector Baseline Lock

Content Builder discovery starts from actual selected content and this operator need:

> Turn selected collected posts into a useful article, script, or video-content input.

The first Content Builder sprint must be shaped from observed workflow. It must not assume that the parked Transform Type catalog, Producer graph, or Artifact model is automatically the correct starting point.

Content Publisher remains parked until a useful generated-content workflow exists.

## Durable Architecture Decisions

- Hexagonal architecture: Domain -> Application use cases and ports -> Infrastructure/interface adapters -> Composition/runtime wiring.
- Collector Profile Manager owns profiles, sessions, leases, readiness, authentication health, and trusted runtime configuration.
- Collector Runtime owns browser execution, capture, extraction, run records, workers, schedulers, and submission orchestration.
- Content Manager owns categories, source groups, normalized content, deduplication, content lifecycle, discovered-source review, and promotion.
- Web UI consumes safe contracts and does not duplicate domain rules.
