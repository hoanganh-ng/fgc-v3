# Sprint 033: Content Category + Source Group Manager UI

## Goal

Add Web UI management for Content Manager content categories and Facebook source groups so operators can create categories, create source groups, view `sourceGroupId`, and manage source group status for manual Collector Runtime runs.

## Scope

- Inspect and use the existing Content Manager HTTP contracts for:
  - `POST /collector/content-categories`
  - `GET /collector/content-categories`
  - `POST /collector/source-groups`
  - `GET /collector/source-groups`
  - `PATCH /collector/source-groups/:sourceGroupId/status`
- Add a typed Web UI Content Manager API client.
- Replace the Source Groups placeholder page with a real manager.
- Add content category management either as a dedicated page or inside the Source Groups page.
- Use React Hook Form, Zod, and TanStack Query for server-backed forms and server state.
- Display backend validation errors clearly while preserving issue paths where possible.
- Add a copy button for `sourceGroupId`.
- Add source group status management for `ACTIVE`, `PAUSED`, and `ARCHIVED`.

## Security Rules

The Web UI must not display:

- Cookies.
- localStorage.
- Profile session data.
- Proxy credentials.
- Token material.
- Trusted runtime configuration.
- Raw Facebook payloads.

## Out Of Scope

- Collector run records.
- Worker process.
- Scheduler.
- Web UI Run Now button.
- Facebook browser capture changes.
- Content item review UI.
- Content status workflow UI.
- Full source group edit/delete.
- Full category edit/delete.
- Authentication or permissions.

## Acceptance Criteria

- Operators can create a content category.
- Operators can see content categories with loading, error, and empty states.
- Operators can create a Facebook source group using backend-supported fields only.
- Operators can see source groups with safe fields including `sourceGroupId`, name, platform, URL, category, status, `createdAt`, and `updatedAt` when those fields are present in backend DTOs.
- Operators can copy `sourceGroupId`.
- Operators can update source group status through the real PATCH endpoint.
- Source group queries refresh after status mutations.
- Backend validation errors are shown clearly.
- API calls live in dedicated frontend client modules.
- Backend remains the source of truth.

## Verification

```bash
pnpm --filter @fgc/web typecheck
pnpm --filter @fgc/web build
pnpm run typecheck
pnpm test
docker compose -f docker-compose.preview.yml config
```

Manual preview verification:

- Create a content category.
- Confirm it appears in the category list.
- Create a Facebook source group using that category.
- Confirm it appears in the source group list.
- Copy `sourceGroupId`.
- Change source group status.
- Confirm `GET /collector/source-groups` reflects the updated status.
- Confirm validation errors display clearly.
