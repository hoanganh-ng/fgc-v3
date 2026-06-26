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

Sprint 073 — Product Scope Lock And Surface Trim is **active**.

This sprint refocuses docs, Web UI navigation, and command/script surfaces around the Profile Feed Collector MVP. It must preserve implemented modules and runtime behavior while reducing operator-facing noise.

Sprint 073 does not change extractor behavior, browser capture, profile checkout/leasing, HTTP contracts, database schemas/migrations, Content Builder internals, LLM execution, Content Briefs, Producers, artifacts, or Content Publisher behavior.

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
- **Web UI**: operator presentation and safe API consumption for profiles, profile feed runs, content items, managed source groups/categories, and discovered sources/promotion. Sprint 073 should trim primary navigation to these MVP surfaces.
- **Operator Tools**: CLI tools for profile provisioning, manual collection, worker execution, browser probing, profile home-feed execution, schedulers, and worker processes. Sprint 073 should reduce package script noise while preserving discoverability through docs.
- **Docker E2E**: isolated production-like Docker E2E harness using synthetic fixtures only. It does not perform live Facebook validation.

## Current Modules

- **Collector Profile Manager**: profiles, sessions, provisioning, readiness, account health, leases, and trusted runtime configuration.
- **Content Manager**: categories, source groups, normalized content, deduplication, content lifecycle, discovered source review/promotion, and safe reads.
- **Collector Runtime**: collection orchestration, browser providers, payload capture, platform extraction, run records, workers, scheduled dispatch support, and normalized content submission.
- **Content Builder**: Transform Type catalog code may exist, but this stage is parked for now.
- **Web UI**: operator presentation and safe API consumption.

## Important Architectural Invariants

- Hexagonal architecture: Domain logic has zero dependencies on HTTP, databases, browsers, queues, React, or framework code.
- Dependencies point inward: Domain -> Application use cases and ports -> Infrastructure/interface adapters -> Composition/runtime wiring.
- Collector Profile Manager owns profile identity, session state, account readiness, authentication health, leases, and trusted runtime profile configuration.
- Collector Runtime owns browser execution, capture, platform extraction, run records, workers, and submission orchestration.
- Content Manager owns categories, source groups, normalized content, deduplication, content lifecycle, discovered source review, and approved group promotion.
- Web UI consumes safe APIs and must not duplicate durable domain rules.
- Sensitive data such as cookies, localStorage, tokens, authorization headers, proxy credentials, trusted runtime configuration, fingerprint secrets, raw Facebook payloads, raw HTML, screenshots, viewer data, and private payloads must not be exposed through DTOs, logs, fixtures, docs, or Web UI contracts.

## Important Unresolved Risks

- The Facebook home-feed extractor can run but may produce zero candidates against real captured payloads. Sprint 074 should add safe extraction diagnostics before changing parser behavior.
- Long-term viability of browser provider behavior against Facebook fingerprinting remains uncertain.
- Package script and operator-surface sprawl can obscure the MVP path.
- Hidden or parked surfaces must not be deleted until migration and compatibility risks are understood.

## Testing Strategy

The cross-cutting testing strategy is documented in [`docs/TESTING_STRATEGY.md`](TESTING_STRATEGY.md). It defines five layers: unit tests, opt-in database integration tests, opt-in HTTP integration tests, Docker E2E with synthetic fixtures, and opt-in operator-driven manual live-Facebook validation.

## Verification Commands

```bash
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:http:db
pnpm web:typecheck
pnpm web:build
pnpm test:e2e:docker
```

Sprint 073 may use a smaller safe verification set when it only changes docs, navigation, and scripts:

```bash
pnpm typecheck
pnpm test
pnpm web:typecheck
pnpm web:build
git diff --check
git status --short
```

## Immediate Next Expected Work

Sprint 073 should update the current-state docs, trim primary Web UI navigation to the Profile Feed Collector MVP, and reduce package command noise without deleting implemented modules or changing runtime behavior.

After Sprint 073 is accepted, the next expected sprint is Sprint 074 — Home Feed Extraction Diagnostics. Sprint 074 should make zero-candidate home-feed runs explain themselves safely before any real-shape extractor calibration is attempted.
