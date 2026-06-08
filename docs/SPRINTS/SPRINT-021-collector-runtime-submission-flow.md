# Sprint 021: Collector Runtime Submission Flow

## Goal

Implement the Collector Runtime submission flow that takes already-captured Facebook GraphQL response bodies, extracts normalized content candidates through the Facebook GraphQL Payload Extractor, and submits those candidates to the Content Manager HTTP API.

## Scope

- Add Collector Runtime application code under `src/collector-runtime/application`.
- Add a Content Manager content submission port owned by Collector Runtime.
- Add a Content Manager HTTP client adapter under `src/collector-runtime/infrastructure`.
- Submit normalized candidates to `POST /collector/content-items`.
- Use configurable Content Manager base URL support through `CONTENT_MANAGER_BASE_URL`.
- Preserve extractor warnings and invalid extraction issues in submission-flow results.
- Attempt every extracted candidate and report partial submission failures per candidate.
- Add unit tests for the submission use case with a fake submission port.
- Add HTTP client adapter tests with mocked `fetch`.
- Update project state, roadmap, and boundary documentation for Sprint 021.

## Out Of Scope

- Browser automation.
- Playwright or Puppeteer.
- Network interception or payload capture.
- Profile checkout.
- Profile lease release.
- Scheduling or queues.
- Database access from Collector Runtime.
- Direct repository access from Collector Runtime.
- Content Manager repository, Drizzle, PostgreSQL, schema, migration, composition-root, or business-rule changes.
- Content Manager raw Facebook GraphQL payload contracts.
- Fastify route changes.
- Web UI.
- Content Builder.
- Publisher.

## Acceptance Criteria

- Active sprint documentation identifies Sprint 021 as the active sprint.
- Collector Runtime owns the submission use case and submission port.
- The submission flow accepts already-captured Facebook GraphQL payloads only.
- The submission use case calls the Facebook GraphQL Payload Extractor.
- Extractor invalid results return a failed submission-flow result with extraction issues.
- Valid extraction with zero candidates returns success with `submittedCount = 0` and preserved warnings.
- Each extracted candidate is submitted through the Collector Runtime submission port.
- Multiple candidates are all attempted even when one candidate submission fails.
- Partial submission failures are represented per candidate and summarized.
- The submission port input structurally matches the Content Manager normalized ingestion HTTP request body.
- Raw GraphQL payloads are not sent through the submission port or HTTP client body.
- The HTTP client posts normalized candidates to `/collector/content-items`.
- The HTTP client treats 2xx responses as success.
- The HTTP client maps 4xx and 5xx responses to structured submission failures.
- The HTTP client maps network failures to structured submission failures.
- The HTTP client uses the configured base URL.
- No browser automation, network interception, profile checkout/release, scheduler, queue, database, migration, or Web UI code is added.

## Verification

```bash
pnpm run typecheck
pnpm test
git status --short
```
