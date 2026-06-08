# Sprint 022A: Facebook Fixture Tracking Cleanup

## Goal

Resolve the untracked sanitized Facebook payload fixture directory left after Sprint 022 so extractor tests do not depend on local-only files before browser and network capture work begins.

## Scope

- Inspect `src/collector-runtime/platform-extractors/facebook/__fixtures__/fixtures_fb_payload/`.
- Confirm whether extractor tests depend on the fixtures.
- Keep sanitized fixtures that are required by tests as tracked repository files.
- Replace any oversized or sensitive fixture with a smaller sanitized fixture that preserves the real Facebook payload shape needed by tests.
- Add nearby fixture guidance documenting that raw Facebook payloads must not be committed.
- Re-run the existing suspicious key/value scan if it exists.
- Keep changes limited to fixture tracking, fixture documentation, and test-only fixture adjustments if required.

## Out Of Scope

- Extractor behavior changes unless required by a minimal test-only fixture adjustment.
- Browser automation.
- Real network interception or payload capture.
- Profile checkout adapters.
- Schedulers or queues.
- Database changes.
- HTTP routes.
- Web UI.
- Content Builder.
- Publisher.

## Acceptance Criteria

- Required Facebook extractor fixtures are tracked as normal repository files.
- Tests that depend on real sanitized Facebook payload shape pass in a clean repository state.
- No raw Facebook payloads, cookies, tokens, viewer data, auth/session fields, tracking fields, CDN tokens, or private identifiers are committed.
- Fixture guidance exists near the fixtures and describes sanitization requirements.
- Existing suspicious token/viewer/auth/session/CDN-token scan reports zero findings.
- Typecheck and default tests pass.
- `git status --short` does not show a required fixture directory as untracked.

## Verification

```bash
pnpm run typecheck
pnpm test
git status --short
```
