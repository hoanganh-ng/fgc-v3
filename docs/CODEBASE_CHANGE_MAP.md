# Codebase Change Map

Planning aid for future structural cleanup. **This document does not authorize implementation** of listed slices. Cleanup follows product work when it is not blocking safe change.

## Measurement method

| Field | Value |
| --- | --- |
| **Date** | 2026-07-16 |
| **Scope** | Production TypeScript under `src/` and `apps/web/src/` (excludes `*.test.ts`, fixtures) |
| **File count** | 633 TypeScript/TSX files (repository-wide, per Sprint 079 baseline) |
| **Ranking inputs** | Line count, mixed ownership (multiple resource families or layers in one file), cross-feature edit frequency, adapter coupling, test co-location density |
| **Tooling** | `find … \| xargs wc -l`, architecture boundary tests, GitNexus impact analysis before symbol moves |

Line count alone is not a defect. **Mixed ownership and repeated cross-feature editing** are the primary change-risk signals.

## Ranked hotspots

| Rank | File | Lines | Responsibility mix | Safe to split now? |
| --- | --- | ---: | --- | --- |
| 1 | `src/interfaces/http/schemas/collector-runtime.http-schemas.ts` | 1,765 | Six HTTP resource families + shared DTO primitives | **Yes** — clear family seams; compatibility barrel preserves imports (Sprint 079 deliverable 2) |
| 2 | `src/interfaces/http/routes/collector-runtime.routes.ts` | 1,168 | Six route registrars + DTO mappers | **Yes** — same family model as schemas |
| 3 | `apps/web/src/lib/api/collector-runtime-client.ts` | 1,289 | Six client families + shared transport | **Yes** — mirror server family split (Sprint 079 deliverable 3) |
| 4 | `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.ts` | 2,052 | Home-feed GraphQL parsing + warning taxonomy | **Defer** — needs fixture discipline and live-baseline regression anchors |
| 5 | `src/collector-runtime/platform-extractors/facebook/facebook-graphql-payload-extractor.ts` | 1,398 | Group-feed GraphQL parsing | **Defer** — same extractor protection gap |
| 6 | `src/collector-runtime/infrastructure/facebook-browser-payload-capture.ts` | 1,444 | Capture orchestration + diagnostics | **Defer** — tightly coupled to live browser behavior |
| 7 | `src/operator-tools/profile-exercise/exercise-runner.ts` | 1,499 | CLI orchestration + browser flow | **Defer** — operator path shares exercise baseline evidence |
| 8 | `src/interfaces/http/schemas/content-manager.http-schemas.ts` | 1,257 | Multiple Content Manager resource groups | **Later** — lower cross-feature pressure than Collector Runtime HTTP |
| 9 | `apps/web/src/pages/source-groups-page.tsx` | 1,605 | Form + table + nested panels | **Later** — UI split is presentation-only but needs visual regression discipline |
| 10 | `apps/web/src/pages/account-exercise-runs-page.tsx` | 1,454 | List + filters + detail drawer | **Later** — large but localized UI ownership |

## Why top entries differ

**Collector Runtime HTTP triad (ranks 1–3)** — High leverage because 43+ consumers import the three compatibility entrypoints. Splitting by resource family reduces merge conflicts without changing HTTP semantics when characterization tests guard behavior.

**Facebook extractors and capture (ranks 4–6)** — Large but risky. Field mapping depends on sanitized fixtures and accepted live-baseline behavior ([COLLECTOR_BASELINE.md](COLLECTOR_BASELINE.md)). Splitting without stronger fixture contracts could hide regressions.

**Operator exercise runner (rank 7)** — Mixed CLI and browser flow; changes touch provisioning and exercise evidence paths.

**Web pages (ranks 9–10)** — Line count reflects operator UX density, not cross-module coupling. Safer after API client boundaries stabilize.

## Recommended next three cleanup slices

Each slice requires its **own acceptance gate** (characterization tests green before and after, zero HTTP/export/script diffs unless explicitly intended).

### Slice 1 — Collector Runtime HTTP modularization (Sprint 079)

- Split server schemas, routes, and Web client by six resource families
- Retain compatibility barrels at existing import paths
- Add/extend characterization tests for route inventory, schema association, and public export inventory
- **Gate**: `pnpm test`, `pnpm test:http:db`, `pnpm web:typecheck`, pre/post export inventory identical

### Slice 2 — Content Manager HTTP schema/route grouping

- Group schemas and routes by resource (`content-items`, `source-groups`, `source-publishers`, categories)
- Keep compatibility entrypoints if external imports exist
- **Gate**: Content Manager HTTP DB tests + E2E source-publisher flow unchanged

### Slice 3 — Web page decomposition (presentation-only)

- Extract view-models and sub-panels from `source-groups-page.tsx` and `account-exercise-runs-page.tsx`
- No backend or DTO changes
- **Gate**: `pnpm web:build`, Web vitest, Docker E2E operator flows unchanged

## Explicit deferrals

Do **not** split until protections are sufficient:

- Facebook group/home-feed extractors (`platform-extractors/facebook/*`)
- Browser capture adapters (`facebook-browser-payload-capture.ts`, page-state observers)
- Profile exercise and provisioning runners (`operator-tools/profile-exercise/`, `profile-provisioning/`)
- Large HTTP integration test files (split tests only when behavior assertions remain stable)
- Database migrations, repository internals, or domain rule refactors disguised as file moves

## Operating rule

Structural cleanup is warranted when **mixed ownership blocks a product change** or **repeat merge conflicts** appear on the same monolith. Otherwise, prefer product delivery. This map ranks candidates; it does not override sprint scope or [ARCHITECTURE.md](ARCHITECTURE.md) boundaries.

## Architecture guard references

- Shared file walker: `src/test-support/collect-typescript-files.ts`
- Global boundary tests: `src/test-support/architecture-boundary.test.ts`
- Module boundary tests: `src/**/*.boundary.test.ts`, `apps/web/src/web-architecture-boundary.test.ts`

Violations discovered on baseline are documented in architecture docs, not silently whitelisted.
