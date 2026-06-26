# Roadmap

## Current Product Direction

The near-term product direction is the **Profile Feed Collector MVP**.

The project should focus on a small, operator-usable loop:

1. Persist collector profiles and authenticated sessions.
2. Run safe profile behavior / warm-up when needed.
3. Collect the authenticated Facebook profile home feed.
4. Extract useful group/page text posts from captured feed payloads.
5. Store normalized content items with categories and review status.
6. Preview, select, reject, and mark content as used.
7. Review discovered publishing sources.
8. Promote approved Facebook group sources into managed source groups.

This roadmap intentionally pauses broader Content Builder and Content Publisher expansion until the feed collector loop is validated against real captured payloads.

## Product Scope Lock

### Keep in the MVP

- **Collector Profile Manager**
  - Profile persistence.
  - Session/provisioning persistence.
  - Runtime profile configuration.
  - Checkout/lease safety.
  - Account readiness and authentication health.

- **Profile Behavior**
  - Safe operator-driven account exercise / warm-up behavior.
  - Authentication health observation.
  - No CAPTCHA solving, checkpoint bypass, credential automation, or unapproved social actions.

- **Profile Feed Collector**
  - Profile-bound Facebook home-feed run records.
  - Bounded browser execution through the existing browser provider boundary.
  - Payload capture through safe fetch/XHR/network capture.
  - Extraction into normalized content candidates.
  - Submission into Content Manager.

- **Content Manager**
  - Content categories.
  - Managed source groups.
  - Normalized content items.
  - Content review lifecycle: `COLLECTED`, `SELECTED`, `REJECTED`, `USED`.
  - Safe content preview and status update APIs.
  - Discovered source identity (`SourcePublisher`) and approved group promotion into managed source groups.

- **Web UI**
  - Profiles.
  - Profile feed runs.
  - Content items / preview queue.
  - Content categories and managed groups.
  - Discovered sources and promote-to-group flow.

### Park for later

- Content Builder Transform Type catalog.
- Content Briefs.
- Producer graphs.
- Producer Sets.
- Artifacts as a product workflow.
- LLM provider integration.
- Prompt execution and prompt versioning.
- Content Publisher / publication scheduling.
- Broad scheduler/operator-control surfaces that are not required for manual feed collector validation.

Existing code for parked areas should not be removed until the MVP loop is validated and the deletion risk is understood. Prefer hiding or de-emphasizing UI and commands first.

## Immediate Roadmap

### Sprint 073: Product Scope Lock And Surface Trim

Refocus the repository around the Profile Feed Collector MVP.

- Update current-state docs to name the MVP and park Content Builder expansion.
- Keep `active.md` changes explicit and separate from this roadmap update.
- Trim Web UI primary navigation to the MVP surfaces.
- Hide advanced/parked pages from the sidebar without deleting their implementation.
- Split command documentation so daily commands are easy to find.
- Reduce `package.json` script noise by keeping only canonical daily commands and moving advanced/operator details into docs or helper scripts.

Out of scope:

- No extractor behavior changes.
- No database table or migration deletion.
- No runtime behavior changes.
- No removal of parked modules.

### Sprint 074: Home Feed Extraction Diagnostics

Make zero-candidate home-feed runs explain themselves safely.

- Preserve safe capture diagnostics through the home-feed run summary.
- Aggregate extractor warning codes per run.
- Count unsupported payloads, invalid extractor results, skipped candidate reasons, and accepted candidates.
- Expose only safe diagnostic counts and codes through HTTP and Web UI.
- Do not expose raw Facebook payloads, cookies, localStorage, tokens, proxy details, viewer IDs, screenshots, raw HTML, or private response bodies.

Expected operator outcome:

```text
capturedPayloads: 42
jsonParseFailures: 0
extractorCandidates: 0
extractorWarnings:
  UNKNOWN_PUBLISHER_KIND: 18
  MISSING_SOURCE_URL: 11
  SKIPPED_CANDIDATE_WITHOUT_BODY_TEXT: 7
  UNSUPPORTED_PAYLOAD_SHAPE: 6
```

### Sprint 075: Real-Shape Home Feed Fixture Calibration

Calibrate the Facebook home-feed extractor against sanitized real-shape payloads.

- Capture or derive sanitized real-shape fixtures from manual runs.
- Keep all fixture data synthetic or sanitized.
- Add failing tests that reproduce the current zero-candidate behavior.
- Adjust extractor traversal and field resolution only enough to pass real-shape fixture tests.
- Preserve strict safety filtering for personal-profile posts, sponsored/ad posts, missing body text, and missing stable source identity.

### Sprint 076: Manual Feed Collection To Preview Validation

Prove the manual MVP loop end to end.

- Queue or run a profile-bound home-feed collection.
- Show run status and safe diagnostics.
- Submit extracted content items.
- Preview collected items.
- Select, reject, and mark content as used.
- Review discovered sources.
- Approve and promote an eligible Facebook group source into a paused managed source group.

This sprint should produce explicit manual validation notes. Live Facebook validation remains opt-in and operator-driven.

### Sprint 077: Discovered Sources Product Rename

Improve product language without renaming stable backend concepts.

- Keep the backend/domain concept `SourcePublisher`.
- Rename the Web UI surface from **Source Publishers** to **Discovered Sources**.
- Present promotion as **Promote to Managed Group**.
- Keep API routes and persistence unchanged unless a later compatibility sprint explicitly approves contract changes.

### Sprint 078: Archive Or Remove Unneeded Surfaces

After the MVP loop is validated, remove or archive genuinely unnecessary surfaces.

Candidates:

- Content Builder Transform Type UI and routes.
- Advanced scheduler pages not needed for manual feed collector validation.
- Exercise/access-check pages if they are not part of the operator loop.
- Legacy package scripts and aliases.
- Docs that imply Content Builder is the current priority.

Deletion must be narrow and reversible where possible. Do not remove migrations or persistent data structures without a dedicated migration/deprecation plan.

## Historical Milestones

Historical sprint details live in sprint documents and project history. The durable architectural decisions remain:

- Hexagonal architecture: Domain -> Application use cases and ports -> Infrastructure/interface adapters -> Composition/runtime wiring.
- Collector Profile Manager owns profiles, sessions, leases, readiness, and trusted runtime configuration.
- Collector Runtime owns browser execution, payload capture, extraction, runs, workers, and submission orchestration.
- Content Manager owns categories, source groups, normalized content, deduplication, content lifecycle, and discovered source review/promotion.
- Web UI consumes safe API contracts and must not duplicate domain rules.

## Later Roadmap

Only after the Profile Feed Collector MVP is proven:

1. Revisit Content Builder with a smaller product brief.
2. Define how selected/used content becomes input to article/script/video workflows.
3. Reintroduce Transform Types only if prompt cataloging is still required.
4. Define artifacts and producer workflows from actual operator needs.
5. Revisit Content Publisher as a separate downstream stage.
