# Sprint 074 — Home Feed Extraction Diagnostics

## Status

Accepted.

## Goal

Make every profile home-feed collection run explain its result safely before changing capture or extractor behavior.

An operator must be able to distinguish capture failure, JSON/framing parse failure, unsupported payload shape, candidate rejection, publisher-resolution rejection, content submission failure, duplicate merge, and a legitimately low-yield feed.

## Context

Sprint 073 locked the Profile Feed Collector MVP. The current blocker is observability: home-feed runs may finish with zero or few candidates, but the existing result does not provide enough safe evidence to identify the failing stage.

Sprint 074 is the first sprint in the Collector completion sequence:

1. Sprint 074 makes current behavior explainable.
2. Sprint 075 calibrates extraction only from diagnostic evidence and sanitized fixtures.
3. Sprint 076 validates the complete live loop repeatedly.
4. Sprint 077 locks the working Collector baseline before Content Builder resumes.

## Capability Summary

Sprint 074 carries one complete vertical capability:

> A persisted profile home-feed run exposes a strict, safe, aggregate
> diagnostic summary through its existing read contracts and Web UI, using
> facts propagated from the existing capture, extraction, publisher
> observation, and content-submission stages.

This capability includes all four necessary slices and they must remain one
vertical delivery:

1. **Capture and extraction accounting** — derive truthful safe counts and
   allowlisted warning/rejection codes from existing results without changing
   capture or candidate acceptance.
2. **Run propagation and persistence** — retain the diagnostic summary,
   including partial facts collected before a terminal failure, on the
   profile-bound home-feed run.
3. **Safe read contract** — return the optional summary through existing
   profile home-feed run list/detail DTOs with backward-compatible omission for
   older runs.
4. **Operator presentation** — display the summary on the existing profile
   home-feed run surface with readable labels and an explicit unavailable state
   for legacy runs.

The sprint is incomplete if diagnostics exist only in logs, only in memory,
only in the database, or only in backend DTOs. No new standalone diagnostics
subsystem or unrelated run-type instrumentation is authorized.

## Required Context

- `docs/SPRINTS/active.md`
- This sprint document
- `docs/PROJECT_SNAPSHOT.md`
- `docs/ROADMAP.md`
- `docs/modules/collector-runtime.md`
- `docs/modules/content-manager.md`
- `docs/TESTING_STRATEGY.md`
- `src/collector-runtime/domain/profile-home-feed-collection-run.ts`
- `src/collector-runtime/domain/profile-home-feed-collection-run.schemas.ts`
- `src/collector-runtime/application/ports/profile-home-feed-collection-run-repository.port.ts`
- `src/collector-runtime/application/use-cases/execute-profile-home-feed-collection-run.use-case.ts`
- `src/collector-runtime/application/use-cases/mark-profile-home-feed-collection-run-succeeded.use-case.ts`
- `src/collector-runtime/application/use-cases/mark-profile-home-feed-collection-run-failed.use-case.ts`
- `src/collector-runtime/infrastructure/facebook-home-feed-browser-payload-capture.ts`
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.ts`
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-extractor.types.ts`
- `src/operator-tools/profile-home-feed-runner/runner.ts`
- `src/operator-tools/profile-home-feed-worker/worker-runner.ts`
- `src/infrastructure/database/schema/collector-runtime.schema.ts`
- `src/infrastructure/database/mappers/profile-home-feed-collection-run.mapper.ts`
- `src/infrastructure/database/repositories/drizzle-profile-home-feed-collection-run.repository.ts`
- `src/interfaces/http/routes/collector-runtime.routes.ts`
- `src/interfaces/http/schemas/collector-runtime.http-schemas.ts`
- `apps/web/src/lib/api/collector-runtime-client.ts`
- `apps/web/src/pages/profile-home-feed-collection-runs-page.tsx`
- `apps/web/src/features/collector-runtime/profile-home-feed-collection-run-view-model.ts`
- Nearby tests for only the files above

Do not scan Content Builder, source-group collection, account exercise, access-check, scheduling, or unrelated historical sprints unless a direct dependency requires it.

## Requirements

### Diagnostic model

- Collector Runtime owns home-feed capture and extraction diagnostics.
- Define a strict, safe, aggregate diagnostic summary.
- Use stable diagnostic field names and warning/rejection codes.
- Do not store arbitrary messages originating from Facebook payloads.
- Counts must be non-negative integers.
- Warning/rejection maps must use an allowlisted code vocabulary and non-negative counts.
- Empty-versus-omitted behavior must be explicit and consistent across domain, persistence, DTO, client, and UI.

