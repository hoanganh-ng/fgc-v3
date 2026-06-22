# Sprint 069: Source Publisher Review And Promotion UI

## Goal

Expose the existing Content Manager `SourcePublisher` HTTP contracts through a
narrow Web UI/client surface so operators can review discovered publishing
source identities, update review status, and promote approved Facebook group
publishers into managed `PAUSED` source groups.

`SourcePublisher` remains the Content Manager-owned publishing-source identity
discovered from home-feed collection. It is not the future Content Publisher
pipeline stage.

## Required Context

- `docs/SPRINTS/active.md`
- `docs/SPRINTS/SPRINT-063C-source-publisher-http-contract-and-e2e.md`
- `docs/SPRINTS/SPRINT-066-source-publisher-status-mutation-http-contract.md`
- `docs/SPRINTS/SPRINT-067-approved-source-publisher-group-promotion.md`
- `docs/SPRINTS/SPRINT-068C-profile-home-feed-schedule-operator-ui.md`
- `docs/modules/content-manager.md`
- `apps/web/src/lib/api/content-manager-client.ts`
- `apps/web/src/features/content-manager/content-manager-queries.ts`
- `apps/web/src/features/content-manager/content-manager-mutations.ts`
- `apps/web/src/pages/source-groups-page.tsx`
- `apps/web/src/app/navigation.ts`
- `apps/web/src/app/router.tsx`
- nearby Web UI tests and test helpers under
  `apps/web/src/features/content-manager/**` and `apps/web/src/pages/**`

## Capability Summary

- Web UI client support in `apps/web/src/lib/api/content-manager-client.ts`:
  - strict Zod schemas and exported types for `SourcePublisher`,
    list/detail response envelopes, status update request/response, promotion
    request, and promotion response
  - client methods for:
    - `listSourcePublishers`
    - `getSourcePublisher`
    - `updateSourcePublisherStatus`
    - `promoteSourcePublisherToSourceGroup`
  - `toListSourcePublishersQueryParams` for safe query assembly
- React Query support in
  `apps/web/src/features/content-manager/content-manager-queries.ts`:
  - source-publisher list/detail query keys
  - `useSourcePublishersQuery`
  - `useSourcePublisherQuery`
- Mutation helpers in
  `apps/web/src/features/content-manager/content-manager-mutations.ts`:
  - `updateSourcePublisherStatus`
  - `promoteSourcePublisherToSourceGroup`
  - `invalidateContentManagerQueries`
  - React Query hooks for status update and promotion
- View-model helpers in
  `apps/web/src/features/content-manager/source-publisher-review-view-model.ts`:
  - filter schema and options
  - promotion form schema
  - display-name fallback to `externalPublisherId`
  - promotion gating for Facebook group + approved status + category presence
  - promotion default values from publisher display name / canonical URL
  - promotion request mapping that omits empty optional fields and never sends
    `null`
- New page `apps/web/src/pages/source-publishers-page.tsx`:
  - route `/source-publishers`
  - navigation entry `Source Publishers`
  - default `DISCOVERED` list filter
  - status, kind, and platform filters
  - safe identity, timestamp, count, and canonical URL rendering
  - `Approve`, `Ignore`, `Block`, and `Reset to discovered` actions
  - promotion form only for `platform === "FACEBOOK"`,
    `kind === "GROUP"`, and `status === "APPROVED"`
  - content-category loading for promotion
  - no-category promotion disabled state with operator explanation
  - `CREATED` / `ALREADY_EXISTS` promotion outcome display

## Safe DTO Contract

The Web UI client accepts only the safe `SourcePublisher` DTO fields already
defined by the backend:

- `id`
- `platform`
- `kind`
- `externalPublisherId`
- optional `displayName`
- optional `canonicalUrl`
- `status`
- `firstObservedAt`
- `lastObservedAt`
- `observationCount`
- `createdAt`
- `updatedAt`

Optional DTO fields must be omitted when absent. `null` optional DTO fields,
unknown fields, raw payloads, cookies, localStorage, authorization material,
proxy details, viewer IDs, account IDs, screenshots, diagnostics, and stack
traces are rejected or never rendered.

## Out Of Scope

- Backend domain, application, persistence, HTTP routes, or migrations.
- Collector Runtime, browser execution, scheduler, worker, or Docker changes.
- New source-publisher status rules.
- Bulk review or bulk promotion.
- PAGE promotion.
- Source group activation, joining, scheduling, or live Facebook validation.
- Content Builder or future Content Publisher behavior.

## Test Matrix

| Requirement | Test file |
| --- | --- |
| Strict SourcePublisher DTO schema accepts only safe fields and rejects `null` optionals / unknown fields | `apps/web/src/lib/api/content-manager-client.test.ts` |
| Source-publisher list query params omit undefined filters | `apps/web/src/lib/api/content-manager-client.test.ts` |
| Promotion request schema validates priority and rejects `null` optionals | `apps/web/src/lib/api/content-manager-client.test.ts` |
| Display-name fallback, filters, promotion gates, defaults, and optional-field omission | `apps/web/src/features/content-manager/source-publisher-review-view-model.test.ts` |
| Status and promotion mutation helpers call the production client and invalidate Content Manager queries | `apps/web/src/features/content-manager/source-publisher-review-mutations.test.ts` |
| Navigation entry, page rendering, filters, status actions, promotion gating, and no-category message | `apps/web/src/pages/source-publishers-page.test.tsx` |

## Verification

```bash
pnpm web:typecheck
pnpm web:build
pnpm typecheck
pnpm test apps/web/src/features/content-manager
pnpm test apps/web/src/pages
pnpm test
git diff --check
git status --short
```

## Sprint Status

Sprint 068C is accepted. Sprint 069 is the active Web UI/client-only sprint
for Source Publisher review and approved Facebook group promotion. It does not
advance beyond the declared UI/client scope.
