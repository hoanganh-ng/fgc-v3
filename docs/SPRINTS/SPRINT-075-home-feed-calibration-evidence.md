# Sprint 075 — Home Feed Calibration Evidence

## Status

Awaiting the first operator-driven run after Sprint 074 acceptance.

This file is the safe evidence handoff for Sprint 075. Record aggregate values
from the existing run summary and Sprint 074 diagnostics only. Do not paste raw
payload material or sensitive runtime data here.

## Run Evidence

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

Leave an unavailable field blank or remove it. Never substitute `0` unless the
diagnostic surface explicitly reported zero.

## Stage Classification

Choose exactly one after reviewing the safe values above:

- [ ] `CAPTURE_OR_AUTH` — capture did not succeed or no payload reached the
  extractor; stop Sprint 075 extractor implementation.
- [ ] `EXTRACTION` — payloads reached the extractor and warning/count evidence
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

```

## Sanitized Fixture Admission

Complete this section only when the classification is `EXTRACTION`.

```text
fixturePath:
diagnosedWarningOrGap:
expectedEligibleCandidateCount:
expectedPublisherKind:
expectedWarningBehavior:
structuralPathsPreserved:
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
decision: PENDING
reviewNotes:
```
