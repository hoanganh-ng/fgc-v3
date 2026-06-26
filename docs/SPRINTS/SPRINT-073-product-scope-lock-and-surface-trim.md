# Sprint 073 — Product Scope Lock And Surface Trim

## Status

Active, not accepted.

## Goal

Refocus the repository around the **Profile Feed Collector MVP** and reduce operator-facing noise before changing extractor behavior.

This sprint is a scope-lock and surface-trim sprint. It should make the current product direction clear in docs, Web UI navigation, and package commands while preserving implemented behavior for later review.

## Context

The product direction has changed from expanding into Content Builder to proving the Profile Feed Collector MVP loop:

1. Persist collector profiles and authenticated sessions.
2. Run safe profile behavior / warm-up when needed.
3. Collect the authenticated Facebook profile home feed.
4. Extract useful group/page text posts from captured feed payloads.
5. Store normalized content items with categories and review status.
6. Preview, select, reject, and mark content as used.
7. Review discovered publishing sources.
8. Promote approved Facebook group sources into managed source groups.

Sprint 072 introduced the Content Builder Transform Type catalog direction, but that direction is now parked. Do not remove implemented Transform Type code in this sprint unless explicitly approved later. Hide or de-emphasize parked surfaces first.

## Required context

- `docs/SPRINTS/active.md`
- `docs/SPRINTS/SPRINT-072-content-builder-transform-type-catalog.md`
- `docs/SPRINTS/SPRINT-073-product-scope-lock-and-surface-trim.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_SNAPSHOT.md`
- `README.md`
- `package.json`
- `apps/web/src/app/navigation.ts`
- `apps/web/src/app/router.tsx`
- `apps/web/src/app/layout/dashboard-layout.tsx`
- Existing MVP Web UI pages:
  - `apps/web/src/pages/profiles-page.tsx`
  - `apps/web/src/pages/profile-detail-page.tsx`
  - `apps/web/src/pages/source-groups-page.tsx`
  - `apps/web/src/pages/source-publishers-page.tsx`
  - `apps/web/src/pages/content-items-page.tsx`
  - `apps/web/src/pages/content-item-detail-page.tsx`
  - `apps/web/src/pages/profile-home-feed-collection-runs-page.tsx`
- Existing Web UI query/mutation helpers under:
  - `apps/web/src/features/content-manager/**`
  - `apps/web/src/features/content-items/**`
  - `apps/web/src/lib/api/**`
- Script/runtime docs when changing command documentation:
  - `docs/RUNTIME.md`
  - any existing command docs if present

### Unrelated areas not to scan

- Do not scan all historical sprint files.
- Do not scan extractor implementation except to avoid changing it.
- Do not scan Content Builder internals unless needed only to hide navigation safely.
- Do not scan migrations except to confirm no migration deletion is being attempted.
- Do not scan browser provider internals, profile checkout internals, or raw capture adapters.

## Requirements

### Functional requirements

- Make the active sprint pointer reference Sprint 073 only.
- Keep Sprint 072 explicitly parked / not accepted.
- Update durable current-state docs so the current product direction is the Profile Feed Collector MVP, not Content Builder expansion.
- Trim Web UI primary navigation to MVP surfaces:
  - Dashboard
  - Profiles
  - Profile Feed Runs
  - Content Items
  - Source Groups / Categories
  - Discovered Sources
- Rename operator-facing `Source Publishers` label to `Discovered Sources` where this can be done without changing backend contracts.
- Hide parked/advanced pages from primary navigation:
  - Transform Types
  - Collection Schedules
  - Home Feed Schedules
  - Exercise Runs
  - Access Checks
  - generic Collection Runs, unless Builder finds it is still required for the MVP navigation
- Keep routes available unless removing a route is necessary for compilation. Prefer hiding from navigation over deleting implementation.
- Reduce `package.json` script noise by keeping a smaller canonical set for daily use and moving advanced/operator/legacy command details to docs or helper scripts.
- Add or update command documentation so advanced commands are still discoverable.
- Preserve backward compatibility where removal would break documented runtime flows. Deprecated aliases may be removed only if docs clearly explain the replacement.

### Technical requirements

- Do not change domain models.
- Do not change database schema or migrations.
- Do not change HTTP contracts.
- Do not change Collector Runtime execution behavior.
- Do not change Facebook payload capture or extractor behavior.
- Do not change profile checkout, lease, account-stage, authentication health, or provisioning behavior.
- Do not expose sensitive fields in docs, UI, logs, fixtures, or DTO examples.
- Keep Web UI validation and API consumption safe; do not duplicate backend domain rules in UI beyond existing form/view-model validation patterns.

### Documentation requirements

- `docs/PROJECT_SNAPSHOT.md` should reflect the current active sprint and the Profile Feed Collector MVP direction.
- `README.md` should no longer imply Content Builder is the current focus.
- Command documentation should distinguish daily commands from advanced/operator commands.
- Parked areas should be described as parked, not deleted or rejected forever.

### Compatibility requirements

- Existing routes and implemented modules should continue to compile.
- Hidden Web UI pages should not be broken by navigation changes.
- Existing tests should not be weakened or removed merely because a surface is parked.

## Out of scope

- No extractor diagnostics work. That belongs to Sprint 074.
- No real-shape fixture calibration. That belongs to Sprint 075.
- No live Facebook validation.
- No raw payload persistence.
- No raw diagnostic payload exposure.
- No database migration deletion.
- No removal of Content Builder persistence or HTTP routes.
- No broad module deletion.
- No new product features.
- No LLM execution, Content Brief, Producer, artifact, or Content Publisher work.

