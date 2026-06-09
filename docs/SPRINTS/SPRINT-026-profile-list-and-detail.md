# Sprint 026: Profile List + Detail

## Goal

Replace the Profiles placeholder area in the Web UI with read-only Collector Profile Manager integration for safe profile listing and safe profile detail inspection.

The backend remains the source of truth. The frontend is an adapter/client and must not duplicate Profile Manager lifecycle, provisioning, checkout, or readiness rules.

## Scope

- Inspect the existing Fastify Profile Manager routes and use the actual safe read endpoints for:
  - Listing profiles.
  - Getting safe profile details.
- Add or update the Web UI Profile Manager API client with:
  - `listProfiles()`.
  - `getProfile(profileId)`.
  - Typed DTOs based on actual safe backend responses.
  - Safe error handling through the existing HTTP client pattern.
- Replace the Profiles placeholder page with a real profiles list page.
- Replace the example profile route with a real dynamic route at `/profiles/:profileId`.
- Implement the profile detail page using the real safe profile detail endpoint.
- Use TanStack Query for server-state loading and caching.
- Add loading, error, empty, and not-found states.
- Add a status badge/component that supports:
  - `PENDING_CONFIG`.
  - `PENDING_LOGIN`.
  - `READY`.
  - `BUSY`.
  - Unknown statuses rendered safely as text.

## Safe Display Fields

The profiles list should show safe fields where available:

- Profile id.
- Display name/name.
- Status.
- Timezone.
- Created timestamp.
- Updated timestamp.

The profile detail page should show safe sections only:

- Identity and metadata summary.
- Status.
- Safe configuration summary.
- Timestamps.
- Safe provisioning readiness/status fields exposed by the backend.

## Architecture Rules

- The frontend is an adapter/client.
- Backend APIs remain the source of truth.
- Do not duplicate backend profile state machine rules in frontend code.
- Keep API calls in dedicated client modules.
- Keep page components mostly presentational.
- Do not expose cookies, local storage, proxy passwords, raw session state, token hashes, provisioning token hashes, or trusted runtime configuration secrets.

## Out Of Scope

- Profile creation form.
- Profile configuration form.
- Start provisioning action.
- Session ingestion.
- Browser login capture.
- Runtime checkout.
- Trusted runtime configuration view.
- Content/source group UI implementation.
- Scheduler or queue.
- Authentication or permissions.

## Acceptance Criteria

- `/profiles` calls the real backend and renders profiles.
- `/profiles` includes loading, error, and empty states.
- `/profiles/:profileId` loads real safe profile detail.
- Profile not-found responses render a not-found state.
- No sensitive Profile Manager fields are displayed anywhere in the UI.
- Web UI typecheck and build pass.
- Repository typecheck and tests pass.

## Verification

```bash
pnpm --filter @fgc/web typecheck
pnpm --filter @fgc/web build
pnpm run typecheck
pnpm test
```
