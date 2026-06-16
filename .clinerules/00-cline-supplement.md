# Cline-only Builder supplement

This file supplements `AGENTS.md`; it is not a second project brain.
Do not copy architecture, security, module ownership, sprint scope, or baseline
verification rules into this file. Those remain authoritative in `AGENTS.md`,
`docs/SPRINTS/active.md`, and the active sprint document.

## Authority and conflicts

Use this order when sources disagree:

1. The Product Owner's current explicit instruction.
2. The active sprint document referenced by `docs/SPRINTS/active.md`.
3. `AGENTS.md`.
4. Relevant implementation, tests, and current project/module documentation.
5. This Cline-specific supplement.

Do not blend conflicting instructions silently. Report a material conflict before
expanding scope or changing ownership, security, persistence, or public contracts.

## Cline-specific behavior

- Follow the progressive context-loading process in `AGENTS.md`. Open tabs,
  workspace search, and Cline's automatic context do not authorize a broad repo scan.
- Do not initialize, create, or update Cline Memory Bank files. Do not create another
  project-state or architecture summary unless the active sprint explicitly requires it.
- In Plan mode, identify the narrow affected files, contracts, tests, and verification.
  A plan is not approval to implement work outside the active sprint.
- Preserve the existing worktree. Read-only Git inspection is allowed, but do not
  commit, push, create branches or pull requests, rebase, reset, clean, or rewrite
  history unless the Product Owner explicitly requests that exact action.
- Do not deploy, run migrations against shared environments, perform live social
  actions, or execute other irreversible external operations unless explicitly
  authorized by the Product Owner and required by the active sprint.

## Completion report

Report only evidence from the completed task:

1. Changed files and the behavior or contract each change implements.
2. Exact verification commands run and their results.
3. Checks not run, environmental limits, and remaining uncertainty.
4. Confirmation that no unrelated scope, commit, push, or sprint advancement occurred.

Do not propose or begin the next sprint in the implementation report.
