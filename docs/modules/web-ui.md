# Web UI

Primary Profile Feed Collector MVP surfaces (`/profiles`,
`/profile-home-feed-collection-runs`, `/content-items`, `/source-groups`,
`/source-publishers`) follow the accepted operator flow in
[`COLLECTOR_BASELINE.md`](../COLLECTOR_BASELINE.md). The Web UI does not execute
browsers; it queues runs, shows safe diagnostics, and supports content and
discovered-source review within that locked boundary.

## Ownership
- Operator presentation for Content Collector.
- Dashboard routing, layout shell, UI components, and state management.
- Safe API calls to backend HTTP boundaries.
- Form components and client-side validation.
- Query caching and state synchronization via TanStack Query.

## Does Not Own
- Domain rules, eligibility, or business invariants.
- Persistence, direct DB access, or caching beyond the frontend lifecycle.
- Browser execution or browser provider configuration.
- Sensitive runtime configuration storage.

## Important Source Paths
- `apps/web/src/`
- `apps/web/src/features/`
- `apps/web/src/api/`

## Important Entrypoints
- `Main`: `apps/web/src/main.tsx`
- `Vite Config`: `apps/web/vite.config.ts`

## Critical Invariants
- UI validation improves UX but never replaces backend validation.
- Must honor backend status values explicitly; do not infer hidden permissions.

## Cross-Module Communication
- Uses standardized API clients hitting `/collector/*` and `/content/*` endpoints.

## Sensitive Data Rules
- Never render, expose, or log sensitive data such as proxy passwords, full provisioning tokens, or raw cookie payloads. Use backend-provided safe DTOs.

## Relevant Verification Commands
```bash
pnpm web:typecheck
pnpm web:build
```
