# Sprint 076 — Repeated Live Collector Validation

## Status

Paused while Sprint 076A implements explicit direct-network support and Sprint
076B then makes discovered-source approval reviewable. Samples `V01`–`V05`
are retained as exploratory evidence but do not count as the final
supported-path baseline because they used a temporary proxy-eligibility bypass.
The earlier source approval/promotion also does not count because the UI exposed
only an opaque publisher ID with no review URL.

## Goal

Prove that the complete Facebook profile home-feed Collector loop is reliable,
useful, explainable, and repeatable before the Collector baseline is locked and
product work moves to Content Builder.

## Capability Summary

> An operator can repeatedly run the existing profile home-feed collector,
> inspect safe diagnostics, review useful normalized content and discovered
> sources, verify duplicate merging and lease release, and promote one approved
> group source without database access or sensitive-data exposure.

## Required Context

Read only:

- `AGENTS.md`;
- `docs/SPRINTS/active.md`;
- this sprint;
- `docs/SPRINTS/SPRINT-076-live-validation-evidence.md`;
- `docs/PROJECT_SNAPSHOT.md`;
- `docs/ROADMAP.md`;
- `docs/modules/collector-runtime.md`;
- `docs/TESTING_STRATEGY.md`;
- the existing operator documentation for the profile home-feed runner;
- the existing Web UI pages for home-feed runs, content review, discovered
  sources, and source-group promotion;
- directly related configuration only when required to execute the existing
  flow.

Do not scan unrelated modules or historical sprints.

## Product Owner Execution Approval

The Product Owner authorizes the Builder to execute this validation against the
existing local development stack and already logged-in eligible profile.

This approval permits:

- running the accepted baseline verification commands;
- executing the existing bounded Playwright home-feed flow;
- using supported Web UI/API surfaces for review and promotion;
- updating only the safe Sprint 076 evidence worksheet;
- pausing after same-day samples and resuming on a genuinely later UTC date.

This approval does not permit credential entry, reprovisioning, profile-state
bypasses, temporary runtime patches, provider-default changes, execution-bound
changes, application/test changes, fabricated dates, or fabricated evidence.

The Builder must not commit or push unless the Product Owner separately asks.

## Preconditions

Before each run:

- the development stack is healthy;
- the selected profile is already provisioned, authenticated, and collection
  eligible;
- the profile is not actively leased;
- execution remains within its configured safety and collection bounds;
- no credential, cookie, token, proxy, fingerprint, raw payload, or viewer data
  will be printed, copied into evidence, or committed.

A stale or unhealthy profile must be handled through existing supported profile
flows. This sprint does not authorize readiness, authentication, or provisioning
changes.

## Required Validation Matrix

After Sprint 076A and Sprint 076B acceptance, the final acceptance packet
contains five supported-path baseline runs:

- exactly five numbered baseline samples, `V06` through `V10`;
- `V06` is the clean direct-network live proof from accepted Sprint 076A;
- `V07` through `V10` run on at least one genuinely later UTC calendar date,
  so the final baseline spans at least two distinct UTC dates;
- all five samples use an explicitly configured `DIRECT` profile, the normal
  `https://www.facebook.com/` target, standard checkout, and the contractual
  Playwright provider with no temporary source edits or bypasses;
- at least one already provisioned profile is required;
- a second profile should be used when safely available, but its absence is not
  an acceptance blocker when documented;
- CloakBrowser runs may be recorded as supplementary evidence but do not replace
  `V06` through `V10` without a separate Product Owner provider decision;
- at least three baseline runs must succeed with one or more extracted
  candidates;
- at least two baseline runs must contain one or more items the Product Owner
  judges useful for future Content Builder input;
- every exercised terminal run must release its lease;
- at least one repeated post must demonstrate merge/deduplication rather than a
  duplicate review item;
- at least one eligible discovered Facebook group must be reviewed, approved,
  and promoted into a paused managed source group through supported UI/API
  behavior.

Do not deliberately create failures, authentication challenges, or unsafe
activity merely to populate the matrix. Naturally occurring zero-yield or
failed runs are valid evidence when diagnostics explain them.

## Procedure Per Baseline Run

1. Assign the next supported-path sample reference, `V06` through `V10`.
2. Record the UTC date, provider, and a non-sensitive profile alias such as
   `P1`; never record the real profile ID or account identity.
3. Request or queue the profile-bound home-feed run through the existing
   supported flow.
4. Execute it through the existing bounded runner or worker path without
   changing execution bounds.
5. Inspect terminal status, duration, safe Sprint 074 diagnostics, existing run
   summary, and lease release.
6. In the Web UI, inspect submitted or merged content items. Record counts only
   and a Product Owner usefulness judgment; do not copy Facebook text or URLs.
7. Inspect discovered-source observations. Record counts/status only.
8. When a repeated post is encountered, verify it merges into the existing
   content item rather than creating a duplicate review item.
9. For one eligible approved group during the sprint, verify promotion into a
   paused managed source group.
