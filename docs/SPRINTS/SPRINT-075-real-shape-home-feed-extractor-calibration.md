# Sprint 075 — Real-Shape Home Feed Extractor Calibration

## Status

Accepted. Product Owner review accepted the calibrated extractor at commit
`0932eba` after the path-enforcement correction and negative regressions.

## Goal

Use Sprint 074 diagnostics and sanitized real-shape evidence to reproduce one
confirmed Facebook home-feed extraction gap, then make the smallest extractor
change that restores eligible group/page text-post extraction without weakening
existing exclusions or changing browser capture.

## Why This Sprint Exists

Sprint 074 made the current home-feed pipeline explainable. Sprint 075 must now
follow that evidence instead of guessing at Facebook payload drift.

The fastest acceptable path is:

1. run the current collector once;
2. classify the exhausted stage from safe diagnostics;
3. proceed only if extraction is the responsible layer;
4. reproduce that exact shape with one sanitized fixture and a failing test;
5. apply the narrowest extractor correction;
6. repeat the same operator run and compare safe summaries.

## Capability Summary

Sprint 075 carries one narrow capability:

> A confirmed current Facebook home-feed payload shape, represented by a safe
> sanitized regression fixture, yields the expected eligible group/page
> candidate while all existing personal-profile, sponsored, bodyless, and
> unstable-identity exclusions remain enforced.

This is not authority for general extractor modernization. One evidence packet
may justify one cohesive family of related payload paths only. A second
unrelated shape requires a separate review or correction sprint.

## Required Evidence Packet

Before Builder handoff, complete
[`SPRINT-075-home-feed-calibration-evidence.md`](SPRINT-075-home-feed-calibration-evidence.md)
from at least one operator-driven run. Omit unavailable values rather than
inventing zeroes. The required safe fields are:

```text
runDateUtc:
terminalStatus:
captureStage:
capturePageState:
captureCounters:
  pageContextFetchCaptureCount:
  pageContextXhrCaptureCount:
  networkListenerCaptureCount:
  parseFailureCount:
  totalPayloadsPassedToExtractor:
extractorCounters:
  extractedCandidateCount:
  deduplicatedCandidateCount:
warningCounts:
unsupportedPayloadCount:
runOutcome:
existingRunSummary:
  capturedPayloads:
  extractorCandidates:
  sourcePublishersObserved:
  contentItemsSubmitted:
  failedPublisherObservations:
  failedContentSubmissions:
  leaseReleased:
operatorClassification:
```

The packet must not contain a profile/account/viewer identifier, raw URL, raw
payload, cookie, localStorage value, token, header, proxy or fingerprint value,
screenshot, raw HTML, private response body, arbitrary Facebook text, or stack
trace.

### Stage decision

- If capture did not succeed or no payload reached the extractor, stop Sprint
  075 implementation and shape the responsible capture/authentication
  correction.
- If candidates were extracted but publisher observation or content submission
  failed, stop and shape that downstream correction.
- If eligible content is absent and diagnostics show unsupported shapes or
  extractor rejection categories, proceed to sanitized fixture preparation.
- If the run is legitimately low-yield and no eligible group/page post can be
  identified, collect another operator sample; do not change code.

## Operator-Assisted Fixture Acquisition

The Product Owner authorizes the bounded workflow in
[`SPRINT-075A-operator-assisted-fixture-acquisition.md`](SPRINT-075A-operator-assisted-fixture-acquisition.md)
to run against the existing local dev stack and already logged-in profile. This
authority covers one headed collection run, minimum relevant response
inspection inside the operator-controlled environment, sanitization, fixture
creation, fixture-safety verification, and one focused failing regression test.

Sprint 075A did not authorize extractor or browser-capture changes and stopped
with a Fixture Admission Report. That fixture has now passed Architect review;
only the narrow Sprint 075 extractor calibration is authorized.

## Fixture Admission Gate

At least one fixture derived from the diagnosed shape must be approved before
extractor code changes.

The fixture must:

- preserve only the object/array topology and field paths required to reproduce
  the extraction behavior;
- replace all post, publisher, actor, feedback, comment, and other identifiers
  with deterministic fixture values;
- replace body and comment text with clearly synthetic text;
- replace URLs with deterministic non-private fixture URLs or omit them when
  they are not required by the behavior;
