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

## Current Active Sprint

Sprint 074 — Home Feed Extraction Diagnostics is **active**.

The goal is to make profile home-feed collection runs explain their result safely before changing extractor behavior. The sprint should surface safe capture diagnostics and aggregated warning/count summaries so an operator can understand why a run produced zero or few candidates without exposing raw Facebook payloads or sensitive runtime data.

Sprint 074 must not change Facebook extraction behavior, browser capture behavior, profile checkout/leasing, HTTP contracts, database schemas/migrations, Content Builder internals, LLM execution, Content Briefs, Producers, artifacts, or Content Publisher behavior unless a later approved handoff explicitly narrows such a change.

Sprint 073 — Product Scope Lock And Surface Trim is accepted.

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
- **Profile Feed Collection**: profile-bound home-feed run records, bounded browser execution through the existing browser provider boundary, payload capture, extraction, source-publisher observation, content submission, and safe run summaries.
- **Content Management**: content categories, managed source groups, normalized content items, deduplication, review lifecycle, top comments, safe content preview/status APIs, discovered source identity, and approved group promotion into managed source groups.
- **Web UI**: Profile Feed Collector MVP surfaces for profiles, profile feed runs, content items, source groups/categories, and discovered sources. Parked/advanced pages may remain routed but are hidden from primary navigation.
- **Operator Commands**: canonical `pnpm operator:*` commands for provisioning, manual collection, workers, schedulers, browser probe, and the profile home-feed one-shot runner.

## Current Known Gaps

- Home-feed runs need better safe diagnostics for zero-candidate or low-yield outcomes.
- Manual live-Facebook validation of the profile home-feed path still needs operator execution and review.
- Home-feed extractor fixture coverage exists, but real-shape calibration may still be needed after diagnostics reveal the failure reason.
- Content Builder and Content Publisher remain parked until the collector loop is validated.
