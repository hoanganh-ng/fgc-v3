# Sprint 043A: Operator-Assisted Group Access Browser CLI

## Goal

Add a one-shot operator CLI that checks out a specified profile for
`ASSISTED_GROUP_ACCESS`, resolves a safe Content Manager source-group entry
route, opens that route in a headed profile-configured browser for manual
operator inspection, and releases the lease on completion or failure.

## Scope

- Add canonical script `operator:profile:assisted-access`.
- Add compatibility alias `profile:assisted-access:run`.
- Require `--profile-id`, `--source-group-id`, and `--base-url`.
- Support optional `--entry-route-id`, `--browser-provider`,
  `--max-duration-ms`, and `--allow-high-risk-route`.
- Default `--max-duration-ms` to `600000` and validate `30000-1800000`.
- Extend the Collector Runtime-owned source-group lookup contract with minimal
  safe entry-route data: `id`, `type`, `url`, `riskLevel`, and `isDefault`.
- Keep Collector Runtime independent of Content Manager domain types.
- Extend `ContentManagerHttpClient` to parse source-group entry routes while
  preserving existing collection behavior.
- Extend `ProfileManagerHttpClient` with
  `checkoutProfileForAssistedGroupAccess(profileId, sourceGroupId)`.
- Fetch trusted runtime configuration using the returned lease id.
- Launch the selected browser provider with `headless=false` through
  `buildBrowserProviderLaunchConfig`.
- Navigate only to the selected entry-route URL.
- Add an injectable `AssistedAccessSessionControlPort`.
- Make the real CLI adapter wait for Enter, while tests use fakes that never
  wait on stdin.
- Clamp session duration so cleanup starts before lease expiry.
- Always attempt browser close and lease release using cleanup logic.

## Route Selection

- Source group must be `FACEBOOK` and `ACTIVE`.
- Explicit `--entry-route-id` must match exactly.
- Without an explicit route, select the single default entry route.
- If no default exists, derive a `DIRECT_GROUP_URL` route from `sourceGroup.url`
  with `MEDIUM` risk.
- Reject multiple defaults.
- Reject malformed or non-HTTP(S) URLs.
- Reject `HIGH`-risk routes unless `--allow-high-risk-route` is present.

## Out Of Scope

- Joining groups or submitting join requests.
- Automated clicks, search, form input, likes, comments, posts, shares, or
  messages.
- Content capture, extraction, or submission.
- Access-state detection or mutation.
- Run records or database migrations.
- Account-stage updates.
- Profile-source access updates.
- Logging or persisting cookies, localStorage, proxy credentials, session
  headers, runtime configuration, fingerprint secrets, page HTML, screenshots,
  or raw network payloads.

## Verification

Run and report:

- `pnpm web:typecheck`
- `pnpm typecheck`
- `pnpm test`
- `pnpm operator:profile:assisted-access -- --help`
- `pnpm profile:assisted-access:run -- --help`
- `git diff --check`
