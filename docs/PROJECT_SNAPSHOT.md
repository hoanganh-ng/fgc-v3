# Project Snapshot

## Current Product Stage
The product is currently in the **Content Collector** stage (Stage 1 of 3, preceding Builder and Publisher). The core focus is collecting normalized content from configured Facebook sources while maintaining strict isolation between profile management, collection orchestration, and content storage.

## Current Active Sprint
Sprint 054B: Runtime Authentication Health Reporting and Checkout Enforcement (Active).
Sprint 054A: Profile Authentication Health Foundation (Accepted).

## Currently Available Capabilities
- **Profile Management**: Creation, lifecycle, session ingestion, checkout leasing.
- **Content Management**: Storage of normalized Facebook knowledge group text posts and top comments.
- **Collection Execution**: Headless browser extraction using Playwright (or experimental CloakBrowser). Worker processes automatically consume queued collection runs, ambient exercise runs, and access-check runs.
- **Operator Tools**: CLI tools for profile provisioning, manual collection, worker execution, and browser probing.
- **Web UI**: Dashboard for managing profiles, source groups, categories, content items, and reviewing run status.

## Current Modules
- **Collector Profile Manager**: Identity, sessions, provisioning, readiness, leases.
- **Content Manager**: Categories, source groups, normalized content, deduplication.
- **Collector Runtime**: Collection orchestration, browser providers, extraction, submission.
- **Web UI**: Operator presentation and safe API consumption.

## Important Architectural Invariants
- Hexagonal architecture: Domain logic has zero dependencies on HTTP, databases, browsers, or queues.
- Security: Raw session data (cookies, tokens, proxy credentials) and raw Facebook private payloads are never exposed to the UI, logs, or persistent records.
- Separation of Concerns: Profile readiness/leasing is owned entirely by Profile Manager. Browsers consume leases but do not determine profile eligibility.

## Important Unresolved Risks
- Scale of active profile checkout frequency vs PostgreSQL concurrency.
- Long-term viability of browser provider evasion capabilities (e.g. Playwright vs CloakBrowser) against Facebook fingerprinting.
- Future Content Builder handoff payload structure.

## Verification Commands
```bash
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:http:db
pnpm web:typecheck
pnpm web:build
```

## Immediate Next Expected Work
Future sprint work after Sprint 054B will depend on the runtime
authentication health reporting and checkout enforcement surface area
established here.
