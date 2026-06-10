# Sprint 034A: Collector CLI Source Group Resolution + Checkout Diagnostics

## Goal

Make `sourceGroupId` the primary input for manual Facebook collector runs, resolve the Facebook group URL from Content Manager source group records, and improve safe troubleshooting output for profile checkout failures.

## Scope

- Inspect existing Content Manager source group APIs and DTOs.
- Update the manual Facebook collector command so normal usage is:

```bash
pnpm collector:facebook:run -- --source-group-id <source-group-id> --base-url http://localhost:8081
```

- Resolve source groups by `sourceGroupId`.
- Prefer a safe read endpoint, `GET /collector/source-groups/:sourceGroupId`, if the backend pattern supports it.
- If a dedicated read endpoint is not already available or does not fit the backend shape, use the existing source group list API and find by id as a temporary adapter-level solution.
- Validate the resolved source group before browser launch:
  - source group exists
  - platform is `FACEBOOK`
  - status is `ACTIVE`
  - source/group URL exists
- Use the stored source/group URL for browser navigation.
- Use the same `sourceGroupId` for Content Manager submission.
- Keep `--group-url` as a development override only:
  - `--source-group-id` remains required
  - `--group-url` is optional
  - the command prints a safe warning when `--group-url` overrides the stored source URL
  - operator docs recommend sourceGroupId-only usage
- Improve safe checkout failure output for `NO_ELIGIBLE_PROFILE_AVAILABLE`.
- Add optional `--diagnose-checkout` safe diagnostics if practical, limited to safe profile status counts.
- Update operator documentation for preview/direct API base URLs and checkout eligibility troubleshooting.

## Security Rules

Do not print or expose:

- Cookies.
- localStorage.
- Proxy credentials.
- Raw Facebook payloads.
- Request or response headers.
- Authorization or session headers.
- Token material.
- Trusted runtime configuration.

Diagnostics may print only safe aggregate profile counts:

- Total profiles.
- `READY` count.
- `BUSY` count.
- `PENDING_LOGIN` count.
- `PENDING_CONFIG` count.

## Out Of Scope

- Scheduler.
- Worker process.
- `collection_runs` table.
- Web UI Run Now button.
- Advanced eligibility API.
- Automatic retries.
- Multi-group collection.
- Multi-profile collection.
- Stealth plugins.
- CAPTCHA solving.
- Rate-limit bypass.
- Access-control bypass.
- Raw payload persistence.

## Acceptance Criteria

- `pnpm collector:facebook:run -- --source-group-id <source-group-id> --base-url http://localhost:8081` resolves the source URL from Content Manager.
- `--source-group-id` is required.
- `--group-url` remains available only as an optional development override and prints a safe warning when used.
- PAUSED and ARCHIVED source groups are rejected before browser launch.
- Invalid `sourceGroupId` produces a clear safe error.
- The collector navigates to the resolved source URL and submits collected content using the same `sourceGroupId`.
- Checkout failures caused by `NO_ELIGIBLE_PROFILE_AVAILABLE` print safe useful diagnostic hints.
- Optional `--diagnose-checkout` prints only safe profile status counts if implemented.
- Operator docs show sourceGroupId-only usage as the normal path.

## Verification

```bash
pnpm run typecheck
pnpm test
pnpm --filter @fgc/web build
```

Manual verification:

- Run the collector with only `--source-group-id` and confirm it resolves the source URL from Content Manager.
- Confirm PAUSED and ARCHIVED source groups are rejected before browser launch.
- Confirm an invalid `sourceGroupId` gives a clear safe error.
- Confirm checkout failure output includes safe troubleshooting hints.
