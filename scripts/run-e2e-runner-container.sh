#!/bin/sh
set -eu

gateway_url="${E2E_GATEWAY_URL:-http://web-gateway}"
max_wait_seconds="${E2E_GATEWAY_WAIT_SECONDS:-60}"
poll_interval_seconds="${E2E_GATEWAY_POLL_INTERVAL_SECONDS:-1}"

# Gateway readiness: both checks must pass before Playwright starts.
#   1. The React app shell (/) returns exact HTTP 200 and the response
#      body contains the stable id="root" app-shell marker.
#   2. A safe API read through Nginx (/collector/content-categories)
#      returns exact HTTP 200 and the response body contains "items".
# We do NOT use arbitrary fixed startup sleeps; we poll with a small
# bounded interval until both checks pass or the deadline elapses.

elapsed=0
until node -e "
const url = process.argv[1];
(async () => {
  try {
    const shell = await fetch(url + '/');
    if (shell.status !== 200) { process.exit(1) }
    const shellBody = await shell.text();
    if (!shellBody.includes('id=\"root\"')) { process.exit(1) }
    const api = await fetch(url + '/collector/content-categories');
    if (api.status !== 200) { process.exit(1) }
    const apiBody = await api.text();
    if (!apiBody.includes('\"items\"')) { process.exit(1) }
    process.exit(0)
  } catch (_e) {
    process.exit(1)
  }
})();
" "${gateway_url}"; do
  if [ "$elapsed" -ge "$max_wait_seconds" ]; then
    echo "E2E runner: gateway ${gateway_url} did not become ready within ${max_wait_seconds}s." >&2
    exit 1
  fi
  sleep "${poll_interval_seconds}"
  elapsed=$((elapsed + poll_interval_seconds))
done

# Replace the shell with Playwright so init forwards SIGINT / SIGTERM
# directly to the runner process.
exec pnpm exec playwright test --config=tests/e2e/playwright.config.ts "$@"
