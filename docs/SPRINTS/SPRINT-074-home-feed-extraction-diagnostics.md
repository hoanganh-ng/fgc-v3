# Sprint 074 — Home Feed Extraction Diagnostics

## Status

Active, not accepted.

## Goal

Make every profile home-feed collection run explain its result safely before changing extractor behavior.

Sprint 074 should help an operator understand why a home-feed run produced zero or few candidates without exposing raw Facebook payloads, cookies, localStorage, tokens, headers, proxy credentials, viewer data, screenshots, or private runtime configuration.

## Context

Sprint 073 refocused the project around the Profile Feed Collector MVP. The next blocker is observability: profile home-feed runs can complete with zero candidates, but the operator cannot yet see enough safe diagnostics to distinguish capture failure, parser failure, extraction gating, unsupported publisher identity, sponsored/unsupported content, or normal low-yield feed behavior.

Known current behavior to preserve:

- Home-feed collection remains profile-bound.
- Facebook capture and extraction behavior must not change in this sprint.
- Diagnostics must be safe, aggregate, and operator-readable.
- Raw payloads and sensitive runtime data must remain internal and unexposed.

## Initial scope

Shape and implement safe diagnostics for profile home-feed collection runs, likely including:

- safe capture diagnostics already available from the capture buffer
- aggregated extractor warning codes or categories
- candidate/count summary fields that explain run yield
- safe persistence or safe run-summary exposure if needed
- Web UI rendering of diagnostics on profile feed run detail/list surfaces if supported by existing contracts

The exact implementation should be shaped before Builder handoff.

## Out of scope

- No Facebook extractor behavior changes.
- No browser capture behavior changes.
- No live Facebook validation claim.
- No raw payload persistence or raw diagnostic payload exposure.
- No profile checkout/leasing/account-stage changes.
- No Content Builder, Content Brief, Producer, artifact, LLM, or Content Publisher work.
- No broad UI redesign.

## Review focus

- Diagnostics are useful enough to explain zero-candidate runs.
- Diagnostics are aggregate and safe.
- Existing boundaries are preserved: Collector Runtime owns capture/execution details; Content Manager does not receive raw payloads.
- Any contract or persistence change is minimal and justified.
- Null-versus-omission behavior remains explicit.
