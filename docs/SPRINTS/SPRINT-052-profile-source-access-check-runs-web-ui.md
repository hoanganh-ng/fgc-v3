# Sprint 052: Profile-Source Access Check Runs Web UI

## Goal

Add a frontend-only operator workspace for requesting, listing, filtering, monitoring, inspecting, and canceling queued Profile-Source Access Check Runs through the existing safe Collector Runtime HTTP APIs.

## Scope

- [x] Extend `apps/web/src/lib/api/collector-runtime-client.ts` with strict Zod schemas, types, query serialization, and methods for Profile-Source Access Check Runs.
  - `accountStageAtRequest` uses a closed `ProfileSourceAccessCheckRunAccountStageSchema` enum (6 values: NEW_ACCOUNT, WARMING, COLLECTION_READY, LIMITED, NEEDS_REVIEW, RETIRED). Unknown non-empty stages are rejected.
- [x] Enforce frontend lifecycle parsing in client:
  - `SUCCEEDED` requires outcome and forbids failureReason.
  - `FAILED` requires failureReason and forbids outcome.
  - `QUEUED`, `RUNNING`, and `CANCELED` contain neither.
- [x] Add queries, mutations, view-model helpers, and tests under `apps/web/src/features/collector-runtime/`.
  - Query key tests: stable list keys, distinct detail keys, all-prefix invariant, enabled-flag logic.
  - Mutation tests: invalidation targets correct family root; failure does not invoke invalidation.
  - View-model tests: all outcome labels, getProfileDisplay, getSourceGroupDisplay, pagination, isCheckRunFiltersActive.
  - Drawer state tests: select, row marking, switching, close sources, focus restore, content state isolation.
  - Client tests: strict schema, lifecycle invariants, request schema, query params, path encoding, account-stage enum.
- [x] Create `apps/web/src/pages/profile-source-access-check-runs-page.tsx`.
  - Page title: **Profile-Source Access Checks**.
  - Navigation label: **Access Checks** (unchanged).
  - History card title: **Access Check Runs** (unchanged).
  - Profile request options show: `<displayName> — <status> / <accountStage> (<id>)`.
  - Empty state distinguishes no-filters ("No access check runs have been requested yet.") from active-filters ("No access check runs match the current filters.").
- [x] Register route `/profile-source-access-check-runs` and add primary navigation label: "Access Checks".
- [x] Build a two-column operational workspace:
  - Main list/history area.
  - Request and filter cards in the right column.
  - Existing reusable Drawer for run details.
- [x] Request form selects a profile and source group using existing safe queries and submits `{ profileId, sourceGroupId }`.
- [x] Preserve rows when profile/source-group enrichment fails. Fall back to IDs and show incomplete-list warnings.
- [x] Support list filters for `status`, `profileId`, `sourceGroupId`.
- [x] Support offset pagination and reset offset when filters change.
- [x] Poll about every five seconds while the displayed page contains `QUEUED` or `RUNNING` records.
- [x] Expose Cancel only for `QUEUED` records. Keep cancellation errors local to the affected row.
- [x] Detail drawer displays safe metadata, frozen target, outcome/sanitized failure reason, and timestamps.
  - Fields: Run ID, Profile, Source Group, Stage At Request, Requested/Started/Finished, Created, Updated, Frozen Target, Outcome, Failure Reason.
- [x] Define central outcome labels and badge tones for outcome classification.
- [x] Display the disclaimer: "Successful access is one collection requirement and does not guarantee current checkout eligibility."

## Out Of Scope

- Backend, domain, repository, schema, migration, or HTTP changes.
- Worker changes.
- Docker Compose.
- Retries or scheduling.
- Canceling `RUNNING` checks.
- Browser interruption.
- Contextual request buttons on profile/source-group pages.
- Direct Profile-Source Access editing.
- Group joining or other Facebook write actions.
- CAPTCHA/checkpoint bypass.
- Authentication/authorization.
- Unrelated refactors.

## Verification

Run:
- [x] `pnpm web:typecheck` — passed (0 errors)
- [x] `pnpm web:build` — passed (1768 modules, no errors)
- [x] `pnpm typecheck` — passed (0 errors)
- [x] `pnpm test` — **75 test files passed, 780 tests passed** (8 skipped integration tests requiring DB)
- [x] `git diff --check` — clean

## Test files added or modified (Sprint 052 + correction passes)

| File | Tests |
|---|---|
| `profile-source-access-check-run-client.test.ts` | 9 (schema, lifecycle, enum) |
| `profile-source-access-check-run-view-model.test.ts` | 22 (form, outcomes, display, active/cancel, pagination, filters) |
| `profile-source-access-check-run-detail-drawer-state.test.ts` | 6 (select, mark, switch, close, focus, content state) |
| `profile-source-access-check-run-queries.test.ts` | 11 (key stability, distinctness, prefix invariant, enabled flag) |
| `profile-source-access-check-run-mutations.test.ts` | 4 (invalidation target, family root, cancel parity, failure baseline) |
