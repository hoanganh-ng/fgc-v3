# Sprint 078 — Runtime Command Surface Consolidation

## Status

Accepted by the Product Owner on 2026-07-16 at commit `28bd08c`. Sprint 077 was
accepted at implementation commit `93cf205` and correction commit `1a7861d`.
The Collector baseline remains locked and maintenance-only. Sprint 079 is now
active.

Acceptance record: no live automation, CI, or root-script consumer depended on
the removed aliases. The manifest contains exactly 35 scripts; all six lifecycle
and 13 canonical operator commands remain; 34 removed aliases have exact
Compose argument parity through the typed builder; invalid input fails before
spawn; process launch uses `shell: false` and inherited standard I/O; exit,
signal, and spawn failures propagate. Both Compose configurations, help output,
`pnpm typecheck`, `pnpm test` (2,006 passed), 14 focused tests, GitNexus
LOW-risk change detection, and `git diff --check` passed. Compose files,
container scripts, operator CLIs, and Collector runtime behavior did not change.

## Goal

Make the root runtime command surface understandable and difficult to drift by
consolidating repetitive Docker Compose aliases behind one typed command,
without changing any supported runtime behavior.

## Capability Summary

> An operator can select the development or preview stack, one supported
> background service (or all services), and a valid start/once/logs action
> through one discoverable, validated command. Existing lifecycle and canonical
> operator commands remain stable, invalid combinations fail before Docker is
> invoked, and each admitted combination produces the exact Compose argument
> sequence used by the command it replaces.

## Why This Sprint Exists

Before this sprint, the root manifest contained 69 scripts. Forty were under
`stack:*`, and 34 of those formed a repeated dev/preview × service × action
alias matrix. The matrix made the manifest look like dozens of separate
capabilities even though it represented one bounded command model. It also
encouraged copy/paste drift.

This is a command-surface problem, not a Collector-runtime problem. The 13
canonical `operator:*` commands are intentional and remain stable. The
specialized isolated-database test commands encode current database guard
contracts and are not consolidated here.

## Required Context

Read only:

- `AGENTS.md`;
- `docs/SPRINTS/active.md`;
- this sprint;
- `docs/COLLECTOR_BASELINE.md`;
- `package.json`;
- the current command sections in `README.md`;
- the Docker/runtime command sections in `docs/RUNTIME.md`;
- the E2E command section in `docs/TESTING_STRATEGY.md`;
- `docker-compose.dev.yml` and `docker-compose.preview.yml`;
- `scripts/run-e2e-runner-container.sh`;
- the five worker/scheduler container scripts referenced by the Compose files;
- directly related operator CLI argument, process-launch, and unit-test patterns
  only as needed to follow established conventions;
- TypeScript and test configuration only when needed to register the new CLI or
  its tests.

Do not scan historical sprint documents to find consumers. Historical command
examples are records, not active automation. Search current source, current
docs, root scripts, and any CI configuration for live references before removing
an alias. Do not inspect or modify unrelated modules.

## Command Model

Add one root command:

```bash
pnpm stack:service -- \
  --stack dev \
  --service profile-home-feed-worker \
  --action once
```

Accepted values:

| Option | Values |
| --- | --- |
| `--stack` | `dev`, `preview` |
| `--service` | `collector-worker`, `account-exercise-worker`, `collection-scheduler`, `profile-home-feed-scheduler`, `profile-home-feed-worker`, `all` |
| `--action` | `start`, `once`, `logs` |

`all` supports `start` and `logs`. Reject `all + once` with a concise usage
error and a non-zero exit before spawning Docker. Reject missing, duplicated,
unknown, or extra arguments the same way. `--help` must document the complete
matrix and examples without running Docker.

The old alias segments map to the new service values as follows; apply the same
mapping for both `dev` and `preview` and retain the old final segment as the
`--action` value:

| Removed alias segment | New `--service` value |
| --- | --- |
| `worker` | `collector-worker` |
| `exercise-worker` | `account-exercise-worker` |
| `scheduler` | `collection-scheduler` |
| `profile-home-feed-scheduler` | `profile-home-feed-scheduler` |
| `profile-home-feed-worker` | `profile-home-feed-worker` |
| `workers` | `all` (`start` and `logs` only) |

## Exact Behavior Contract

The implementation must build an executable plus argument array and launch it
without a shell, with inherited standard I/O. Do not construct a shell command
string.

For stack `dev`, use `docker-compose.dev.yml`; for `preview`, use
`docker-compose.preview.yml`.

| Action | Required Compose arguments |
| --- | --- |
| `start` | `docker compose -f <file> --profile worker up --build -d <service...>` |
| `logs` | `docker compose -f <file> logs -f <service...>` |
| `once` | `docker compose -f <file> --profile worker run --rm --build -e <mode-env>=--once <service>` |

The `all` service expands in the existing aggregate order to all five services.
Preserve the exact current service names, build flags, worker profile, detached
start behavior, log following, and one-shot mode environment variables:

| Service | One-shot environment variable |
| --- | --- |
| `collector-worker` | `COLLECTOR_WORKER_MODE_ARGS` |
| `account-exercise-worker` | `ACCOUNT_EXERCISE_WORKER_MODE_ARGS` |
| `collection-scheduler` | `COLLECTION_SCHEDULER_MODE_ARGS` |
| `profile-home-feed-scheduler` | `PROFILE_HOME_FEED_SCHEDULER_MODE_ARGS` |
| `profile-home-feed-worker` | `PROFILE_HOME_FEED_WORKER_MODE_ARGS` |

Propagate child process success, non-zero exit, signal termination, and spawn
failure honestly to the CLI exit result. Do not swallow Docker errors.

