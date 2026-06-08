# Sprint 014A: Collector Extraction Boundary Amendment

## Goal

Amend the Content Manager boundary so raw platform-specific payload parsing belongs to the Collector Runtime side under a Platform Extractor boundary.

This is a documentation-only sprint.

## Scope

- Define Platform Extractor as a collection-side component.
- Define Facebook GraphQL Payload Extractor as the first planned extractor.
- Clarify that raw Facebook GraphQL payload parsing does not belong in Content Manager core.
- Clarify ownership between Collector Runtime / Platform Extractor and Content Manager.
- Clarify the canonical collection ingestion flow:

```text
raw GraphQL payload
-> Facebook GraphQL Payload Extractor
-> normalized Content Manager ingestion input
-> Content Manager validation/upsert/storage
```

- Clarify that Content Manager should not accept raw Facebook GraphQL payloads as its primary ingestion contract.
- Record that optional future raw payload storage, if any, is diagnostic and not the canonical content model.
- Update roadmap sequencing for Content Manager, extractor, runtime submission, and Web UI foundation work.
- Add an ADR for the platform extractor boundary.

## Out Of Scope

- Source implementation files.
- Parser code.
- Test fixtures.
- Database migrations.
- Repository adapters.
- HTTP routes.
- Collector Runtime implementation.
- Content Manager domain implementation.
- Collector Profile Manager behavior changes.
- Content Builder or Content Publisher implementation.

## Acceptance Criteria

- `docs/SPRINTS/active.md` identifies Sprint 014A as the active sprint.
- Project brain docs identify Facebook GraphQL parsing as Collector Runtime / Platform Extractor responsibility, not Content Manager core responsibility.
- Project brain docs define Platform Extractor.
- Project brain docs name Facebook GraphQL Payload Extractor as the first planned extractor.
- Content Manager requirements define normalized ingestion input as the Content Manager ingestion contract.
- Content Manager requirements state that raw Facebook GraphQL payloads are not the primary ingestion contract.
- Roadmap keeps Sprints 015-018 focused on Content Manager, then assigns Sprint 019 to Facebook GraphQL Payload Extractor, Sprint 020 to Collector Runtime Submission Flow, and Sprint 021 to Profile + Content Manager Web UI Foundation.
- No source implementation files, migrations, parser fixtures, HTTP routes, repositories, or tests are added.

## Verification

Because this is a documentation-only sprint, verification is limited to document review and repository diff inspection:

```bash
git diff --name-only
```

The changed files should be under `docs/` only. No source implementation files, migration files, parser fixtures, repositories, HTTP routes, or tests should appear in the diff.

