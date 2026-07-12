# Sprint 073 — Product Scope Lock And Surface Trim

## Status

Accepted.

## Goal

Refocus the repository around the **Profile Feed Collector MVP** and reduce operator-facing noise before changing extractor behavior.

## Accepted outcome

Sprint 073 successfully refocused the repository around the Profile Feed Collector MVP.

Completed outcomes:

- Locked the near-term product direction around the Profile Feed Collector MVP.
- Parked, but did not remove, the Sprint 072 Content Builder Transform Type direction.
- Updated current-state docs so they no longer present Content Builder expansion as the active focus.
- Trimmed the primary Web UI navigation to MVP surfaces:
  - Dashboard
  - Profiles
  - Profile Feed Runs
  - Content Items
  - Source Groups
  - Discovered Sources
- Renamed the operator-facing Source Publishers surface to Discovered Sources without renaming backend routes, DTOs, persistence, or domain concepts.
- Simplified the package command surface and standardized canonical `pnpm operator:*` commands.
- Restored canonical access to the Sprint 065C3 one-shot profile home-feed runner as `pnpm operator:profile-home-feed:run-next`.
- Updated command documentation so removed legacy aliases map clearly to canonical commands.
- Removed the accidental verification-plan artifact before acceptance.

This sprint intentionally introduced no functional runtime changes. It was a product-scope, documentation, Web UI navigation, and command-surface cleanup sprint only.

## Preserved behavior and boundaries

The accepted implementation did not change:

- domain models
- database schemas or migrations
- HTTP contracts
- Collector Runtime execution behavior
- Facebook payload capture behavior
- Facebook extractor behavior
- profile checkout, leases, account-stage, authentication health, or provisioning behavior
- Content Builder internals, persistence, routes, or Transform Type code
- Content Publisher behavior

Implemented but parked/advanced pages remain available by direct route where already routed; they are only hidden from primary navigation.

## Verification summary

Builder reported the Sprint 073 verification set passing:

```bash
pnpm typecheck
pnpm web:typecheck
pnpm web:build
pnpm exec vitest run
git diff --check
```

Reported results:

- TypeScript checks passed.
- Web build passed.
- Vitest passed with 142 test files passed, 17 skipped; 1903 tests passed, 18 skipped; 0 failed.
- `git diff --check` was clean.
- Current-state docs and current source comments use `pnpm operator:profile-home-feed:run-next`; remaining old alias mentions are only in historical sprint docs.

Manual live Facebook validation was not required and was not claimed.

## Review decision

Accepted and ready to move to Sprint 074 — Home Feed Extraction Diagnostics.
