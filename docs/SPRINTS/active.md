# Active Sprint

Sprint 076A — Supported Direct-Network Home-Feed Baseline is **active and
approved for Builder execution**.

The Product Owner chose explicit direct-network support. The correction adds a
persisted `UNCONFIGURED | DIRECT | PROXY` network mode so a no-proxy profile can
pass standard provisioning, checkout, trusted runtime configuration, and browser
launch without source edits or eligibility bypasses.

- [Sprint 076A - Supported Direct-Network Home-Feed Baseline](SPRINT-076A-supported-direct-network-home-feed.md)
- [Sprint 076B - Reviewable Discovered-Source Identity](SPRINT-076B-reviewable-discovered-source-identity.md)
- [Sprint 076 - Repeated Live Collector Validation](SPRINT-076-repeated-live-collector-validation.md)
- [Sprint 076 - Live Validation Evidence](SPRINT-076-live-validation-evidence.md)

Keep the normal Facebook home target `https://www.facebook.com/`; do not restore
the chronological `?sk=h_chr` override.

Sprint 076 is paused. Samples `V01`–`V05` proved useful exploratory behavior,
merge, and lease release, but they used a temporary proxy-eligibility bypass and
do not count as the supported-path acceptance baseline.

The Product Owner also found that Discovered Sources can present only an opaque
publisher ID, omit any review URL, and still enable Approve. Therefore the prior
exploratory source-review/promotion observation is not acceptance evidence.
Sprint 076B is shaped and approved as the next correction, but must not run
concurrently with active Sprint 076A.

After Sprint 076A is accepted, activate and complete Sprint 076B. Its manual
proof inspects one existing ID-only group through a safe supported Facebook link;
it does not count as the final Sprint 076 promotion proof.

After both corrections are accepted, resume Sprint 076:

- record Sprint 076A's clean direct-network Playwright proof as `V06`;
- complete supported-path samples `V07`–`V10` across a genuinely later UTC
  date;
- repeat discovered-source review and one approved-group promotion using the
  accepted reviewable-identity flow.

Sprint 075 — Real-Shape Home Feed Extractor Calibration is accepted.

Remaining Collector-completion sequence:

1. Complete and accept Sprint 076A.
2. Activate, complete, and accept Sprint 076B.
3. Resume and complete Sprint 076 supported-path live validation.
4. [Sprint 077 - Collector MVP Baseline Lock](SPRINT-077-collector-mvp-baseline-lock.md)

Content Builder remains parked until Sprint 077 locks the Collector operational
baseline.
