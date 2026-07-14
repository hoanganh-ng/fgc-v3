# Sprint 076B — Reviewable Discovered-Source Identity

## Status

Accepted by the Product Owner on 2026-07-15. Implementation commit `7c8fdd1`
introduced the review-identity flow; correction commit `bc5c73d` ensures unsafe
persisted canonical URLs are not rendered or selected as promotion defaults.
Sprint 076 is active.

## Acceptance Record

- The safe review URL resolver normalizes supported Facebook canonical URLs,
  derives fixed-host ID-only group URLs with encoded path segments, and does
  not invent Page URLs.
- Approval fails closed with `SOURCE_PUBLISHER_NOT_REVIEWABLE` when no safe
  review destination exists; the rejected status remains unchanged.
- The Web UI presents unnamed group/page labels, technical IDs, safe review
  guidance, secure external-link attributes, and a disabled approval state for
  non-reviewable rows.
- Unsafe persisted canonical URLs remain readable for compatibility but are not
  clickable and never become promotion defaults.
- Focused tests, backend/Web typechecks, Web build, 1,992 unit tests, Docker DB,
  and 19 Docker E2E tests passed. HTTP DB reported 207 passes plus two existing
  missing-`DATABASE_URL` environment guards.
- In the required live proof, the Product Owner recognized one intended ID-only
  group through the safe link, approved it, confirmed `APPROVED`, and confirmed
  the promotion form used the safe review destination. No promotion was
  performed and no sensitive evidence was recorded.

## Goal

Make every source-publisher approval decision reviewable through the supported
Web UI. An operator must be able to open a safe Facebook destination and
understand whether the record is a group or page before approving it; an opaque
publisher identifier alone is not sufficient.

## Why This Correction Exists

Sprint 076 exploratory validation exposed a blocking operator defect on the
Discovered Sources page:

- live source publishers can persist with only `externalPublisherId`;
- `displayName` and `canonicalUrl` are optional throughout the existing
  observation contract;
- the Web UI falls back to the opaque external publisher ID as the card title;
- the canonical URL section disappears when the optional value is absent;
- the Approve action remains enabled.

The result is an authorization decision with no recognizable identity and no
supported destination to inspect. The Product Owner cannot responsibly approve
those rows. The earlier Sprint 076 source-review/promotion observation is
exploratory only and does not satisfy the final acceptance gate.

Sprint 075's admitted real-shape fixture contains a Group-qualified `$.to`
object with a synthetic name and URL, but its positive test only requires the
publisher ID. That test does not prove review metadata survives the complete
extractor-to-UI flow.

## Capability Summary

> A discovered Facebook group or page is presented with a human-readable label
> when captured, a safe fixed-host review link, its technical publisher ID as
> secondary detail, and clear review guidance. Approval is rejected when no safe
> review destination can be produced. Existing ID-only Facebook group rows
> become reviewable without database access through a deterministic group URL
> derived from their already accepted stable publisher identity.

## Required Context

Read only:

- `AGENTS.md`;
- `DESIGN.md` as visual context only; the Review Identity Contract remains the
  behavior authority;
- `docs/SPRINTS/active.md`;
- this sprint;
- `docs/SPRINTS/SPRINT-076-repeated-live-collector-validation.md`;
- `docs/SPRINTS/SPRINT-076-live-validation-evidence.md`;
- `docs/PROJECT_SNAPSHOT.md`;
- `docs/ROADMAP.md`;
- `docs/modules/collector-runtime.md`;
- `docs/modules/content-manager.md`;
- `docs/modules/web-ui.md`;
- `docs/TESTING_STRATEGY.md`;
- `src/collector-runtime/platform-extractors/facebook/__fixtures__/sanitized-realshape-home-feed-group-text-post.fixture.ts`;
- `src/collector-runtime/platform-extractors/facebook/__fixtures__/sanitized-realshape-home-feed-group-text-post.md`;
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.ts`;
- `src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.test.ts`;
- `src/collector-runtime/application/use-cases/execute-profile-home-feed-collection-run.use-case.ts`;
- `src/collector-runtime/application/ports/source-publisher-observation.port.ts`;
- `src/content-manager/domain/source-publisher.ts`;
- `src/content-manager/domain/source-publisher.schemas.ts`;
- `src/content-manager/application/use-cases/observe-source-publisher.use-case.ts`;
- `src/content-manager/application/use-cases/update-source-publisher-status.use-case.ts`;
- the directly related source-publisher repository, mapper, HTTP route/schema,
  and tests;
- `apps/web/src/lib/api/content-manager-client.ts`;
- `apps/web/src/features/content-manager/source-publisher-review-view-model.ts`;
- `apps/web/src/features/content-manager/source-publisher-review-view-model.test.ts`;
- `apps/web/src/pages/source-publishers-page.tsx`;
- `apps/web/src/pages/source-publishers-page.test.tsx`.

Do not scan unrelated modules or historical sprints.

## Review Identity Contract

### Display label

- Preserve an extractor-observed publisher display name only from the same
  resolved publisher reference/identity. Do not borrow arbitrary nested names,
  actor names, profile names, or text from another publisher.
- When no display name is available, the UI label is `Unnamed Facebook group`
  or `Unnamed Facebook page`; it must not promote the opaque external ID into
  the human-readable heading.
- Continue showing `externalPublisherId` as explicitly labeled technical
  detail so operators and support tooling can correlate the record.

### Safe review URL

Expose a computed, read-only `reviewUrl` on the safe source-publisher DTO.
It is not a new identity key and does not replace the persisted
`canonicalUrl`.

The responsible Content Manager helper returns a review URL only under these
rules:

1. If a canonical URL is used, it must parse as HTTPS, contain no credentials,
   use the exact host `www.facebook.com` (normalizing
   `https://facebook.com` to that host is allowed), and have query and
   fragment removed.
