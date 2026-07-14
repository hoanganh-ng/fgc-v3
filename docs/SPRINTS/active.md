# Active Sprint

Sprint 076 — Repeated Live Collector Validation is **active and approved for
Builder execution**.

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

- [Sprint 076A - Supported Direct-Network Home-Feed Baseline](SPRINT-076A-supported-direct-network-home-feed.md)
- [Sprint 076B - Reviewable Discovered-Source Identity](SPRINT-076B-reviewable-discovered-source-identity.md)
- [Sprint 076 - Repeated Live Collector Validation](SPRINT-076-repeated-live-collector-validation.md)
- [Sprint 076 - Live Validation Evidence](SPRINT-076-live-validation-evidence.md)

Keep the normal Facebook home target `https://www.facebook.com/`; do not restore
the chronological `?sk=h_chr` override.

Samples `V01`–`V05` proved useful exploratory
behavior, merge, and lease release, but they used a temporary proxy-eligibility
bypass and do not count as the supported-path acceptance baseline. Sprint
076A's clean DIRECT proof now counts as `V06`.

Complete supported-path samples `V07`–`V10` across a genuinely later UTC date
using the accepted DIRECT and review-identity paths. Demonstrate the remaining
usefulness, duplicate-merge, lease-release, and promotion gates. The Sprint
076B approval proves reviewability but does not replace Sprint 076's required
promotion of one eligible approved group into a paused managed source.

Sprint 075 — Real-Shape Home Feed Extractor Calibration is accepted.

Remaining Collector-completion sequence:

1. Complete and accept Sprint 076 supported-path live validation.
2. [Sprint 077 - Collector MVP Baseline Lock](SPRINT-077-collector-mvp-baseline-lock.md)

Content Builder remains parked until Sprint 077 locks the Collector operational
baseline.
