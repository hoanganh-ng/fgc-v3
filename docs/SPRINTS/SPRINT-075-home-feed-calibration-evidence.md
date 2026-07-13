# Sprint 075 — Home Feed Calibration Evidence

## Status

Required Evidence Packet complete. Stage classified as `EXTRACTION`; the
sanitized fixture is admitted and narrow extractor calibration is authorized.

This file is the safe evidence handoff for Sprint 075. It records aggregate
values from the existing run summary and Sprint 074 diagnostics only. No run or
profile identifier, raw payload material, or sensitive runtime data is retained
here.

## Run Evidence

```text
runDateUtc:
terminalStatus: SUCCEEDED
captureStage: SUCCEEDED
capturePageState: HOME_FEED
captureCounters:
  pageContextFetchCaptureCount: 0
  pageContextXhrCaptureCount: 76
  networkListenerCaptureCount: 77
  parseFailureCount: 0
  totalPayloadsPassedToExtractor: 77
extractorCounters:
  extractedCandidateCount: 0
  deduplicatedCandidateCount: 0
warningCounts:
  UNKNOWN_PUBLISHER_KIND: 105
  UNSUPPORTED_PAYLOAD_SHAPE: 62
  MISSING_STABLE_PUBLISHER_ID: 14
  EXCLUDED_SPONSORED_POST: 6
  SKIPPED_CANDIDATE_WITHOUT_POST_ID: 2
unsupportedPayloadCount: 62
runOutcome:
existingRunSummary:
  capturedPayloads: 77
  extractorCandidates: 0
  sourcePublishersObserved: 0
  contentItemsSubmitted: 0
  failedPublisherObservations: 0
  failedContentSubmissions: 0
  leaseReleased: true
operatorClassification: EXTRACTION
```

`runDateUtc` and `runOutcome` remain blank because the supplied safe summary
did not include a UTC timestamp and the terminal run succeeded without a
failure outcome. Reported zeroes are explicit diagnostic or run-summary values,
not substitutions for unavailable facts.

## Stage Classification

- [ ] `CAPTURE_OR_AUTH` — capture did not succeed or no payload reached the
  extractor; stop Sprint 075 extractor implementation.
- [x] `EXTRACTION` — payloads reached the extractor and warning/count evidence
  identifies a supported-shape or rejection-path gap; fixture admission may
  proceed.
- [ ] `DOWNSTREAM` — candidates were extracted but publisher observation or
  content submission failed; stop Sprint 075 extractor implementation.
- [ ] `LEGITIMATELY_LOW_YIELD` — no confirmed eligible group/page post was
  present; collect another sample without changing code.
- [ ] `INCONCLUSIVE` — the safe evidence does not identify one responsible
  stage; collect another sample or shape a diagnostic correction.

Classification rationale:

```text
During a headed operator run, at least one eligible, non-sponsored text post
from a configured Facebook group was visibly present. Capture succeeded, 77
payloads reached the extractor, and no parse failures occurred. The extractor
nevertheless produced zero candidates. The dominant warnings were
UNKNOWN_PUBLISHER_KIND and UNSUPPORTED_PAYLOAD_SHAPE. Publisher observation and
content submission were not reached because extraction yielded no candidates.
```

## Sanitized Fixture Admission

Fixture acquisition and Architect review complete. The sanitized fixture is
admitted for narrow extractor calibration.

```text
fixturePath: src/collector-runtime/platform-extractors/facebook/__fixtures__/sanitized-realshape-home-feed-group-text-post.fixture.ts
diagnosedWarningOrGap: Eligible configured-group Story contains explicitly type-qualified Group publisher objects with GraphQL node ids on demonstrated paths, but the extractor ignores those ids and emits MISSING_STABLE_PUBLISHER_ID with zero candidates.
expectedEligibleCandidateCount: at least 1
expectedPublisherKind: GROUP
expectedWarningBehavior: Unchanged extractor yields zero candidates with MISSING_STABLE_PUBLISHER_ID (publisherKind GROUP) on the root Story; nested content story paths may also warn UNKNOWN_PUBLISHER_KIND.
structuralPathsPreserved: data.node(Story).post_id; permalink_url; actors[]; to(Group); comet_sections.content.story.message; target_group.id; comet_sections.action_link.group(Group with id only)
```

