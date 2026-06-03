#!/bin/sh
set -eu

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

escaped_api_base_url="$(json_escape "$API_BASE_URL")"
escaped_admin_api_key="$(json_escape "$ADMIN_API_KEY")"

cat > /usr/share/nginx/html/config.js <<EOF
window.__DTPM_CONFIG__ = {
  API_BASE_URL: "${escaped_api_base_url}",
  ADMIN_API_KEY: "${escaped_admin_api_key}"
};
EOF
