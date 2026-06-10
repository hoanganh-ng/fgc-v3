# Sprint 034B: Page-Context Facebook Fetch/XHR Capture

## Goal

Adapt the proven page-context `fetch` and `XMLHttpRequest` capture strategy into the Playwright Facebook collector so relevant Facebook payloads can be captured when browser/network response observation alone produces zero GraphQL captures.

## Context

Sprint 032 added a Playwright Facebook browser payload capture adapter using browser/network response observation.
Sprint 034A made `sourceGroupId` the primary collector input and added source group resolution and checkout diagnostics.

Manual validation after Sprint 034A confirmed:

- A stored READY profile can be checked out successfully.
- The browser opens Facebook with the stored login session.
- Source group resolution works.
- The lease is released.
- Capture may still report zero GraphQL responses, zero extractor candidates, and zero submitted content items.

## Scope

- Inspect and update the existing Playwright capture adapter at `src/collector-runtime/infrastructure/facebook-browser-payload-capture.ts`.
- Add page-context instrumentation before page navigation using Playwright `page.addInitScript` or equivalent.
- Patch `window.fetch`, `XMLHttpRequest.prototype.open`, and `XMLHttpRequest.prototype.send` in the page context.
- Capture matching `fetch` responses by cloning the response, reading clone text, parsing safe JSON payloads, and returning the original response unchanged.
- Capture matching XHR responses by tracking request URL from `open`, inspecting response URL or stored URL and content type on load, parsing safe JSON payloads, and leaving the XHR behavior unchanged.
- Capture if URL contains `/api/graphql`, `/graphql`, or `/ajax/`, or content type includes `application/json`.
- Parse normal JSON, Facebook `for (;;);` prefixed JSON, and newline-separated JSON records.
- Ignore parse failures safely without logging raw bodies.
- Use a safe Playwright bridge such as `page.exposeBinding` or `page.exposeFunction`.
- Use captured message shape:

```ts
{
  url: string;
  pageUrl: string;
  body: unknown;
  capturedAt: string;
  transport: "fetch" | "xhr";
}
```

- Hold parsed captured bodies in memory only and pass them into the existing Facebook extractor flow.
- Keep the existing Playwright network response listener as secondary diagnostics/capture.
- Combine payloads from page-context fetch/XHR instrumentation and the existing network listener.
- Add simple local in-memory deduplication so a payload captured by both channels is not processed twice.
- Add safe diagnostic counts to the collection summary:
  - Page-context fetch captures.
  - Page-context XHR captures.
  - Network listener captures.
  - Parse failure count.
  - Total payloads passed to extractor.
  - Final sanitized page URL.
  - Login redirect suspected yes/no.
- Add or update tests for capture rules, parser behavior, URL sanitization, page-context counters, safe parse failures, and no-real-Facebook behavior.
- Update operator docs for page-context capture behavior, recommended command, zero capture troubleshooting, and the guarantee that raw payloads are not logged or persisted.

## Security Rules

Do not print or persist:

- Raw payloads.
- Cookies.
- localStorage.
- Proxy credentials.
- Request headers.
- Response headers.
- Request bodies.
- Authorization or session values.
- Viewer or account identifiers.
- Trusted runtime configuration.

## Out Of Scope

- Scheduler.
- Worker process.
- `collection_runs` table.
- Web UI Run Now button.
- Multi-source collection.
- Advanced feed heuristics.
- Comment expansion.
- Stealth plugins.
- CAPTCHA solving.
- Credential automation.
- Rate-limit bypass.
- Access-control bypass.
- Posting, commenting, or liking.
- Raw payload persistence.

## Acceptance Criteria

- The collector injects page-context `fetch` and XHR instrumentation before navigating to the Facebook source group.
- Page-context capture handles `/api/graphql`, `/graphql`, `/ajax/`, and JSON content-type responses.
- Normal JSON, `for (;;);` prefixed JSON, and newline-separated JSON records are parsed safely.
- Parse failures are counted but never expose raw response bodies.
- Captured page-context bodies and network-listener bodies are combined with local deduplication before extractor submission.
- Collection summary includes safe page-context, network, parse failure, extractor input, final sanitized URL, and login redirect suspicion diagnostics.
- Existing network response listener remains available as secondary capture/diagnostics.
- Operator docs recommend source-group-only collector usage with page-context capture.

## Verification

```bash
pnpm run typecheck
pnpm test
```

Manual verification:

```bash
pnpm collector:facebook:run -- --source-group-id <source-group-id> --base-url http://localhost:8081 --max-scrolls 8 --max-duration-ms 60000
```

Expected manual behavior:

- Browser opens logged in.
- Page-context fetch/XHR capture count is greater than zero if Facebook returns relevant payloads.
- Existing extractor receives captured bodies.
- Content Manager receives normalized candidates if the extractor finds valid posts.
- Lease is released.
- No sensitive session, runtime, or raw payload data appears in output or logs.
