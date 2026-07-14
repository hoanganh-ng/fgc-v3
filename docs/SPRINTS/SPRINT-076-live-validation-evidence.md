# Sprint 076 — Live Collector Validation Evidence

## Status

Execution approved; evidence intake active. Record safe aggregate facts only.
Awaiting baseline sample `V01`.

## Baseline Verification

```text
verifiedCommit:
typecheckCommand: pnpm typecheck
typecheckResult:
unitCommand: pnpm test
unitResult:
runtimeCodeChangedDuringSprint: no
```

## Validation Matrix

| Sample | UTC date | Profile alias | Provider | Status | Duration (s) | Captured | Extracted | Submitted | Useful | Lease released |
|---|---|---|---|---|---:|---:|---:|---:|---:|---|
| V01 |  | P1 | PLAYWRIGHT |  |  |  |  |  |  |  |
| V02 |  | P1 | PLAYWRIGHT |  |  |  |  |  |  |  |
| V03 |  |  | PLAYWRIGHT |  |  |  |  |  |  |  |
| V04 |  |  | PLAYWRIGHT |  |  |  |  |  |  |  |
| V05 |  |  | PLAYWRIGHT |  |  |  |  |  |  |  |

Use aliases only. Do not record real profile IDs, run IDs, account identities,
Facebook names, text, identifiers, or URLs.

## Per-Run Detail

Copy this block once for each sample and omit unavailable values.

```text
sample:
utcDate:
profileAlias:
provider: PLAYWRIGHT
terminalStatus:
durationSeconds:
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
existingRunSummary:
  capturedPayloads:
  extractorCandidates:
  sourcePublishersObserved:
  contentItemsSubmitted:
  failedPublisherObservations:
  failedContentSubmissions:
  leaseReleased:
contentReview:
  reviewedItemCount:
  usefulItemCount:
  usefulnessDecision: USEFUL | NOT_USEFUL | MIXED | NOT_REVIEWED
duplicateObservation:
  repeatedPostObserved: yes | no
  mergedWithoutDuplicateReviewItem: yes | no | not_applicable
discoveredSourceReview:
  reviewedCount:
  eligibleGroupObserved: yes | no
failureOrRecoveryClassification:
notes:
```

Notes must remain high level and contain no Facebook text, display names,
identifiers, raw URLs, or sensitive runtime data.

## Cross-Run Duplicate/Merge Evidence

```text
demonstratedBySamples:
repeatedPostObserved:
mergedWithoutDuplicateReviewItem:
verificationSurface: WEB_UI | SAFE_API
notes:
```

## Discovered-Source Promotion Evidence

```text
demonstratedBySample:
reviewedThroughWebUi:
eligibleGroupApproved:
promotionCompleted:
managedSourceInitialStatus: PAUSED
duplicateManagedSourcePrevented:
notes:
```

Do not record the group name, Facebook ID, source-group ID, or URL.

## Provider and Profile Coverage

```text
distinctUtcDates:
playwrightBaselineRunCount:
supplementaryCloakBrowserRunCount:
profileAliasesUsed:
secondProfileAvailable:
secondProfileException:
```

The second profile is preferred but not required. Five Playwright baseline runs
remain required unless Product Owner review explicitly approves a provider
exception.

## Safety Confirmation

- [ ] No real profile/account/viewer/run/post/group/source identifier is present.
- [ ] No Facebook name, post/comment text, or raw URL is present.
- [ ] No cookie, localStorage, token, header, session, proxy, or fingerprint
  value is present.
- [ ] No screenshot, raw HTML, raw payload, private response body, HAR file, or
  stack trace is present.
- [ ] Unavailable values were omitted rather than replaced with invented zeroes.
- [ ] Runtime code did not change during Sprint 076.

## Acceptance Summary

```text
fiveBaselineRunsComplete:
runsSpanAtLeastTwoUtcDates:
playwrightBaselineSatisfied:
atLeastThreeRunsYieldCandidates:
atLeastTwoRunsYieldUsefulContent:
allTerminalLeasesReleased:
zeroYieldOrFailuresExplained:
duplicateMergeDemonstrated:
contentReviewUsable:
discoveredSourceReviewUsable:
eligibleGroupPromotedPaused:
safetyConfirmationComplete:
unresolvedBlockingDefects:
productOwnerDecision: PENDING
```
