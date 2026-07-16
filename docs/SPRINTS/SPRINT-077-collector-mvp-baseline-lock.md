# Sprint 077 — Collector MVP Baseline Lock

## Status

Active and approved for Builder execution. Sprint 076 was accepted by the
Product Owner on 2026-07-16 at evidence commit `109ee4c`.

## Goal

Lock the proven Facebook profile home-feed Collector as a stable, documented
upstream source and prepare the project to move to Content Builder discovery
without expanding Collector behavior.

## Capability Summary

> An operator has one permanent, safe runbook for the accepted Collector
> baseline: supported configuration and provider, bounded manual smoke test,
> Web UI review path, recovery decisions, regression fixtures, known
> limitations, and the maintenance-only boundary. The runbook is grounded in
> accepted `V06`–`V10` evidence and existing commands; it introduces no runtime
> behavior.

## Required Context

Read only:

- `AGENTS.md`;
- `docs/SPRINTS/active.md`;
- this sprint;
- `docs/SPRINTS/SPRINT-076-repeated-live-collector-validation.md`;
- `docs/SPRINTS/SPRINT-076-live-validation-evidence.md`;
- `docs/PROJECT_SNAPSHOT.md`;
- `docs/ROADMAP.md`;
- `docs/RUNTIME.md`;
- `docs/TESTING_STRATEGY.md`;
- `docs/modules/collector-profile-manager.md`;
- `docs/modules/collector-runtime.md`;
- `docs/modules/content-manager.md`;
- `docs/modules/operator-tools-and-infrastructure.md`;
- `docs/modules/web-ui.md`;
- `README.md` command sections;
- `package.json` scripts;
- the CLI argument/usage files directly responsible for the canonical
  profile-home-feed runner and worker commands;
- the admitted sanitized real-shape home-feed fixture and its safety note;
- directly related extractor, execution, diagnostics, source-review, and E2E
  tests only when needed to verify a documented regression claim.

Do not scan historical sprints other than the explicitly listed Sprint 076
documents. Do not inspect unrelated modules.

## Deliverables

### Canonical baseline document

Create `docs/COLLECTOR_BASELINE.md` as the permanent Collector operator and
maintenance reference. It must contain:

1. **Scope and evidence**
   - State that the accepted product baseline is Facebook profile home-feed
     collection into normalized Content Manager items.
   - Link to the accepted Sprint 076 evidence; summarize safe aggregate outcomes
     without copying live identifiers, names, text, or URLs.
   - Distinguish the accepted baseline from exploratory `V01`–`V05`.

2. **Supported baseline**
   - Browser provider: Playwright is contractual for the accepted baseline.
   - Network mode: explicit `DIRECT` is the live-proven mode; `PROXY` remains a
     supported product configuration but was not the Sprint 076 live baseline.
   - Target: normal `https://www.facebook.com/`; the chronological
     `?sk=h_chr` override is retired.
   - Profile preconditions: provisioned session, `READY`, `HEALTHY`,
     `COLLECTION_READY`, no active lease, and cooldown satisfied.
   - CloakBrowser remains experimental/supplementary and is not an accepted
     substitute for the Playwright baseline.

3. **Operator flow**
   - Record the current supported Web UI/API request surface and the exact
     canonical runner or worker command already present in the repository.
   - Cover run request, bounded execution, terminal diagnostics, content
     review, safe discovered-source inspection/approval, and eligible group
     promotion into a paused managed source.
   - Do not invent a UI action or command. Verify every name against current
     source and scripts.

4. **Manual smoke test**
   - Provide a short numbered procedure that an operator can execute against an
     already logged-in eligible profile.
   - Include expected safe observations and stop conditions, not real IDs,
     Facebook content, credentials, or screenshots.
   - Keep execution inside existing bounds. Do not authorize credential entry,
     session manipulation, source edits, bypasses, or repeated activity merely
     to manufacture evidence.

5. **Recovery matrix**
   - Authentication loss or login redirect.
   - Facebook checkpoint/review-required observation.
   - Browser/provider launch or capture failure.
   - Explained zero-yield/low-yield extraction.
   - Checkout cooldown.
   - Interrupted execution or lease-release failure.
   - For each case, name only an existing supported operator path. If recovery
     is not implemented, state the limitation and safe escalation point rather
     than inventing a command or database repair.

6. **Regression anchors and drift points**
   - List the admitted sanitized real-shape fixture and the smallest directly
     relevant test suites protecting capture, extraction, diagnostics,
     deduplication, safe review identity, lease release, and the E2E flow.
   - Record likely Facebook drift points: GraphQL payload shape, qualified
     publisher identity paths, post identity, login/checkpoint page state, and
     candidate yield.
   - Require new diagnostics plus a sanitized fixture before future extractor
     widening.

