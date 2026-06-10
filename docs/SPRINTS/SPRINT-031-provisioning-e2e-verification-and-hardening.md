# Sprint 031: Provisioning E2E Verification & Hardening

## Goal

Run and verify the complete profile provisioning flow end to end with the Dockerized stack, Web UI, operator CLI, and manual Facebook login. Fix only small integration and operator-safety issues found during verification.

The intended flow is:

```text
create profile
-> configure profile
-> start provisioning
-> copy one-time token
-> run CLI
-> manually log in to Facebook
-> capture cookies/localStorage
-> ingest session
-> profile becomes READY
```

## Scope

- Start the Dockerized stack, preferably preview mode through Nginx.
- Open the Web UI.
- Create a new profile.
- Configure it with valid safe defaults.
- Start provisioning from the Web UI.
- Copy the returned one-time provisioning token.
- Run:

```bash
pnpm profile:provision -- --token <provisioning-token> --base-url http://localhost:8081
```

- In the headed browser, manually log in to Facebook.
- Press Enter in the terminal after login is complete.
- Confirm the CLI submits session state successfully.
- Confirm the profile becomes `READY` in the Web UI and backend safe read API.
- Confirm reusing the same token fails.
- Confirm public profile list/detail reads do not expose:
  - cookies.
  - localStorage.
  - raw session state.
  - token hashes.
  - provisioning token material.
  - proxy passwords.
  - trusted runtime secrets.

## Allowed Fixes

- Fix DTO or route mismatches between CLI and backend.
- Fix localStorage capture origin handling.
- Fix safe error messages.
- Fix browser cleanup behavior.
- Fix operator documentation.
- Fix minor Web UI or operator instruction issues.

## Hardening Checks

- Invalid tokens fail safely.
- Reused tokens fail safely.
- Ctrl+C closes the browser.
- Backend ingestion failure closes the browser.
- CLI does not log cookies, localStorage, proxy passwords, tokens, token hashes, raw session material, or trusted runtime secrets.
- CLI does not write captured session material to disk.
- Operator docs are accurate.

## Architecture Rules

- Keep browser automation in the operator CLI/adapters.
- Do not move Playwright, HTTP clients, filesystem behavior, or CLI parsing into Collector Profile Manager domain or application code.
- Do not duplicate backend lifecycle, provisioning token, or session ingestion rules in the CLI.
- Do not expand public safe-read DTOs with sensitive session, provisioning token, proxy password, or trusted runtime data.

## Out Of Scope

- Facebook content capture.
- GraphQL response capture.
- Group scrolling.
- Collector Runtime browser capture adapter.
- Scheduler or queue integration.
- Collection runs.
- Credential automation.
- CAPTCHA solving.
- Stealth plugins.
- Rate-limit bypass.
- Access-control bypass.

## Acceptance Criteria

- Docker preview stack starts.
- Full provisioning flow succeeds once with a real manual login.
- Profile reaches `READY`.
- Reusing the same provisioning token fails.
- Invalid token usage fails with safe output.
- Browser closes on success, failure, and Ctrl+C.
- Backend ingestion failure closes the browser.
- Public Web UI profile views and backend safe reads do not expose cookies, localStorage, raw session state, token hashes, provisioning token material, proxy passwords, or trusted runtime secrets.
- CLI output and logs do not expose cookies, localStorage, proxy passwords, tokens, token hashes, raw session material, or trusted runtime secrets.
- CLI does not write captured session material to disk.
- Operator docs accurately describe the verified flow and safety behavior.

## Verification

```bash
pnpm run typecheck
pnpm test
```

Manual verification:

- Start Docker preview stack.
- Create and configure a profile from the Web UI.
- Start provisioning from profile detail.
- Copy the one-time provisioning token from the immediate success UI.
- Run `pnpm profile:provision -- --token <provisioning-token> --base-url http://localhost:8081`.
- Confirm a headed Chromium browser opens.
- Manually log in to Facebook.
- Press Enter in the CLI.
- Confirm session submission succeeds.
- Confirm the profile becomes `READY` in Web UI and backend safe read API.
- Confirm reusing the same token fails.
- Confirm invalid token usage fails safely.
- Confirm public Web UI profile views and backend safe reads do not expose sensitive session, token, provisioning, proxy password, or trusted runtime data.
