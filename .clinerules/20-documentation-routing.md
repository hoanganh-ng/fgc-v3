---
paths:
  - "docs/**"
  - "README.md"
  - "AGENTS.md"
  - ".clinerules/**"
---

# Documentation placement and drift control

Update only documentation required by the active sprint or the Product Owner.
Keep each fact in the narrowest authoritative document instead of repeating it across
the project brain.

## Place information by purpose

- Current capabilities, current focus, unresolved risks, and immediate next work:
  `docs/PROJECT_SNAPSHOT.md`.
- Completed milestone chronology:
  `docs/PROJECT_HISTORY.md`.
- Module-specific ownership, invariants, important paths, and focused commands:
  the relevant file under `docs/modules/`.
- Cross-cutting architecture and dependency direction:
  `docs/ARCHITECTURE.md`.
- Cross-module contract boundaries:
  `docs/MODULE_BOUNDARIES.md`, only when the boundary itself changes.
- Runtime commands, workers, Docker behavior, and operator execution:
  `docs/RUNTIME.md` or `README.md`, according to existing placement.
- Durable decisions and rationale:
  a focused ADR under `docs/DECISIONS/`.
- Sprint-specific requirements, exclusions, evidence, and status:
  the sprint document.
- Active sprint selection:
  `docs/SPRINTS/active.md`, changed only with Product Owner approval.

## Avoid duplication

- Prefer `docs/modules/*` for new module-specific detail; do not add another full
  module summary to `ARCHITECTURE.md`, `MODULE_BOUNDARIES.md`, or the snapshot.
- Keep `PROJECT_SNAPSHOT.md` concise. Move chronology to `PROJECT_HISTORY.md` rather
  than accumulating sprint-by-sprint prose in the snapshot.
- Do not create Memory Bank files, alternate project-state files, or another Builder
  guidance file alongside `AGENTS.md`.
- When a durable change touches several documents, update the smallest coherent set
  and use links instead of copying the same rules into each file.
- Distinguish implemented, tested, manually validated, inspected, experimental, and
  deferred behavior. Documentation claims must match available evidence.
