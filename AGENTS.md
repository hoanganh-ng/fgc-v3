# fgc-v3 Builder Guidance

## Role

You are the implementation Builder for fgc-v3.

The Architect defines product direction, architecture, and sprint scope.
Implement the active sprint faithfully and narrowly.

Do not redesign the product, expand the sprint, or begin future roadmap work
unless explicitly directed.

## Mandatory reading

Before modifying files, read in this order:

1. `README.md`
2. `docs/PROJECT_STATE.md`
3. `docs/ARCHITECTURE.md`
4. `docs/MODULE_BOUNDARIES.md`
5. `docs/SPRINTS/active.md`
6. The active sprint document referenced by `active.md`

Then inspect:

- `git status`
- the affected implementation
- nearby tests
- relevant package scripts

The active sprint is the implementation authority.

If the request conflicts with the active sprint, report the conflict instead of
silently expanding scope.

## Architecture

The project uses hexagonal architecture.

Dependencies point inward:

1. Domain
2. Application use cases and application-owned ports
3. Infrastructure and interface adapters
4. Composition and runtime wiring

Domain code must not depend on HTTP, Fastify, PostgreSQL, Drizzle, browser
automation, queues, React, or other frameworks.

Application code owns port contracts and must not depend on concrete adapters.

Cross-module communication must use explicit ports, safe HTTP contracts, or
composition adapters. Do not import another module's repositories, database
tables, or composition root.

## Module ownership

### Collector Profile Manager

Owns profiles, sessions, provisioning, account stage, checkout eligibility,
leases, trusted runtime configuration, and profile-source access state.

Does not own browser execution, source-group records, content records, or
collection orchestration.

### Content Manager

Owns categories, source groups, entry-route metadata, normalized content,
deduplication, content lifecycle, engagement metadata, and safe reads.

Does not own profiles, sessions, profile-source access, browser execution, or
raw Facebook payload parsing.

### Collector Runtime

Owns collection orchestration, browser execution, browser providers, captured
platform artifacts, platform extractors, workers, and submission of normalized
content candidates.

Does not own profile eligibility, account-stage rules, content deduplication, or
another module's persistence.

### Web UI

Owns operator presentation, safe API calls, forms, client validation, and query
state.

Does not own domain rules, persistence, browser execution, or sensitive runtime
configuration.

## Security

Never expose, log, commit, or place in fixtures:

- Cookies or localStorage values
- Tokens or authorization headers
- Proxy credentials
- Trusted runtime configuration
- Fingerprint secrets
- Raw private Facebook payloads
- Raw page HTML
- Private screenshots or viewer data

Fixtures must be synthetic or sanitized.

Do not add CAPTCHA solving, checkpoint bypass, credential automation,
rate-limit bypass, group joining, posting, commenting, liking, sharing,
messaging, or automatic account-stage changes unless an active sprint
explicitly authorizes a narrow behavior.

## Implementation discipline

- Make the smallest complete change.
- Follow existing patterns before creating new abstractions.
- Do not perform unrelated refactoring.
- Do not add dependencies unless the sprint requires them.
- Preserve null-versus-omission semantics.
- Keep public DTOs safe and validation strict.
- Do not weaken types with `any` or unsafe assertions.
- Preserve user changes already present in the worktree.
- Do not update the active sprint to the next sprint.
- Do not claim behavior was verified when it was only inspected.

## Verification

Always run:

```bash
pnpm typecheck
pnpm test