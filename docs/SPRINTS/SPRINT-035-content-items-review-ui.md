# Sprint 035: Content Items Review UI

## Goal

Replace the Web UI Content Items placeholder with real review screens so an operator can inspect collected Facebook posts and move them through the Content Manager lifecycle.

## Scope

- Add a `/content-items` list page.
- Add a `/content-items/:contentItemId` detail page.
- Wire routes and navigation using the existing Web UI conventions.
- Add or extend typed Web UI API client functions for:
  - listing content items
  - reading one content item
  - updating content item status
- Add React Query hooks using existing cache and error conventions.
- Show loading, error, empty, and not-found states.
- Render external source URLs with `target="_blank"` and `rel="noreferrer"`.
- Render body text and comments as text only.

## Status Actions

The UI should show only valid lifecycle actions. The backend remains the source of truth.

- `COLLECTED`: Select, Reject
- `SELECTED`: Reject, Mark Used
- `REJECTED`: Select again
- `USED`: no actions

Rules:

- `USED` is terminal.
- `COLLECTED` must not go directly to `USED`.
- `REJECTED` must not go directly to `USED`.

## Out of Scope

- Collection run records.
- API-triggered runs.
- Collector worker process.
- Scheduler.
- Run Now button.
- Run history UI.
- Bulk actions.
- Advanced search or filtering.
- Content editing.
- Raw payload viewer.
- Video generation.
- Publishing workflow.
- Authentication or permissions.
- Audit log.

## Security And Safety

Do not display cookies, local storage, raw session material, token hashes, provisioning tokens, proxy passwords, trusted runtime secrets, or raw Facebook payloads.

## Verification

- `pnpm typecheck:web`
- `pnpm build:web`
- `pnpm typecheck`
- `pnpm test`