10. Complete the corresponding evidence row and per-run detail block before the
    next run.

## Safe Evidence Contract

Complete
[`SPRINT-076-live-validation-evidence.md`](SPRINT-076-live-validation-evidence.md).

Allowed evidence:

- safe sample references and profile aliases;
- UTC dates, provider names, status, and duration;
- aggregate capture/extraction/warning/publisher/submission counts;
- lease-release result;
- counts of reviewed/useful items;
- duplicate/merge observation;
- discovered-source review and promotion status;
- high-level failure/recovery classification.

Prohibited evidence:

- profile, account, viewer, run, post, group, or source identifiers;
- Facebook display names, post text, comment text, or raw URLs;
- cookies, localStorage, tokens, headers, session data, proxy/fingerprint values;
- screenshots, raw HTML, raw payloads, private response bodies, HAR files, or
  stack traces.

Omit unavailable values rather than inventing zeroes.

## No-Change Rule

Sprint 076 is validation-only. Do not change runtime code, tests, schemas,
migrations, HTTP contracts, UI behavior, workers, schedulers, execution bounds,
profile state, or provider defaults.

Documentation may be updated only to record the safe worksheet and final review
decision.

If validation exposes a blocking defect, stop the affected acceptance claim,
classify the lowest responsible layer from diagnostics, and request a narrow
correction sprint. Do not fix the defect inside Sprint 076.

## Verification

Before the first baseline run, confirm the accepted baseline remains green:

```bash
pnpm typecheck
pnpm test
```

Record exact totals in the worksheet. These commands need not be repeated before
every run unless the repository changes.

Manual live evidence is not an automated-test result.

## Acceptance Gate

Sprint 076 is complete only when:

- supported-path rows `V06` through `V10` are complete across at least two UTC dates;
- the provider and profile requirements are satisfied or the optional second
  profile absence is explicitly documented;
- at least three runs yield candidates and at least two yield useful content;
- zero-yield or failed outcomes, if any, are safely explained;
- every exercised terminal run releases its lease;
- duplicate/merge behavior is demonstrated once without duplicate review items;
- content review is usable through the Web UI;
- every approval candidate used for evidence has a safe review link and is
  identifiable through the accepted Sprint 076B flow;
- one eligible reviewed-and-approved Facebook group is promoted to a paused
  managed source;
- no sensitive material appears in evidence, logs, DTOs, fixtures, docs, or UI;
- no unresolved blocking defect remains in the normal home-feed-to-review loop;
- Product Owner review accepts the completed worksheet.

## Stop Conditions

Stop and report instead of continuing when:

- Playwright cannot execute the contractual baseline because of a repeatable
  provider-specific blocker;
- a profile requires unsupported credential or session manipulation;
- a lease fails to release;
- duplicate posts create duplicate review items;
- submitted content or discovered sources cannot be reviewed through supported
  UI/API behavior;
- promotion cannot complete through the existing supported flow;
- diagnostics cannot explain a zero-yield or failure outcome;
- any sensitive data appears in output or evidence;
- a runtime or product change is required.

## Product Owner Handoff

Return:

- the completed safe evidence worksheet;
- exact `pnpm typecheck` and `pnpm test` results;
- the five baseline sample outcomes;
- the duplicate/merge observation;
- the discovered-source review and promotion result;
- any stop condition or provider exception;
- confirmation that no runtime code changed.

Do not mark Sprint 076 accepted, activate Sprint 077, or begin Content Builder.

## Builder Handoff Prompt

Do not execute this handoff until Sprint 076A and Sprint 076B are accepted and
the active pointer returns to Sprint 076.

Then execute Sprint 076 — Repeated Live Collector Validation from
`docs/SPRINTS/SPRINT-076-repeated-live-collector-validation.md`.

Use the existing local dev stack and already logged-in eligible profile. Load
only Required Context. Confirm the accepted baseline with `pnpm typecheck` and
`pnpm test`, then complete the supported-path Playwright baseline samples `V06` through
`V10` across at least two genuine UTC dates. Use only an explicitly configured
`DIRECT` profile and standard checkout; no source edits or bypasses. Review
and approve discovered groups only through the accepted Sprint 076B safe review
link flow.

After every sample, update
`docs/SPRINTS/SPRINT-076-live-validation-evidence.md` with safe aggregate facts
only. Review content and discovered sources through supported UI/API behavior.
Demonstrate one duplicate merge and one approved eligible-group promotion into a
paused managed source group.

Do not use CloakBrowser as a substitute for a baseline sample. Do not change
runtime code, tests, configuration defaults, execution bounds, profile state, or
authentication behavior. If a stop condition occurs, record the safe facts and
stop instead of fixing it.

If all samples cannot truthfully be completed today, stop with a progress report
and resume on a later UTC date. Do not invent date coverage. Do not commit or
push. Return the worksheet diff and Product Owner Handoff when complete; do not
accept Sprint 076 or activate Sprint 077.
