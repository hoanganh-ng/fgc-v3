# Sprint 032: Facebook Browser Payload Capture Adapter

## Goal

Add the first real Facebook browser payload capture adapter for a manual/dev single-group Collector Runtime run.

The intended flow is:

```text
checkout eligible READY profile
-> fetch trusted runtime profile configuration
-> launch headed browser with existing session material
-> visit one Facebook group URL
-> capture Facebook GraphQL JSON responses in memory
-> run the existing Facebook GraphQL extractor
-> submit normalized candidates to Content Manager
-> release profile lease
-> print a safe operator summary
```

## Scope

- Support one READY profile.
- Support one Facebook group URL.
- Support one browser session.
- Capture GraphQL responses whose URL contains `/api/graphql`.
- Prefer JSON responses with `application/json` content type when available.
- Ignore unparsable or non-JSON responses.
- Use existing Collector Runtime profile-orchestrated collection flow instead of duplicating orchestration.
- Use existing Profile Manager HTTP client, trusted runtime configuration contract, Facebook GraphQL extractor, and Content Manager HTTP client.
- Add a dev/operator command similar to:

```bash
pnpm collector:facebook:run -- --group-url "https://www.facebook.com/groups/<group>" --base-url http://localhost:8081 --max-scrolls 3 --max-duration-ms 30000
```

## Adapter Requirements

- Keep Playwright and browser code in Collector Runtime infrastructure/adapters or operator tooling.
- Launch the browser using trusted runtime profile configuration.
- Apply cookies and localStorage from runtime configuration.
- Apply proxy settings where supported.
- Apply user agent, viewport, locale/language, and timezone where supported.
- Visit the provided Facebook group URL.
- Listen for likely Facebook GraphQL network responses.
- Parse JSON payloads safely.
- Return captured payload objects in memory.
- Close the browser on success, failure, and interruption.

## Stop Conditions

- `maxScrolls`, default `3`.
- `maxDurationMs`, default `30000`.
- Browser or page error.
- Operator interruption.

## Safe Summary

Output may include:

- Lease released yes/no.
- GraphQL responses captured count.
- Extractor candidates produced count.
- Content items submitted count.
- Extractor warning count.
- Duration.

Output must not include:

- Cookies.
- localStorage.
- Proxy credentials.
- Raw GraphQL payloads.
- Request or response headers.
- Authorization or session headers.
- Viewer or account identifiers.
- Trusted runtime configuration.
- Token material or hashes.

## Error Handling

Handle safely:

- No eligible READY profile.
- Checkout failure.
- Runtime configuration fetch failure.
- Browser launch failure.
- Facebook redirects to login.
- Inaccessible group.
- Zero captured payloads.
- Zero extracted candidates.
- Content Manager submission failure.
- Timeout.
- Ctrl+C.

The profile lease must be released in success and failure paths.

## Architecture Rules

- Keep browser automation out of Collector Profile Manager domain and application code.
- Keep browser automation in Collector Runtime infrastructure/adapters or operator tooling.
- Do not import Profile Manager repositories, Content Manager repositories, Drizzle schema, database adapters, Fastify routes, or composition roots into Collector Runtime.
- Do not duplicate backend lifecycle, provisioning token, or session ingestion rules in the CLI.
- Do not expand public safe-read DTOs with sensitive session, provisioning token, proxy password, or trusted runtime data.

## Out Of Scope

- Scheduler.
- Queue.
- `collection_runs` table.
- Multi-group runs.
- Multi-profile runs.
- Web UI run button.
- Source group selection UI.
- Automatic group discovery.
- Credential automation.
- CAPTCHA solving.
- Stealth plugins.
- Anti-detection tricks.
- Rate-limit bypass.
- Access-control bypass.
- Posting, commenting, or liking.
- Raw payload persistence.

## Acceptance Criteria

- `pnpm run typecheck` passes.
- `pnpm test` passes.
- With preview stack running and one real READY profile, the operator command launches the browser.
- The Facebook group page loads using the existing session.
- GraphQL responses are captured in memory.
- Existing extractor produces normalized candidates or warnings.
- Normalized candidates are submitted to Content Manager.
- Profile lease is released.
- Content items appear through Content Manager API if candidates are found.
- No sensitive session, runtime, or raw payload data appears in CLI output, logs, Web UI, or public API reads.

## Verification

```bash
pnpm run typecheck
pnpm test
```

Manual verification:

- Start Docker preview stack.
- Confirm one provisioned profile is `READY`.
- Run the operator command with a Facebook group URL.
- Confirm a headed browser opens.
- Confirm the group page loads using the existing session.
- Confirm GraphQL responses are captured.
- Confirm extractor candidates are submitted to Content Manager when found.
- Confirm the profile lease is released.
- Confirm safe output does not expose cookies, localStorage, proxy credentials, raw GraphQL payloads, headers, viewer/account identifiers, trusted runtime config, token material, or hashes.
