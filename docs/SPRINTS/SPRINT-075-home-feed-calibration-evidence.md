# Sprint 075 — Home Feed Calibration Evidence

## Status

Required Evidence Packet complete. Stage classified as `EXTRACTION`;
operator-assisted fixture acquisition is authorized and fixture admission
remains pending.

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

Classification permits fixture preparation, but the admission gate is not yet
satisfied.

```text
fixturePath: pending
diagnosedWarningOrGap: Current eligible home-feed group-post shape is not recognized; exact structural path awaits a sanitized fixture.
expectedEligibleCandidateCount: at least 1
expectedPublisherKind: GROUP
expectedWarningBehavior: The admitted fixture must reproduce the current zero-candidate behavior before calibration.
structuralPathsPreserved: pending
```

Sanitization confirmation:

- [ ] All identifiers use deterministic fixture values.
- [ ] Body/comment text is synthetic.
- [ ] URLs are deterministic fixture URLs or omitted.
- [ ] Unrelated payload branches were removed.
- [ ] No cookies, localStorage, tokens, headers, session data, viewer/account
  identifiers, tracking values, proxy/fingerprint values, screenshots, raw
  HTML, private response bodies, or stack traces remain.
- [ ] The original raw payload is not committed, pasted into documentation,
  included in test output, or logged.

No raw payload or HAR export is admitted by this evidence packet. Extractor
implementation remains blocked until a sanitized fixture is reviewed and every
sanitization confirmation above is satisfied.

## Before/After Evidence

Builder records the focused fixture result before and after the extractor
change. The operator records the repeated live-run safe summary after automated
verification.

```text
beforeFocusedTest:
afterFocusedTest:
afterLiveRunSafeSummary:
```

## Review Decision

```text
decision: FIXTURE_ACQUISITION_AUTHORIZED
reviewNotes: Extraction is the confirmed responsible layer. Execute the bounded Sprint 075A handoff on the Product Owner's dev stack and logged-in profile; do not change the extractor until the sanitized fixture is reviewed and admitted.
```