## Deliverables

### Typed stack-service command

Add a narrowly owned operator-tool CLI, preferably under
`src/operator-tools/stack-service/`, with separable responsibilities:

- strict argument parsing and usage text;
- a pure validated command builder returning executable and arguments;
- a process-launch boundary;
- a thin CLI entry point;
- focused unit tests.

Use existing project conventions where they fit, but do not create a generic
command framework or add a dependency for this small closed command model.

### Root script consolidation

In `package.json`:

- add `stack:service` as the single typed service-operation entry point;
- preserve the six explicit lifecycle scripts:
  `stack:dev:start`, `stack:dev:stop`, `stack:dev:reset`,
  `stack:preview:start`, `stack:preview:stop`, and `stack:preview:reset`;
- preserve all 13 canonical `operator:*` scripts;
- preserve current app, web, typecheck, database, migration, and supported test
  commands except the dead alias named below;
- remove the 34 old dev/preview individual-service and aggregate-worker matrix
  aliases replaced by `stack:service`;
- remove `test:e2e:container`. The owning container script invokes Playwright
  directly and no current automation should depend on this package alias.

The exact acceptance target is **35 root scripts**: 69 − 34 repetitive aliases
+ 1 consolidated command − 1 unused E2E alias.

Do not consolidate `test:db:dispatch:isolated` or
`test:db:provenance:isolated`; they expose distinct database guard contracts.

### Current documentation

Update `README.md` and `docs/RUNTIME.md` with concise examples for the new
command and a compact old-to-new migration table. Update
`docs/TESTING_STRATEGY.md` to remove the `test:e2e:container` package alias and
state that the E2E container invokes Playwright directly.

Do not rewrite historical sprint or evidence documents merely because they
mention an old command. They must remain truthful records of their time.

## No-Change Boundary

Do not change:

- Compose files, profiles, service definitions, images, health checks, volumes,
  networks, or environment contracts;
- the existing worker/scheduler/E2E container scripts;
- canonical `operator:*` command names or arguments;
- Collector domain, application, capture, extraction, diagnostics, persistence,
  HTTP, scheduling, worker, or Web UI behavior;
- browser provider, Facebook target, profile, session, lease, `DIRECT`, or
  `PROXY` behavior;
- database schemas or migrations;
- accepted fixtures, live evidence, or the Collector baseline runbook;
- Content Builder or Content Publisher behavior.

No live Facebook run is required or allowed for this tooling-only sprint.

## Verification

Run and report:

```bash
pnpm exec vitest run <focused stack-service test files>
pnpm typecheck
pnpm test
docker compose -f docker-compose.dev.yml config --quiet
docker compose -f docker-compose.preview.yml config --quiet
pnpm stack:service -- --help
git diff --check
```

Also prove with automated tests or a table generated from the pure builder that:

- every removed service/action alias maps to the exact prior executable and
  argument sequence;
- every allowed option combination builds the specified command;
- `all + once` and all invalid arguments fail before process launch;
- process exit, signal, and spawn failures propagate;
- `package.json` contains exactly 35 scripts;
- removed aliases are absent from current source automation and current docs;
- only approved files changed.

If Docker is unavailable, stop and report the two Compose configuration checks
as unverified; do not substitute a runtime or live-Facebook claim.

Follow `AGENTS.md`: use repository impact analysis before changing an existing
symbol and run repository change detection before commit. New isolated CLI
symbols do not justify scanning unrelated runtime modules.

## Acceptance Gate

Sprint 078 is complete only when:

- the typed CLI accepts exactly the documented stack/service/action model;
- all 34 replaced aliases have exact command parity through the new builder;
- invalid input cannot reach Docker;
- Docker execution does not use a shell and failures propagate honestly;
- the six lifecycle and 13 canonical operator scripts remain unchanged;
- specialized database test commands remain unchanged;
- the dead E2E alias is removed without a live consumer;
- current docs teach the consolidated command and no longer direct operators to
  removed aliases;
- the root manifest contains exactly 35 scripts;
- Compose files and runtime behavior are unchanged;
- required verification passes;
- the Product Owner accepts the consolidation.

Acceptance locks the new command names as the supported surface. It does not
activate or implement Content Builder.

## Stop Conditions

Stop and report instead of expanding scope when:

- any alias proposed for removal is used by current non-document automation,
  CI, deployment, or another root script;
- exact parity requires a Compose, container-script, or runtime behavior change;
- an existing command has behavior that does not fit the closed model;
- a specialized database command appears redundant but its isolation contract
  cannot be proven unnecessary;
- the 35-script target cannot be reached without removing a supported command;
- a Collector defect or Content Builder requirement is discovered.

Do not silently retain extra compatibility aliases to make the count miss. Stop
with the consumer and recommend the smallest revised scope.

## Builder Handoff Prompt

Implement Sprint 078 — Runtime Command Surface Consolidation from
`docs/SPRINTS/SPRINT-078-runtime-command-surface-consolidation.md`.

Begin by inventorying the 69 root scripts and searching current automation and
docs for consumers of the 35 proposed removals. If a live consumer exists, stop
with exact references. Otherwise implement the strict typed `stack:service`
CLI, parity tests, package consolidation to exactly 35 scripts, and the three
current-document updates. Preserve every no-change boundary and do not run
Facebook.

Run the complete verification and return: files changed; before/after script
inventory; removed-alias parity evidence; invalid-input and process-propagation
evidence; Compose configuration results; typecheck/test results; and
`git diff --check`. Stop for Product Owner review. Do not accept Sprint 078,
advance the active pointer, begin Content Builder discovery, or commit/push
unless the Product Owner separately requests it.
