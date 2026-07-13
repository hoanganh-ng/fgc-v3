# Project Snapshot

## Current Product Stage

The near-term product direction is the **Profile Feed Collector MVP**.

The project has enough Content Collector foundation to focus on proving one operator-usable loop before expanding Content Builder or Content Publisher:

1. Persist collector profiles and authenticated sessions.
2. Run safe profile behavior / warm-up when needed.
3. Collect the authenticated Facebook profile home feed.
4. Extract useful group/page text posts from captured feed payloads.
5. Store normalized content items with categories and review status.
6. Preview, select, reject, and mark content as used.
7. Review discovered publishing sources.
8. Promote approved Facebook group sources into managed source groups.

Content Builder Transform Types, Content Briefs, Producers, Producer Sets, artifacts, LLM execution, prompt versioning, collected-content selection, and Content Publisher behavior are parked until the feed collector loop is validated.

The priority is actual working behavior as soon as possible: explain current
home-feed outcomes, calibrate only from real diagnostic evidence, validate the
complete loop repeatedly, then lock the Collector baseline and move directly to
Content Builder discovery.

## Current Active Sprint

Sprint 075 — Real-Shape Home Feed Extractor Calibration is **active**; the
sanitized real-shape fixture is admitted and the narrow extractor calibration
is implemented pending Product Owner review.

Sprint 074 is accepted and profile home-feed runs retain and expose a strict,
safe aggregate diagnostic summary. Sprint 075 classified the gap as
`EXTRACTION`, admitted the sanitized configured-group text-post fixture from
commit `765ccad`, and calibrated the home-feed extractor to accept GraphQL
`id` only from objects explicitly type-qualified as `Group` on
fixture-demonstrated publisher paths (`to`,
`comet_sections.action_link.group`). Arbitrary object ids, actor/user ids, and
unqualified `target_group.id` remain excluded.

The planned completion sequence is:

- **Sprint 075 — Real-Shape Home Feed Extractor Calibration**: reproduce
  confirmed failures with sanitized real-shape fixtures and make only the
  evidence-backed extractor correction.
- **Sprint 076 — Repeated Live Collector Validation**: complete at least five
  live runs across multiple days, preferably with at least two profiles, and
  evaluate reliability, usefulness, diagnostics, deduplication, lease release,
  content review, and discovered-source review/promotion.
- **Sprint 077 — Collector MVP Baseline Lock**: record the supported provider,
  regression fixtures, limitations, recovery guidance, and smoke test, then
  move active product development to Content Builder.

If live validation reveals a blocking defect, a narrow correction sprint is
inserted before acceptance rather than expanding the validation sprint.

Sprint 073 — Product Scope Lock And Surface Trim is accepted.

Sprint 074 — Home Feed Extraction Diagnostics is accepted.

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
- **Content Management**: content categories, managed source groups, normalized content items, deduplication, review lifecycle, top comments, safe content preview/status APIs, discovered source identity, and approved group promotion into managed source groups.
- **Web UI**: Profile Feed Collector MVP surfaces for profiles, profile feed runs, content items, source groups/categories, and discovered sources. Parked/advanced pages may remain routed but are hidden from primary navigation.
- **Operator Commands**: canonical `pnpm operator:*` commands for provisioning, manual collection, workers, schedulers, browser probe, and the profile home-feed one-shot runner.

## Current Known Gaps

- Manual live-Facebook validation of the calibrated home-feed extractor still
  needs Product Owner review of the repeated operator run summary.
- Further extractor calibration beyond the admitted Group-qualified `id` path
  must be justified by new diagnostics and a separate sanitized fixture.
- Content Builder and Content Publisher remain parked until the collector loop is validated.

## Collector Completion Gate

Before moving to Content Builder:

- At least five live home-feed runs must be completed across multiple days,
  preferably using at least two provisioned profiles.
- Eligible feeds must repeatedly produce useful group/page content.
- Zero-yield and failed runs must be safely explainable.
- Duplicate posts must merge instead of creating duplicate review items.
- Profile leases must release on the exercised terminal paths.
- The Web UI must support run inspection, content review, discovered-source
  review, and eligible group promotion.
- No unresolved blocking defect may remain in the normal
  home-feed-to-review loop.
- Logs, DTOs, fixtures, docs, and UI must remain free of sensitive browser,
  profile, and raw Facebook data.
