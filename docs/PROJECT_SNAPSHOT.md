# Project Snapshot

## Current Product Stage
The product is currently in the **Content Collector** stage (Stage 1 of 3, preceding Builder and Publisher). The core focus is collecting normalized content from configured Facebook sources while maintaining strict isolation between profile management, collection orchestration, and content storage.

## Current Active Sprint
Sprint 063A — Source Publisher Domain and Application: awaiting definition (not active; not authorized for implementation).
Sprint 062: Feed Discovery Delivery Plan And Docker E2E Foundation (Accepted).
Sprint 061: Operator Collection Schedule Management Surface (Accepted).
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
- **Docker E2E**: An isolated production-like Docker E2E harness (`docker-compose.e2e.yml`) that runs the production Nginx gateway, the API after migrations, an isolated PostgreSQL instance, and a Playwright Chromium runner. The harness proves the current stack works end-to-end using only synthetic fixtures. It never touches dev or preview volumes and never publishes a host port.

## Current Modules
- **Collector Profile Manager**: Identity, sessions, provisioning, readiness, leases.
- **Content Manager**: Categories, source groups, normalized content, deduplication.
- **Collector Runtime**: Collection orchestration, browser providers, extraction, submission, collection-schedule domain, atomic scheduled dispatch, scheduled dispatch poller.
- **Web UI**: Operator presentation and safe API consumption.

## Important Architectural Invariants
- Hexagonal architecture: Domain logic has zero dependencies on HTTP, databases, browsers, or queues.
- Security: Raw session data (cookies, tokens, proxy credentials) and raw Facebook private payloads are never exposed to the UI, logs, or persistent records.
- Separation of Concerns: Profile readiness/leasing is owned entirely by Profile Manager. Browsers consume leases but do not determine profile eligibility.
- Test isolation: The E2E harness uses its own Compose project (`fgc-v3-e2e`), its own named volume (`fgc_e2e_postgres_data`), and its own network. It cannot read or modify dev or preview resources.

## Important Unresolved Risks
- Scale of active profile checkout frequency vs PostgreSQL concurrency.
- Long-term viability of browser provider evasion capabilities (e.g. Playwright vs CloakBrowser) against Facebook fingerprinting.
- Future Content Builder handoff payload structure.

## Testing Strategy
The cross-cutting testing strategy is documented in [`docs/TESTING_STRATEGY.md`](TESTING_STRATEGY.md). It defines five layers: unit tests (Vitest), database integration tests (opt-in Vitest with PostgreSQL), HTTP integration tests (opt-in Vitest with PostgreSQL), Docker E2E (Sprint 062 Playwright in production-like Compose), and manual live-Facebook validation (opt-in operator-driven probes).

## Verification Commands
```bash
pnpm typecheck
pnpm test
pnpm test:db
pnpm test:http:db
pnpm web:typecheck
pnpm web:build
pnpm test:e2e:docker
```

## Immediate Next Expected Work
Sprint 061 closed the operator feedback loop for collection schedules
by adding HTTP routes, a Web UI page, and the small SCHEDULED regression
fix. Sprint 062 is accepted: it published the feed discovery delivery
plan, the cross-cutting testing strategy, the isolated Docker E2E
harness, and the baseline E2E flow that proves the production-like
stack works through Nginx → API → migrations → PostgreSQL using only
synthetic fixtures. Future sprint work after Sprint 062 will follow
the corrected 063A–068 sequence documented in `docs/ROADMAP.md`, in
which `SourcePublisher` is the Content Manager-owned publishing-source
identity (a group or a page observed while reading the feed) and is
not the future Content Publisher pipeline stage. The long-term
`Future: Content Builder` and `Future: Content Publisher` pipeline
stages are retained. Sprint 063A — Source Publisher Domain and
Application is awaiting definition; it is not yet active and is not
authorized for implementation.