# Sprint 053: Facebook Authentication Wall Detection Hardening

## Goal

Create one shared, safe Facebook page-state observer that detects login and
checkpoint walls even when Facebook renders a modal over the requested page
without redirecting to `/login` or `/checkpoint`.

## Scope

- [x] Add `src/collector-runtime/infrastructure/facebook-page-state-observer.ts`.
- [x] Return only safe page state:
  - `pageLoaded`
  - `blockingState`: `NONE_DETECTED`, `LOGIN_REQUIRED`, or `CHECKPOINT_REQUIRED`
- [x] Enforce detection precedence:
  - `CHECKPOINT_REQUIRED`
  - `LOGIN_REQUIRED`
  - `NONE_DETECTED`
- [x] Detect login through high-confidence structural evidence:
  - Facebook `/login` URL
  - visible password and identity inputs
  - visible authentication form actions
  - visible login forms
  - visible authentication dialogs or modals
  - localized text only as supporting evidence
- [x] Detect checkpoints through:
  - Facebook `/checkpoint` URL
  - visible checkpoint/security/identity-confirmation forms
  - high-confidence checkpoint indicators
- [x] Add bounded settle/poll observation that respects duration budgets,
  abort signals, and access-check lease deadlines.
- [x] Apply the observer to Account Exercise so blocked pages fail before
  scrolling and are rechecked after dwell/scroll and at the end.
- [x] Apply the observer to Facebook payload capture so authentication walls
  fail capture before submission.
- [x] Apply the observer to Profile-Source Access browser checks before
  group-content classification.
- [x] Use only synthetic sanitized DOM fixtures in tests.
- [x] Update narrowly relevant runtime and project documentation.

## Live Validation Note

Sprint 053 live acceptance depends on reprovisioning the affected Facebook
profile before rerunning Account Exercise, Facebook collection, and
Profile-Source Access Check validation. Sprint 053A adds CloakBrowser support
to the provisioning CLI as a prerequisite correction for that live validation.
Sprint 053 remains active until the live validation is completed and accepted.

## Out Of Scope

- Automatic login.
- Credential entry.
- QR login automation.
- CAPTCHA solving.
- Checkpoint bypass.
- Automatic profile status or account-stage changes.
- Clearing authentication state.
- Docker Compose worker work.
- Scheduling, retries, or worker lease changes.
- Raw evidence persistence.
- Screenshots, captured Facebook HTML, cookies, localStorage, credentials, or
  raw body text in fixtures, logs, output, persistence, or docs.
- Commits or pushes.

## Verification

Required:

- `pnpm typecheck`
- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm test`
- `git diff --check`

Coverage targets:

- `/login` URL
- `/checkpoint` URL
- English login modal
- Vietnamese login modal
- login modal over `/groups/...`
- asynchronously appearing modal
- hidden inputs do not trigger
- normal logged-in group page does not trigger
- checkpoint precedence
- exerciser initial block means zero scrolls
- exerciser mid-run block stops further scrolling
- collector initial and mid-run blocks fail safely
- access checker maps modal to `LOGIN_REQUIRED`
- leases/browser sessions are cleaned up
- no raw DOM text or sensitive data escapes
