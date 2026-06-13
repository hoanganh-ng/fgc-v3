# Sprint 044: Source Group Profile Access Readiness View

## Goal

Add an expandable profile-access readiness panel to each source group on the existing Source Groups page. The panel should show persisted profile-source access outcomes for the selected source group and optionally enrich them with safe profile summary data.

## Scope

- Frontend-only changes.
- Modify `apps/web/src/lib/api/profile-manager-client.ts` to add `listProfileSourceAccessForSourceGroup(sourceGroupId)`.
- Modify `apps/web/src/features/profiles/profile-queries.ts` to add `profileQueryKeys.sourceGroupAccess(sourceGroupId)` and `useSourceGroupProfileAccessQuery(sourceGroupId)`.
- Create `apps/web/src/features/content-manager/source-group-profile-access-panel.tsx`.
- Modify `apps/web/src/pages/source-groups-page.tsx` to add a "View Profile Access" button per source group, hide "Profile Access" for the expanded row, and mount the new panel only for the expanded source group.
- Display only persisted access records returned by the source-group profile-access endpoint.
- Do not synthesize UNKNOWN records for profiles without an access record.
- Empty means: no access outcomes have been recorded for this source group.
- Do not claim successful access means current collection or checkout eligibility.
- Use the labels:
  - Recorded outcomes
  - Successful access
  - Needs attention
- Add explanatory text: "Successful access is one collection requirement and does not guarantee current checkout eligibility."
- Successful access states: `PUBLIC_ACCESSIBLE`, `JOINED_ACCESSIBLE`.
- All other recorded states count as Needs attention for summary display only. Do not persist this grouping.

## Out Of Scope

- backend changes
- database migrations
- new access states
- synthetic UNKNOWN records
- editing access records in this panel
- launching a CLI process from the browser
- automated access detection
- browser automation
- joining groups
- category browse exercise
- scheduler behavior
- worker changes
- checkout changes
- account-stage changes
- authentication/authorization
- commits or pushes

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

## Verification

Run:
- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm typecheck`
- `pnpm test`
- `git diff --check`

Add targeted tests where supported for:
- encoded sourceGroupId
- strict response parsing
- successful/needs-attention counts
- unresolved profile fallback
- empty response semantics
- profile query failure preserving access rows
- lazy mounting for only the expanded source group

Manual checks:
1. No access request before expanding a group.
2. Expanding loads only that group’s access records.
3. Counts are accurate.
4. Resolved and unresolved profiles display correctly.
5. Source-group access errors remain local.
6. Profile-query errors do not hide access records.
7. Expanding another group closes the first.
8. Existing source-group status and entry-route controls remain functional.

Do not commit or push changes.