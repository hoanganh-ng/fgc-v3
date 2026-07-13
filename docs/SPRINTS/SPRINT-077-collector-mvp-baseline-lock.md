# Sprint 077 — Collector MVP Baseline Lock

## Status

Planned. Activate only after Sprint 076 passes the Collector Completion Gate.

## Goal

Lock the proven profile home-feed Collector as a stable upstream baseline and prepare the project to move to Content Builder without unnecessary Collector expansion.

## Requirements

- Record the supported operator flow and accepted live-validation evidence.
- Record the supported browser-provider baseline and status of experimental providers.
- Preserve sanitized regression fixtures derived from validated shapes.
- Document a short manual smoke-test procedure.
- Record known Facebook/platform limitations and likely drift points.
- Record recovery steps for authentication loss, checkpoint observation, browser failure, zero-yield runs, and interrupted leases.
- Confirm the Web UI path for run request, diagnostics, content review, discovered-source review, and group promotion.
- Mark Collector expansion as maintenance-only unless a real defect or approved requirement appears.
- Make Content Builder discovery the next product activity.

## Out of Scope

- New extraction features.
- New scheduler or worker capabilities.
- Public production deployment.
- Removal of historical migrations or parked modules.
- Content Builder implementation beyond preparing its discovery handoff.

## Completion Result

The Collector is treated as a working source of normalized, reviewed content. The next sprint shapes the smallest useful Content Builder workflow from actual selected content and observed operator needs.

