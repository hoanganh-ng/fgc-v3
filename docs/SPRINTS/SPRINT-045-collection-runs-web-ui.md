# Sprint 045: Collection Runs Web UI — Queue, Monitor, Cancel

## Goal

Replace the Collection Runs placeholder page with a frontend-only operational workspace that can:

1. Request a manual collection run.
2. List and filter existing collection runs.
3. Monitor queued/running runs through restrained TanStack Query polling.
4. Cancel queued runs.
5. Display safe summaries and sanitized failures.

## Scope

- Frontend-only changes under `apps/web/`.
- Add a focused Web UI Collector Runtime client with strict Zod schemas.
- Implement `listCollectionRuns`, `requestCollectionRun`, and `cancelCollectionRun`.
- Add collection-run query keys, list query hooks, request mutation, and cancel mutation.
- Replace `apps/web/src/pages/collection-runs-page.tsx`.
- Use existing source-group queries for safe name enrichment and request choices.
- Preserve collection-run rows when source-group enrichment fails.
- Fall back to displaying `sourceGroupId` when a group cannot be resolved.
- Show a source-group pagination warning when more groups exist than were loaded.
- Support status/source-group filters and offset pagination.
- Use a valid collection-run limit no greater than 100.
- Poll every approximately five seconds only while the displayed page contains QUEUED or RUNNING runs.
- Expose Cancel only for QUEUED runs.
- Never optimistically transition a run before the backend accepts cancellation.
- Invalidate/refetch the appropriate query keys after request and cancel mutations.
- Keep optional `maxScrolls` and `maxDurationMs` absent when their form fields are blank.
- Preserve `maxScrolls = 0` as a valid value.
- Reuse existing UI primitives and error handling patterns.

## Collection Run Statuses

- QUEUED
- RUNNING
- SUCCEEDED
- FAILED
- CANCELED

Only QUEUED -> CANCELED is permitted by the current cancellation contract.

## Out Of Scope

- Backend changes
- Database or migrations
- Worker changes
- Scheduler or recurring runs
- Automatic retries
- Canceling RUNNING runs
- Worker interruption
- Log streaming
- Dedicated detail page
- Account exercise UI
- Assisted-access browser launching
- Profile-source access mutations
- Checkout eligibility changes
- Authentication/authorization
- Raw payloads, screenshots, HTML, cookies, localStorage, proxy credentials, runtime configuration, or fingerprint data
- Commits or pushes

## Security

Never expose or request:
- cookies
- localStorage
- proxy credentials
- runtime configuration
- browser fingerprint data
- provisioning tokens
- raw Facebook payloads
- HTML
- screenshots

## Files Changed

- `apps/web/src/lib/api/collector-runtime-client.ts` (new)
- `apps/web/src/features/collector-runtime/collection-run-queries.ts` (new)
- `apps/web/src/features/collector-runtime/collection-run-mutations.ts` (new)
- `apps/web/src/pages/collection-runs-page.tsx` (replaced)
- `src/collector-runtime/web-ui/collection-run-client.test.ts` (new)
- `src/collector-runtime/web-ui/collection-run-query-keys.test.ts` (new)
- `docs/SPRINTS/active.md` (updated)
- `docs/PROJECT_STATE.md` (updated)

## Verification

Run:
- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm typecheck`
- `pnpm test`
- `git diff --check`

Add targeted tests for:
- strict response parsing
- URL encoding of sourceGroupId in query params
- request parameter omission (blank maxScrolls / maxDurationMs)
- maxScrolls zero handling
- query keys structure
- status and source-group filters
- offset pagination
- polling (active only when QUEUED/RUNNING present)
- queued-only cancellation visibility
- query invalidation after mutations
- source-group enrichment failure behavior (rows preserved, ID fallback, pagination warning)

Do not commit or push changes.
