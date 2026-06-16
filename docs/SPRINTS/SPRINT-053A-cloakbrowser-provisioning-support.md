# Sprint 053A: CloakBrowser Provisioning Support

## Goal

Add browser-provider selection to the operator-only profile provisioning CLI so
blocked Sprint 053 live validation can reprovision affected Facebook profiles
through either the existing Playwright Chromium path or the experimental
CloakBrowser path.

Sprint 053 remains active. Sprint 053A is a prerequisite correction for Sprint
053 live acceptance; it does not complete Sprint 053 and does not define Sprint
054.

## Scope

- Add provisioning CLI support for:
  - `--browser-provider playwright`
  - `--browser-provider cloakbrowser`
- Resolve provider selection with precedence:
  - CLI option
  - `BROWSER_PROVIDER`
  - `playwright`
- Keep Playwright as the default.
- Add a provisioning-specific browser-provider boundary for:
  - headed browser launch.
  - manual Facebook login.
  - normalized cookie and localStorage export.
  - clean close.
- Implement provisioning adapters for:
  - Playwright Chromium.
  - CloakBrowser.
- Reuse existing safe launch configuration behavior where applicable:
  - proxy protocol, host, port, and credentials.
  - user agent.
  - viewport and device scale factor.
  - locale and language header.
  - timezone.
  - stable profile-owned fingerprint settings for providers that support them.
- Preserve the existing provisioning token configuration and session-ingestion
  HTTP contracts.
- Block submission when browser capture returns empty or incomplete
  authentication state.
- Preserve safe CLI output and redaction for token, proxy, cookie, and
  localStorage material.
- Update provisioning help and runtime/project docs.

## No-Fallback Guarantees

- Do not fall back from CloakBrowser to Playwright.
- Do not fall back from configured proxy to direct connection.
- Do not fall back from one proxy protocol to another.

Provider or proxy launch failures must fail fast with sanitized output so the
operator can fix the selected provider or profile configuration.

## Out Of Scope

- Profile Manager API changes.
- Profile lifecycle changes.
- Automatic credential entry.
- QR login automation.
- CAPTCHA or checkpoint bypass.
- Automatic session recovery.
- Automatic provider fallback.
- No-proxy fallback.
- Broad browser subsystem relocation.
- Sprint 053 consumer behavior changes.
- Sprint 054 definition.
- Commits or pushes.

## Verification

Required:

- `pnpm typecheck`
- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm test`
- `git diff --check`

Coverage targets:

- CLI provider parsing.
- CLI, environment, and default precedence.
- Invalid provider rejection.
- Provider resolution.
- Headed launch config for Playwright and CloakBrowser.
- Exact proxy forwarding.
- No proxy or provider fallback.
- Matching normalized session DTOs.
- No submission for empty or incomplete authentication state.
- Cleanup on launch, navigation, capture, submission, and operator interruption
  paths.
- Token, proxy, cookie, and localStorage redaction.
- Preservation of the default Playwright provisioning behavior.
