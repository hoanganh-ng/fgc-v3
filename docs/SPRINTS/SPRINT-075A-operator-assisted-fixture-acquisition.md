# Sprint 075A — Operator-Assisted Home-Feed Fixture Acquisition

## Status

Complete. The bounded evidence-acquisition phase produced the sanitized
real-shape fixture in commit `765ccad`; Architect review admitted it for narrow
Sprint 075 extractor calibration. This remains a supporting phase, not a new
roadmap sprint.

## User Authorization

The Product Owner authorizes the Builder to use the existing local development
stack and the already logged-in Facebook collector profile for one headed
home-feed collection session whose only purpose is to identify and sanitize the
payload topology for the extraction gap recorded in
[`SPRINT-075-home-feed-calibration-evidence.md`](SPRINT-075-home-feed-calibration-evidence.md).

This authorization does not permit credential entry, session reprovisioning,
account-stage changes, group joining, posting, reacting, commenting, messaging,
or any other Facebook action beyond the existing home-feed collection behavior.

## Goal

Produce one minimal, deterministic, sanitized fixture that preserves the exact
object/array topology and field paths needed to reproduce the confirmed
eligible group text-post extraction failure.

## Capability Summary

> Using the existing dev stack and logged-in profile, the Builder may perform
> one operator-assisted headed capture, inspect the minimum relevant response
> only inside the operator-controlled environment, sanitize it before it enters
> the repository, and hand back a fixture-admission report.

This phase does not authorize an extractor change.

## Required Context

Read only:

- `AGENTS.md`;
- `docs/SPRINTS/active.md`;
- this handoff;
- `docs/SPRINTS/SPRINT-075-real-shape-home-feed-extractor-calibration.md`;
- `docs/SPRINTS/SPRINT-075-home-feed-calibration-evidence.md`;
- `docs/modules/collector-runtime.md`;
- `docs/TESTING_STRATEGY.md`;
- the existing headed home-feed runner command and directly related runner
  configuration;
- `src/collector-runtime/platform-extractors/facebook/__fixtures__/index.ts`;
- nearby fixture files and fixture-safety tests;
- the Facebook home-feed extractor types and focused extractor test only as
  needed to understand the expected fixture shape.

Do not scan unrelated modules or historical sprints.

## Preconditions

Before starting, confirm:

- the dev stack is running;
- the selected profile is already logged in;
- no credential, cookie, token, proxy, fingerprint, or session value needs to
  be printed or copied;
- the existing headed command can run without changing tracked capture code;
- the worktree state is recorded and user changes will be preserved.

If any precondition fails, stop and report.

## Execution Procedure

1. Record `git status --short`.
2. Start the existing headed home-feed collector against the already logged-in
   profile. Do not reprovision or alter the profile.
3. Confirm visually that one eligible, non-sponsored text post from a configured
   group is present.
4. Identify the smallest GraphQL/XHR response branch associated with that post.
   Prefer inspection in memory or browser DevTools.
5. If temporary persistence is unavoidable, write only to a git-ignored or
   outside-repository file with owner-only permissions. Never print the raw
   response to the terminal, test output, application logs, chat, or a report.
6. Construct a new fixture by retaining only topology and field paths necessary
   to reproduce the extraction behavior.
7. Replace every post, group, publisher, actor, feedback, comment, viewer, and
   other identifier with deterministic fixture values.
8. Replace all body/comment text with clearly synthetic text. Replace required
   URLs with deterministic non-private fixture URLs; otherwise omit them.
9. Remove cookies, localStorage, tokens, headers, session data, viewer/account
   data, tracking values, proxy/fingerprint values, unrelated branches, raw
   HTML, screenshots, and stack traces.
10. Add a nearby sanitization note describing only the structural behavior
    represented and confirming that no raw/private values remain.
11. Run the repository's existing fixture-safety assertions and manually inspect
    the complete diff.
12. Verify the unchanged extractor produces zero candidates or the diagnosed
    warning behavior for this fixture. A focused failing regression test may be
    added, but do not change extractor implementation.
13. Securely delete any temporary raw response after the sanitized fixture has
    been verified. Confirm it is absent from the repository, Git index, console
    output, test artifacts, and reports.
14. Stop and return the Fixture Admission Report below.

## Allowed Changes

Only:

- one sanitized fixture under
  `src/collector-runtime/platform-extractors/facebook/__fixtures__/`;
- the fixture index if required;
- one focused extractor regression test that demonstrates the existing failure;
- a sanitization note beside the fixture;
- the Sanitized Fixture Admission section of the Sprint 075 evidence worksheet.

## Prohibited Changes

Do not change:

- extractor implementation;
- browser capture, navigation, interception, or payload framing;
- diagnostics contracts;
- run execution;
- checkout, leases, readiness, authentication health, or provisioning;
- database, HTTP, Web UI, workers, schedulers, or downstream ingestion;
- Content Manager or Content Builder.

Do not commit or push unless the Product Owner separately asks for publication.

## Verification

Run the narrowest existing fixture-safety checks discovered in Required Context,
then run:

```bash
pnpm exec vitest run src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.test.ts
pnpm typecheck
```

The focused test is expected to fail only for the diagnosed extraction gap. If
unrelated tests fail, report them without broadening scope. Full `pnpm test`
belongs to the implementation phase after fixture admission.

## Fixture Admission Report

Return exactly:

```text
headedRunCompleted:
eligibleConfiguredGroupPostObserved:
fixturePath:
sanitizationNotePath:
structuralPathsPreserved:
unchangedExtractorResult:
diagnosedWarnings:
fixtureSafetyCommand:
fixtureSafetyResult:
focusedTestCommand:
focusedTestResult:
typecheckResult:
temporaryRawArtifactDeleted:
gitStatus:
filesChanged:
stopConditionEncountered:
```

Do not include a run ID, profile ID, account/viewer identifier, raw URL, raw
Facebook text, payload excerpt, screenshot, cookie, token, header, session
value, proxy/fingerprint value, or stack trace.

## Acceptance Gate

This acquisition phase is complete only when:

- one eligible configured-group text post was visibly confirmed;
- one minimal sanitized fixture reproduces the diagnosed failure;
- every identifier and text value is deterministic and synthetic;
- fixture-safety assertions pass;
- no prohibited data appears anywhere in the diff or report;
- any temporary raw artifact is deleted;
- no extractor or capture implementation changed;
- the Fixture Admission Report is complete.

Architect/Product Owner review must admit the fixture before the Builder
continues with Sprint 075 extractor calibration.

## Stop Conditions

Stop and report if:

- using the logged-in profile requires credential entry or reprovisioning;
- a relevant response cannot be isolated without a tracked capture change;
- the failure cannot be reproduced without retaining raw/private material;
- the observed eligible post belongs to a personal profile or is sponsored;
- more than one unrelated payload family is required;
- sanitization cannot be verified;
- any change outside Allowed Changes appears necessary.

## Builder Handoff Prompt

Execute `docs/SPRINTS/SPRINT-075A-operator-assisted-fixture-acquisition.md`
only.

Use the existing local dev stack and already logged-in profile for one headed
home-feed run. Produce the smallest sanitized fixture that reproduces the
confirmed configured-group text-post extraction gap. Keep raw response material
inside the operator-controlled environment, never print or commit it, and
delete any temporary raw artifact after sanitization.

You may add the sanitized fixture, its sanitization note, fixture-index wiring,
and one focused failing regression test. Do not change the extractor or any
capture/runtime/downstream implementation. Run the required safety and focused
verification, complete the Fixture Admission Report, then stop for review.
