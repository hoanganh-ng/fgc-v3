# Sprint 020: Facebook GraphQL Payload Extractor

## Goal

Implement the collection-side Facebook GraphQL Payload Extractor that converts captured Facebook GraphQL response bodies into normalized Content Manager ingestion input candidates while preserving module boundaries.

## Scope

- Add a Collector Runtime / Platform Extractor module for Facebook GraphQL payload extraction.
- Locate extractor code under `src/collector-runtime/platform-extractors/facebook`.
- Define extractor input types for captured GraphQL response bodies, not HTTP requests.
- Define extractor output candidates that structurally match normalized Content Manager collected content ingestion input.
- Accept `unknown` payloads and traverse nested object/array structures safely.
- Extract post identity, source URL, rich text body, optional title, optional author metadata, optional posted timestamp, engagement counts, optional share counts, and candidate top comments.
- Extract comment identity, body text, optional author metadata, reaction count, optional reply count, optional posted timestamp, and collection timestamp.
- Sort comments by reaction count descending with deterministic tie-breaking and keep the top N, defaulting to 10.
- Skip invalid post/comment candidates with warnings.
- Return zero candidates with warnings for malformed or unsupported payloads.
- Deduplicate duplicate post candidates inside a single payload by external post id.
- Add sanitized synthetic extractor fixtures, sanitized real Facebook payload fixtures when available, and unit tests.
- Update project state and boundary documentation for Sprint 020.

## Out Of Scope

- Content Manager domain, application, repository, HTTP route, Fastify, Drizzle, PostgreSQL, or composition-root changes.
- Browser automation.
- Network interception.
- Profile checkout or lease handling.
- Collector Runtime workflow orchestration.
- HTTP submission to Content Manager.
- Database access or new database tables.
- Raw Facebook GraphQL payloads as Content Manager contracts.
- Cookies, tokens, authorization headers, viewer IDs, private user data, raw request headers, or sensitive account/session details in fixtures.
- Content Builder.
- Publisher.
- Web UI.

## Acceptance Criteria

- Active sprint documentation identifies Sprint 020 as the active sprint.
- The Facebook extractor lives under the Collector Runtime / Platform Extractor boundary.
- Extractor code does not import Content Manager infrastructure, repositories, HTTP routes, Fastify, Drizzle, PostgreSQL, or composition root.
- Extractor output structurally matches normalized Content Manager ingestion input and does not include the raw GraphQL payload.
- The extractor never throws for normal malformed or unsupported payload shapes.
- Unsupported payloads return zero candidates plus warnings.
- The extractor safely walks nested object and array structures rather than depending on one exact GraphQL path.
- Rich text extraction handles plain strings, objects with text-like fields, and arrays of fragments conservatively.
- Comments are sorted by reaction count descending, tie-broken deterministically, and limited to the default top 10 unless configured otherwise.
- Invalid comments without id or body text are skipped with warnings.
- Duplicate post candidates in one payload are deduplicated deterministically and documented in tests.
- Unit tests cover valid post extraction, engagement counts, top comments, optional missing metadata, unsupported payloads, malformed payloads, deduplication, and omission of raw payload data.
- Fixtures are sanitized. Synthetic fixtures are clearly named as synthetic, and real Facebook payload fixtures must have viewer, token, cookie, authorization, session, and other sensitive fields removed before use.

## Verification

```bash
pnpm run typecheck
pnpm test
git status --short
```
