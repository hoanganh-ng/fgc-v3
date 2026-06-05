# Sprint 000: Project Brain Bootstrap

## Goal

Create a documentation-based project brain for future development.

## Scope

- Add `AGENTS.md` as the Builder entrypoint.
- Add project state, product overview, roadmap, glossary, architecture, and module boundary documents.
- Add Collector Profile Manager functional and non-functional requirements copied from the seed files.
- Add ADRs for project brain structure and collector-first scope.
- Add sprint documentation and an active sprint pointer.

## Out of Scope

- Backend code.
- Frontend code.
- Database selection.
- Browser automation framework selection.
- Profile CRUD implementation.
- Collector Runtime implementation.
- Content Builder implementation.
- Content Publisher implementation.

## Acceptance Criteria

- The requested documentation tree exists.
- `AGENTS.md` instructs future Builders to read `docs/PROJECT_STATE.md`, `docs/ARCHITECTURE.md`, `docs/MODULE_BOUNDARIES.md`, and `docs/SPRINTS/active.md`.
- `AGENTS.md` instructs future Builders to follow only the active sprint.
- `AGENTS.md` records that domain logic must not depend on HTTP, database, browser automation, queues, or framework code.
- `docs/PROJECT_STATE.md` includes current focus, current sprint, decided items, not-decided-yet items, and open questions.
- Product, architecture, module boundary, ADR, and sprint documents describe the requested context.
- `docs/REQUIREMENTS/collector-profile-manager-fr.md` contains the copied contents of `FR.md`.
- `docs/REQUIREMENTS/collector-profile-manager-nfr.md` contains the copied contents of `NFR.md`.

## Completion Notes

Sprint 000 is complete when the project brain documentation is present and no application code has been added.