Sanitization confirmation:

- [x] All identifiers use deterministic fixture values.
- [x] Body/comment text is synthetic.
- [x] URLs are deterministic fixture URLs or omitted.
- [x] Unrelated payload branches were removed.
- [x] No cookies, localStorage, tokens, headers, session data, viewer/account
  identifiers, tracking values, proxy/fingerprint values, screenshots, raw
  HTML, private response bodies, or stack traces remain.
- [x] The original raw payload is not committed, pasted into documentation,
  included in test output, or logged.

Sanitization note:
`src/collector-runtime/platform-extractors/facebook/__fixtures__/sanitized-realshape-home-feed-group-text-post.md`.

No raw payload or HAR export is admitted by this evidence packet. Calibration
may use `id` only from explicitly type-qualified `Group` objects on the
fixture-demonstrated publisher paths. Arbitrary object ids, actor/user ids, and
unqualified `target_group.id` remain ineligible.

## Before/After Evidence

Builder records the focused fixture result before and after the extractor
change. The operator records the repeated live-run safe summary after automated
verification.

```text
beforeFocusedTest: FAIL — expected 1 candidate, got 0 (MISSING_STABLE_PUBLISHER_ID on GROUP)
afterFocusedTest: PASS — 1 GROUP candidate with stable GraphQL Group id; no MISSING_STABLE_PUBLISHER_ID
afterLiveRunSafeSummary:
  terminalStatus: SUCCEEDED
  captureStage: SUCCEEDED
  capturePageState: HOME_FEED
  captureCounters:
    pageContextFetchCaptureCount: 0
    pageContextXhrCaptureCount: 0
    networkListenerCaptureCount: 42
    parseFailureCount: 0
    totalPayloadsPassedToExtractor: 42
  extractorCounters:
    extractedCandidateCount: 5
    deduplicatedCandidateCount: 5
  warningCounts:
    UNKNOWN_PUBLISHER_KIND: 66
    UNSUPPORTED_PAYLOAD_SHAPE: 37
  unsupportedPayloadCount: 37
  existingRunSummary:
    capturedPayloads: 42
    extractorCandidates: 5
    sourcePublishersObserved: 3
    contentItemsSubmitted: 5
    failedPublisherObservations: 0
    failedContentSubmissions: 0
    leaseReleased: true
```

## Review Decision

```text
decision: PRODUCT_OWNER_CHANGES_REQUIRED
reviewedImplementationCommit: 6ee4b53
acceptedEvidence: Focused test changed from 0 to 1 GROUP candidate; focused suite, typecheck, and full unit suite passed; repeated live run improved from 0 to 5 candidates with no MISSING_STABLE_PUBLISHER_ID.
blockingFinding: The implementation accepts id from any explicitly type-qualified Group object reached through recursive publisher-container discovery because extractStablePublisherId does not receive or validate PublisherReference.path. The documented restriction to $.to and $.comet_sections.action_link.group is therefore not enforced.
requiredCorrection: Pass the publisher-reference path into stable-id resolution and permit the GraphQL id fallback only for explicitly type-qualified Group objects at exactly $.to or $.comet_sections.action_link.group relative to the candidate Story.
requiredNegativeTests: Prove that an explicitly type-qualified Group plus id is still rejected with MISSING_STABLE_PUBLISHER_ID when placed under (1) a non-demonstrated generic publisher container and (2) an unrelated nested group key. Preserve the existing kind-only rejection test.
scope: Extractor implementation and focused extractor tests only. Do not repeat the live run unless the correction changes the admitted positive fixture result or diagnostics.
```

Sprint 075 remains active and is not accepted. The successful live-run evidence is
retained; Product Owner review resumes after the narrow path-enforcement
correction and required negative tests pass.