2. For `FACEBOOK / GROUP` with no usable canonical URL, derive exactly
   `https://www.facebook.com/groups/{encodedExternalPublisherId}/` from the
   already validated stable publisher identity. Encode the path segment; never
   concatenate an untrusted raw value into a URL.
3. Do not invent a Page URL from an ID without fixture-backed evidence.
4. Unsupported platform/kind combinations and unsafe URLs produce no
   `reviewUrl`.
5. Never render or return `javascript:`, non-HTTPS, credential-bearing,
   lookalike-host, query-bearing, or fragment-bearing destinations.

The same application-owned rule must govern the approval gate and the DTO. Do
not implement a UI-only safety decision that direct API callers can bypass.

### Approval behavior

- Transition to `APPROVED` is allowed only when the computed safe
  `reviewUrl` exists.
- A missing review URL returns a typed application/HTTP error and leaves status
  unchanged.
- The Web UI disables Approve for non-reviewable rows and explains:
  `Approval unavailable until this source has a safe Facebook review link.`
- Reviewable rows show a prominent `Open on Facebook` link before the status
  actions. It opens in a new tab with `rel="noopener noreferrer"`.
- UI guidance says to open and verify the source before approving it.
- Promotion defaults use the safe review URL when a persisted canonical URL is
  absent. Existing promotion status/category rules remain unchanged.

## Extractor Regression Requirement

Extend the admitted Sprint 075 real-shape positive assertion so its candidate
must preserve:

- `displayName: "Synthetic Home Feed Group"`;
- `canonicalUrl:
  "https://www.facebook.com/groups/synthetic-home-feed-group/"`.

If this assertion is already green, report that evidence and do not make an
unnecessary extractor change. If it is red, change only publisher-reference
selection/enrichment required to combine metadata from references that have the
same accepted `kind + externalPublisherId`. Never merge metadata across
different identities, unknown references, actors, users, or off-path objects.

This sprint does not authorize new raw live payload capture. If the admitted
fixture cannot explain a required extractor change, stop and request a separate
sanitized-fixture acquisition slice.

## Existing Rows and Compatibility

- Do not delete, auto-approve, auto-ignore, or auto-promote existing rows.
- Existing Facebook GROUP rows with a valid external publisher ID receive the
  derived safe `reviewUrl` at read time, so the current numeric-only records
  become inspectable without a migration.
- Existing PAGE rows lacking a safe canonical URL remain visible but cannot be
  approved until a later valid observation enriches them.
- Keep `displayName` and persisted `canonicalUrl` optional for backward
  compatibility.
- No schema migration is expected. If implementation discovers that persistence
  must change, stop and report instead of expanding this sprint.

## UI Acceptance Details

For the current ID-only group scenario, the card must show:

- heading: `Unnamed Facebook group`;
- badges: current status, `GROUP`, and `FACEBOOK`;
- an `Open on Facebook` action using the computed safe review URL;
- external publisher ID under a technical-detail label;
- observation and timestamp facts;
- the existing promotion panel;
- Approve available only because a safe group review URL was derived.

A captured display name replaces the unnamed heading. Long names and IDs must
truncate visually while remaining available through the existing title/detail
treatment. Keyboard focus and accessible link/button names are required.

## Verification

Run and report:

