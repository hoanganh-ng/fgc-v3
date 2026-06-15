# Sprint 048: Category Browse Exercise Foundation

## Goal

Category Browse Exercise is a low-risk, read-only account exercise. The caller specifies a profile and an active Facebook source group. Collector Runtime selects and freezes one managed CATEGORY_ENTRY_URL route before queueing the run. The worker later opens exactly that frozen URL and performs only dwell and light scrolling. It does not click links, navigate to the group, collect content, or mutate source-access state.

## Scope

- Add CATEGORY_BROWSE to AccountExerciseType.
- Add a strict CategoryBrowseExerciseTarget containing categoryId, sourceGroupId, entryRouteId, entryRouteType, url, and riskLevel.
- Add optional target to AccountExerciseRun with cross-field invariants:
  - AMBIENT_ACCOUNT has no target.
  - CATEGORY_BROWSE requires the Category Browse target.
  - HTTPS Facebook URLs only.
  - HIGH risk is invalid.
- Update PostgreSQL/Drizzle:
  - Add CATEGORY_BROWSE to the account exercise enum.
  - Add nullable JSONB target to schema and mappers.
  - Add a migration.
  - Update mapper, repository, schema, and DB tests.
- Extend account-exercise request handling with a discriminated input:
  - Existing omitted exerciseType defaults to AMBIENT_ACCOUNT.
  - CATEGORY_BROWSE requires sourceGroupId.
  - entryRouteId is optional.
- Resolve the source group through a Collector Runtime application-owned port implemented by the Content Manager HTTP client.
- Validate Category Browse requests:
  - Source group exists, platform FACEBOOK, status ACTIVE.
  - Eligible CATEGORY_ENTRY_URL exists.
  - Explicit entryRouteId belongs to the group.
  - Selected route is LOW or MEDIUM.
  - Selected category URL is not the direct group URL.
- Select route deterministically if entryRouteId is omitted:
  - CATEGORY_ENTRY_URL only.
  - LOW before MEDIUM.
  - isDefault true before false within equal risk.
  - Route ID ascending as final tie-breaker.
- Freeze the selected target in the run before saving.
- Reuse existing checkout, config, launch, close, lease release, and terminal-record lifecycle.
- Add Web UI read compatibility:
  - Accept CATEGORY_BROWSE and target schema.
  - Rename generic page/list wording to Account Exercise Runs.
  - Display exercise type.
  - Display safe Category Browse target metadata in details.
  - Preserve the existing Ambient request form.

## Out Of Scope

- Clicking links.
- Searching Facebook.
- Opening the source group's direct URL.
- Joining or requesting to join.
- Capturing GraphQL/network payloads.
- Invoking extractors.
- Submitting content.
- Mutating profile-source access or changing accountStage.
- Persisting HTML, screenshots, page text, cookies, localStorage, proxy credentials, or runtime config.
- Web UI request form or selectors for Category Browse.

## Safety Boundaries

- The worker must not perform any interactive/write actions on Facebook.
- Fingerprints, session details, and runtime credentials must not leak to logs, DB records, or frontend views.

## Verification

Run:
- `pnpm typecheck`
- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm test`
- `git diff --check`
- `DATABASE_URL=<isolated-test-db> pnpm db:migrate`
- `DATABASE_URL=<isolated-test-db> pnpm test:db`
- `DATABASE_URL=<isolated-test-db> pnpm test:http:db`
