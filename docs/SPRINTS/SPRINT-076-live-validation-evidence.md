# Sprint 076 — Live Collector Validation Evidence

## Status

Paused for Sprint 076A. Same-day samples `V01`–`V05` are retained as
exploratory evidence only because they used a temporary proxy-eligibility
bypass. The bypass was restored. The Product Owner chose supported direct
networking and accepted the normal `https://www.facebook.com/` home target;
the chronological `?sk=h_chr` override remains retired.

After Sprint 076A acceptance, record the clean direct-network proof as `V06`
and complete final supported-path samples `V07`–`V10` on a genuinely later
UTC date.

## Baseline Verification

```text
verifiedCommit: cfb1bf9
typecheckCommand: pnpm typecheck
typecheckResult: passed (exit 0)
unitCommand: pnpm test
unitResult: Test Files 146 passed | 17 skipped (163); Tests 1952 passed | 18 skipped (1970); Duration 24.95s
runtimeCodeChangedDuringSprint: temporary local-only proxy eligibility bypass applied then restored; FACEBOOK_HOME_FEED_URL changed from chronological (?sk=h_chr) to normal https://www.facebook.com/ under operator direction (focused capture-adapter tests 9/9 pass)
```

## Exploratory Validation Matrix — Not Acceptance Baseline


| Sample | UTC date | Profile alias | Provider | Status | Duration (s) | Captured | Extracted | Submitted | Useful | Lease released |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| V01 | 2026-07-14 | P1 | PLAYWRIGHT | SUCCEEDED | 23.772 | 48 | 7 | 7 | 6 | yes |
| V02 | 2026-07-14 | P1 | PLAYWRIGHT | SUCCEEDED | 14.480 | 42 | 4 | 4 | 4 | yes |
| V03 | 2026-07-14 | P1 | PLAYWRIGHT | SUCCEEDED | 14.397 | 41 | 4 | 4 | 4 | yes |
| V04 | 2026-07-14 | P1 | PLAYWRIGHT | SUCCEEDED | 15.122 | 49 | 1 | 1 | 1 | yes |
| V05 | 2026-07-14 | P1 | PLAYWRIGHT | SUCCEEDED | 13.976 | 45 | 1 | 1 | 1 | yes |

Use aliases only. Do not record real profile IDs, run IDs, account identities,
Facebook names, text, identifiers, or URLs.

## Final Supported-Path Validation Matrix

| Sample | UTC date | Profile alias | Provider | Network mode | Status | Captured | Extracted | Submitted | Useful | Lease released |
|---|---|---|---|---|---|---:|---:|---:|---:|---|
| V06 |  | P1 | PLAYWRIGHT | DIRECT |  |  |  |  |  |  |
| V07 |  | P1 | PLAYWRIGHT | DIRECT |  |  |  |  |  |  |
| V08 |  | P1 | PLAYWRIGHT | DIRECT |  |  |  |  |  |  |
| V09 |  | P1 | PLAYWRIGHT | DIRECT |  |  |  |  |  |  |
| V10 |  | P1 | PLAYWRIGHT | DIRECT |  |  |  |  |  |  |

No sample counts here if it requires a checkout bypass, temporary source edit,
proxy-rule comment, or non-standard profile mutation.

## Exploratory Per-Run Detail

```text
sample: V01
utcDate: 2026-07-14
profileAlias: P1
provider: PLAYWRIGHT
terminalStatus: SUCCEEDED
durationSeconds: 23.772
captureStage: SUCCEEDED
capturePageState: HOME_FEED
captureCounters:
  pageContextFetchCaptureCount: 0
  pageContextXhrCaptureCount: 47
  networkListenerCaptureCount: 48
  parseFailureCount: 0
  totalPayloadsPassedToExtractor: 48
extractorCounters:
  extractedCandidateCount: 7
  deduplicatedCandidateCount: 7
warningCounts:
  EXCLUDED_SPONSORED_POST: 6
  UNKNOWN_PUBLISHER_KIND: 57
  UNSUPPORTED_PAYLOAD_SHAPE: 38
unsupportedPayloadCount: 38
existingRunSummary:
  capturedPayloads: 48
  extractorCandidates: 7
  sourcePublishersObserved: 3
  contentItemsSubmitted: 7
  failedPublisherObservations: 0
  failedContentSubmissions: 0
  leaseReleased: true
contentReview:
  reviewedItemCount: 7
  usefulItemCount: 6
  usefulnessDecision: USEFUL
duplicateObservation:
  repeatedPostObserved: no
  mergedWithoutDuplicateReviewItem: not_applicable
discoveredSourceReview:
  reviewedCount: 4
  eligibleGroupObserved: yes
failureOrRecoveryClassification:
notes: Chronological home URL still in effect for this sample. Content total delta +7 (all new). Web UI review surfaces reachable.
```

