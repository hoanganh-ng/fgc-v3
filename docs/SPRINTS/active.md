# Active Sprint

Sprint 076B — Reviewable Discovered-Source Identity is **active and approved
for Builder execution**.

Sprint 076A — Supported Direct-Network Home-Feed Baseline is accepted. Commit
`f7a4970` implements the explicit `UNCONFIGURED | DIRECT | PROXY` contract, and
the supported Playwright DIRECT proof completed without a checkout bypass,
reached `HOME_FEED`, submitted six items, and released its lease.

- [Sprint 076A - Supported Direct-Network Home-Feed Baseline](SPRINT-076A-supported-direct-network-home-feed.md)
- [Sprint 076B - Reviewable Discovered-Source Identity](SPRINT-076B-reviewable-discovered-source-identity.md)
- [Sprint 076 - Repeated Live Collector Validation](SPRINT-076-repeated-live-collector-validation.md)
- [Sprint 076 - Live Validation Evidence](SPRINT-076-live-validation-evidence.md)

Keep the normal Facebook home target `https://www.facebook.com/`; do not restore
the chronological `?sk=h_chr` override.

Sprint 076 remains paused. Samples `V01`–`V05` proved useful exploratory
behavior, merge, and lease release, but they used a temporary proxy-eligibility
bypass and do not count as the supported-path acceptance baseline. Sprint
076A's clean DIRECT proof remains proposed `V06` until Sprint 076B is accepted.

The Product Owner also found that Discovered Sources can present only an opaque
publisher ID, omit any review URL, and still enable Approve. Therefore the prior
exploratory source-review/promotion observation is not acceptance evidence.
Sprint 076B now carries that correction. Its manual proof inspects one existing
ID-only group through a safe supported Facebook link; it does not count as the
final Sprint 076 promotion proof. `DESIGN.md` is visual context for the existing
admin design system and does not expand the sprint's behavior contract.

After Sprint 076B is accepted, resume Sprint 076:

- record Sprint 076A's clean direct-network Playwright proof as `V06`;
- complete supported-path samples `V07`–`V10` across a genuinely later UTC
  date;
- repeat discovered-source review and one approved-group promotion using the
  accepted reviewable-identity flow.

Sprint 075 — Real-Shape Home Feed Extractor Calibration is accepted.

Remaining Collector-completion sequence:

1. Complete and accept Sprint 076B.
2. Resume and complete Sprint 076 supported-path live validation.
3. [Sprint 077 - Collector MVP Baseline Lock](SPRINT-077-collector-mvp-baseline-lock.md)

Content Builder remains parked until Sprint 077 locks the Collector operational
baseline.
