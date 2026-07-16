# Active Sprint

Sprint 078 — Runtime Command Surface Consolidation is **active and approved
for Builder execution**.

Sprint 077 — Collector MVP Baseline Lock is accepted by the Product Owner on
2026-07-16. Commit `93cf205` created the permanent Collector baseline runbook,
and correction commit `1a7861d` made the canonical Playwright worker example
and supported `DIRECT | PROXY` sandbox wording explicit. The accepted change
is documentation-only; it adds no runtime behavior or new live-Facebook claim.

Sprint 076A — Supported Direct-Network Home-Feed Baseline is accepted. Commit
`f7a4970` implements the explicit `UNCONFIGURED | DIRECT | PROXY` contract, and
the supported Playwright DIRECT proof completed without a checkout bypass,
reached `HOME_FEED`, submitted six items, and released its lease.

Sprint 076B — Reviewable Discovered-Source Identity is accepted. Commits
`7c8fdd1` and `bc5c73d` implement the safe review-identity contract and ensure
unsafe persisted canonical URLs are neither clickable nor selected as
promotion defaults. On 2026-07-15 the Product Owner recognized one existing
ID-only group through the safe link, approved it, confirmed `APPROVED`, and
confirmed the safe promotion default without promoting it. No sensitive
evidence was recorded.

Sprint 076 — Repeated Live Collector Validation is accepted at evidence commit
`109ee4c`. Supported samples `V06`–`V10` span UTC dates 2026-07-14 and
2026-07-16. Four runs succeeded with candidates; three were judged useful; the
natural `CHECKOUT_COOLDOWN` failure acquired no lease; all acquired leases were
released; supported-path duplicate merge and safe paused-group promotion were
proven. No unresolved Collector blocker remains.

- [Sprint 076A - Supported Direct-Network Home-Feed Baseline](SPRINT-076A-supported-direct-network-home-feed.md)
- [Sprint 076B - Reviewable Discovered-Source Identity](SPRINT-076B-reviewable-discovered-source-identity.md)
- [Sprint 076 - Repeated Live Collector Validation](SPRINT-076-repeated-live-collector-validation.md)
- [Sprint 076 - Live Validation Evidence](SPRINT-076-live-validation-evidence.md)
- [Sprint 077 - Collector MVP Baseline Lock](SPRINT-077-collector-mvp-baseline-lock.md)
- [Sprint 078 - Runtime Command Surface Consolidation](SPRINT-078-runtime-command-surface-consolidation.md)

Keep the normal Facebook home target `https://www.facebook.com/`; do not restore
the chronological `?sk=h_chr` override.

Sprint 078 is one bounded tooling cleanup before Content Builder discovery.
Preserve the locked Collector commands and exact Compose behavior while
replacing the repetitive stack service/action alias matrix with one typed,
validated command surface. Do not change Collector behavior, Compose service
definitions, browser/network/profile configuration, or accepted evidence.

Sprint 075 — Real-Shape Home Feed Extractor Calibration is accepted.

Immediate delivery sequence:

1. Complete and accept Sprint 078.
2. Begin Architect-led Content Builder discovery from actual reviewed content.

The Collector baseline is locked and maintenance-only. Content Builder remains
parked only for this bounded command-surface cleanup; Sprint 078 must not invent
or implement Content Builder behavior.
