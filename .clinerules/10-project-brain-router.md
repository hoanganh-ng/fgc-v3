# Project-brain context router

This is a routing index, not a mandatory reading list. Follow `AGENTS.md` first and
load only the context required by the active sprint or a discovered dependency.

## Canonical destinations

- Active implementation authority:
  `docs/SPRINTS/active.md` -> referenced active sprint -> its `Required Context`.
- Concise current product state and available capabilities:
  `docs/PROJECT_SNAPSHOT.md`.
- Historical milestones only:
  `docs/PROJECT_HISTORY.md`.
- Cross-cutting dependency direction and durable architecture:
  `docs/ARCHITECTURE.md`.
- Module-specific ownership, invariants, paths, and focused verification:
  - Collector Profile Manager: `docs/modules/collector-profile-manager.md`
  - Content Manager: `docs/modules/content-manager.md`
  - Collector Runtime: `docs/modules/collector-runtime.md`
  - Web UI: `docs/modules/web-ui.md`
- Cross-module boundary detail needed by an affected contract:
  `docs/MODULE_BOUNDARIES.md`.
- Runtime, commands, workers, and deployment behavior:
  `docs/RUNTIME.md` and relevant package scripts.
- Durable decision rationale:
  the directly relevant file under `docs/DECISIONS/`.

## Loading discipline

- Do not read `PROJECT_HISTORY.md`, historical sprints, every ADR, or every module
  document to begin a normal implementation task.
- If an active sprint has no `Required Context` section, use only files named by the
  sprint plus the affected implementation, nearby tests, and relevant scripts described
  by `AGENTS.md`; report the missing section rather than compensating with a broad scan.
- Do not use historical documents as evidence of current runtime behavior.
- Treat `FR.md` and `NFR.md`, when present, as seed requirements for the original
  Profile Property Manager work, not as the current global project brain. Load them
  only when the active sprint explicitly references them or a requirement trace is
  necessary.
- Prefer nearby implementation and tests for observed current behavior. When they
  conflict materially with current documentation or the active sprint, report the
  discrepancy instead of selecting the most convenient source.
