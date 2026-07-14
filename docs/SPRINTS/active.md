# Active Sprint

Sprint 076 — Repeated Live Collector Validation is **active**.

The goal is to prove that the complete Facebook profile home-feed-to-review loop
is reliable, useful, explainable, and repeatable before locking the Collector
baseline and moving product work to Content Builder.

- [Sprint 076 - Repeated Live Collector Validation](SPRINT-076-repeated-live-collector-validation.md)
- [Sprint 076 - Live Validation Evidence](SPRINT-076-live-validation-evidence.md)

Sprint 075 — Real-Shape Home Feed Extractor Calibration is accepted at
implementation commit `0932eba`. The admitted fixture extracts one expected
`GROUP` candidate, off-path GraphQL ids remain rejected, the focused extractor
suite passes 23/23, and the repeated live run improved from zero to five
candidates with five submissions.

Sprint 076 is validation-only. Complete five Playwright baseline runs across at
least two UTC dates, record only safe aggregate evidence, verify useful content,
duplicate merging, lease release, discovered-source review, and one approved
group promotion. Do not change runtime code inside this sprint.

If validation reveals a blocking defect, stop the affected acceptance claim and
shape a narrow correction sprint at the lowest responsible layer.

Remaining Collector-completion sequence:

1. Complete Sprint 076 repeated live validation.
2. [Sprint 077 - Collector MVP Baseline Lock](SPRINT-077-collector-mvp-baseline-lock.md)

Content Builder remains parked until Sprint 077 locks the Collector operational
baseline.
