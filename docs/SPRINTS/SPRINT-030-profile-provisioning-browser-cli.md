# Sprint 030: Profile Provisioning Browser CLI

## Goal

Add a TypeScript operator CLI that consumes a one-time provisioning token, opens a headed browser for manual Facebook login, captures browser session state, submits it to Collector Profile Manager through the existing backend session ingestion flow, and moves the profile to `READY`.

The CLI is an adapter/operator tool. Collector Profile Manager remains the owner of provisioning token validation, session ingestion rules, and lifecycle transitions.

## Scope

- Inspect existing Collector Profile Manager HTTP route files and DTOs for:
  - fetching provisioning configuration by provisioning token.
  - ingesting session state by provisioning token.
- Add a CLI command runnable as:
  - `pnpm profile:provision -- --token <provisioning-token> --base-url http://localhost:8081`
  - `pnpm profile:provision -- --token <provisioning-token> --base-url http://localhost:3000`
- Add argument parsing:
  - `--token` is required.
  - `--base-url` is optional and may default from environment or local development defaults.
  - failures use safe error messages.
- Add a provisioning HTTP client that:
  - gets provisioning configuration by token.
  - ingests captured session state by token.
  - uses actual backend routes and DTOs.
  - preserves backend validation errors safely.
  - never logs cookies, localStorage, proxy passwords, raw session material, token hashes, or trusted runtime secrets.
- Use Playwright Chromium to launch a headed browser.
- Apply provisioning configuration where supported:
  - proxy.
  - user agent.
  - viewport.
  - locale/language.
  - timezone.
- Browser flow:
  - navigate to `https://www.facebook.com/login`.
  - print clear manual-login instructions.
  - wait for explicit operator Enter key confirmation.
  - capture browser context cookies.
  - capture localStorage snapshots for relevant Facebook origins such as `https://www.facebook.com` and `https://m.facebook.com`.
  - submit captured session to backend.
  - close browser on success, failure, and Ctrl+C.
- Add focused automated tests that do not require real Facebook login.
- Add or update operator documentation.

## Architecture Rules

- Keep the CLI outside Collector Profile Manager domain and application code.
- Treat the CLI as an outer adapter/operator tool that consumes Profile Manager HTTP contracts.
- Do not import Profile Manager repositories, database adapters, composition roots, or domain internals.
- Do not duplicate backend lifecycle, provisioning token, or session ingestion rules in the CLI.
- Domain logic must not depend on Playwright, HTTP clients, filesystem, or CLI parsing.

## Security Rules

- Do not automate credentials.
- Do not store passwords.
- Do not solve CAPTCHAs.
- Do not add stealth plugins.
- Do not add rate-limit bypass.
- Do not add access-control bypass.
- Do not capture Facebook content.
- Do not capture GraphQL responses.
- Do not implement runtime collection.
- Do not write cookies or localStorage to disk.
- Do not display or log cookies, localStorage, proxy passwords, token hashes, raw session material, or trusted runtime secrets.
- Treat provisioning tokens as one-time secrets and print only redacted token references, if needed.

## Out Of Scope

- Web UI session ingestion.
- Runtime checkout changes.
- Runtime collection.
- Facebook content capture.
- GraphQL/network interception.
- Source group collection.
- Scheduler or queue integration.
- Authentication or authorization implementation.
- Any backend route expansion unless existing contracts are missing and this sprint documentation is updated first.

## Acceptance Criteria

- CLI command accepts a required provisioning token and optional API base URL.
- CLI fetches provisioning configuration through the real backend token route.
- CLI opens a headed Chromium browser.
- Operator can manually log in to Facebook.
- After the operator presses Enter, the CLI captures cookies and localStorage for relevant Facebook origins.
- CLI submits session state through the real backend token ingestion route.
- Browser closes on success, failure, and Ctrl+C.
- Successful ingestion moves the profile to `READY`.
- Reusing the same provisioning token fails through backend validation.
- Public Web UI profile detail still does not expose session material.
- Automated tests cover argument parsing and runner flow with fakes.
- HTTP client tests are added where practical.
- Tests do not require real Facebook login.
- Captured session material is never printed or written to disk.
- Operator docs explain Web UI provisioning start, token copy, CLI execution, success, one-time-use tokens, and sensitive logging behavior.

## Verification

```bash
pnpm run typecheck
pnpm test
```

Manual verification:

- Create and configure a profile from the Web UI.
- Start provisioning from profile detail.
- Copy the one-time provisioning token from the immediate success UI.
- Run `pnpm profile:provision -- --token <provisioning-token> --base-url http://localhost:8081`.
- Confirm a headed Chromium browser opens.
- Manually log in to Facebook.
- Press Enter in the CLI.
- Confirm session submission succeeds and the profile becomes `READY`.
- Confirm reusing the same token fails.
- Confirm public Web UI profile detail does not expose cookies, localStorage, raw session material, proxy passwords, token hashes, or trusted runtime secrets.
