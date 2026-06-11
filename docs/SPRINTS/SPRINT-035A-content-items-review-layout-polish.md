# Sprint 035A: Content Items Review Layout Polish

## Goal

Reorganize the Web UI Content Items review screens so operators can scan, read, and make lifecycle decisions on collected Facebook posts without changing backend behavior.

## Scope

- Replace the `/content-items` wide table layout with a review-focused card or list queue.
- Make each content item body preview the primary visual element in the list.
- Show each item's status, reaction count, comment count, collected time when available, compact source group and category metadata, and detail/open action.
- Keep quick lifecycle actions on cards and show only valid transitions:
  - `COLLECTED`: Select, Reject
  - `SELECTED`: Reject, Mark Used
  - `REJECTED`: Select again
  - `USED`: no actions
- Reduce UUID prominence by rendering source group and category IDs as muted, aggressively truncated metadata.
- Preserve loading, error, empty, and not-found states.
- Keep the detail page body and top comments readable while moving technical metadata into a lower metadata section or side panel.

## Out of Scope

- Backend changes.
- Collection run records.
- Worker or scheduler changes.
- Run Now button.
- Source group or category display-name joins unless already available.
- Bulk actions.
- Advanced filtering or search.
- Content editing.
- Raw payload viewer.

## Security And Safety

Do not display raw Facebook payloads, cookies, local storage, proxy credentials, runtime configuration, provisioning tokens, trusted secrets, token hashes, raw session material, or sensitive account/session details.

Render body text and comments as safe text. External links must use `target="_blank"` and `rel="noreferrer"`.

## Verification

- `pnpm typecheck:web`
- `pnpm build:web`
- `pnpm typecheck`
- `pnpm test`
