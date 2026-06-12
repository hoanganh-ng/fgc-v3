# Sprint 037A: Browser Provider Boundary + CloakBrowser Feasibility

## Goal

Add a Collector Runtime browser-provider boundary and validate CloakBrowser as an optional experimental provider without changing the default Playwright Chromium collector path.

## Scope

- Add a Collector Runtime browser provider port owned by the application layer.
- Refactor the Facebook browser payload capture adapter so browser launch, context creation, page creation, and close behavior go through the provider boundary.
- Keep `PLAYWRIGHT_CHROMIUM` as the default provider and preserve existing Playwright behavior when no provider is configured.
- Add an experimental `CLOAK_BROWSER` provider adapter that is configuration-gated and fails with clear sanitized setup guidance when CloakBrowser is unavailable or cannot honor the required profile-owned launch contract.
- Support provider selection from `BROWSER_PROVIDER` and, where practical, `--browser-provider`.
- Ensure manual Facebook collection and the Sprint 037 worker path both use the provider boundary through the existing collector runner.
- Add a backend-free browser probe command:
  - `pnpm collector:browser:probe -- --browser-provider playwright`
  - `pnpm collector:browser:probe -- --browser-provider cloakbrowser`
- Keep existing page-context `fetch`/XHR instrumentation attached through the provider abstraction.
- Derive provider launch configuration from Profile Manager trusted runtime configuration.

## Provider Names

- `PLAYWRIGHT_CHROMIUM`
- `CLOAK_BROWSER`

Accepted operator configuration values:

- `playwright`
- `cloakbrowser`

## Controlled Browser Provider Rule

Browser-provider hardening is allowed only inside Collector Runtime infrastructure. Profile Manager remains the authority for profile identity, session, proxy, and fingerprint configuration. Browser providers must consume profile-owned runtime configuration and must not randomize or mutate profile identity outside Profile Manager.

No CAPTCHA solving. No credential automation. No rate-limit or access-control bypass. No posting, commenting, or liking. Checkpoint pages must be detected and surfaced as profile/session health issues, not bypassed automatically. No raw payload, session, runtime secret, proxy credential, or fingerprint secret logging or persistence.

## Launch Configuration

Provider launch configuration must be derived from the trusted runtime configuration returned by Profile Manager after checkout. At minimum it should carry supported profile-owned values for:

- proxy
- viewport
- user agent
- locale and language header
- timezone
- storage state for cookies and localStorage
- provider fingerprint seed or config when available

If selected provider setup cannot honor the required profile-owned launch contract, it must fail fast with a sanitized error.

## Out Of Scope

- Full worker containerization.
- Scheduler.
- Run history UI.
- Run Now UI.
- Automatic checkpoint bypass.
- CAPTCHA solving.
- Credential automation.
- New profile health UI.
- Per-source-group browser provider config.
- Browser provider selection in the Web UI.
- Full migration to CloakBrowser.
- Removing the Playwright default.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm collector:browser:probe -- --browser-provider playwright`
- `pnpm collector:browser:probe -- --browser-provider cloakbrowser` when CloakBrowser is available locally, or confirm it fails gracefully with sanitized setup guidance when unavailable.

When a provisioned preview stack and source group are available, also verify:

```bash
pnpm collector:facebook:run -- --source-group-id <source-group-id> --base-url http://localhost:8081 --max-scrolls 1 --max-duration-ms 15000
```
