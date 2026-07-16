# Web UI

## Purpose and current capability

The Web UI is the operator presentation layer for the Content Collector. It provides pages for profiles, collection runs and schedules, home-feed runs and schedules, content review, source groups, discovered publishers, and Transform Types. It calls backend HTTP APIs through typed clients and TanStack Query.

Primary Collector MVP surfaces follow the accepted operator flow in [COLLECTOR_BASELINE.md](../COLLECTOR_BASELINE.md). The Web UI does not execute browsers.

## Owns

- Routing, layout shell, and page components under `apps/web/src/`
- Client-side validation and form UX
- TanStack Query caching and mutation orchestration
- Typed API clients mirroring backend safe DTOs
- Feature view-models mapping HTTP data to presentation state

## Does not own

- Domain rules, eligibility, or business invariants
- Persistence or direct database access
- Browser execution or provider configuration
- Secret storage or trusted runtime configuration

## Public ports, contracts, and cross-module communication

- **Outbound only**: HTTP to Nginx gateway → Fastify backend
- **Clients**: `apps/web/src/lib/api/profile-manager-client.ts`, `collector-runtime-client.ts`, `content-manager-client.ts`, `content-builder-client.ts`
- **No backend imports**: must not import `fgc-v3/src/` modules

## Important source paths and entrypoints

- App entry: `apps/web/src/main.tsx`
- Router: `apps/web/src/app/router.tsx`
- Features: `apps/web/src/features/`
- Pages: `apps/web/src/pages/`
- API clients: `apps/web/src/lib/api/`
- Build: `apps/web/vite.config.ts`

## Critical invariants and sensitive-data rules

- UI validation improves UX but never replaces backend validation
- Render backend status values explicitly; do not infer hidden permissions
- Never display proxy passwords, provisioning tokens, cookies, or raw payloads
- Use safe DTO fields only; optional fields are omitted, not serialized as null

## Verification anchors

```bash
pnpm web:typecheck
pnpm web:build
pnpm vitest run apps/web
```

Boundary test: `apps/web/src/web-architecture-boundary.test.ts`

## Known change hotspots and limitations

- `apps/web/src/lib/api/collector-runtime-client.ts` (~1,289 lines) — six resource families combined
- `apps/web/src/pages/source-groups-page.tsx` (~1,605 lines)
- `apps/web/src/pages/account-exercise-runs-page.tsx` (~1,454 lines)
- `apps/web/src/features/profiles/profile-configuration-form.tsx` (~1,442 lines)
- Large page/form splits are deferred unless blocking safe change ([CODEBASE_CHANGE_MAP.md](../CODEBASE_CHANGE_MAP.md))
