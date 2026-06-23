#!/usr/bin/env bash
# Host driver for the Docker-backed Layer 2 (database integration) test runner.
#
# Responsibilities:
#   1. Always clean up any prior DB test resources (project fgc-v3-db-test).
#   2. Build the isolated stack.
#   3. Bring up postgres in detached mode only.
#   4. Start the db-test-runner exactly once in attached mode with
#      --abort-on-container-exit and --exit-code-from db-test-runner so
#      Compose returns the runner's exit code.
#   5. On non-zero exit, print sanitized logs for db-test-runner and postgres.
#   6. Always clean up on EXIT INT TERM (success, failure, interruption).
#
# Invariants:
#   - Never publishes a host port.
#   - Never reuses fgc_dev_postgres_data, fgc_preview_postgres_data,
#     or fgc_e2e_postgres_data.
#   - Never prints DATABASE_URL or environment values.
#   - DB_TEST_ARGS is forwarded as-is to the runner; default is
#     src/infrastructure (matching the host pnpm test:db target).
#   - The db-test-runner is never started during the detached dependency
#     startup; it is started exactly once in attached mode.

set -eu

compose_file="docker-compose.db-test.yml"
project_name="fgc-v3-db-test"

cleanup() {
  # Always run cleanup, even on interrupt.
  docker compose \
    -p "${project_name}" \
    -f "${compose_file}" \
    down -v --remove-orphans >/dev/null 2>&1 || true
}

print_failure_logs() {
  echo
  echo "===== DB test failure logs (sanitized) ====="
  docker compose \
    -p "${project_name}" \
    -f "${compose_file}" \
    logs --no-color db-test-runner postgres || true
  echo "===== End DB test failure logs ====="
}

# Ensure cleanup runs on success, failure, and interruption.
trap cleanup EXIT INT TERM

# Pre-cleanup: kill any stale DB test resources from a previous interrupted run.
cleanup

echo "Building DB test runner image..."
docker compose \
  -p "${project_name}" \
  -f "${compose_file}" \
  build

echo "Starting DB test dependencies (postgres)..."
docker compose \
  -p "${project_name}" \
  -f "${compose_file}" \
  up -d postgres

# Start the db-test-runner exactly once in attached mode. `--abort-on-container-exit`
# ensures Compose exits as soon as the runner exits; `--exit-code-from
# db-test-runner` makes Compose return the runner's exit code as its own.
set +e
docker compose \
  -p "${project_name}" \
  -f "${compose_file}" \
  up --abort-on-container-exit --exit-code-from db-test-runner db-test-runner
runner_exit=$?
set -e

if [ "${runner_exit}" -ne 0 ]; then
  print_failure_logs
fi

exit "${runner_exit}"