```text
sample: V02
utcDate: 2026-07-14
profileAlias: P1
provider: PLAYWRIGHT
terminalStatus: SUCCEEDED
durationSeconds: 14.480
captureStage: SUCCEEDED
capturePageState: HOME_FEED
captureCounters:
  pageContextFetchCaptureCount: 0
  pageContextXhrCaptureCount: 41
  networkListenerCaptureCount: 42
  parseFailureCount: 0
  totalPayloadsPassedToExtractor: 42
extractorCounters:
  extractedCandidateCount: 4
  deduplicatedCandidateCount: 4
warningCounts:
  EXCLUDED_SPONSORED_POST: 3
  UNKNOWN_PUBLISHER_KIND: 42
  UNSUPPORTED_PAYLOAD_SHAPE: 37
unsupportedPayloadCount: 37
existingRunSummary:
  capturedPayloads: 42
  extractorCandidates: 4
  sourcePublishersObserved: 4
  contentItemsSubmitted: 4
  failedPublisherObservations: 0
  failedContentSubmissions: 0
  leaseReleased: true
contentReview:
  reviewedItemCount: 4
  usefulItemCount: 4
  usefulnessDecision: USEFUL
duplicateObservation:
  repeatedPostObserved: yes
  mergedWithoutDuplicateReviewItem: yes
discoveredSourceReview:
  reviewedCount: 6
  eligibleGroupObserved: yes
failureOrRecoveryClassification:
notes: Chronological home URL. contentItemsSubmitted 4 with content-total delta 3 implies one merge. Global content inventory: unique externalPostId count equals item count (no duplicate review rows).
```

```text
sample: V03
utcDate: 2026-07-14
profileAlias: P1
provider: PLAYWRIGHT
terminalStatus: SUCCEEDED
durationSeconds: 14.397
captureStage: SUCCEEDED
capturePageState: HOME_FEED
captureCounters:
  pageContextFetchCaptureCount: 0
  pageContextXhrCaptureCount: 40
  networkListenerCaptureCount: 41
  parseFailureCount: 0
  totalPayloadsPassedToExtractor: 41
extractorCounters:
  extractedCandidateCount: 4
  deduplicatedCandidateCount: 4
warningCounts:
  EXCLUDED_SPONSORED_POST: 3
  UNKNOWN_PUBLISHER_KIND: 35
  UNSUPPORTED_PAYLOAD_SHAPE: 36
unsupportedPayloadCount: 36
existingRunSummary:
  capturedPayloads: 41
  extractorCandidates: 4
  sourcePublishersObserved: 4
  contentItemsSubmitted: 4
  failedPublisherObservations: 0
  failedContentSubmissions: 0
  leaseReleased: true
contentReview:
  reviewedItemCount: 4
  usefulItemCount: 4
  usefulnessDecision: USEFUL
duplicateObservation:
  repeatedPostObserved: no
  mergedWithoutDuplicateReviewItem: not_applicable
discoveredSourceReview:
  reviewedCount: 6
  eligibleGroupObserved: yes
failureOrRecoveryClassification:
notes: Chronological home URL. Last sample before operator-directed home URL param removal. Content total delta +4.
```

```text
sample: V04
utcDate: 2026-07-14
profileAlias: P1
provider: PLAYWRIGHT
terminalStatus: SUCCEEDED
durationSeconds: 15.122
captureStage: SUCCEEDED
capturePageState: HOME_FEED
captureCounters:
  pageContextFetchCaptureCount: 0
  pageContextXhrCaptureCount: 48
  networkListenerCaptureCount: 49
  parseFailureCount: 0
  totalPayloadsPassedToExtractor: 49
extractorCounters:
  extractedCandidateCount: 1
  deduplicatedCandidateCount: 1
warningCounts:
  EXCLUDED_SPONSORED_POST: 3
  MISSING_STABLE_PUBLISHER_ID: 2
  SKIPPED_CANDIDATE_WITHOUT_POST_ID: 2
  UNKNOWN_PUBLISHER_KIND: 27
  UNSUPPORTED_PAYLOAD_SHAPE: 44
unsupportedPayloadCount: 44
existingRunSummary:
  capturedPayloads: 49
  extractorCandidates: 1
  sourcePublishersObserved: 1
  contentItemsSubmitted: 1
  failedPublisherObservations: 0
  failedContentSubmissions: 0
  leaseReleased: true
contentReview:
  reviewedItemCount: 1
  usefulItemCount: 1
  usefulnessDecision: USEFUL
duplicateObservation:
  repeatedPostObserved: no
  mergedWithoutDuplicateReviewItem: not_applicable
discoveredSourceReview:
  reviewedCount: 9
  eligibleGroupObserved: yes
failureOrRecoveryClassification:
notes: First sample after removing chronological feed query param (normal facebook.com home). Lower candidate yield than V01–V03; login not suspected; page state HOME_FEED.
```

