# Sprint 053B: Facebook Checkpoint False-Positive Hardening

## Goal

Eliminate false-positive `CHECKPOINT_REQUIRED` results from the shared Facebook
page-state observer introduced in Sprint 053. A visible, usable Facebook feed was
being classified as checkpoint-blocked because the observer used over-broad
substring matching and combined unrelated global evidence.

## Root Causes Removed

1. **Generic form-action substrings** — `security`, `identity`, and `confirm` in
   a form's action attribute independently triggered `CHECKPOINT`. Removed. Now
   only a form action whose parsed pathname starts with `/checkpoint` counts as an
   independent checkpoint signal (`CHECKPOINT_FORM_ACTION`).

2. **Global evidence combination** — Checkpoint text anywhere in the document was
   combined with any `Continue` button, any form, any identity input, or any
   password input anywhere else. Removed. Non-URL checkpoint detection now requires
   a single visible container (form, role=dialog, role=alertdialog, or
   aria-modal=true) that simultaneously contains checkpoint-specific text **and** a
   visible verification control or input.

3. **Visibility defaulting to true** — `isElementVisible` returned `true` when
   `getClientRects()` returned results but the bounding box had zero area, and
   also returned `true` as a final fallback when no geometry was available at all.
   Fixed: zero `getClientRects()` length → hidden; zero width **and** zero height
   bounding box → hidden; no affirmative geometry → hidden (no fallback `return true`).

## Observer Changes

File: `src/collector-runtime/infrastructure/facebook-page-state-observer.ts`

- **URL detection**: `pathnameStartsWith("/checkpoint")` replaces
  `pathname.includes("/checkpoint")`. Uses parsed `rawPathname` to avoid
  false matches on query strings or hash fragments.
- **Form action detection**: `formActionIsCheckpoint` parses the action via
  `new URL(…, base)` and checks `pathname.startsWith("/checkpoint")` only.
  Generic substrings (`security`, `identity`, `confirm`) removed entirely.
- **Co-located checkpoint evidence**: `visibleCheckpointDialog` inspects only
  candidate containers (form/dialog/aria-modal) that **simultaneously** contain
  `CHECKPOINT_TEXT_SIGNALS` text **and** a visible verification control or input
  (`containerHasVerificationControl`). No cross-document text+button combination.
- **Visibility tightened**: `isElementVisible` now requires at least one
  client rect (length > 0) and a non-zero bounding box (width > 0 or height > 0).
  The unconditional `return true` fallback is removed.
- **Internal evidence codes** (not persisted, not returned): `CHECKPOINT_URL`,
  `CHECKPOINT_FORM_ACTION`, `CHECKPOINT_DIALOG`, `LOGIN_URL`, `LOGIN_FORM`,
  `LOGIN_DIALOG`, `NONE` — assigned inside the IIFE for diagnostic clarity only.
- **Login detection unchanged**: Sprint 053 login-modal logic (English and
  Vietnamese, form-action, dialog, async settle/poll) is preserved exactly.
- **Checkpoint precedence preserved**: `CHECKPOINT_REQUIRED` still wins when
  co-located with login evidence.

## Tests Added

File: `src/collector-runtime/infrastructure/facebook-page-state-observer.test.ts`

New cases covering Sprint 053B requirements:

| Test | Verifies |
|---|---|
| normal feed with visible forms returns NONE_DETECTED | healthy feed not flagged |
| normal feed with a Continue button returns NONE_DETECTED | global Continue button not a checkpoint signal |
| normal feed with generic "security" text returns NONE_DETECTED | security text alone not a checkpoint |
| normal feed with "confirm" form action returns NONE_DETECTED | confirm action not a checkpoint |
| normal feed with "identity" form action returns NONE_DETECTED | identity action not a checkpoint |
| hidden checkpoint form returns NONE_DETECTED | hidden containers rejected |
| zero-size checkpoint-like element returns NONE_DETECTED | zero-rect elements rejected |
| checkpoint text in one container, Continue button in another returns NONE_DETECTED | no cross-container combination |
| /checkpoint URL returns CHECKPOINT_REQUIRED | URL detection works |
| visible /checkpoint form action returns CHECKPOINT_REQUIRED | form-action detection works |
| visible checkpoint dialog with co-located verification control returns CHECKPOINT_REQUIRED | dialog detection works |
| checkpoint precedence over login | CHECKPOINT wins |
| English login modal still detected | login regression |
| Vietnamese login modal still detected | login regression |
| healthy feed returns NONE_DETECTED | overall healthy-feed regression |

Consumer regression cases (SequencePage):

- Exerciser healthy feed → NONE_DETECTED (no false positive)
- Collector healthy feed → NONE_DETECTED (no false positive)
- Genuine checkpoint → CHECKPOINT_REQUIRED (stops consumers)

## Verification Results

```
pnpm typecheck      ✓  (no errors)
pnpm web:typecheck  ✓  (no errors)
pnpm web:build      ✓  (1768 modules, no errors)
pnpm test           ✓  842 passed | 8 skipped (opt-in DB integration)
git diff --check    ✓  (no whitespace errors)
```

## Manual Verification Required

Before closing Sprint 053B, rebuild/restart both workers and verify:

1. **Healthy Facebook feed**:
   - `CHECKPOINT_REQUIRED` is false
   - Normal exercise/collection continues

2. **Genuine checkpoint page**:
   - `CHECKPOINT_REQUIRED` is true
   - No scrolling or content submission continues
   - Lease is released

## Out of Scope

- Checkpoint bypass, CAPTCHA solving, automatic login
- Profile status or session state changes
- Browser-provider redesign, proxy changes
- Collector/Exerciser UI redesign
- Commits or pushes

## Sprint Status

Sprint 053 remains active. Sprint 053B is a hardening correction under Sprint 053
live validation. Sprint 054 not defined.