7. **Known limitations**
   - Only one profile participated in the accepted live baseline.
   - Direct networking, not proxy networking, was live-proven in Sprint 076.
   - ID-only Page destinations are not guessed and remain non-reviewable until
     a safe canonical URL is observed.
   - Facebook yield and payload shapes may change.
   - Production/VPS deployment and multi-profile scale are not proven by this
     baseline.
   - Record any additional limitation demonstrated by current source or
     accepted evidence; do not speculate.

8. **Maintenance boundary and downstream handoff**
   - Collector feature expansion is parked. Reopen it only for a reproduced
     defect, platform drift backed by safe diagnostics/fixture evidence, or an
     explicitly approved product requirement.
   - Content Builder discovery is the next product activity, starting from
     actual reviewed content and existing Content Manager contracts.
   - Do not activate an old parked Content Builder sprint automatically.

### Existing documentation alignment

- Add a concise pointer to `docs/COLLECTOR_BASELINE.md` from `README.md` and
  `docs/RUNTIME.md`; avoid duplicating the full runbook.
- Align `docs/modules/collector-runtime.md`,
  `docs/modules/content-manager.md`, and `docs/modules/web-ui.md` with the
  accepted boundary and link to the baseline document.
- Update `docs/TESTING_STRATEGY.md` only as needed to point to the accepted
  regression anchors; do not broaden the test strategy.
- Preserve `docs/PROJECT_SNAPSHOT.md`, `docs/ROADMAP.md`, and the active sprint
  pointer as Architect-owned status documents. Do not advance them.

## No-Change Boundary

This sprint is documentation-only.

Do not change:

- application or test code;
- schemas, migrations, DTOs, routes, workers, schedulers, or browser behavior;
- dependencies, package scripts, Compose files, environment defaults, provider
  defaults, home-feed URL, execution bounds, or profile state;
- accepted fixtures or live evidence;
- Content Builder implementation.

Do not run another live Facebook collection merely to write the runbook.

## Safety

Do not add cookies, localStorage values, tokens, headers, session/viewer data,
proxy credentials, fingerprint values, raw payloads, raw HTML, screenshots,
private response bodies, Facebook post text, real profile/source/post/group IDs,
live Facebook names, or live destination URLs.

The fixed generic target `https://www.facebook.com/`, synthetic fixture values,
safe command names, aggregate accepted counts, and non-sensitive profile alias
`P1` are allowed.

## Verification

Run and report:

```bash
pnpm typecheck
pnpm test
git diff --check
```

Also verify manually that:

- every documented command exists in `package.json` or the owning CLI usage;
- every internal Markdown link resolves to an existing repository file;
- the baseline document contains no prohibited evidence;
- no file outside the documentation scope changed.

Do not claim a live smoke test was executed; this sprint writes the procedure
and relies on accepted Sprint 076 live evidence.

## Acceptance Gate

Sprint 077 is complete only when:

- `docs/COLLECTOR_BASELINE.md` contains all eight required sections;
- provider, network, target, preconditions, operator flow, and smoke-test steps
  match current source and accepted evidence;
- recovery guidance distinguishes supported actions from unimplemented
  limitations and never recommends database mutation or bypasses;
- regression anchors and Facebook drift points are explicit and fixture-safe;
- the one-profile/direct-network/deployment/Page-review limitations are
  recorded;
- README, runtime, module, and testing-strategy pointers are consistent;
- Collector expansion is explicitly maintenance-only and Content Builder
  discovery is named as the next activity;
- no runtime, test, configuration, dependency, fixture, or evidence file
  changed;
- required verification passes;
- the Product Owner accepts the baseline lock.

## Stop Conditions

Stop and report instead of expanding scope when:

- a documented command or UI path cannot be confirmed from current source;
- recovery would require an unimplemented command, database repair, bypass, or
  runtime change;
- current docs conflict with accepted Sprint 076 evidence in a way that cannot
  be resolved by documentation alone;
- sensitive live material is found in a proposed deliverable;
- a Collector defect is discovered;
- Content Builder requirements would need to be invented.

## Builder Handoff Prompt

Implement Sprint 077 — Collector MVP Baseline Lock from
`docs/SPRINTS/SPRINT-077-collector-mvp-baseline-lock.md`.

This is documentation-only. Create `docs/COLLECTOR_BASELINE.md`, add concise
pointers from the approved existing docs, and faithfully record the supported
Playwright/DIRECT/normal-home baseline, operator flow, smoke test, recovery
matrix, regression anchors, limitations, and maintenance boundary. Verify every
command and UI path against current source. Do not execute another live
Facebook run.

Run the required verification and return the files changed, command/link audit,
verification results, and any stop condition. Do not change runtime/test/config
files, accepted fixtures, or evidence. Do not accept Sprint 077, advance the
active pointer, activate a Content Builder sprint, or begin implementation.