- remove cookies, tokens, headers, session data, viewer data, tracking values,
  proxy/fingerprint configuration, and unrelated payload branches;
- include a nearby sanitization note stating what structural behavior it
  represents and confirming that no raw/private values remain;
- pass the existing fixture safety assertions before being committed.

The raw source payload must never be committed, pasted into a sprint document,
issue, chat, test output, or application log. Sanitization happens only in the
operator-controlled environment. Sprint 075A completed that bounded workflow,
deleted its temporary raw artifact, and committed only the reviewed sanitized
fixture.

### Admission decision

The fixture in
`src/collector-runtime/platform-extractors/facebook/__fixtures__/sanitized-realshape-home-feed-group-text-post.fixture.ts`
is admitted for Sprint 075 calibration.

The demonstrated publisher identity rule is deliberately narrow: a generic
GraphQL `id` may be used as the external publisher ID only when it belongs to an
object explicitly type-qualified as `Group` on a fixture-demonstrated publisher
path such as `to` or `comet_sections.action_link.group`. Do not accept an
arbitrary `id`, an actor/user `id`, or `target_group.id` without independent
explicit `Group` qualification. Preserve the existing missing-stable-ID warning
for all unqualified cases.

## Required Context

Read only:

- `AGENTS.md`
- `docs/SPRINTS/active.md`
- this sprint document;
- `docs/PROJECT_SNAPSHOT.md`;
- `docs/ROADMAP.md`;
- `docs/modules/collector-runtime.md`;
- `docs/TESTING_STRATEGY.md`;
- `docs/SPRINTS/SPRINT-075-home-feed-calibration-evidence.md` with a completed
  Required Evidence Packet;
- `docs/SPRINTS/SPRINT-075A-operator-assisted-fixture-acquisition.md` when the
  fixture-acquisition phase is being executed;
