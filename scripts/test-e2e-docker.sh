#!/usr/bin/env bash
# Host driver for the Docker E2E harness.
#
# Responsibilities:
#   1. Always clean up any prior E2E resources (project fgc-v3-e2e).
#   2. Build the isolated stack.
#   3. Bring up postgres, api, and web-gateway in detached mode only.
#   4. Start the e2e-runner exactly once in attached mode with
#      --abort-on-container-exit and --exit-code-from e2e-runner so
#      Compose returns the runner's exit code.
#   5. On non-zero exit, print sanitized logs for api / web-gateway / e2e-runner.
#   6. Always clean up on EXIT INT TERM (success, failure, interruption).
#
# Invariants:
#   - Never publishes a host port.
#   - Never reuses fgc_dev_postgres_data or fgc_preview_postgres_data.
#   - Never prints DATABASE_URL or environment values.
#   - Never sleeps as the readiness mechanism (the runner entrypoint handles
#     gateway readiness, and the API healthcheck handles API readiness).
#   - The e2e-runner is never started during the detached dependency
#     startup; it is started exactly once in attached mode.

set -eu

compose_file="docker-compose.e2e.yml"
project_name="fgc-v3-e2e"

cleanup() {
  # Always run cleanup, even on interrupt.
  docker compose \
    -p "${project_name}" \
    -f "${compose_file}" \
    down -v --remove-orphans >/dev/null 2>&1 || true
}

print_failure_logs() {
  echo
  echo "===== E2E failure logs (sanitized) ====="
  docker compose \
    -p "${project_name}" \
    -f "${compose_file}" \
    logs --no-color api web-gateway e2e-runner || true
  echo "===== End E2E failure logs ====="
}

# Ensure cleanup runs on success, failure, and interruption.
trap cleanup EXIT INT TERM

# Pre-cleanup: kill any stale E2E resources from a previous interrupted run.
cleanup

echo "Building E2E stack..."
docker compose \
  -p "${project_name}" \
  -f "${compose_file}" \
  build

echo "Starting E2E dependencies (postgres, api, web-gateway)..."
docker compose \
  -p "${project_name}" \
  -f "${compose_file}" \
  up -d postgres api web-gateway

# Start the e2e-runner exactly once in attached mode. `--abort-on-container-exit`
# ensures Compose exits as soon as the runner exits; `--exit-code-from
# e2e-runner` makes Compose return the runner's exit code as its own.
set +e
docker compose \
  -p "${project_name}" \
  -f "${compose_file}" \
  up --abort-on-container-exit --exit-code-from e2e-runner e2e-runner
runner_exit=$?
set -e

if [ "${runner_exit}" -ne 0 ]; then
  print_failure_logs
fi

exit "${runner_exit}"
