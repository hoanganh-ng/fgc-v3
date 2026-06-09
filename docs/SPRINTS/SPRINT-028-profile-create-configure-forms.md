# Sprint 028: Profile Create + Configure Forms

## Goal

Make the Web UI operator-usable for Collector Profile Manager profile creation and configuration through structured forms backed by the existing Profile Manager APIs.

The frontend remains an adapter/client. The backend remains the source of truth for validation, profile state transitions, provisioning rules, and security rules.

## Scope

- Inspect existing Profile Manager HTTP routes and request DTOs/schemas for:
  - Creating a profile.
  - Updating profile configuration.
- Update the Web UI Profile Manager API client with:
  - `createProfile(...)`.
  - `updateProfileConfiguration(profileId, ...)`.
  - Typed request and response DTOs based on the real backend contracts.
  - Safe error handling through the existing HTTP client pattern.
- Add routes:
  - `/profiles/new`.
  - `/profiles/:profileId/configure`.
- Add a create profile action from `/profiles`.
- Implement a structured Create Profile page using React Hook Form and Zod validation.
- Implement a structured Configure Profile page using React Hook Form and Zod validation.
- Use TanStack Query mutations and invalidate relevant profile list/detail queries after successful create/configure actions.
- Redirect or clearly link operators to the created or configured profile detail page after success.
- Display backend validation errors clearly.
- Cover the actual required backend configuration fields in organized form sections where applicable:
  - Identity.
  - Network Context.
  - Hardware Fingerprint.
  - Behavioral Persona.
  - Temporal Routine.
  - Safety Thresholds.
  - Content Affinities.
- Provide safe defaults where useful so operators do not need to understand raw schema details.

## Architecture Rules

- The Web UI remains an adapter/client that consumes backend APIs.
- Backend APIs remain the source of truth.
- Do not duplicate backend profile state machine, provisioning, checkout, or security rules in frontend code.
- Keep API calls in dedicated client modules.
- Keep pages and components mostly presentational.
- Frontend validation is for UX only.

## Security Rules

- Do not manually edit authentication state in the UI.
- Do not display or edit cookies.
- Do not display or edit localStorage.
- Do not display or edit raw session material.
- Do not display token hashes.
- Do not display provisioning token material or hashes.
- Do not display trusted runtime secrets.
- Do not display stored proxy passwords in read views.

## Out Of Scope

- Start provisioning action.
- Provisioning token display.
- Session ingestion.
- Browser login capture.
- Runtime checkout.
- Trusted runtime configuration view.
- Source group management.
- Content item review.
- Scheduler or queue.
- Collection runs.
- Authentication or permissions.

## Acceptance Criteria

- `/profiles/new` presents a structured create form, not raw JSON editing.
- Creating a profile submits to the real backend endpoint.
- The created profile appears in `/profiles`.
- `/profiles/:profileId/configure` loads current safe profile detail and presents structured configuration fields.
- Updating configuration submits to the real backend endpoint.
- Profile list/detail queries refresh after successful create/configure actions.
- Backend validation errors are displayed clearly.
- No sensitive session, token, provisioning, proxy password, or trusted runtime data is displayed.
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
