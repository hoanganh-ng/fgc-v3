# Sprint 029: Start Provisioning UI

## Goal

Add a safe Start Provisioning action to the Web UI profile detail page so an operator can move a configured Collector Profile Manager profile toward `PENDING_LOGIN` through the existing backend endpoint.

The frontend remains an adapter/client. The backend remains the source of truth for validation, lifecycle transitions, provisioning token issuance, and security rules.

## Scope

- Inspect existing Collector Profile Manager HTTP route files and request/response DTOs for the start provisioning endpoint.
- Update the Web UI Profile Manager API client with:
  - `startProfileProvisioning(profileId)`.
  - Typed response DTOs based on the real backend contract.
  - Safe error handling through the existing HTTP client pattern.
- Add a Start Provisioning action on the profile detail page.
- Use a TanStack Query mutation for the action.
- Add loading, success, and error states.
- Add operator confirmation before starting provisioning.
- On success, invalidate/refetch:
  - Profile detail query.
  - Profile list query.
- If the backend returns a raw one-time provisioning token:
  - Show it only in the immediate success UI.
  - Provide a copy button if practical.
  - Warn the operator to save it now because it may not be visible again.
- If the backend does not return a raw token, show only safe success state and next-step instructions.
- Show clear status text for:
  - `PENDING_CONFIG`.
  - `PENDING_LOGIN`.
  - `READY`.
  - `BUSY`.

## Architecture Rules

- The Web UI remains an adapter/client that consumes backend APIs.
- Backend APIs remain the source of truth.
- Do not duplicate backend profile state machine, provisioning, checkout, or security rules in frontend code.
- Frontend status checks may guide action visibility only; backend rejection must be displayed clearly.
- Keep API calls in dedicated client modules.
- Keep pages and components mostly presentational.

## Security Rules

- Do not display cookies.
- Do not display localStorage.
- Do not display raw session material.
- Do not display proxy credentials or stored proxy passwords.
- Do not display token hashes.
- Do not display provisioning token hashes.
- Do not display trusted runtime secrets.
- Do not store raw provisioning tokens in:
  - localStorage.
  - sessionStorage.
  - URL params.
  - Profile detail state loaded from safe read APIs.
  - Logs.

## Out Of Scope

- Browser login capture.
- Playwright provisioning CLI.
- Cookie/localStorage capture.
- Session ingestion UI.
- Runtime checkout.
- Trusted runtime configuration view.
- Facebook content capture.
- GraphQL capture.
- Source group collection.
- Scheduler or queue.
- Collection runs.
- Authentication or permissions.

## Acceptance Criteria

- Profile detail page offers a safe Start Provisioning action for appropriate operator workflow.
- Starting provisioning submits to the real backend endpoint.
- Operator confirmation is required before submission.
- Loading, success, and backend error states are visible.
- Profile list/detail queries refresh after successful start provisioning.
- If a raw provisioning token is returned, it appears only in the immediate success UI and is not persisted.
- If no raw token is returned, no token-like or hash-like material is shown.
- Clear status text is visible for `PENDING_CONFIG`, `PENDING_LOGIN`, `READY`, and `BUSY`.
- No sensitive session, token hash, runtime, cookie, localStorage, or proxy credential material is displayed.
- Web UI typecheck and build pass.
- Repository typecheck and tests pass.
- Docker preview Compose config remains valid.

## Verification

```bash
pnpm --filter @fgc/web typecheck
pnpm --filter @fgc/web build
pnpm run typecheck
pnpm test
docker compose -f docker-compose.preview.yml config
```

Manual preview verification:

- In preview stack, create and configure a profile.
- Start provisioning from profile detail.
- Confirm backend endpoint is called.
- Confirm profile moves to `PENDING_LOGIN`.
- Confirm profile list/detail refresh.
- If token is returned, confirm it appears only in the immediate success UI and disappears after page refresh.
- Confirm no sensitive session/token/runtime material is displayed from safe profile reads.
