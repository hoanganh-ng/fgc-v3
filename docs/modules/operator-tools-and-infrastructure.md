# Operator Tools and Infrastructure

## Ownership
- Command-line interfaces for manual intervention, debugging, and targeted tasks.
- Profile provisioning CLI workflows (connecting one-time tokens to browser sessions).
- Manual Facebook collection triggers and diagnostics.
- Containerized execution environments (Docker Compose) for dependent services (API, DB, UI, Workers).
- Opt-in script aliases and lifecycle commands in `package.json`.

## Does Not Own
- Domain rules, API endpoint logic, or HTTP routing.
- Persistent source of truth for runtime config.
- Bypassing profile leasing rules or faking readiness.

## Important Source Paths
- `docker/`
- `scripts/`
- Tool entrypoints in `src/operator-tools/` or specific runtime files.

## Important Entrypoints
- `pnpm operator:profile:provision`
- `pnpm operator:collector:facebook`
- `pnpm stack:dev:start` / `pnpm stack:preview:start`

## Critical Invariants
- Manual tools should consume the same HTTP API boundaries as the Web UI whenever possible.
- Provisioning tools must pass captured sessions back securely.

## Sensitive Data Rules
- Do not persist raw Facebook payloads captured during manual runs without sanitization.
- CLI output must never print proxy credentials or raw session values.

## Relevant Verification Commands
```bash
# Verify the types of tools directly
pnpm typecheck
```
