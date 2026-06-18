#!/bin/sh
set -eu

gateway_url="${E2E_GATEWAY_URL:-http://web-gateway}"
max_wait_seconds="${E2E_GATEWAY_WAIT_SECONDS:-60}"

# Readiness: poll the React app shell until the gateway responds. Any HTTP
# status below 500 is acceptable (Nginx returns 200 with the React app HTML;
# a 5xx during a transient restart would not block the runner).
elapsed=0
until node -e "fetch(process.argv[1]).then((response) => process.exit(response.status < 500 ? 0 : 1)).catch(() => process.exit(1))" "${gateway_url}/"; do
  if [ "$elapsed" -ge "$max_wait_seconds" ]; then
    echo "E2E runner: gateway ${gateway_url} did not become ready within ${max_wait_seconds}s." >&2
    exit 1
  fi
  sleep 1
  elapsed=$((elapsed + 1))
done

# Replace the shell with Playwright so init forwards SIGINT / SIGTERM directly
# to the runner process.
exec pnpm exec playwright test --config=tests/e2e/playwright.config.ts "$@"