- the approved sanitized fixture and its sanitization note;
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-extractor.types.ts`;
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.ts`;
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.test.ts`;
- `src/collector-runtime/platform-extractors/facebook/__fixtures__/index.ts`;
- nearby fixture files required by the failing test.

Inspect `src/collector-runtime/application/use-cases/execute-profile-home-feed-collection-run.use-case.ts`
only to confirm the extractor seam and diagnostic meanings. Do not change it
unless a newly discovered dependency is reported and separately approved.

Do not scan or modify browser capture, checkout/leasing, scheduling, HTTP, Web
UI, Content Manager, Content Builder, or unrelated historical sprints by
default.

## Requirements

### Reproduce first

- Add the approved sanitized fixture and sanitization note.
- Add a focused test that fails for the diagnosed reason before changing the
  extractor.
- Assert the expected normalized candidate fields and the relevant warning
  behavior.
- Record the before-change test result in the implementation report.

### Narrow extractor calibration

- Change traversal or field resolution only for paths demonstrated by the
  admitted fixture.
- Reuse existing normalization and validation rules.
- Preserve stable `externalPostId`, stable publisher identity, supported
  `GROUP`/`PAGE` publisher kind, meaningful body text, and deterministic source
  URL behavior.
- Preserve deterministic candidate ordering and in-payload deduplication.
- Preserve warning-code meanings. If a new warning code appears necessary,
  stop because it changes the accepted Sprint 074 diagnostic contract and
  requires Architect review.
- Do not make a generic recursive traversal broader merely because additional
  objects resemble posts; every newly accepted path must be fixture-backed.

### Preserve exclusions

Regression tests must continue to prove exclusion of:

- personal-profile posts;
- sponsored or advertising posts;
- candidates without meaningful body text;
- candidates without stable post identity;
- candidates without stable group/page publisher identity;
- malformed or unsupported values that should produce safe warnings rather
  than exceptions.

### Documentation

- Update `docs/modules/collector-runtime.md` only if the durable extractor
  behavior or supported real-shape paths materially change.
- Update `docs/PROJECT_SNAPSHOT.md` only with implemented, verified facts.
- Keep Sprint 075 active until Product Owner review.
- Do not activate Sprint 076.

## Out of Scope

- Browser navigation, interception, payload framing, or capture changes.
- New capture diagnostics or changes to the Sprint 074 persistence/HTTP/UI
  contract.
- Profile checkout, lease, readiness, session, or authentication-health
  changes.
- Publisher observation or content-submission changes.
- Database migrations, HTTP routes, Web UI changes, workers, or schedulers.
- CAPTCHA solving, checkpoint bypass, credential automation, or automatic
  account-stage changes.
- Source-group collection behavior.
- Content Builder, LLM, Content Brief, Producer, Artifact, or Content Publisher
  work.
- Broad extractor refactoring, speculative fallback paths, or support for
  unrelated payload families.

## Verification

Builder must run:

```bash
pnpm exec vitest run src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.test.ts
pnpm typecheck
pnpm test
```

Database, HTTP, Web, and Docker E2E suites are not required when the final diff
is limited to extractor fixtures, extractor implementation/tests, and docs. If
the implementation changes another layer, stop for scope review and add the
verification required by `docs/TESTING_STRATEGY.md`.

After automated verification, the operator repeats the same live collection
scenario. Record only the safe Sprint 074 diagnostic summary and existing safe
run-summary counts. Manual live evidence is not an automated-test result.

## Acceptance Gate

Sprint 075 is complete only when all of the following are demonstrated:

- The Required Evidence Packet identifies extraction as the responsible layer.
- An approved sanitized fixture reproduces the diagnosed real-shape failure.
- The focused regression test is shown failing before the extractor change and
  passing afterward.
- The corrected fixture yields at least one expected eligible group/page
  candidate with stable post identity, stable publisher identity, and
  meaningful synthetic body text.
- Existing personal-profile, sponsored, bodyless, unstable-identity,
  malformed-input, warning, ordering, and deduplication tests pass unchanged in
  behavior.
- Fixture safety assertions pass and review finds no prohibited data.
- `pnpm typecheck` and `pnpm test` pass with exact results reported.
- A repeated operator run shows safe evidence that the diagnosed extraction
  stage improved, or explicitly documents that live Facebook changed again.
- No browser capture, checkout/lease, persistence, HTTP, Web UI, worker,
  scheduler, or downstream content behavior changed.
- No broad live-Facebook success or general extractor-compatibility claim is
  made from one fixture/run.

Product Owner review accepted Sprint 075. The admitted fixture changed from
zero candidates to one expected `GROUP` candidate, the repeated live run changed
from zero to five candidates with five submissions, and the exact path guard plus
negative regressions preserve the stable-publisher boundary.

## Stop Conditions

Stop and report instead of implementing when:

- the Required Evidence Packet or sanitized fixture is missing;
- diagnostics do not identify extraction as the responsible layer;
- reproducing the issue requires raw/private payload material in the repo or
  report;
- the fix requires capture, authentication, checkout, lease, persistence,
  HTTP, Web UI, publisher observation, or content submission changes;
- the proposed change weakens an exclusion or accepts personal/sponsored
  content;
- the proposed change needs a new public diagnostic warning code;
- more than one unrelated payload family is being addressed.

## Builder Reasoning Effort

High. Facebook shapes drift, but the implementation must remain narrow,
fixture-backed, deterministic, and safe.

## Handoff Prompt for Builder

Implement Sprint 075 — Real-Shape Home Feed Extractor Calibration only after the
Required Evidence Packet and approved sanitized fixture in this sprint are
complete.

Load only the Required Context. First run the new focused fixture test against
the unchanged extractor and record the expected failure. Then make the smallest
field-resolution or traversal change required by that fixture. Preserve all
existing stable-identity, supported-publisher, body-text, personal-profile,
sponsored-content, warning, ordering, and deduplication behavior.

Do not change browser capture, diagnostics contracts, run execution,
checkout/leasing, persistence, HTTP, Web UI, workers, schedulers, publisher
observation, content submission, Content Manager, or Content Builder. Do not
retain or expose raw Facebook payloads or any prohibited profile/runtime data.

Run the focused extractor suite, `pnpm typecheck`, and `pnpm test`. Report the
safe evidence packet, fixture sanitization statement, before/after focused test,
exact files changed, exact verification results, and the safe before/after
operator summaries. Do not commit, push, mark Sprint 075 accepted, activate
Sprint 076, or begin unrelated calibration.
