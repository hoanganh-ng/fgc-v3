# Builder Entrypoint

This repository uses a documentation-based project brain. Future Builders must start each session by reading these files in order:

1. `docs/PROJECT_STATE.md`
2. `docs/ARCHITECTURE.md`
3. `docs/MODULE_BOUNDARIES.md`
4. `docs/SPRINTS/active.md`

Future Builders must follow only the active sprint identified in `docs/SPRINTS/active.md`. Do not work ahead into inactive roadmap items, future modules, or implementation details unless the active sprint explicitly calls for that work.

## Architecture Rule

Domain logic must not depend on HTTP, database, browser automation, queues, or framework code. Domain rules belong in the core and must interact with outside technology only through ports owned by the application core.

## Current Project Focus

The current product focus is the Content Video Pipeline, starting with the Content Collector stage. The first core module is the Collector Profile Manager.

## Sprint Discipline

Before changing files, confirm the active sprint scope. If a requested change conflicts with the active sprint, update the sprint documentation first or ask for direction.
