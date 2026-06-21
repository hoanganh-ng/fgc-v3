#!/bin/sh
set -eu

mode_args="${PROFILE_HOME_FEED_SCHEDULER_MODE_ARGS:---poll-interval-ms 5000}"
readiness_url="${PROFILE_HOME_FEED_SCHEDULER_READINESS_URL:-http://api:3000/collector/profile-home-feed-collection-schedules?limit=1}"

until node -e "fetch(process.argv[1]).then((response) => process.exit(response.status < 500 ? 0 : 1)).catch(() => process.exit(1))" "${readiness_url}"; do
  echo "Waiting for profile home-feed scheduler API endpoint..."
  sleep 1
done

# mode_args is intentionally split so Compose can provide "--once" or
# "--poll-interval-ms 5000" through PROFILE_HOME_FEED_SCHEDULER_MODE_ARGS.
exec node --import tsx src/operator-tools/profile-home-feed-scheduler/cli.ts -- ${mode_args}