The summary should explain, where the existing seams can support it:

- captured response/payload count;
- successfully parsed payload count;
- JSON/framing parse failure count;
- extractor input/payload count;
- unsupported payload count;
- candidate-like object count;
- accepted extractor candidate count;
- rejection counts grouped by stable safe reason;
- observed publisher count;
- submitted content count;
- merged/deduplicated content count;
- safe failure stage/code for terminal failure.

If an exact count cannot be derived without changing capture or extraction behavior, omit it and document why. Do not invent an approximation.

### Execution propagation

- Preserve diagnostics from existing capture and extractor results through the bounded home-feed runner.
- Aggregate warning and rejection codes deterministically.
- Persist the minimum safe summary needed for later run reads.
- A terminal run must retain diagnostics gathered before a later failure.
- Diagnostic collection must not change candidate acceptance, browser navigation, timing, payload capture, submission, or lease behavior.

### Persistence and HTTP

- If the current run record cannot store the safe summary, add one minimal nullable/optional persistence field using established Drizzle migration and mapper patterns.
- Existing rows must remain readable and expose diagnostics according to the explicit omission/null policy.
- Extend only profile home-feed run read DTOs needed by the operator surface.
- Use a strict safe DTO allowlist.
- Do not expose internal exceptions, raw payload fragments, URLs copied from private responses, or stack traces.
- Preserve existing request contracts and run lifecycle behavior.

### Web UI

- Render diagnostics on the existing profile home-feed run surface.
- Make zero-yield, low-yield, and failed outcomes understandable without a broad redesign.
- Show safe labels and counts, not backend objects or raw JSON.
- Handle older runs without diagnostics gracefully.
- Do not expose sensitive runtime details.

### Safety

The domain, persistence, logs, HTTP, tests, fixtures, and Web UI must not expose:

- raw Facebook payloads or response bodies;
- cookies or localStorage;
- access/session/provisioning tokens;
- authorization or request headers;
- proxy credentials;
- fingerprint secrets or trusted runtime configuration;
- viewer/account identifiers;
- screenshots or raw HTML;
- arbitrary Facebook field values;
- stack traces.

### Compatibility

- Do not change Facebook extraction behavior.
- Do not change browser capture behavior.
- Do not change profile checkout, leasing, account stage, or authentication-health policy.
- Preserve existing run state transitions, cancellation, scheduler, worker, and manual runner behavior.
- Preserve existing content ingestion and deduplication behavior.

### Documentation

- Update Collector Runtime documentation with the durable safe diagnostic contract.
- Update the project snapshot only with implemented facts.
- Keep Sprint 074 active until Product Owner review.
- Do not activate Sprint 075.

## Out of Scope

- Facebook extractor rule changes.
- Browser navigation, interception, or capture changes.
- Live-Facebook success claims.
- Raw payload persistence.
- New retry policy.
- Scheduler or worker expansion.
- Source-group collection changes.
- Profile lifecycle or lease changes.
- Content Builder, LLM, Content Brief, Producer, Artifact, or Content Publisher work.
- Broad UI redesign or unrelated cleanup.

## Implementation Guidance

- Start at the existing capture-result and extractor-result seams.
- Prefer one typed diagnostic value object or contract over unrelated counters scattered through the runner.
- Keep diagnostic aggregation pure and independently testable.
- Prefer a single JSONB summary on the home-feed run if persistence is required, following existing safe validated JSONB patterns.
- Use a versioned or strictly validated shape if future diagnostic evolution would otherwise make old rows unsafe.
- Persist only data required for operator explanation.
- Keep safe diagnostic codes separate from human UI labels.
- Preserve diagnostics in both success and failure completion paths.
- Do not catch and downgrade existing domain or submission errors merely to create a diagnostic result.

## Verification Points

- `pnpm typecheck`
- `pnpm test`
- `pnpm web:typecheck`
- `pnpm web:build`
- If persistence changes: `pnpm test:db:docker`
- If HTTP contracts change: `pnpm test:http:db` and a focused `pnpm test:e2e:docker` flow
- Verify an old run without diagnostics remains readable.
- Verify a zero-candidate synthetic run shows safe explanatory counts/codes.
- Verify a successful synthetic run shows accepted/submitted counts.
- Verify a failure after partial capture preserves already gathered safe diagnostics.
- Verify unknown diagnostic codes or invalid negative/fractional counts are rejected at boundaries.
- Verify DTO/UI allowlists contain no sensitive fields.

Live Facebook execution is optional evidence for shaping Sprint 075 and is not an acceptance requirement for Sprint 074. If performed, record only safe aggregate results.

