# Sprint 046: Ambient Exercise Runs Web UI

## Goal

Add a frontend-only operational Web UI for Ambient Account Exercise runs so operators can request, monitor, inspect, filter, page through, and cancel queued read-only exercise runs.

## Scope

- Frontend-only changes under `apps/web/`.
- Add strict Web UI Zod schemas for account exercise run responses and requests.
- Add Collector Runtime client methods for:
  - `POST /collector/account-exercise-runs`
  - `GET /collector/account-exercise-runs`
  - `GET /collector/account-exercise-runs/:accountExerciseRunId`
  - `POST /collector/account-exercise-runs/:accountExerciseRunId/cancel`
- Add account exercise run query keys, paginated list query, detail query, request mutation, and cancel mutation.
- Add a dedicated routed page for ambient account exercise runs.
- Allow requesting ambient account exercise runs for a profile with safe action-budget inputs.
- Use safe profile reads to enrich profile IDs where practical.
- Preserve run rows when profile enrichment fails and fall back to `profileId`.
- Support status and profile filters.
- Support offset pagination with item-count-aware Previous/Next behavior.
- Poll every approximately five seconds only while the displayed page contains `QUEUED` or `RUNNING` runs.
- Display safe summaries and sanitized failure reasons.
- Show Cancel only for `QUEUED` runs.
- Do not optimistically mark cancellation successful.
- Keep cancellation errors local to the affected run.
- Add a focused detail view backed by the existing detail endpoint.
- Reuse existing UI primitives, API error handling, and Sprint 045 collection-run patterns where appropriate.

## Existing Backend Contracts

- `POST /collector/account-exercise-runs`
- `GET /collector/account-exercise-runs`
- `GET /collector/account-exercise-runs/:accountExerciseRunId`
- `POST /collector/account-exercise-runs/:accountExerciseRunId/cancel`

The current backend request contract stores only safe run metadata and action-budget values. The Web UI must not create leases, launch browsers, run the CLI, or execute browser automation.

## Account Exercise Run Statuses

- `QUEUED`
- `RUNNING`
- `SUCCEEDED`
- `FAILED`
- `CANCELED`

Only `QUEUED -> CANCELED` is available through the Web UI cancellation flow.

## Security

Never expose or request:

- cookies
- localStorage contents
- proxy credentials
- trusted runtime configuration
- browser fingerprint data
- provisioning tokens
- raw Facebook payloads
- HTML
- screenshots
- raw browser or network details

The UI may display only safe profile identifiers/display names, safe account stage/status fields, action-budget values, safe summaries, timestamps, statuses, and sanitized `{code, message}` failure reasons.

## Out Of Scope

- Backend changes
- Database migrations
- Worker or browser automation changes
- Launching the CLI or browser exercise from the Web UI
- Scheduler or recurring runs
- Automatic retries
- Canceling `RUNNING` runs
- Account-stage automation
- New exercise types or statuses
- Assisted group access changes
- Collection-run changes
- Authentication/authorization
- Commits or pushes

## Sprint 046A: Exercise Run Detail Drawer Polish

Sprint 046A addressed the Run Detail visibility issue found after the initial
Ambient Exercise Runs Web UI implementation. The original detail view rendered as
a third document-flow card under Request Exercise Run and Filters in the right
sidebar, which could place the panel below the viewport and make Details clicks
look ineffective.

The detail view now opens in a fixed right-side drawer. The drawer uses full
viewport height, scrolls its content independently, uses full viewport width on
small screens, and uses an approximately 448px desktop width. The permanent
right sidebar keeps only Request Exercise Run and Filters. Detail loading and
detail errors remain inside the drawer, backed by the existing account exercise
run detail query and safe DTO.

Accessibility behavior:

- Opening the drawer moves focus into the drawer, preferring the Close button.
- Tab and Shift+Tab are contained inside the drawer and wrap at the ends.
- The single-focusable-element case keeps focus on that element.
- Background app content is marked inert while the portaled drawer is open.
- Escape, backdrop click, and the Close button close the drawer.
- Closing restores focus to the exact Details button that opened the drawer.
- Updating the selected run reuses the existing drawer instead of stacking
  drawers.

Files changed:

- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/drawer.tsx`
- `apps/web/src/components/ui/drawer.test.tsx`
- `apps/web/src/components/ui/drawer-interaction-fixture.html`
- `apps/web/src/components/ui/drawer-interaction-fixture.tsx`
- `apps/web/src/components/ui/drawer.interaction.test.ts`
- `apps/web/src/features/collector-runtime/account-exercise-run-detail-drawer-state.ts`
- `apps/web/src/features/collector-runtime/account-exercise-run-detail-drawer-state.test.ts`
- `apps/web/src/pages/account-exercise-runs-page.tsx`

Verification completed for Sprint 046A:

- `pnpm web:typecheck` passed.
- `pnpm web:build` passed with the existing Vite large chunk warning.
- `pnpm typecheck` passed.
- `pnpm test` passed.
- `git diff --check` passed.

## Verification

Run:

- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm typecheck`
- `pnpm test`
- `git diff --check`

Add targeted frontend tests for:

- strict parsing
- request serialization
- status and profile filters
- offset pagination
- conditional polling
- cancellation visibility and local errors
- query invalidation
- detail query isolation
- profile enrichment failure fallback
