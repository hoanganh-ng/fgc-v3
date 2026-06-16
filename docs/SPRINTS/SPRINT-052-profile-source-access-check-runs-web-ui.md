# Sprint 052: Profile-Source Access Check Runs Web UI

## Goal

Add a frontend-only operator workspace for requesting, listing, filtering, monitoring, inspecting, and canceling queued Profile-Source Access Check Runs through the existing safe Collector Runtime HTTP APIs.

## Scope

- [ ] Extend `apps/web/src/lib/api/collector-runtime-client.ts` with strict Zod schemas, types, query serialization, and methods for Profile-Source Access Check Runs.
- [ ] Enforce frontend lifecycle parsing in client:
  - `SUCCEEDED` requires outcome and forbids failureReason.
  - `FAILED` requires failureReason and forbids outcome.
  - `QUEUED`, `RUNNING`, and `CANCELED` contain neither.
- [ ] Add queries, mutations, view-model helpers, and tests under `apps/web/src/features/collector-runtime/`.
- [ ] Create `apps/web/src/pages/profile-source-access-check-runs-page.tsx`.
- [ ] Register route `/profile-source-access-check-runs` and add primary navigation label: "Access Checks".
- [ ] Build a two-column operational workspace:
  - Main list/history area.
  - Request and filter cards in the right column.
  - Existing reusable Drawer for run details.
- [ ] Request form selects a profile and source group using existing safe queries and submits `{ profileId, sourceGroupId }`.
- [ ] Preserve rows when profile/source-group enrichment fails. Fall back to IDs and show incomplete-list warnings.
- [ ] Support list filters for `status`, `profileId`, `sourceGroupId`.
- [ ] Support offset pagination and reset offset when filters change.
- [ ] Poll about every five seconds while the displayed page contains `QUEUED` or `RUNNING` records.
- [ ] Expose Cancel only for `QUEUED` records. Keep cancellation errors local to the affected row.
- [ ] Detail drawer displays safe metadata, frozen target, outcome/sanitized failure reason, and timestamps.
- [ ] Define central outcome labels and badge tones for outcome classification.
- [ ] Display the disclaimer: "Successful access is one collection requirement and does not guarantee current checkout eligibility."

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
- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm typecheck`
- `pnpm test`
- `git diff --check`
