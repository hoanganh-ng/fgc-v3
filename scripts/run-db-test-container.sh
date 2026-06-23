#!/bin/sh
# Container entrypoint for the Docker-backed Layer 2 (database integration)
# test runner.
#
# Responsibilities:
#   1. Apply pending Drizzle migrations against the in-network Postgres.
#   2. Run the Vitest DB specs selected by DB_TEST_ARGS (default
#      src/infrastructure) with RUN_DB_TESTS=true.
#
# Invariants:
#   - DATABASE_URL and RUN_DB_TESTS come from the Compose environment
#     block. The entrypoint does not re-export them.
#   - Path arguments in DB_TEST_ARGS must not contain whitespace; the
#     existing test paths under src/infrastructure do not.

set -eu

# DB_TEST_ARGS is whitespace-split into positional parameters. Default to
# the same target as the host pnpm test:db command.
# shellcheck disable=SC2086
set -- ${DB_TEST_ARGS:-src/infrastructure}
if [ "$#" -eq 0 ]; then
  set -- src/infrastructure
fi

echo "Applying Drizzle migrations..."
pnpm db:migrate

echo "Running Vitest with: $*"
# Replace the shell with Vitest so init forwards SIGINT / SIGTERM directly.
exec pnpm exec vitest run "$@"
