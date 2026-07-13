# Sprint 076 — Repeated Live Collector Validation

## Status

Planned. Do not activate until Sprint 075 is reviewed and accepted.

## Goal

Prove that the complete profile home-feed Collector loop is reliable, useful, explainable, and repeatable before moving product development to Content Builder.

## Validation Matrix

- At least five operator-driven live home-feed runs.
- Runs occur on more than one day.
- Preferably at least two provisioned profiles are used.
- Playwright is the contractual baseline provider.
- CloakBrowser may be recorded separately but does not replace baseline evidence unless explicitly approved.

## Required Flow

For every run:

1. Confirm the profile is eligible and authenticated.
2. Request or queue the profile-bound home-feed run.
3. Execute it through the existing bounded runner/worker path.
4. Inspect lifecycle, diagnostics, and lease release.
5. Inspect submitted or merged content items.
6. Review content usefulness.
7. Review observed discovered sources.
8. For at least one eligible approved Facebook group, verify promotion into a paused managed source group.

## Evidence Per Run

- Date and non-sensitive profile reference.
- Browser provider.
- Final status and duration.
- Safe capture, parse, extraction, rejection, publisher, submission, and merge counts.
- Number of content items judged useful.
- Duplicate/merge behavior when applicable.
- Lease-release result.
- Authentication/checkpoint observation when applicable.
- Failure and recovery notes without sensitive material.

## Acceptance Gate

- Eligible feeds repeatedly produce useful content.
- Zero-yield and failed runs are safely explainable.
- Duplicate posts do not create duplicate review items.
- Leases release on all exercised terminal paths.
- Content and discovered-source review are usable through the Web UI.
- Sensitive information is absent from logs, DTOs, fixtures, docs, and UI.
- No unresolved blocking defect remains in the normal home-feed-to-review loop.

## Failure Handling

Do not broaden Sprint 076 to fix substantial defects. Record evidence, stop acceptance, and create a narrow correction sprint targeting the lowest responsible layer. Repeat the affected validation after correction.

## Out of Scope

- New Collector features not required by validation.
- Autonomous operation as an acceptance requirement.
- Broad UI redesign.
- Content Builder or Content Publisher implementation.
- Production/public deployment hardening.

