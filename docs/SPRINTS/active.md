# Active Sprint

Sprint 076A — Supported Direct-Network Home-Feed Baseline is **active and
approved for Builder execution**.

The Product Owner chose explicit direct-network support. The correction adds a
persisted `UNCONFIGURED | DIRECT | PROXY` network mode so a no-proxy profile can
pass standard provisioning, checkout, trusted runtime configuration, and browser
launch without source edits or eligibility bypasses.

- [Sprint 076A - Supported Direct-Network Home-Feed Baseline](SPRINT-076A-supported-direct-network-home-feed.md)
- [Sprint 076 - Repeated Live Collector Validation](SPRINT-076-repeated-live-collector-validation.md)
- [Sprint 076 - Live Validation Evidence](SPRINT-076-live-validation-evidence.md)

Keep the normal Facebook home target `https://www.facebook.com/`; do not restore
the chronological `?sk=h_chr` override.

Sprint 076 is paused. Samples `V01`–`V05` proved useful exploratory behavior,
merge, review, promotion, and lease release, but they used a temporary
proxy-eligibility bypass and do not count as the supported-path acceptance
baseline.

After Sprint 076A automated verification, execute one clean Playwright run using
an explicitly configured `DIRECT` profile. If accepted, record it as `V06` and
resume Sprint 076 with supported-path samples `V07`–`V10` across a genuinely
later UTC date.

Sprint 075 — Real-Shape Home Feed Extractor Calibration is accepted.

Remaining Collector-completion sequence:

1. Complete and accept Sprint 076A.
2. Resume and complete Sprint 076 supported-path live validation.
3. [Sprint 077 - Collector MVP Baseline Lock](SPRINT-077-collector-mvp-baseline-lock.md)

Content Builder remains parked until Sprint 077 locks the Collector operational
baseline.
