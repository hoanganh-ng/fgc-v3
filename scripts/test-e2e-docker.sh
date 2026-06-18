#!/usr/bin/env bash
# Host driver for the Docker E2E harness.
#
# Responsibilities:
#   1. Always clean up any prior E2E resources (project fgc-v3-e2e).
#   2. Build and start the isolated stack.
#   3. Wait for the runner to exit and capture its exit code.
#   4. On non-zero exit, print sanitized logs for api / web-gateway / e2e-runner.
#   5. Always clean up on EXIT INT TERM (success, failure, interruption).
#
# Invariants:
#   - Never publishes a host port.
#   - Never reuses fgc_dev_postgres_data or fgc_preview_postgres_data.
#   - Never prints DATABASE_URL or environment values.
#   - Never sleeps as the readiness mechanism (the runner entrypoint handles
#     gateway readiness, and the API healthcheck handles API readiness).

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

echo "Starting E2E stack..."
docker compose \
  -p "${project_name}" \
  -f "${compose_file}" \
  up -d

# Run the runner in attached mode so its exit code is captured.
# `--abort-on-container-exit` ensures Compose exits when the runner exits.
set +e
docker compose \
  -p "${project_name}" \
  -f "${compose_file}" \
  up --abort-on-container-exit e2e-runner
runner_exit=$?
set -e

if [ "${runner_exit}" -ne 0 ]; then
  print_failure_logs
fi

exit "${runner_exit}"