```bash
pnpm exec vitest run src/collector-runtime/platform-extractors/facebook/facebook-home-feed-graphql-payload-extractor.test.ts
pnpm exec vitest run apps/web/src/features/content-manager/source-publisher-review-view-model.test.ts
pnpm exec vitest run apps/web/src/pages/source-publishers-page.test.tsx
pnpm typecheck
pnpm test
pnpm web:typecheck
pnpm web:build
pnpm test:db:docker
pnpm test:http:db
pnpm test:e2e:docker
git diff --check
```

Add focused tests for:

- the admitted fixture's display name and canonical URL;
- safe canonical Facebook URL normalization;
- query/fragment stripping;
- fixed-host group URL derivation with path-segment encoding;
- rejection of HTTP, credentials, non-Facebook/lookalike hosts, unsupported
  platform/kind, and missing Page URL;
- application-level approval rejection when `reviewUrl` is unavailable;
- no status mutation on rejection;
- DTO inclusion/omission of `reviewUrl`;
- ID-only group UI heading/link/guidance/approval behavior;
- captured-name UI behavior;
- non-reviewable Page UI disabled state and explanation;
- external-link security attributes;
- promotion default URL behavior;
- legacy optional-field compatibility.

Separate pre-existing environment/harness failures with baseline evidence. Do
not relabel a regression as pre-existing.

## Required Manual Proof

Using the existing development stack after automated checks:

1. Open Discovered Sources.
2. Choose one existing `DISCOVERED / FACEBOOK / GROUP` row that previously
   showed only an ID.
3. Confirm the UI labels it as unnamed rather than presenting the ID as a name.
4. Open its computed Facebook review link and verify that it resolves to the
   intended group or a Facebook-native unavailable/access response; record no
   group name, ID, URL, screenshot, or page content in evidence.
5. Only when the Product Owner recognizes the intended group, approve it through
   the normal UI.
6. Confirm status changes and the promotion form uses the safe review URL.
7. Do not promote another group merely to prove this sprint; the final Sprint
   076 promotion evidence will be repeated after acceptance.

If the derived URL resolves to a different entity, an unsafe destination, or
cannot support an operator decision, stop and report. Do not approve.

## Safety

Do not expose or persist cookies, localStorage, tokens, headers, session/viewer
data, proxy/fingerprint values, raw payloads, raw HTML, screenshots, private
response bodies, or Facebook post text.

Publisher display name and the sanitized fixed-host review URL are intentional
operator-facing source metadata. Render names as text, never HTML. Never include
reviewed live names, IDs, or URLs in sprint evidence.

## Acceptance Gate

Sprint 076B is complete only when:

- the review-identity contract is implemented at the responsible domain,
  application, HTTP, and UI boundaries;
- the admitted fixture proves its existing safe name and canonical URL;
- ID-only Facebook GROUP rows receive a safe derived review link;
- opaque IDs remain technical details rather than human-readable headings;
- application/API approval fails closed without a safe review URL;
- the UI clearly directs the operator to inspect the Facebook source first;
- unsafe and lookalike destinations are rejected;
- existing rows remain readable and no migration was required;
- all required verification is reported;
- one existing ID-only group is manually inspected through the supported UI;
- no sensitive evidence is recorded;
- Product Owner review accepts the result.

## Stop Conditions

Stop and report instead of expanding scope when:

- a safe group review URL cannot be derived from the accepted stable identity;
- a Page URL would need to be guessed;
- recognizable display-name capture requires an unadmitted live payload shape;
- implementation requires a database migration or a new browser navigation
  workflow;
- approval safety can only be enforced in the Web UI;
- a link resolves to the wrong Facebook entity;
- sensitive data appears in logs, DTOs, tests, fixtures, docs, or evidence;
- a defect outside discovered-source identity/review is found.

## Builder Handoff Prompt

Implement Sprint 076B —
`docs/SPRINTS/SPRINT-076B-reviewable-discovered-source-identity.md`.

Use the exact Review Identity Contract and Required Context. Add the computed
safe `reviewUrl`, enforce the same application-level approval gate, fix the
ID-only UI state, and tighten the admitted Sprint 075 fixture assertion. Make no
new raw capture and no database migration. Use root `DESIGN.md` to preserve the
existing operator-console visual language; it does not authorize behavior or
scope beyond this sprint.

Run every required verification command, then perform the Required Manual Proof
against one existing ID-only discovered group. Return files changed, focused
test evidence, full verification results, and the safe manual outcome. Do not
record a real Facebook name, ID, URL, screenshot, or page content.

Do not commit or push. Do not accept Sprint 076B, resume Sprint 076, activate
Sprint 077, or begin Content Builder.
