# Collector Runtime

## Purpose and current capability

Collector Runtime executes Facebook collection workflows: profile-bound home-feed runs, source-group collection, ambient account exercise, and profile-source access checks. It owns durable run and schedule records, browser capture, platform extractors, HTTP submission to Content Manager, and safe home-feed diagnostics.

The accepted Profile Feed Collector baseline is locked in [COLLECTOR_BASELINE.md](../COLLECTOR_BASELINE.md). Runtime behavior beyond maintenance requires an explicit product decision.

## Owns

- Collection, exercise, access-check, and home-feed run records and state machines
- Collection schedules and profile home-feed schedules with atomic dispatch use cases
- Browser automation orchestration and payload capture (infrastructure layer)
- Platform extractors, including Facebook group and home-feed GraphQL extractors
- HTTP clients to Profile Manager (checkout, release, config) and Content Manager (ingest, observe)
- Profile home-feed diagnostic summaries on terminal runs
- Workers and bounded runners invoked by operator tools

## Does not own

- Profile checkout eligibility or account stage rules
- Content deduplication, lifecycle, or storage
- Source group or entry route metadata ownership
- Direct database access to Profile Manager or Content Manager tables
- Automatic account-stage promotion after runs

## Public ports, contracts, and cross-module communication

- **HTTP**: six resource families under `/collector/*` via `src/interfaces/http/routes/collector-runtime.routes.ts`
- **Profile Manager ports**: checkout/release/runtime-config HTTP clients in `src/collector-runtime/infrastructure/`
- **Content Manager ports**: ingestion and publisher observation HTTP clients
- **Web client**: `apps/web/src/lib/api/collector-runtime-client.ts`
- **Operator entrypoints**: workers and schedulers under `src/operator-tools/`

## Important source paths and entrypoints

- Domain/application: `src/collector-runtime/domain/`, `src/collector-runtime/application/`
- Extractors: `src/collector-runtime/platform-extractors/facebook/`
- Browser infrastructure: `src/collector-runtime/infrastructure/`
- Composition: `src/composition/collector-runtime/`
- Workers: `src/collector-runtime/workers/`, `src/operator-tools/profile-home-feed-worker/`
- HTTP schemas: `src/interfaces/http/schemas/collector-runtime.http-schemas.ts`

## Critical invariants and sensitive-data rules

- Profile leases must release on success, failure, and interruption paths
- Extractor output must conform to Content Manager ingestion schemas
- Browser providers consume trusted runtime config after checkout; they do not mutate profile identity
- Diagnostic contracts expose aggregate counts and closed enums only — no raw URLs, payloads, or secrets
- Extractor fixtures must be synthetic or sanitized

## Verification anchors

```bash
pnpm test src/collector-runtime
pnpm test:db src/collector-runtime
pnpm test:http:db src/collector-runtime
```

Boundary tests: `src/collector-runtime/collector-runtime.boundary.test.ts`, global checks in `src/test-support/architecture-boundary.test.ts`

## Known change hotspots and limitations

- `src/interfaces/http/schemas/collector-runtime.http-schemas.ts` (~1,765 lines) — six resource families in one schema module
- `src/interfaces/http/routes/collector-runtime.routes.ts` (~1,168 lines) — combined route registration
- `apps/web/src/lib/api/collector-runtime-client.ts` (~1,289 lines) — combined Web client
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.ts` (~2,052 lines)
- `src/collector-runtime/infrastructure/facebook-browser-payload-capture.ts` (~1,444 lines)
- `src/collector-runtime/application/use-cases/execute-profile-home-feed-collection-run.use-case.ts` (~977 lines)
- Facebook extractor/capture splits are deferred until fixture and live-baseline protections are sufficient ([CODEBASE_CHANGE_MAP.md](../CODEBASE_CHANGE_MAP.md))
