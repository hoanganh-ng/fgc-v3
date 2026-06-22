# Sprint 071: Profile Home-Feed Collection Runs Operator UI

## Goal

Expose the existing safe `ProfileHomeFeedCollectionRun` HTTP contracts through
a narrow Web UI/client surface so operators can manually queue, monitor,
filter, and cancel profile-bound Facebook home-feed collection runs.

This is a Web UI/client-only sprint. The backend request, list, detail, and
cancel routes already exist and are consumed unchanged.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/modules/collector-runtime.md`
- `docs/SPRINTS/SPRINT-065C3-bounded-facebook-home-feed-execution.md`
- `docs/SPRINTS/SPRINT-068A-profile-home-feed-schedule-foundation.md`
- `docs/SPRINTS/SPRINT-068C-profile-home-feed-schedule-operator-ui.md`
- `src/interfaces/http/routes/collector-runtime.routes.ts`
- `src/interfaces/http/schemas/collector-runtime.http-schemas.ts`
- `apps/web/src/lib/api/collector-runtime-client.ts`
- `apps/web/src/features/collector-runtime/collection-run-queries.ts`
- `apps/web/src/features/collector-runtime/collection-run-mutations.ts`
- `apps/web/src/pages/collection-runs-page.tsx`
- `apps/web/src/pages/profile-home-feed-collection-schedules-page.tsx`
- `apps/web/src/features/profiles/profile-queries.ts`
- `apps/web/src/lib/api/profile-manager-client.ts`
- `apps/web/src/app/navigation.ts`
- `apps/web/src/app/router.tsx`
- nearby Web UI tests under `apps/web/src/features/collector-runtime/**` and
  `apps/web/src/pages/**`

## Scope

- Add `/profile-home-feed-collection-runs` and the `Home Feed Runs` navigation
  item beside Home Feed Schedules.
- Extend the Collector Runtime web client with strict
  `ProfileHomeFeedCollectionRun` schemas, request/list/detail/cancel methods,
  and safe query-param construction.
- Add React Query list/detail mutation hooks under
  `apps/web/src/features/collector-runtime`.
- Add a Web UI page for listing, filtering, refreshing, polling active runs,
  paginating, requesting, and canceling profile home-feed collection runs.
- Load safe profile summaries for display and request selection. The request
  form prefers profiles with `READY`, `COLLECTION_READY`, and `HEALTHY`.
- Omit empty optional request numerics. The Web UI validates integers locally
  but does not silently clamp execution ceilings.

## Out Of Scope

- Backend routes, schemas, domain, application, repositories, migrations, and
  composition changes.
- Browser automation, scheduler, worker, Docker, Content Manager, Content
  Builder, and Content Publisher changes.
- Live Facebook validation.
- Commits, pushes, or advancing beyond Sprint 071.

## Security

The page renders only safe DTO fields from the existing contracts. It must not
expose cookies, localStorage, authorization headers, proxy credentials, trusted
runtime configuration, browser artifacts, screenshots, viewer/account internals,
raw payloads, raw HTML, or stack traces.

## Verification

```bash
pnpm web:typecheck
pnpm web:build
pnpm typecheck
pnpm test apps/web/src/features/collector-runtime
pnpm test apps/web/src/pages
pnpm test
git diff --check
git status --short
```

## Status

Sprint 070 is accepted. Sprint 071 is **active**.
