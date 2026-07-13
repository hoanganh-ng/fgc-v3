# Active Sprint

Sprint 075 — Real-Shape Home Feed Extractor Calibration is **active; narrow
extractor calibration is implemented against the admitted fixture and awaits
Product Owner review**.

The goal is to use Sprint 074 diagnostics and a sanitized real-shape fixture to
reproduce one confirmed home-feed extraction gap, then make the smallest
extractor correction that restores eligible group/page post extraction without
weakening safety filters.

- [Sprint 075 - Real-Shape Home Feed Extractor Calibration](SPRINT-075-real-shape-home-feed-extractor-calibration.md)
- [Sprint 075A - Operator-Assisted Fixture Acquisition](SPRINT-075A-operator-assisted-fixture-acquisition.md)

Sprint 075A fixture acquisition is complete. The Builder has applied the narrow
Group-qualified GraphQL `id` publisher-identity calibration against the admitted
fixture. Keep Sprint 075 active until Product Owner review; do not activate
Sprint 076 yet.

If new safe diagnostics identify capture, checkout, lease, publisher
observation, or content submission as the exhausted stage, stop and
shape a narrow correction sprint at that layer instead of changing extraction.

Sprint 074 — Home Feed Extraction Diagnostics is accepted.

Remaining Collector-completion sequence:

1. Complete Sprint 075 Product Owner review.
2. [Sprint 076 - Repeated Live Collector Validation](SPRINT-076-repeated-live-collector-validation.md)
3. [Sprint 077 - Collector MVP Baseline Lock](SPRINT-077-collector-mvp-baseline-lock.md)

Content Builder remains parked until the Collector completion gate passes and
Sprint 077 locks the operational baseline.