## Implementation guidance

- Prefer small documentation and presentation changes over structural deletion.
- Treat this sprint as a product-scope correction, not a refactor.
- Keep backend contracts untouched.
- For Web UI navigation, change labels and sidebar entries first; avoid deleting route definitions unless the app cannot build otherwise.
- If `package.json` scripts are reduced, preserve a clear mapping in docs from old operator workflows to the new canonical commands.
- Keep command names operator-readable. Prefer a few canonical commands plus documented arguments over many alias scripts.
- Do not modify raw capture fixtures or create new fixtures.
- If a choice is ambiguous, preserve behavior and only hide/de-emphasize the surface.

## Verification points

Run the smallest safe verification set for a docs/UI/scripts cleanup:

```bash
pnpm typecheck
pnpm test
pnpm web:typecheck
pnpm web:build
git diff --check
git status --short
```

Manual UI verification:

- Start the Web UI.
- Confirm primary navigation shows the Profile Feed Collector MVP surfaces.
- Confirm hidden/parked pages are not in the sidebar.
- Confirm direct routes for existing hidden pages still do not crash if they remain routed.
- Confirm Content Items preview/status actions still render.
- Confirm Discovered Sources review/promote UI still renders through the renamed navigation entry.

Live Facebook validation is not required and should not be claimed.

## Risks and review focus

- **Navigation drift**: hiding the wrong page could make the MVP harder to operate.
- **Script breakage**: removing scripts without documentation could break known operator workflows.
- **Scope creep**: Builder may be tempted to delete parked modules; do not do that in this sprint.
- **Docs conflict**: `README.md`, `PROJECT_SNAPSHOT.md`, `ROADMAP.md`, and `active.md` must agree on the active direction.
- **Security**: docs must not include real tokens, cookies, profile secrets, raw Facebook payloads, viewer IDs, screenshots, or private payload examples.

## Builder reasoning effort

Medium.

## Handoff prompt for Builder

You are implementing Sprint 073 — Product Scope Lock And Surface Trim in the `fgc-v3` repository.

Context: The product direction is now the **Profile Feed Collector MVP**, not Content Builder expansion. The immediate product loop is: profiles and sessions → safe profile behavior/warm-up → authenticated Facebook profile home-feed collection → extraction into normalized content items → preview/select/reject/used → review discovered sources → promote approved Facebook group sources into managed source groups. Sprint 072 Transform Types is parked and not accepted. Do not delete Transform Type code or migrations in this sprint.

Your task is to make docs, Web UI navigation, and package commands reflect the new MVP direction while preserving implemented behavior.

Required context:
- `docs/SPRINTS/active.md`
- `docs/SPRINTS/SPRINT-072-content-builder-transform-type-catalog.md`
- `docs/SPRINTS/SPRINT-073-product-scope-lock-and-surface-trim.md`
- `docs/ROADMAP.md`
- `docs/PROJECT_SNAPSHOT.md`
- `README.md`
- `package.json`
- `apps/web/src/app/navigation.ts`
- `apps/web/src/app/router.tsx`
- `apps/web/src/app/layout/dashboard-layout.tsx`
- MVP Web UI pages for profiles, profile feed runs, content items, source groups, and source publishers/discovered sources
- command/runtime docs such as `docs/RUNTIME.md`

Requirements:
1. Ensure active sprint docs point to Sprint 073 only, with Sprint 072 parked/not accepted.
2. Update current-state docs and README to say the current focus is the Profile Feed Collector MVP.
3. Trim primary Web UI navigation to MVP surfaces: Dashboard, Profiles, Profile Feed Runs, Content Items, Source Groups/Categories, and Discovered Sources.
4. Rename operator-facing `Source Publishers` labels to `Discovered Sources` where safe, without renaming backend contracts, routes, DTOs, persistence, or domain concepts.
5. Hide parked/advanced pages from sidebar navigation: Transform Types, schedules, exercise/access-check pages, and other non-MVP surfaces. Prefer hiding over deleting routes.
6. Reduce `package.json` script noise by keeping canonical daily scripts and moving advanced/operator/legacy command details into docs or helper scripts. Preserve discoverability and avoid breaking necessary workflows.
7. Do not change domain models, HTTP contracts, database schemas/migrations, runtime behavior, profile checkout/leasing, browser capture, or extractor behavior.
8. Do not expose sensitive material: cookies, localStorage, tokens, auth headers, proxy credentials, runtime configuration secrets, raw Facebook payloads, viewer IDs, screenshots, private payloads, or stack traces.

Out of scope:
- Extractor diagnostics, real-shape fixture calibration, live Facebook validation, database deletion, Content Builder deletion, LLM execution, Content Briefs, Producers, artifacts, Content Publisher work, and broad refactors.

Verification:
Run:
```bash
pnpm typecheck
pnpm test
pnpm web:typecheck
pnpm web:build
git diff --check
git status --short
```

Manual checks:
- Web UI sidebar shows only MVP surfaces.
- Hidden pages are not in primary navigation.
- Direct routes for retained hidden pages do not crash.
- Content Items preview/status actions still render.
- Discovered Sources review/promote flow still renders.

Return a summary of changed files, behavior changes, verification commands and results, and any unverified items. Do not commit, push, or advance the sprint.
