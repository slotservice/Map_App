#!/usr/bin/env bash
# Smoke-test the API end-to-end with curl. No browser, no phone needed.
# Useful for: post-deploy "did it actually start," CI healthchecks, and
# validating the stack works before bringing the mobile app into the loop.
#
# Usage:
#   API=https://api.fullcirclefm.com ADMIN_EMAIL=admin@... ADMIN_PASSWORD=... ./infra/smoke-test.sh
#
# Or with defaults for local dev:
#   ./infra/smoke-test.sh
set -euo pipefail

API="${API:-http://localhost:3001}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@fullcirclefm.local}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-password123}"

PASS=0
FAIL=0

step() {
  echo
  echo "› $1"
}

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    echo "  ✔ $label ($actual)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ $label expected=$expected actual=$actual"
    FAIL=$((FAIL + 1))
  fi
}

require() {
  local cmd="$1"
  command -v "$cmd" > /dev/null 2>&1 || { echo "Missing dependency: $cmd"; exit 2; }
}

require curl
require jq

step "1. /healthz"
HEALTH=$(curl -s "$API/healthz")
check "status field" "ok" "$(echo "$HEALTH" | jq -r .status)"

step "2. /readyz"
READY=$(curl -s "$API/readyz")
check "ready+db"  "ready" "$(echo "$READY" | jq -r .status)"
check "db ping"   "true"  "$(echo "$READY" | jq -r .db)"

step "3. /api/v1/auth/login (admin)"
LOGIN=$(curl -sf -X POST "$API/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
TOKEN=$(echo "$LOGIN" | jq -r '.tokens.accessToken')
USER_ROLE=$(echo "$LOGIN" | jq -r '.user.role')
check "got access token" "true" "$([[ -n "$TOKEN" && "$TOKEN" != "null" ]] && echo true || echo false)"
check "role is admin"    "admin" "$USER_ROLE"

step "4. /api/v1/maps (authenticated)"
MAPS_HTTP=$(curl -s -o /tmp/maps.json -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" "$API/api/v1/maps")
check "200 OK" "200" "$MAPS_HTTP"
MAPS_LEN=$(jq 'length' < /tmp/maps.json)
echo "  ℹ  $MAPS_LEN map(s) visible"

step "5. /api/v1/users?role=worker"
USERS_HTTP=$(curl -s -o /tmp/users.json -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN" "$API/api/v1/users?role=worker")
check "200 OK" "200" "$USERS_HTTP"

step "6. /api/v1/auth/login (bogus password) — must reject"
BOGUS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"'"$ADMIN_EMAIL"'","password":"definitely-wrong"}')
check "401 Unauthorized" "401" "$BOGUS_HTTP"

step "7. /api/v1/maps without token — must reject"
ANON_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/v1/maps")
check "401 Unauthorized" "401" "$ANON_HTTP"

step "8. OpenAPI docs reachable"
DOCS_HTTP=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/v1/docs")
check "200 OK" "200" "$DOCS_HTTP"

echo
echo "Results: $PASS pass, $FAIL fail"
[[ $FAIL -eq 0 ]] || exit 1
