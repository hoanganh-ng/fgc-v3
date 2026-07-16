# Collector MVP Baseline

Permanent operator and maintenance reference for the accepted Facebook profile
home-feed Collector. This document locks the proven baseline; it does not add
runtime behavior.

Evidence authority:
[`SPRINT-076-live-validation-evidence.md`](SPRINTS/SPRINT-076-live-validation-evidence.md)
at commit `109ee4c`. Sprint status:
[`SPRINT-076-repeated-live-collector-validation.md`](SPRINTS/SPRINT-076-repeated-live-collector-validation.md).

## 1. Scope and evidence

The accepted product baseline is Facebook **profile home-feed** collection into
normalized Content Manager items: request a profile-bound run, capture through
bounded browser execution, extract group/page text-post candidates, observe
discovered publishers, submit or merge content, review in the Web UI, and
promote an eligible approved Facebook group into a paused managed source.

Accepted supported-path samples `V06`–`V10` (Playwright, explicit `DIRECT`,
normal `https://www.facebook.com/`, standard checkout, no bypasses):

| Outcome | Aggregate (safe) |
| --- | --- |
| Succeeded with candidates | 4 of 5 (`V06`, `V07`, `V09`, `V10`) |
| Useful content (Product Owner) | 3 of 5 (`V07`, `V09`, `V10`) |
| Explained natural failure | 1 (`V08` `CHECKOUT_COOLDOWN`; no lease acquired; profile remained `READY`) |
| Lease release | All acquired leases released |
| Duplicate merge | Proven on `V09` (no duplicate review rows) |
| Eligible group promotion | One approved group → `PAUSED` managed source; re-promote `ALREADY_EXISTS` |
| UTC date span | `2026-07-14` and `2026-07-16` |
| Profiles | Alias `P1` only |

Exploratory samples `V01`–`V05` are **not** the acceptance baseline. They used a
temporary proxy-eligibility bypass (since restored). Keep them only as
historical context.

## 2. Supported baseline

| Axis | Accepted baseline |
| --- | --- |
| Browser provider | **Playwright** (`playwright` / `PLAYWRIGHT_CHROMIUM`). Contractual for the accepted baseline. |
| Network mode | Explicit persisted `DIRECT` (`mode: DIRECT`, `proxy: null`, killswitch off). Live-proven in Sprint 076. |
| `PROXY` mode | Supported product configuration; **not** the Sprint 076 live baseline. |
| Home target | Normal `https://www.facebook.com/` (`FACEBOOK_HOME_FEED_URL`). Chronological `?sk=h_chr` override is retired. |
| Profile preconditions | Provisioned session; operational `READY`; `authenticationHealth` `HEALTHY`; `accountStage` `COLLECTION_READY`; no active lease; cooldown / temporal / daily safety gates satisfied. |
| CloakBrowser | Experimental/supplementary only. Not an accepted substitute for the Playwright baseline. |

Configure network mode through the profile configure Web UI (`/profiles/:profileId/configure`, network section) or `PATCH /collector/profiles/:profileId/configuration`. Do not infer `DIRECT` from a null proxy alone; `UNCONFIGURED` fails checkout.

## 3. Operator flow

Primary Web UI navigation (Profile Feed Collector MVP):

| Step | Surface |
| --- | --- |
| Profiles / provisioning / recovery | `/profiles`, `/profiles/:profileId` |
| Queue home-feed runs, inspect status and diagnostics | `/profile-home-feed-collection-runs` |
| Review normalized content | `/content-items`, `/content-items/:contentItemId` |
| Review discovered sources; approve; promote eligible groups | `/source-publishers` |
| Inspect paused/managed source groups | `/source-groups` |

Supported API surface for the same loop:

| Action | Contract |
| --- | --- |
| Configure network | `PATCH /collector/profiles/:profileId/configuration` |
| Request run | `POST /collector/profile-home-feed-collection-runs` |
| List / get / cancel | `GET` / `GET …/:id` / `POST …/:id/cancel` under `/collector/profile-home-feed-collection-runs` |
| Content review status | `PATCH /collector/content-items/:contentItemId/status` |
| Discovered-source status | `PATCH /collector/source-publishers/:sourcePublisherId/status` |
| Promote approved Facebook group | `POST /collector/source-publishers/:sourcePublisherId/promote-to-source-group` |

Canonical bounded execution (claim at most one queued run, execute, release lease):

```bash
# One-shot runner (Sprint 065C3)
pnpm operator:profile-home-feed:run-next -- --base-url http://localhost:3000 --browser-provider playwright

# Or worker once-mode (same bounded executor path)
pnpm operator:profile-home-feed-worker -- --base-url http://localhost:3000 --once --browser-provider playwright
```

Against the preview gateway, use `--base-url http://localhost:8081`. Defaults:
`--browser-provider` uses `BROWSER_PROVIDER`, then `playwright`; `--base-url`
uses `PROFILE_HOME_FEED_RUNNER_BASE_URL`, then `PROFILE_MANAGER_BASE_URL`, then
`CONTENT_MANAGER_BASE_URL`, then `http://localhost:3000`.

