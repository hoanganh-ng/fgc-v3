# Sprint 025: Web UI Foundation

## Goal

Create the first Web UI foundation for the Content Video Pipeline as an internal dashboard shell that can evolve into a production admin panel later.

This sprint starts the Web UI stage only. It does not implement profile workflows, provisioning, browser login capture, Facebook content capture, scheduler controls, authentication, authorization, deployment, or business-rule ownership in the frontend.

## Frontend Stack

- React.
- Vite.
- TypeScript.
- React Router.
- TanStack Query.
- React Hook Form and Zod may be added now if they are lightweight foundation dependencies, but full forms remain deferred.
- Tailwind CSS.
- Local shadcn/ui-style primitives where practical.

## Scope

- Add a frontend application under `apps/web` unless an existing repository convention points elsewhere.
- Configure Vite, React, TypeScript, Tailwind CSS, React Router, and TanStack Query.
- Add a clean internal dashboard layout shell with sidebar and topbar.
- Add navigation entries for:
  - Profiles.
  - Source Groups.
  - Content Items.
  - Collection Runs placeholder.
- Add pages for:
  - Dashboard.
  - Profiles placeholder.
  - Profile detail placeholder route if practical.
  - Source Groups placeholder.
  - Content Items placeholder.
- Add web environment configuration with `VITE_API_BASE_URL=http://localhost:3000` and an example environment file when appropriate.
- Add an API client foundation with:
  - Base HTTP client.
  - Profile Manager client placeholder or minimal safe read methods when route names are already clear.
  - Typed request/response pattern.
  - Safe error handling pattern.
- Add reusable UI primitives where useful:
  - Button.
  - Input.
  - Select.
  - Card.
  - StatusBadge.
- Add package scripts so the web app can be started, typechecked, and built through pnpm.

## Architecture Rules

- The frontend is an adapter/client.
- Backend APIs remain the source of truth.
- Do not duplicate profile state machine rules in frontend code.
- Do not put business logic in UI components.
- Keep API calls in dedicated client modules.
- Do not expose cookies, local storage, proxy passwords, raw session state, token hashes, or trusted runtime configuration secrets.

## Out Of Scope

- Profile create form.
- Profile configuration form.
- Start provisioning action.
- Browser login capture.
- Cookies or local storage capture.
- Facebook content capture.
- GraphQL capture.
- Scheduler or queue.
- Authentication or authorization.
- Production deployment.

## Acceptance Criteria

- `apps/web` contains a Vite React TypeScript app.
- Tailwind CSS is configured for the web app.
- React Router powers the dashboard routes.
- TanStack Query provider is installed at the web app root.
- Dashboard, Profiles, Source Groups, and Content Items pages load.
- A profile detail placeholder route exists if practical.
- Dashboard navigation routes work.
- API client foundation is isolated from UI components and avoids sensitive fields.
- Web app can be started, typechecked, and built through pnpm.
- Existing backend typecheck and tests continue to pass.

## Verification

```bash
pnpm install
pnpm --filter @fgc/web typecheck
pnpm --filter @fgc/web build
pnpm test
git status --short
```
