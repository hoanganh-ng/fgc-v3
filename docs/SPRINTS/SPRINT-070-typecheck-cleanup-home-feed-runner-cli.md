# Sprint 070: Typecheck Cleanup For Home-Feed Runner CLI Test

## Goal

Restore full repository `pnpm typecheck` by fixing the narrow TypeScript
mismatch in `src/operator-tools/profile-home-feed-runner/cli.test.ts`
without changing runtime behavior, test intent, or exported module
surface.

## Required Context

- `docs/SPRINTS/active.md`
- `src/operator-tools/profile-home-feed-runner/cli.test.ts`
- `src/operator-tools/profile-home-feed-runner/cli-error-reporter.ts`
- nearby test/package config only if needed

## Unrelated Areas Not To Scan Or Modify

- Web UI source publisher files
- Content Manager domain/application/persistence
- Collector Runtime execution logic
- browser automation
- Docker/runtime services
- migrations
- Content Builder / Content Publisher

## Requirements

1. Fix the TypeScript type error around capturing/restoring
   `process.exitCode`.
2. Prefer the smallest safe test-only fix, likely typing the captured
   value as `typeof process.exitCode`.
3. Preserve existing test assertions and intent:
   - unexpected errors print only the fixed safe message;
   - sensitive values are not leaked;
   - importing `cli-error-reporter` does not install signal handlers;
   - exported module surface stays limited.
4. Do not change runtime implementation unless absolutely necessary.
5. Sprint 069 is marked accepted/complete before this sprint is opened.
6. Do not make product, backend, Web UI, Docker, worker, scheduler,
   browser, or migration changes.

## Acceptance

- `pnpm typecheck` passes for the whole repository.
- `pnpm test src/operator-tools/profile-home-feed-runner/cli.test.ts`
  passes.
- `pnpm test` passes.
- `git diff --check` reports no whitespace errors.
- No commits, pushes, or new sprint activations occur as part of this
  sprint.

## Status

Sprint 070 is **accepted**. Sprint 071 is the active follow-up sprint.
