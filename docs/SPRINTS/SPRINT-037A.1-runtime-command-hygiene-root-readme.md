# Sprint 037A.1: Runtime Command Hygiene + Root README

## Goal

Clean up root runtime command naming and add a concise root README without changing collector behavior, browser provider behavior, or Docker Compose behavior.

## Scope

- Add clearer canonical root `package.json` script names for app runtime, Web UI, and operator tools.
- Keep all existing script names working as backward-compatible aliases.
- Keep existing test, database, and Docker stack script behavior unchanged.
- Add a root `README.md` that introduces the project, current Content Collector focus, current modules, architecture notes, quick start commands, command groups, and sprint workflow.
- Update `docs/RUNTIME.md` with command groups for app runtime, Web UI, database, tests, operator tools, and Docker stacks.
- Update project state and active sprint documentation to record this hygiene sprint.

## Canonical Script Names

- `app:dev`
- `app:start`
- `web:dev`
- `web:build`
- `web:typecheck`
- `operator:profile:provision`
- `operator:collector:facebook`
- `operator:collector:worker`
- `operator:browser:probe`

## Backward-Compatible Aliases

- `dev`
- `start`
- `dev:web`
- `build:web`
- `typecheck:web`
- `profile:provision`
- `collector:facebook:run`
- `collector:worker:run`
- `collector:browser:probe`

## Existing Scripts To Preserve

- `test`
- `test:db`
- `test:http:db`
- `db:generate`
- `db:migrate`
- `stack:dev:start`
- `stack:dev:stop`
- `stack:dev:reset`
- `stack:preview:start`
- `stack:preview:stop`
- `stack:preview:reset`

## Out Of Scope

- Docker worker service.
- Scheduler.
- CloakBrowser installation.
- Changing provider behavior.
- Changing collector behavior.
- Refactoring collector logic.
- Removing old scripts.
- Renaming source files.
- Web UI changes.

## Verification

- `pnpm typecheck`
- `pnpm test`
- `pnpm operator:browser:probe -- --browser-provider playwright`
- `pnpm collector:browser:probe -- --browser-provider playwright`

Also manually verify:

- `README.md` renders clearly in GitHub/Markdown preview.
- Old script aliases still work.
- New canonical script names work.