Typical sequence:

1. Confirm the profile meets preconditions (`READY`, `HEALTHY`,
   `COLLECTION_READY`, explicit `DIRECT`, no active lease, cooldown clear).
2. On **Profile Feed Runs**, request a run for that profile (optional bound
   overrides stay within existing ceilings).
3. Execute with `pnpm operator:profile-home-feed:run-next` or
   `pnpm operator:profile-home-feed-worker -- --once`, Playwright selected.
4. Inspect terminal status, safe diagnostics (capture stage/page state,
   counters, warnings, run outcome), and lease-release indication on the run
   row or CLI safe summary.
5. Review content on **Content Items** (counts and status only; do not copy
   Facebook text into evidence).
6. On **Discovered Sources**, open the safe **Open on Facebook** `reviewUrl`
   when present, approve only when the destination is identifiable, then
   promote an eligible `FACEBOOK` + `GROUP` + `APPROVED` publisher into a
   paused managed source. Opaque IDs without a safe review URL are not
   approval candidates.

Do not invent UI actions or commands beyond those listed above.

## 4. Manual smoke test

Preconditions: development or preview stack healthy; one already logged-in
eligible profile (`READY` + `HEALTHY` + `COLLECTION_READY` + explicit `DIRECT`);
cooldown satisfied; no credential entry or session manipulation in this
procedure.

1. Open `/profiles` and confirm the target profile shows `READY`, `HEALTHY`,
   and `COLLECTION_READY`, with network mode `DIRECT`.
2. Open `/profile-home-feed-collection-runs` and request one home-feed run for
   that profile, leaving bounds at defaults unless an existing supported
   override is required.
3. Execute once with Playwright:

   ```bash
   pnpm operator:profile-home-feed:run-next -- --base-url http://localhost:3000 --browser-provider playwright
   ```

   (Use `http://localhost:8081` when the preview gateway is the stack
   entrypoint.)
4. Refresh Profile Feed Runs. Expect a terminal `SUCCEEDED` or an explained
   failure (for example `CHECKOUT_COOLDOWN` before lease acquisition). For a
   succeeded run, expect `capturePageState` `HOME_FEED` when capture completed,
   non-negative capture/extractor counters, and the profile returned to
   `READY` with the lease released.
5. Open `/content-items`. Expect submitted or merged items to appear; record
   counts only. Do not copy post text, names, or URLs.
6. Optionally open `/source-publishers`. If an eligible Facebook group has a
   safe review link, confirm it opens a recognizable destination before any
   approval. Do not approve ID-only rows without a safe `reviewUrl`. Do not
   promote unless intentionally exercising the accepted promotion path into a
   `PAUSED` source group.

**Stop conditions** (do not continue, do not bypass, do not edit runtime):

- Profile requires credential entry, reprovisioning, or unsupported session
  repair mid-smoke.
- Lease is acquired and fails to release.
- Diagnostics cannot explain zero-yield or failure.
- Sensitive material (cookies, tokens, raw payloads, screenshots, live IDs)
  appears in CLI output, DTOs, or logs.
- A runtime or configuration change would be required to proceed.

This procedure documents how to smoke-test; Sprint 077 does not claim a new
live run was executed. Accepted live proof remains Sprint 076 `V06`–`V10`.

## 5. Recovery matrix

| Observation | Supported operator path | Limitation / escalation |
| --- | --- | --- |
| Authentication loss or login redirect (`LOGIN` page state / `REAUTH_REQUIRED`) | Profile detail → **Start Reauthentication** → `pnpm operator:profile:provision` with the new one-time token; headed manual login only. | No automated credential entry or session patch. Health returns to `HEALTHY` only via successful session ingestion. |
| Facebook checkpoint / review-required (`CHECKPOINT` / `CHECKPOINT_REVIEW_REQUIRED`) | Profile detail → **Start Manual Checkpoint Recovery** → same provisioning CLI for manual Facebook checkpoint completion. | No checkpoint bypass. Explicitly manual. |
| Browser / provider launch or capture failure | Confirm Playwright with `pnpm operator:browser:probe -- --browser-provider playwright`. Re-run only after probe succeeds. For CloakBrowser setup failures, treat CloakBrowser as non-baseline. | Do not fall back providers silently. Do not change provider defaults to “make the run pass.” |
| Explained zero-yield / low-yield extraction | Inspect safe diagnostics on Profile Feed Runs: capture counters, `unsupportedPayloadCount`, warning histogram, extractor candidate counts. | Do not widen the extractor without new diagnostics plus a sanitized fixture. Escalate as platform-drift maintenance if yield collapses with unexplained shapes. |
| Checkout cooldown (`CHECKOUT_COOLDOWN` / `HOME_FEED_CHECKOUT_FAILED` at checkout) | Wait until the profile is eligible again; confirm no active lease and profile remains `READY`. | Do not bypass cooldown, temporal windows, or daily safety gates. Do not mutate lease or profile rows in the database. |
| Interrupted execution or lease-release failure (`HOME_FEED_LEASE_RELEASE_FAILED` or `leaseReleased: false`) | Inspect the run diagnostics/summary and profile operational status. Prefer a later supported re-run only when the profile is `READY` and not leased. | No operator CLI exists to force-release a stuck lease. Escalate to Architect/Product Owner; do not invent database repairs. |

