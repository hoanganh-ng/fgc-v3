# ADR-0001: Project Brain Structure

## Status

Accepted

## Context

The project is at the start of development. Future Builders need a stable source of truth before implementation begins. Without a shared project brain, early implementation choices could drift into framework selection, database selection, module coupling, or work outside the active sprint.

## Decision

Create a documentation-based project brain with:

- `AGENTS.md` as the Builder entrypoint.
- `docs/PROJECT_STATE.md` for current focus, sprint, decisions, unknowns, and open questions.
- `docs/PRODUCT_OVERVIEW.md` for product-level context.
- `docs/ROADMAP.md` for broad sequencing.
- `docs/GLOSSARY.md` for shared vocabulary.
- `docs/ARCHITECTURE.md` for architectural direction.
- `docs/MODULE_BOUNDARIES.md` for ownership boundaries.
- `docs/REQUIREMENTS/` for functional and non-functional requirements.
- `docs/DECISIONS/` for ADRs.
- `docs/SPRINTS/` for active and historical sprint scope.

Future Builders must read the project state, architecture, module boundaries, and active sprint before changing files.

## Consequences

- The repository has a durable orientation layer before application code exists.
- Sprint scope is explicit and can be enforced by `docs/SPRINTS/active.md`.
- Early architectural constraints are captured without prematurely selecting frameworks or infrastructure.
- Requirements copied from the seed files are preserved under module-specific requirement documents.