```text
sample: V05
utcDate: 2026-07-14
profileAlias: P1
provider: PLAYWRIGHT
terminalStatus: SUCCEEDED
durationSeconds: 13.976
captureStage: SUCCEEDED
capturePageState: HOME_FEED
captureCounters:
  pageContextFetchCaptureCount: 0
  pageContextXhrCaptureCount: 44
  networkListenerCaptureCount: 45
  parseFailureCount: 0
  totalPayloadsPassedToExtractor: 45
extractorCounters:
  extractedCandidateCount: 1
  deduplicatedCandidateCount: 1
warningCounts:
  EXCLUDED_SPONSORED_POST: 3
  SKIPPED_CANDIDATE_WITHOUT_POST_ID: 2
  UNKNOWN_PUBLISHER_KIND: 36
  UNSUPPORTED_PAYLOAD_SHAPE: 40
unsupportedPayloadCount: 40
existingRunSummary:
  capturedPayloads: 45
  extractorCandidates: 1
  sourcePublishersObserved: 1
  contentItemsSubmitted: 1
  failedPublisherObservations: 0
  failedContentSubmissions: 0
  leaseReleased: true
contentReview:
  reviewedItemCount: 1
  usefulItemCount: 1
  usefulnessDecision: USEFUL
duplicateObservation:
  repeatedPostObserved: no
  mergedWithoutDuplicateReviewItem: not_applicable
discoveredSourceReview:
  reviewedCount: 9
  eligibleGroupObserved: yes
failureOrRecoveryClassification:
notes: Normal facebook.com home URL. Candidate yield remained 1; lease released; useful content reviewed.
```

## Cross-Run Duplicate/Merge Evidence

```text
demonstratedBySamples: V02
repeatedPostObserved: yes
mergedWithoutDuplicateReviewItem: yes
verificationSurface: SAFE_API
notes: V02 submitted 4 with content-total delta 3. End-of-day inventory: content item count equals unique externalPostId count (214/214); zero duplicate review rows.
```

## Discovered-Source Promotion Evidence

```text
demonstratedBySample: V02
reviewedThroughWebUi: yes
eligibleGroupApproved: yes
promotionCompleted: yes
managedSourceInitialStatus: PAUSED
duplicateManagedSourcePrevented: yes
notes: One DISCOVERED FACEBOOK GROUP approved then promoted through supported API into a PAUSED managed source group (outcome CREATED). No group name, Facebook ID, source-group ID, or URL recorded here. Post-promotion inventory includes one PAUSED managed source among existing ACTIVE groups.
```

## Provider and Profile Coverage

```text
distinctUtcDates: 1
playwrightBaselineRunCount: 5
supplementaryCloakBrowserRunCount: 0
profileAliasesUsed: P1
secondProfileAvailable: no
secondProfileException: Only one READY + HEALTHY + COLLECTION_READY profile is present; three others remain PENDING_CONFIG / NOT_PROVISIONED.
temporaryProxyIgnoreAuthorized: yes (restored after samples)
homeFeedUrlModeBySample: V01-V03 chronological query param; V04-V05 normal facebook.com home (param removed under operator direction)
```

## Safety Confirmation

- [x] No real profile/account/viewer/run/post/group/source identifier is present.
- [x] No Facebook name, post/comment text, or raw URL is present.
- [x] No cookie, localStorage, token, header, session, proxy, or fingerprint
  value is present.
- [x] No screenshot, raw HTML, raw payload, private response body, HAR file, or
  stack trace is present.
- [x] Unavailable values were omitted rather than replaced with invented zeroes.
- [x] Temporary proxy eligibility bypass restored after samples.
- [ ] No durable runtime change: FACEBOOK_HOME_FEED_URL remains changed to the
      normal home URL pending Product Owner keep-or-revert decision.

## Acceptance Summary

```text
fiveSupportedBaselineRunsComplete: no
supportedBaselineSamplesRequired: V06-V10
runsSpanAtLeastTwoUtcDates: no
playwrightBaselineSatisfied: pending
atLeastThreeRunsYieldCandidates: yes (V01–V05 all yielded >=1)
atLeastTwoRunsYieldUsefulContent: yes (V01–V05)
allTerminalLeasesReleased: yes
zeroYieldOrFailuresExplained: not applicable (no zero-yield/failure among V01–V05)
duplicateMergeDemonstrated: yes
contentReviewUsable: yes
discoveredSourceReviewUsable: yes
eligibleGroupPromotedPaused: yes
safetyConfirmationComplete: exploratory packet safe; final baseline pending
unresolvedBlockingDefects: proxy-null profiles are not supported by standard checkout
acceptanceBlocker: Sprint 076A explicit direct-network correction and final V06-V10 baseline required
productOwnerDecision: PAUSED_FOR_SPRINT_076A
```

## Progress / Resume Notes

```text
resumeRequired: yes
resumeReason: final evidence must use standard checkout with an explicitly supported DIRECT profile
onResume: accept Sprint 076A first; count its clean direct-network proof as V06; run V07-V10 on a genuinely later UTC date; never reapply the proxy bypass
cloakhrowserSubstitution: not used
sprint076Accepted: no
sprint077Activated: no
contentBuilderStarted: no
committed: no
```
