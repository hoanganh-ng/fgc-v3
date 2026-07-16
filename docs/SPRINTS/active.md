# Active Sprint

Sprint 077 — Collector MVP Baseline Lock is **active and approved for Builder
execution**.

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

Keep the normal Facebook home target `https://www.facebook.com/`; do not restore
the chronological `?sk=h_chr` override.

Sprint 077 is documentation and product-state lock only. Record the accepted
Collector baseline, supported operator smoke test, recovery guidance, provider
choice, regression fixtures, limitations, and maintenance boundary. Do not add
Collector behavior or begin Content Builder implementation.

Sprint 075 — Real-Shape Home Feed Extractor Calibration is accepted.

Remaining Collector-completion sequence:

1. Complete and accept Sprint 077.
2. Begin Architect-led Content Builder discovery from actual reviewed content.

Content Builder remains parked until Sprint 077 locks the Collector operational
baseline.
