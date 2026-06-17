# Project Snapshot

## Current Product Stage
The product is currently in the **Content Collector** stage (Stage 1 of 3, preceding Builder and Publisher). The core focus is collecting normalized content from configured Facebook sources while maintaining strict isolation between profile management, collection orchestration, and content storage.

## Current Active Sprint
Sprint 061: Operator Collection Schedule Management Surface (Active).
Sprint 060: Collection Scheduler Containerization and Stack Integration (Accepted).
Sprint 059: Scheduled Collection Dispatch Poller (Accepted).
Sprint 058: Atomic Scheduled Collection Dispatch (Accepted).
Sprint 057: Collection Schedule Domain and Persistence Foundation (Accepted).
Sprint 056: Operator Authentication Health Filtering and Profile Inventory Pagination (Accepted).
Sprint 055: Operator Authentication Recovery and Reprovisioning (Accepted).
Sprint 054B: Runtime Authentication Health Reporting and Checkout Enforcement (Accepted).
Sprint 054A: Profile Authentication Health Foundation (Accepted).

## Currently Available Capabilities
- **Profile Management**: Creation, lifecycle, session ingestion, checkout leasing, and operator-driven recovery reprovisioning for `REAUTH_REQUIRED` and `CHECKPOINT_REVIEW_REQUIRED` profiles.
- **Content Management**: Storage of normalized Facebook knowledge group text posts and top comments.
- **Collection Execution**: Headless browser extraction using Playwright (or experimental CloakBrowser). Worker processes automatically consume queued collection runs, ambient exercise runs, and access-check runs.
- **Collection Scheduling**: One persisted `CollectionSchedule` per source group (interval, next run, parameters). A containerized `collection-scheduler` Compose service drains due schedules into queued `SCHEDULED` collection runs on an interval; the scheduler-runtime image does not provision browser executables, Playwright browser downloads, Xvfb, browser-specific system packages, or a runnable CloakBrowser browser/system runtime, and does not launch a browser.
- **Operator Tools**: CLI tools for profile provisioning, manual collection, worker execution, browser probing, the same provisioning CLI used for first-time and recovery login, and the containerized collection scheduler.
- **Web UI**: Dashboard for managing profiles, source groups, categories, content items, and reviewing run status. The profile detail page now displays `authenticationHealth` and a generalized provisioning card for `Start Provisioning`, `Issue New Provisioning Token`, `Start Reauthentication`, and `Start Manual Checkpoint Recovery`. The profile inventory page now supports URL-backed Status and Authentication Health filters, a `Health Updated` column, and 25-item pagination with Previous / Next navigation.

## Current Modules
- **Collector Profile Manager**: Identity, sessions, provisioning, readiness, leases.
- **Content Manager**: Categories, source groups, normalized content, deduplication.
- **Collector Runtime**: Collection orchestration, browser providers, extraction, submission, collection-schedule domain, atomic scheduled dispatch, scheduled dispatch poller.
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
Sprint 060 made the Sprint 059 scheduled dispatch poller deployable in
the dev and preview stacks as a lightweight `collection-scheduler`
Compose service. Sprint 061 closes the operator feedback loop by adding
HTTP routes for listing, getting, and upserting `CollectionSchedule`
records, a Web UI schedules page, and the operator-visible surface for
inspecting and editing the schedules that the scheduler will dispatch.
Future sprint work after Sprint 061 will build on the schedule
management surface.