## Acceptance Gate

Sprint 074 is complete only when all of the following are demonstrated:

- A zero-candidate synthetic run persists and returns enough safe facts to
  identify the exhausted stage or allowlisted rejection categories.
- A successful synthetic run persists and returns capture/extraction and
  publisher/submission counts available from existing seams.
- A failure after partial progress retains the diagnostic facts gathered before
  the failure while preserving the existing failed-run behavior.
- Existing/legacy rows without diagnostics remain readable; read DTOs omit the
  optional summary and the Web UI renders an explicit diagnostics-unavailable
  state rather than zeroes.
- Unknown diagnostic codes and negative, fractional, or otherwise invalid
  counts are rejected at domain and adapter boundaries.
- Run list/detail responses use a strict allowlist and contain none of the
  sensitive fields prohibited by this sprint.
- The existing Web UI run surface renders operator-readable labels and counts
  without raw JSON or a new page.
- Existing Facebook capture, extractor candidate output, run transitions,
  cancellation, worker/scheduler behavior, checkout/leasing, and content
  ingestion tests remain unchanged in behavior and pass.
- Every verification command required by the changed layers passes, with exact
  results reported.
- No live-Facebook success claim is made by this sprint.

Product Owner review, not Builder implementation, determines acceptance. That
review gate was satisfied by the decision below.

## Acceptance Decision

Accepted after Product Owner review of implementation commit `d2d3c4c`.

The review confirmed:

- safe diagnostics persist through success, failure, interruption, and lease
  release failure paths;
- extractor output and executor-level cross-payload deduplication counts have
  distinct, truthful meanings;
- warning keys, failure codes, page states, and HTTP fields are closed
  allowlists;
- URLs, upstream error codes, raw payloads, and other prohibited data do not
  cross the diagnostic contract;
- legacy rows with `NULL` diagnostics remain readable and render the explicit
  unavailable state;
- backend typecheck and the six focused Sprint 074 suites passed during review
  (`94/94` focused tests).

The initial unaccepted Sprint 074 diagnostic JSON shape must not be carried into
a persistent deployment. Disposable development databases containing that
shape should be recreated before deployment; the accepted schema is the only
Sprint 074 persistence contract.

## Risks and Review Focus

- Diagnostics accidentally becoming a channel for raw Facebook data.
- Counter meanings differing across capture, extractor, persistence, and UI.
- Changing extraction or capture while instrumenting it.
- Losing partial diagnostics on failure.
- Migration/backward-compatibility behavior for existing runs.
- Confusing submitted items with newly created items when deduplication merges.
- Treating unavailable counts as zero instead of omitted/unknown.
- Expanding the sprint into observability for unrelated run types.

## Builder Reasoning Effort

High. The work crosses runtime contracts, error paths, persistence, HTTP, and Web UI while carrying sensitive-data constraints. Keep the implementation narrow and reuse established patterns.

## Handoff Prompt for Builder

Implement Sprint 074 — Home Feed Extraction Diagnostics.

Begin with only the required context listed in the sprint document. Inspect the existing profile home-feed capture result, extractor result/warnings, bounded runner, run record, persistence mapper/schema/repository, HTTP DTO/routes, Web UI client/page, and nearby tests. Do not scan unrelated modules or historical sprints by default.

Add a strict, safe, aggregate diagnostic summary that lets an operator distinguish capture, parsing, unsupported-shape, candidate-rejection, publisher-resolution, submission, deduplication, and terminal-failure outcomes. Preserve partial diagnostics when a later stage fails. Persist and expose only the minimum safe summary required by the existing run read surface, with explicit backward-compatible omission/null behavior for older runs.

Do not change Facebook extractor behavior, browser capture/navigation behavior, profile checkout/leasing, run lifecycle, scheduler/worker behavior, content ingestion rules, or authentication-health policy. Do not expose raw payloads, cookies, localStorage, tokens, headers, proxy or fingerprint material, viewer/account identifiers, screenshots, raw HTML, private response bodies, arbitrary Facebook values, or stack traces.

Render the safe diagnostic summary in the existing profile home-feed run UI without a broad redesign. Use stable allowlisted codes in backend contracts and operator-readable labels in the UI.

Add proportionate unit, persistence, HTTP, and UI/E2E coverage according to `docs/TESTING_STRATEGY.md`. Run all verification commands required by the layers changed. Report exact files changed, migration/contract behavior, test commands and results, and any count that could not be derived without changing behavior.

Do not commit, push, activate Sprint 075, or advance the active sprint.
