# Sprint 014: Content Manager Requirement Amendment and Boundary Definition

## Goal

Add Content Manager to the project brain and define its boundaries, requirements, initial model, storage direction, and roadmap before implementation begins.

This is a documentation and design sprint only.

## Scope

- Update project brain documents for the next Content Collector module.
- Define Content Manager as part of the Content Collector stage.
- Define the module separation between Collector Profile Manager, Content Manager, and Collector Runtime.
- Define Content Manager ownership and explicit non-ownership.
- Define Collector Runtime's future responsibility for collecting Facebook content and submitting it to Content Manager.
- Define Facebook as the first platform.
- Define Facebook knowledge groups as the first source type.
- Define managed group categories.
- Define source group fields and source group statuses.
- Define Facebook rich text posts as the first content item type.
- Define content item fields and content lifecycle statuses.
- Define v1 top high-engagement comment handling.
- Define v1 content deduplication and upsert rules.
- Add an ADR for introducing Content Manager before Web UI and Collector Runtime.
- Add storage planning notes for likely future PostgreSQL persistence.
- Update the roadmap so Sprint 015 is Content Manager Domain Model.

## Out of Scope

- Source implementation files.
- Database migrations.
- Repository adapters.
- HTTP routes.
- Tests.
- Facebook integration.
- Browser automation.
- Collector Runtime execution.
- Web UI.
- Behavior changes to Collector Profile Manager.
- Content Builder or Content Publisher implementation.

## Acceptance Criteria

- `docs/SPRINTS/active.md` identifies Sprint 014 as the active sprint.
- `docs/PROJECT_STATE.md` identifies Sprint 014 as the current sprint.
- Product overview, roadmap, glossary, architecture, and module boundary docs include Content Manager where appropriate.
- `docs/REQUIREMENTS/content-manager.md` defines Content Manager boundaries, fields, statuses, deduplication, comments, and v1 scope.
- `docs/DECISIONS/ADR-014-content-manager-boundaries.md` explains why Content Manager is introduced before Web UI and Collector Runtime.
- `docs/STORAGE/content-manager-storage-notes.md` records likely future tables, JSONB direction, root operational fields, and indexes.
- Content Manager is clearly part of Content Collector.
- Module separation is clear for Collector Profile Manager, Content Manager, and Collector Runtime.
- Roadmap points to Sprint 015 as Content Manager Domain Model.
- No application code, migrations, repositories, HTTP routes, or tests are added.

## Verification

Because this is a documentation-only sprint, verification is limited to document review and repository diff inspection:

```bash
git diff --name-only
```

The changed files should be under `docs/` only. No source implementation files, migration files, repositories, HTTP routes, or tests should appear in the diff.

