#!/bin/sh
set -eu

api_base_url="${COLLECTOR_WORKER_BASE_URL:-http://api:3000}"
mode_args="${COLLECTOR_WORKER_MODE_ARGS:---poll-interval-ms 5000}"
display="${COLLECTOR_WORKER_DISPLAY:-:99}"
xvfb_screen="${COLLECTOR_WORKER_XVFB_SCREEN:-1280x720x24}"

until node -e "fetch(process.argv[1]).then((response) => process.exit(response.status < 500 ? 0 : 1)).catch(() => process.exit(1))" "${api_base_url}/collector/collection-runs?limit=1"; do
  echo "Waiting for worker API endpoint..."
  sleep 1
done

Xvfb "${display}" -screen 0 "${xvfb_screen}" -nolisten tcp >/tmp/collector-worker-xvfb.log 2>&1 &
xvfb_pid="$!"
export DISPLAY="${display}"

sleep 1

if ! kill -0 "${xvfb_pid}" 2>/dev/null; then
  echo "Collector worker display server failed to start."
  exit 1
fi

worker_pid=""
worker_status=0

shutdown() {
  if [ -n "${worker_pid}" ]; then
    kill -TERM "${worker_pid}" 2>/dev/null || true
    wait "${worker_pid}" || worker_status="$?"
  fi

  kill "${xvfb_pid}" 2>/dev/null || true
  wait "${xvfb_pid}" 2>/dev/null || true
  exit "${worker_status}"
}

trap shutdown INT TERM

# mode_args is intentionally split so Compose can provide "--once" or
# "--poll-interval-ms 5000" through COLLECTOR_WORKER_MODE_ARGS.
node --import tsx src/operator-tools/collector-worker/cli.ts -- --base-url "${api_base_url}" ${mode_args} &
worker_pid="$!"

wait "${worker_pid}" || worker_status="$?"
worker_pid=""

kill "${xvfb_pid}" 2>/dev/null || true
wait "${xvfb_pid}" 2>/dev/null || true

exit "${worker_status}"
