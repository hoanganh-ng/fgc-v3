# Active Sprint

No Builder implementation sprint is active. The next activity is
Architect-led Content Builder workflow discovery from actual reviewed content;
it must be shaped before another Builder handoff.

Sprint 079 — Codebase Changeability Baseline is accepted by the Product Owner
on 2026-07-17. Commits `fc56bb1` and `99e948c` split the Web and server
Collector Runtime HTTP boundaries; corrections `5a84070` and `781b53d` make
import/re-export cycle guards truthful, correct change-map metrics, and preserve
the original Web build contract. Twenty-six routes, 141 Web public exports, all
server compatibility exports, and the exact 35-script command surface remain
locked. Architecture and all six module references now describe current
ownership instead of sprint history.

Sprint 078 — Runtime Command Surface Consolidation is accepted at commit
`28bd08c`. The root manifest now exposes exactly 35 scripts instead of 69: one
typed `stack:service` CLI replaces 34 repetitive service/action aliases, the
unused `test:e2e:container` alias is removed, and all six lifecycle and 13
canonical operator commands remain stable. Exact Compose parity, strict input
validation, no-shell process launch, failure propagation, both Compose
configurations, typecheck, 2,006 tests, help output, and whitespace checks
passed. Collector runtime behavior did not change.

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
- [Sprint 079 - Codebase Changeability Baseline](SPRINT-079-codebase-changeability-baseline.md)

Keep the normal Facebook home target `https://www.facebook.com/`; do not restore
the chronological `?sk=h_chr` override.

The Collector and changeability baselines are locked. Do not implement another
cleanup slice from `docs/CODEBASE_CHANGE_MAP.md`; it is planning evidence, not
authorization. Do not resume parked Sprint 072 or invent Content Builder
contracts before discovery identifies the operator workflow and the smallest
useful generated-content outcome.

Sprint 075 — Real-Shape Home Feed Extractor Calibration is accepted.

Immediate product sequence:

1. Run Architect-led Content Builder discovery from actual reviewed content.
2. Shape the smallest end-to-end Builder sprint from that evidence.
3. Activate it only after Product Owner approval.

The Collector baseline is locked and maintenance-only. Content Builder
implementation remains parked until the discovery output is reviewed and a new
sprint is explicitly activated.
