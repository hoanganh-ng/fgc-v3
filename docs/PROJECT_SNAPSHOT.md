# Project Snapshot

## Current Product Stage

The **Profile Feed Collector MVP is accepted and locked**. The near-term product
direction is now Architect-led Content Builder workflow discovery using actual
reviewed content.

The accepted operator-usable Collector loop is:

1. Persist collector profiles and authenticated sessions.
2. Run safe profile behavior / warm-up when needed.
3. Collect the authenticated Facebook profile home feed.
4. Extract useful group/page text posts from captured feed payloads.
5. Store normalized content items with categories and review status.
6. Preview, select, reject, and mark content as used.
7. Review discovered publishing sources.
8. Promote approved Facebook group sources into managed source groups.

The validated Collector baseline is locked by accepted Sprint 077 and is now
maintenance-only. Content Builder Transform Types, Content Briefs, Producers,
Producer Sets, artifacts, LLM execution, prompt versioning, and
collected-content selection remain parked until discovery shapes a narrow,
operator-useful Builder workflow. Content Publisher remains parked until a
useful generated-content workflow exists.

The priority is actual working behavior as soon as possible: explain current
home-feed outcomes, calibrate only from real diagnostic evidence, validate the
complete loop repeatedly, then lock the Collector baseline and move directly to
Content Builder discovery.

## Current Active Sprint

No Builder implementation sprint is active. Content Builder workflow discovery
is the current Architect/Product Owner activity.

Sprint 079 is accepted through implementation commits `fc56bb1` and `99e948c`
and correction commits `5a84070` and `781b53d`. The Collector Runtime HTTP
surface is separated into six resource families behind stable server-schema,
server-route, and Web-client compatibility paths. Architecture references are
current, boundary/cycle guards cover import and re-export edges, and
`docs/CODEBASE_CHANGE_MAP.md` ranks later cleanup without authorizing it.

Sprint 078 is accepted at commit `28bd08c`. The root command surface is reduced
from 69 scripts to exactly 35. The typed `stack:service` CLI replaces 34
repetitive aliases with exact Compose parity, rejects invalid combinations
before spawn, launches without a shell, and propagates child failures. The six
lifecycle and 13 canonical operator commands remain stable; Compose and
Collector runtime behavior did not change.

Sprint 077 is accepted at implementation commit `93cf205` and correction commit
`1a7861d`. `docs/COLLECTOR_BASELINE.md` is now the permanent operator and
maintenance runbook. The change was documentation-only; it added no runtime
behavior or new live-Facebook claim.

Sprint 075 is accepted. It classified the live gap as `EXTRACTION`, admitted a
sanitized configured-group text-post fixture, and calibrated the extractor to
accept GraphQL `id` only from explicitly type-qualified `Group` objects at
the exact candidate-relative paths `$.to` and
`$.comet_sections.action_link.group`. Off-path, actor/user, kind-only, and
unqualified `target_group.id` cases remain excluded. The accepted repeated
live run improved from zero to five candidates and submitted all five.

Sprint 076 exploratory samples then proved useful content, duplicate merging,
and lease release, but they required a temporary proxy eligibility bypass.
Sprint 076A is accepted at commit `f7a4970`. It adds the explicit persisted
`UNCONFIGURED | DIRECT | PROXY` contract, preserves the accepted normal
`https://www.facebook.com/` target, and proves one clean supported Playwright
DIRECT run with no checkout bypass and a released lease. That proof now counts
as `V06`.

Sprint 076B is accepted at correction commit `bc5c73d`. Discovered Sources now
provide fixed-host safe review links for ID-only groups, preserve opaque IDs as
technical detail, fail approval closed without a safe destination, and never
render or default to unsafe persisted canonical URLs. The Product Owner
recognized and approved one live ID-only group through this supported flow and
confirmed the safe promotion default without promoting it.

Sprint 076 is accepted at evidence commit `109ee4c`. Supported Playwright
samples `V06`–`V10` used explicit `DIRECT` networking and the normal home
target across two UTC dates. Four runs succeeded with candidates, three yielded
useful content, cooldown behavior was safely explained, all acquired leases
were released, duplicate merge was proven, and one eligible approved group was
promoted into a paused managed source.

The planned completion sequence is:

- **Sprint 076A — Supported Direct-Network Home-Feed Baseline**: accepted;
  standard direct-network checkout and one clean Playwright run are proven.
- **Sprint 076B — Reviewable Discovered-Source Identity**: accepted; safe
  inspection and fail-closed approval are proven.
- **Sprint 076 — Repeated Live Collector Validation**: accepted; the Collector
  Completion Gate passes with no unresolved supported-path blocker.
- **Sprint 077 — Collector MVP Baseline Lock**: accepted; the permanent runbook
  records the supported provider, network modes, target, smoke test, recovery,
  regression anchors, limitations, and maintenance boundary.