Never recommend database mutation, checkout bypasses, temporary source edits, or
provider/network hacks as recovery.

## 6. Regression anchors and drift points

### Admitted sanitized real-shape fixture

- Fixture:
  `src/collector-runtime/platform-extractors/facebook/__fixtures__/sanitized-realshape-home-feed-group-text-post.fixture.ts`
- Safety note:
  `src/collector-runtime/platform-extractors/facebook/__fixtures__/sanitized-realshape-home-feed-group-text-post.md`

Identifiers and body text are synthetic. No raw Facebook response material.

### Smallest directly relevant automated suites

| Concern | Anchor |
| --- | --- |
| Capture | `src/collector-runtime/infrastructure/facebook-home-feed-browser-payload-capture.test.ts` |
| Extraction | `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.test.ts` |
| Diagnostics | `src/collector-runtime/application/profile-home-feed-diagnostic-aggregator.test.ts`; `src/collector-runtime/domain/profile-home-feed-diagnostic-summary.schemas.test.ts`; `src/interfaces/http/profile-home-feed-collection-run-diagnostics.server.test.ts` |
| Execution / lease release | `src/collector-runtime/application/use-cases/execute-profile-home-feed-collection-run.use-case.test.ts`; `src/operator-tools/profile-home-feed-runner/runner.test.ts` |
| Deduplication / home-feed ingest | `src/content-manager/application/content-application.test.ts`; `src/content-manager/application/content-collection-provenance-persistence.test.ts`; `src/content-manager/domain/home-feed-source-publisher-id.boundary.test.ts` |
| Safe review identity | `src/content-manager/domain/source-publisher-review-url.test.ts`; `apps/web/src/features/content-manager/source-publisher-review-view-model.test.ts`; `apps/web/src/pages/source-publishers-page.test.tsx` |
| E2E (synthetic, no Facebook) | `tests/e2e/profile-home-feed-run-next.spec.ts`; `tests/e2e/home-feed-content-ingestion.spec.ts`; `tests/e2e/profile-home-feed-checkout.spec.ts`; `tests/e2e/source-publisher-http.spec.ts` |

### Likely Facebook drift points

- GraphQL payload shape and field topology
- Qualified publisher identity paths (Group-qualified `id` at admitted paths only)
- Post identity (`post_id` / stable external post id)
- Login or checkpoint page-state detection
- Candidate yield under the normal home target

**Rule:** before any future extractor widening, require new safe diagnostics
evidence plus a new sanitized fixture. Do not calibrate from live raw payloads
committed to the repository.

## 7. Known limitations

- Only one profile (`P1`) participated in the accepted live baseline; a second
  profile was unavailable.
- Direct networking was live-proven; proxy networking was not the Sprint 076
  acceptance path.
- ID-only Page destinations are not guessed and remain non-reviewable until a
  safe canonical/review URL is observed. Approval fails closed without a safe
  destination. Unsafe persisted canonical URLs are neither clickable nor
  promotion defaults.
- Facebook yield and payload shapes may change; unsupported-payload and
  publisher-kind warnings are expected and must stay explainable.
- Production/VPS deployment and multi-profile scale are not proven by this
  baseline.
- Source-group Facebook collection (`pnpm operator:collector:facebook`) remains
  available but is outside the Profile Feed Collector MVP operator loop.
- Dev Compose browser-backed workers may default `BROWSER_PROVIDER=cloakbrowser`;
  the accepted baseline still requires explicit Playwright for contractual
  smoke and live validation.

## 8. Maintenance boundary and downstream handoff

Collector **feature expansion is parked**. Reopen Collector work only for:

- a reproduced defect on the supported path;
- platform drift backed by safe diagnostics and a sanitized fixture; or
- an explicitly approved new product requirement.

Next product activity: **Content Builder discovery**, starting from actual
reviewed content and existing Content Manager contracts. Do not activate an old
parked Content Builder sprint automatically. Do not assume the parked Transform
Type catalog is the correct starting point.

Related pointers: [`RUNTIME.md`](RUNTIME.md), [`TESTING_STRATEGY.md`](TESTING_STRATEGY.md),
module docs under [`modules/`](modules/), and Architect-owned
[`PROJECT_SNAPSHOT.md`](PROJECT_SNAPSHOT.md) / [`ROADMAP.md`](ROADMAP.md).
