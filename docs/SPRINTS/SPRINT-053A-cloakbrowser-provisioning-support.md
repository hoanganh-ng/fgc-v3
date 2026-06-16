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
- Use the concrete CloakBrowser Node package:
  - Source and documentation: `https://github.com/CloakHQ/CloakBrowser`.
  - Package: `cloakbrowser`.
  - Peer/runtime dependency: `playwright-core`.
  - Runtime API: `launchContext` from `cloakbrowser`, returning a
    Playwright-style browser context.
  - Binary installation: `pnpm exec cloakbrowser install`, or first launch
    downloads the binary into the CloakBrowser cache.
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
- Add a provisioning-specific CloakBrowser availability probe with sanitized
  reason codes plus an opt-in headed launch smoke that does not visit Facebook
  or submit session state.
- Update provisioning help and runtime/project docs.

## Installation Prerequisites

The workspace includes `cloakbrowser` and `playwright-core` as root
dependencies. Operators should run:

```bash
pnpm install
pnpm exec cloakbrowser install
```

CloakBrowser's Node package requires Node.js 20 or newer. The package exposes a
CLI binary as `cloakbrowser` and the JavaScript Playwright API through
`import { launchContext } from "cloakbrowser"`.

Provisioning setup can be checked without Facebook login:

```bash
pnpm operator:profile:provision:cloakbrowser-probe --
pnpm operator:profile:provision:cloakbrowser-probe -- --launch-headed
```

The first command reports package/API/binary availability. The second command
launches a headed synthetic page and closes it; it does not log in, capture
cookies/localStorage, or submit anything to Profile Manager.

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

## Collector Runtime CloakBrowser API Alignment

The Collector Runtime `CloakBrowserProvider` (Sprint 037A) has been updated to
use the same `launchContext` API as the provisioning adapter:

- `launchContext` (named or default export) is the primary and only supported
  path. Legacy speculative `module.launch` and `module.chromium.launch` paths
  have been removed.
- `launchContext` returns a Playwright-compatible `BrowserContext` directly.
  The session abstraction uses a context-only close (single `context.close()`
  call, guarded against double-close) with no separate `browser.close()`.
- `BrowserProviderLaunchConfig` fields are mapped to `launchContext` options
  using the same shape as the provisioning adapter: `headless`, `proxy`,
  `viewport`, `userAgent`, `locale`, `timezone`, with `contextOptions` carrying
  `storageState`, `deviceScaleFactor`, and `extraHTTPHeaders`
  (`Accept-Language`).
- Unsupported module shapes still return `CLOAK_BROWSER_UNSUPPORTED_API`.
- Import failures still return `CLOAK_BROWSER_UNAVAILABLE`.
- No Playwright or direct fallback.
- The existing `collector:browser:probe` CLI (`pnpm collector:browser:probe --
  --browser-provider cloakbrowser`) tests the same Collector Runtime
  `CloakBrowserProvider` used by the worker.

Both provisioning and Collector Runtime now support the real `launchContext`
API.

## Verification

Required:

- `pnpm typecheck`
- `pnpm web:typecheck`
- `pnpm web:build`
- `pnpm test`
- `pnpm operator:profile:provision:cloakbrowser-probe --`
- `pnpm operator:profile:provision:cloakbrowser-probe -- --launch-headed`
- `pnpm collector:browser:probe -- --browser-provider cloakbrowser`
- `git diff --check`

Coverage targets:

- CLI provider parsing.
- CLI, environment, and default precedence.
- Invalid provider rejection.
- Provider resolution.
- Headed launch config for Playwright and CloakBrowser.
- Real CloakBrowser package/API/binary availability probe with sanitized reason
  codes.
- Opt-in real headed CloakBrowser smoke launch without Facebook login.
- Exact proxy forwarding.
- No proxy or provider fallback.
- Matching normalized session DTOs.
- No submission for empty or incomplete authentication state.
- Cleanup on launch, navigation, capture, submission, and operator interruption
  paths.
- Token, proxy, cookie, and localStorage redaction.
- Preservation of the default Playwright provisioning behavior.