- **Sprint 078 — Runtime Command Surface Consolidation**: accepted; 34
  repetitive stack aliases and one dead E2E alias are replaced by one validated
  CLI, leaving an exact 35-script supported surface.
- **Sprint 079 — Codebase Changeability Baseline**: accepted; current
  architecture/module documentation is reconciled and the Collector Runtime
  HTTP boundary is modularized into six resource families behind stable
  compatibility paths.

If live validation reveals another blocking defect, a narrow correction sprint
is inserted before acceptance rather than expanding the validation sprint.

Sprint 073 — Product Scope Lock And Surface Trim is accepted.

Sprint 074 — Home Feed Extraction Diagnostics is accepted.

Sprint 075 — Real-Shape Home Feed Extractor Calibration is accepted.

Sprint 072 — Content Builder Transform Type Catalog is parked and not accepted.

## Recently Relevant Collector Milestones

- **Sprint 065A — Facebook Home-Feed Extractor Fixtures**: accepted. Added a separate, pure, fixture-driven Facebook home-feed extractor for group/page candidates. It made no live-Facebook validation claim.
- **Sprint 065B — Profile-Bound Home-Feed Run Model**: accepted. Added durable `ProfileHomeFeedCollectionRun` records for profile-bound home-feed collection without creating a fake Home Feed source group.
- **Sprint 065C1 — Bare Home-Feed Content Ingestion**: accepted. Added `POST /collector/content-items/home-feed`, allowed home-feed-first content items without `sourceGroupId`, and preserved internal-only collection provenance.
- **Sprint 065C2 — Profile-Bound Home-Feed Checkout**: accepted. Added the `HOME_FEED_COLLECTION` checkout path for the exact profile referenced by a home-feed run.
- **Sprint 065C3 — Bounded Facebook Home-Feed Execution**: accepted. Added the one-shot operator-invoked executor `pnpm operator:profile-home-feed:run-next` using bounded profile checkout, browser capture, extraction, source-publisher observation, content submission, and lease release. Manual live-Facebook validation was not performed by that sprint.
- **Sprint 066 / 067 / 069 sequence**: delivered discovered publishing-source review/status mutation, approved Facebook group promotion into managed source groups, and the Web UI review/promotion surface.
- **Sprint 068 / 071 sequence**: added profile home-feed scheduling/runs surfaces and runtime support. These are useful but should be de-emphasized if they distract from manual MVP validation.

## Currently Available Capabilities

- **Profile Management**: profile creation, lifecycle, session ingestion, provisioning/reprovisioning, authentication health, checkout leasing, and trusted runtime profile configuration.
- **Profile Behavior**: safe operator-driven account exercise / warm-up and authentication-health observation.
- **Profile Feed Collection**: profile-bound home-feed run records, bounded browser execution through the existing browser provider boundary, payload capture, extraction, source-publisher observation, content submission, safe run summaries, and strict aggregate diagnostics for capture, extraction, warnings, deduplication, and terminal failure stages.
- **Content Management**: content categories, managed source groups, normalized
  content items, deduplication, review lifecycle, top comments, safe content
  preview/status APIs, discovered source records, and approved group promotion
  into managed source groups, including safe reviewable identity for ID-only
  Facebook groups and fail-closed approval when no safe destination exists.
- **Web UI**: Profile Feed Collector MVP surfaces for profiles, profile feed runs, content items, source groups/categories, and discovered sources. Parked/advanced pages may remain routed but are hidden from primary navigation.
- **Operator Commands**: canonical `pnpm operator:*` commands for provisioning, manual collection, workers, schedulers, browser probe, and the profile home-feed one-shot runner.

## Current Known Gaps

- Content Builder discovery has not yet selected the first operator workflow,
  output type, source-selection contract, or acceptance example. No
  implementation sprint is shaped.
- `docs/CODEBASE_CHANGE_MAP.md` ranks additional structural hotspots, but none
  is authorized and cleanup should not displace product discovery.
- Further extractor calibration beyond the admitted exact Group-qualified
  `id` paths requires new diagnostics and a separate sanitized fixture.
- Content Builder implementation remains parked pending discovery. Content
  Publisher remains parked until a useful generated-content workflow exists.

## Collector Completion Gate — Passed

Sprint 076 proved each required condition before the baseline-lock handoff:

- At least five live home-feed runs must be completed across multiple days,
  preferably using at least two provisioned profiles.
- Eligible feeds must repeatedly produce useful group/page content.
- Zero-yield and failed runs must be safely explainable.
- Duplicate posts must merge instead of creating duplicate review items.
- Profile leases must release on the exercised terminal paths.
- The Web UI must support run inspection, content review, safe source
  inspection before approval, discovered-source review, and eligible group
  promotion.
- No unresolved blocking defect may remain in the normal
  home-feed-to-review loop.
- Logs, DTOs, fixtures, docs, and UI must remain free of sensitive browser,
  profile, and raw Facebook data.
