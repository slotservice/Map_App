#!/usr/bin/env bash
# Comprehensive end-to-end smoke for the Map App. Walks every API
# endpoint + every admin web page, reports PASS/FAIL with one line
# per check. Pre-requisite: infra/smoke-real-data.sh's prereqs (the
# `c_dilbeck.xlsx` at /tmp/c_dilbeck.xlsx, mapapp_dev DB seeded with
# the 3 default users at password123).
#
# Read top-down. When a check fails, the script keeps going so the
# whole picture surfaces in a single run.

set -uo pipefail

API=${API:-http://localhost:3001}
ADMIN=${ADMIN:-http://localhost:4000}
PUBLIC=${PUBLIC:-http://80.241.222.224}

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf '  \033[32m✔\033[0m %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  \033[31m✗\033[0m %s\n' "$1"; }
section() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }

# helper: assert HTTP status
assert_status() {
  local expected=$1 actual=$2 label=$3
  [ "$actual" = "$expected" ] && ok "$label ($actual)" || bad "$label expected $expected got $actual"
}

# helper: probe URL, return status code
probe() { curl -sS -m 10 -o /dev/null -w '%{http_code}' "$@"; }

# helper: get json body
jget() { curl -sS -m 10 "$@"; }

# helper: post json, return status
jpost_status() {
  local url=$1 body=$2; shift 2
  curl -sS -m 10 -o /dev/null -w '%{http_code}' -X POST "$url" -H 'Content-Type: application/json' -d "$body" "$@"
}

# ============================================================
section "1. Process / port inventory"
# ============================================================
for p in 80 3001 4000 5432 9000 8025 1025; do
  ss -tln | grep -q ":$p\b" && ok "port $p listening" || bad "port $p NOT listening"
done

# ============================================================
section "2. Health probes (local + public)"
# ============================================================
assert_status 200 "$(probe $API/healthz)" "GET $API/healthz"
assert_status 200 "$(probe $API/readyz)" "GET $API/readyz"
assert_status 200 "$(probe $PUBLIC/healthz)" "GET $PUBLIC/healthz (via nginx)"
assert_status 200 "$(probe $PUBLIC/readyz)" "GET $PUBLIC/readyz (via nginx)"

# ============================================================
section "3. Auth: login as 3 roles"
# ============================================================
ADM_RES=$(jget -X POST $API/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@fullcirclefm.local","password":"password123"}')
ADM=$(echo "$ADM_RES" | jq -er '.tokens.accessToken' 2>/dev/null)
[ -n "${ADM:-}" ] && ok "admin login → token" || bad "admin login FAILED: $ADM_RES"

WRK_RES=$(jget -X POST $API/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"worker@fullcirclefm.local","password":"password123"}')
WRK=$(echo "$WRK_RES" | jq -er '.tokens.accessToken' 2>/dev/null)
[ -n "${WRK:-}" ] && ok "worker login → token" || bad "worker login FAILED"

VEN_RES=$(jget -X POST $API/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"vendor@fullcirclefm.local","password":"password123"}')
VEN=$(echo "$VEN_RES" | jq -er '.tokens.accessToken' 2>/dev/null)
[ -n "${VEN:-}" ] && ok "vendor login → token" || bad "vendor login FAILED"

# ============================================================
section "4. Auth: error handling"
# ============================================================
ERR=$(jget -X POST $API/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@fullcirclefm.local","password":"WRONG"}')
ETYPE=$(echo "$ERR" | jq -er '.type' 2>/dev/null)
[ "$ETYPE" = "INVALID_CREDENTIALS" ] && ok "wrong pw → type=INVALID_CREDENTIALS" || bad "wrong pw → type=$ETYPE (expected INVALID_CREDENTIALS)"

ETITLE=$(echo "$ERR" | jq -er '.title' 2>/dev/null)
[ "$ETITLE" = "Invalid credentials" ] && ok "wrong pw → title=Invalid credentials" || bad "wrong pw → title=$ETITLE"

# leading-space pw was the actual user-reported bug — still rejected
SPACE=$(jget -X POST $API/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@fullcirclefm.local","password":" password123"}')
[ "$(echo "$SPACE" | jq -er '.type')" = "INVALID_CREDENTIALS" ] && ok "leading-space pw rejected" || bad "leading-space pw NOT rejected"

# anonymous protected endpoint
assert_status 401 "$(probe $API/api/v1/maps)" "anonymous /maps → 401"
assert_status 401 "$(probe $API/api/v1/users)" "anonymous /users → 401"

# ============================================================
section "5. Users API (admin)"
# ============================================================
USERS_LIST=$(jget $API/api/v1/users -H "Authorization: Bearer $ADM")
USER_COUNT=$(echo "$USERS_LIST" | jq -r 'length')
[ "$USER_COUNT" -ge 3 ] && ok "list users → $USER_COUNT users" || bad "list users → only $USER_COUNT (expected ≥ 3)"

assert_status 200 "$(probe $API/api/v1/users?role=worker -H "Authorization: Bearer $ADM")" "list users?role=worker"
assert_status 200 "$(probe $API/api/v1/users?role=vendor -H "Authorization: Bearer $ADM")" "list users?role=vendor"
assert_status 200 "$(probe $API/api/v1/users?role=viewer -H "Authorization: Bearer $ADM")" "list users?role=viewer"

# create + delete a test user round-trip
TS=$(date +%s)
CREATE=$(jget -X POST $API/api/v1/users -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
  -d "{\"email\":\"e2e-test-$TS@example.com\",\"firstName\":\"E2E\",\"lastName\":\"Test\",\"role\":\"worker\"}")
NEW_ID=$(echo "$CREATE" | jq -er '.user.id // empty' 2>/dev/null)
NEW_PW=$(echo "$CREATE" | jq -er '.initialPassword // empty' 2>/dev/null)
[ -n "${NEW_ID:-}" ] && ok "create user → id $NEW_ID + initialPassword ($((${#NEW_PW}))B)" || bad "create user FAILED: $CREATE"

if [ -n "${NEW_ID:-}" ]; then
  # Block/unblock = PATCH with status (no dedicated endpoints).
  BLOCK=$(jpost_status $API/api/v1/users/$NEW_ID '{"status":"blocked"}' -X PATCH -H "Authorization: Bearer $ADM")
  [ "$BLOCK" = "200" ] && ok "block user (PATCH status=blocked)" || bad "block user → $BLOCK"
  UNBLK=$(jpost_status $API/api/v1/users/$NEW_ID '{"status":"active"}' -X PATCH -H "Authorization: Bearer $ADM")
  [ "$UNBLK" = "200" ] && ok "unblock user (PATCH status=active)" || bad "unblock user → $UNBLK"
  RESET=$(jget -X POST $API/api/v1/users/$NEW_ID/reset-password -H "Authorization: Bearer $ADM")
  echo "$RESET" | jq -er '.newPassword // empty' >/dev/null 2>&1 && ok "reset-password → newPassword issued" || bad "reset-password → no newPassword: $RESET"
  assert_status 204 "$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X DELETE $API/api/v1/users/$NEW_ID -H "Authorization: Bearer $ADM")" "delete user"
fi

# vendor must NOT be able to list users
assert_status 403 "$(probe $API/api/v1/users -H "Authorization: Bearer $VEN")" "vendor → /users 403"
assert_status 403 "$(probe $API/api/v1/users -H "Authorization: Bearer $WRK")" "worker → /users 403"

# ============================================================
section "6. Maps API + Excel import + assignment + RBAC"
# ============================================================
IMPORT=$(curl -sS -X POST $API/api/v1/maps/import -H "Authorization: Bearer $ADM" \
  -F "name=E2E Smoke Map $TS" -F 'file=@/tmp/c_dilbeck.xlsx')
MAP_ID=$(echo "$IMPORT" | jq -er '.mapId' 2>/dev/null)
[ -n "${MAP_ID:-}" ] && ok "Excel import → map $MAP_ID ($(echo $IMPORT | jq -r '.storeCount') stores)" || bad "Excel import FAILED: $IMPORT"

if [ -n "${MAP_ID:-}" ]; then
  assert_status 200 "$(probe $API/api/v1/maps -H "Authorization: Bearer $ADM")" "list maps as admin"
  assert_status 200 "$(probe $API/api/v1/maps/$MAP_ID -H "Authorization: Bearer $ADM")" "get map detail"

  # PATCH map (e.g. recipients)
  assert_status 200 "$(jpost_status $API/api/v1/maps/$MAP_ID '{"tagAlertRecipients":["e2e@example.com"]}' -H "Authorization: Bearer $ADM" -X PATCH)" "PATCH map recipients"

  # stores list
  STORES_RES=$(jget $API/api/v1/maps/$MAP_ID/stores -H "Authorization: Bearer $ADM")
  STORE_COUNT=$(echo "$STORES_RES" | jq -r 'length')
  [ "$STORE_COUNT" = "161" ] && ok "list stores → 161 (matches xlsx)" || bad "list stores → $STORE_COUNT (expected 161)"
  STORE_ID=$(echo "$STORES_RES" | jq -er '.[0].id')

  # marker color present on every store
  MARKER_OK=$(echo "$STORES_RES" | jq '[.[] | select(.markerColor != null)] | length')
  [ "$MARKER_OK" = "$STORE_COUNT" ] && ok "every store has markerColor" || bad "$((STORE_COUNT - MARKER_OK)) stores missing markerColor"

  # store detail
  assert_status 200 "$(probe $API/api/v1/stores/$STORE_ID -H "Authorization: Bearer $ADM")" "get store detail"

  # assignments (workers / vendors / viewers)
  # Pick the seeded users explicitly (filter by email) — `.[0]` picks
  # leftover test users from prior runs and the assigned worker won't
  # match the WRK token holder.
  WORKER_ID=$(jget "$API/api/v1/users?role=worker" -H "Authorization: Bearer $ADM" | jq -er '.[] | select(.email == "worker@fullcirclefm.local") | .id')
  VENDOR_ID=$(jget "$API/api/v1/users?role=vendor" -H "Authorization: Bearer $ADM" | jq -er '.[] | select(.email == "vendor@fullcirclefm.local") | .id')
  for ROLE in worker vendor; do
    UID_VAR=$([ "$ROLE" = "worker" ] && echo $WORKER_ID || echo $VENDOR_ID)
    assert_status 204 "$(jpost_status $API/api/v1/maps/$MAP_ID/assignments "{\"userId\":\"$UID_VAR\",\"role\":\"$ROLE\"}" -H "Authorization: Bearer $ADM")" "assign $ROLE"
  done
  assert_status 200 "$(probe "$API/api/v1/maps/$MAP_ID/assignments?role=worker" -H "Authorization: Bearer $ADM")" "list assignments?role=worker"

  # vendor RBAC: should see this map (after assignment), should NOT see another admin's unassigned map
  V_MAPS=$(jget $API/api/v1/maps -H "Authorization: Bearer $VEN")
  V_COUNT=$(echo "$V_MAPS" | jq 'length')
  [ "$V_COUNT" = "1" ] && ok "vendor sees only assigned map (1)" || bad "vendor sees $V_COUNT maps (expected 1 — L1 fix verification)"

  # worker can list maps too
  W_MAPS=$(jget $API/api/v1/maps -H "Authorization: Bearer $WRK")
  W_COUNT=$(echo "$W_MAPS" | jq 'length')
  [ "$W_COUNT" -ge 1 ] && ok "worker sees assigned map (≥1)" || bad "worker sees $W_COUNT maps"

  # Excel export
  XLSX_BYTES=$(curl -sS -m 30 -w '%{size_download}' -o /tmp/e2e-export.xlsx $API/api/v1/maps/$MAP_ID/excel -H "Authorization: Bearer $ADM")
  [ "$XLSX_BYTES" -gt 5000 ] && ok "Excel export → $XLSX_BYTES bytes" || bad "Excel export tiny ($XLSX_BYTES B)"
  file /tmp/e2e-export.xlsx | grep -q 'Excel' && ok "export is valid xlsx (file magic)" || bad "export not a real xlsx"
fi

# ============================================================
section "7. Photos: presign + PUT + finalize + list"
# ============================================================
if [ -n "${STORE_ID:-}" ]; then
  printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xff\xff?\x03\x00\x06\x00\x02\xfe\xff\xfe2\xc0\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/e2e-tiny.png
  SHA=$(sha256sum /tmp/e2e-tiny.png | awk '{print $1}')
  SIZ=$(stat -c %s /tmp/e2e-tiny.png)
  for KIND in before after tag_alert signature; do
    P=$(jget -X POST $API/api/v1/stores/$STORE_ID/photos -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
      -d "{\"kind\":\"$KIND\",\"contentType\":\"image/png\",\"sizeBytes\":$SIZ}")
    PID=$(echo "$P" | jq -er '.photoId' 2>/dev/null)
    PURL=$(echo "$P" | jq -er '.uploadUrl' 2>/dev/null)
    [ -n "${PID:-}" ] && ok "$KIND presign → photo $PID" || { bad "$KIND presign FAILED: $P"; continue; }
    PUT=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X PUT "$PURL" -H 'Content-Type: image/png' --data-binary @/tmp/e2e-tiny.png)
    [ "$PUT" = "200" ] && ok "$KIND PUT to MinIO" || bad "$KIND PUT to MinIO → $PUT"
    FIN=$(jpost_status $API/api/v1/photos/$PID/finalize "{\"sha256\":\"$SHA\"}" -H "Authorization: Bearer $WRK")
    [ "$FIN" = "204" ] && ok "$KIND finalize" || bad "$KIND finalize → $FIN"
    declare ${KIND^^}_ID=$PID
  done

  # finalize-without-actual-upload should be REJECTED (the bug we fixed)
  GHOST=$(jget -X POST $API/api/v1/stores/$STORE_ID/photos -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
    -d "{\"kind\":\"before\",\"contentType\":\"image/png\",\"sizeBytes\":$SIZ}")
  GHOST_ID=$(echo "$GHOST" | jq -er '.photoId')
  GHOST_FIN=$(jpost_status $API/api/v1/photos/$GHOST_ID/finalize "{\"sha256\":\"deadbeef\"}" -H "Authorization: Bearer $WRK")
  [ "$GHOST_FIN" = "400" ] && ok "ghost finalize rejected (400)" || bad "ghost finalize accepted ($GHOST_FIN — should be 400)"

  # photo list
  P_LIST=$(jget "$API/api/v1/stores/$STORE_ID/photos?kind=before" -H "Authorization: Bearer $WRK")
  P_COUNT=$(echo "$P_LIST" | jq 'length')
  [ "$P_COUNT" -ge 1 ] && ok "list before-photos → $P_COUNT" || bad "list before-photos empty"
fi

# ============================================================
section "8. Tag alerts + Mailhog delivery"
# ============================================================
if [ -n "${TAG_ALERT_ID:-}" ]; then
  TA=$(jget -X POST $API/api/v1/stores/$STORE_ID/tag-alerts -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
    -d "{\"title\":\"E2E alert\",\"description\":\"Smoke\",\"photoIds\":[\"$TAG_ALERT_ID\"]}")
  TA_ID=$(echo "$TA" | jq -er '.id' 2>/dev/null)
  [ -n "${TA_ID:-}" ] && ok "tag-alert created → $TA_ID" || bad "tag-alert FAILED: $TA"

  # Wait for outbox poll (5s) + handler
  sleep 8
  TA_STATUS=$(jget $API/api/v1/maps/$MAP_ID/tag-alerts -H "Authorization: Bearer $ADM" | jq -er '.[0].emailStatus' 2>/dev/null)
  [ "$TA_STATUS" = "sent" ] && ok "tag-alert email status: sent" || bad "tag-alert email status: $TA_STATUS (expected sent)"

  # Mailhog check
  MH_TOTAL=$(jget http://localhost:8025/api/v2/messages | jq -r '.total')
  [ "$MH_TOTAL" -ge 1 ] && ok "Mailhog has $MH_TOTAL message(s)" || bad "Mailhog empty"
fi

# ============================================================
section "9. Completion + read-back + Excel re-export"
# ============================================================
if [ -n "${BEFORE_ID:-}" ] && [ -n "${AFTER_ID:-}" ] && [ -n "${SIGNATURE_ID:-}" ]; then
  COMP_BODY=$(jq -n --arg b "$BEFORE_ID" --arg a "$AFTER_ID" --arg s "$SIGNATURE_ID" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{firstName:"E2E",lastName:"Tester",generalComments:"Smoke",deviceTimezone:"America/Indiana/Indianapolis",completedAt:$ts,signaturePhotoId:$s,beforePhotoIds:[$b],afterPhotoIds:[$a],counts:{Handicap:1,Canopy:0,Crash:0,Dog_Bones:0,Gas_Lids:2,Lines:4}}')
  COMP=$(jget -X POST $API/api/v1/stores/$STORE_ID/complete -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' -d "$COMP_BODY")
  COMP_ID=$(echo "$COMP" | jq -er '.id' 2>/dev/null)
  [ -n "${COMP_ID:-}" ] && ok "completion created → $COMP_ID" || bad "completion FAILED: $COMP"

  # readback
  RB=$(jget $API/api/v1/stores/$STORE_ID/completion -H "Authorization: Bearer $WRK")
  [ "$(echo "$RB" | jq -r '.id')" = "$COMP_ID" ] && ok "completion read-back" || bad "completion read-back mismatch"

  # re-completion should 409
  RE=$(jpost_status $API/api/v1/stores/$STORE_ID/complete "$COMP_BODY" -H "Authorization: Bearer $WRK")
  [ "$RE" = "409" ] && ok "re-completion → 409 (idempotent guard)" || bad "re-completion → $RE (expected 409)"
fi

# ============================================================
section "10. Property image (admin only)"
# ============================================================
if [ -n "${STORE_ID:-}" ]; then
  PI=$(jget -X POST $API/api/v1/stores/$STORE_ID/property-image -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
    -d "{\"kind\":\"property_view\",\"contentType\":\"image/png\",\"sizeBytes\":$SIZ}")
  PI_ID=$(echo "$PI" | jq -er '.photoId' 2>/dev/null)
  PI_URL=$(echo "$PI" | jq -er '.uploadUrl' 2>/dev/null)
  [ -n "${PI_ID:-}" ] && ok "property-image presign" || bad "property-image presign FAILED: $PI"

  if [ -n "${PI_ID:-}" ]; then
    PI_PUT=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X PUT "$PI_URL" -H 'Content-Type: image/png' --data-binary @/tmp/e2e-tiny.png)
    [ "$PI_PUT" = "200" ] && ok "property-image PUT" || bad "property-image PUT → $PI_PUT"
    PI_FIN=$(jpost_status $API/api/v1/stores/$STORE_ID/property-image/$PI_ID/finalize "{\"sha256\":\"$SHA\"}" -H "Authorization: Bearer $ADM")
    [ "$PI_FIN" = "204" ] && ok "property-image finalize" || bad "property-image finalize → $PI_FIN"
    PI_GET=$(jget $API/api/v1/stores/$STORE_ID -H "Authorization: Bearer $ADM" | jq -er '.propertyImageUrl')
    [ -n "${PI_GET:-}" ] && [ "$PI_GET" != "null" ] && ok "store now has propertyImageUrl" || bad "propertyImageUrl missing after finalize"
    PI_DEL=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X DELETE $API/api/v1/stores/$STORE_ID/property-image -H "Authorization: Bearer $ADM")
    [ "$PI_DEL" = "204" ] && ok "property-image delete" || bad "property-image delete → $PI_DEL"
  fi

  # worker should NOT be able to upload property image (admin-only)
  WORKER_PI=$(probe -X POST $API/api/v1/stores/$STORE_ID/property-image -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' -d "{\"kind\":\"property_view\",\"contentType\":\"image/png\",\"sizeBytes\":$SIZ}")
  [ "$WORKER_PI" = "403" ] && ok "worker blocked from property-image (403)" || bad "worker NOT blocked from property-image ($WORKER_PI)"
fi

# ============================================================
section "11. Forgot/reset-password flow"
# ============================================================
FP=$(jpost_status $API/api/v1/auth/forgot-password '{"email":"admin@fullcirclefm.local"}')
[ "$FP" = "204" ] && ok "forgot-password → 204 (always)" || bad "forgot-password → $FP"
FP_GHOST=$(jpost_status $API/api/v1/auth/forgot-password '{"email":"does-not-exist@example.com"}')
[ "$FP_GHOST" = "204" ] && ok "forgot-password ghost-email → 204 (no enumeration leak)" || bad "forgot-password ghost-email → $FP_GHOST"

# ============================================================
section "12. Audit log"
# ============================================================
AL=$(jget "$API/api/v1/audit-log?page=1&pageSize=10" -H "Authorization: Bearer $ADM")
AL_COUNT=$(echo "$AL" | jq -r '.items | length')
[ "$AL_COUNT" -gt 0 ] && ok "audit-log has $AL_COUNT entries (latest: $(echo "$AL" | jq -r '.items[0].action'))" || bad "audit-log empty"
WORKER_AL=$(probe $API/api/v1/audit-log -H "Authorization: Bearer $WRK")
[ "$WORKER_AL" = "403" ] && ok "worker blocked from audit-log (403)" || bad "worker not blocked from audit-log ($WORKER_AL)"

# ============================================================
section "13. Devices (push tokens)"
# ============================================================
TOK="ExponentPushToken[E2EFAKE_$TS]"
DEV=$(jpost_status $API/api/v1/devices "{\"pushToken\":\"$TOK\",\"platform\":\"android\"}" -H "Authorization: Bearer $WRK")
[ "$DEV" = "204" ] && ok "register device" || bad "register device → $DEV"
DEV_DEL=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X DELETE "$API/api/v1/devices/$(printf %s "$TOK" | jq -sRr @uri)" -H "Authorization: Bearer $WRK")
[ "$DEV_DEL" = "204" ] && ok "deregister device" || bad "deregister device → $DEV_DEL"

# ============================================================
section "13a. Legacy parity: self-profile update (PATCH /auth/profile)"
# ============================================================
PROF_BEFORE=$(jget $API/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"worker@fullcirclefm.local","password":"password123"}' | jq -r .user.phone)
ok "worker phone before: ${PROF_BEFORE:-null}"
NEW_PHONE="555-SMOKE-$TS"
PR_RES=$(curl -sS -X PATCH $API/api/v1/auth/profile -H "Authorization: Bearer $WRK" \
  -H 'Content-Type: application/json' -d "{\"phone\":\"$NEW_PHONE\",\"address\":\"123 E2E Ln\",\"state\":\"IA\",\"zip\":\"50000\"}")
PR_PHONE=$(echo "$PR_RES" | jq -er .phone)
[ "$PR_PHONE" = "$NEW_PHONE" ] && ok "worker self-updated phone → $NEW_PHONE" || bad "self-update FAILED: $PR_RES"
# admin can read it back
A_PHONE=$(jget "$API/api/v1/users?role=worker" -H "Authorization: Bearer $ADM" \
  | jq -er '.[] | select(.email == "worker@fullcirclefm.local") | .phone')
[ "$A_PHONE" = "$NEW_PHONE" ] && ok "admin sees updated phone via users list" || bad "admin sees: $A_PHONE"
# self-update cannot rename or change role/status (subset enforced by Zod)
NO_RENAME=$(probe -X PATCH $API/api/v1/auth/profile -H "Authorization: Bearer $WRK" \
  -H 'Content-Type: application/json' -d '{"firstName":"Hack"}')
[ "$NO_RENAME" = "200" ] && ok "self-update silently ignores firstName (extra fields stripped)" \
  || bad "self-update with firstName → $NO_RENAME"

# ============================================================
section "13b. Legacy parity: Questions module (CRUD)"
# ============================================================
if [ -n "${MAP_ID:-}" ]; then
  Q_LIST_EMPTY=$(jget $API/api/v1/maps/$MAP_ID/questions -H "Authorization: Bearer $ADM")
  [ "$(echo "$Q_LIST_EMPTY" | jq 'length')" = "0" ] && ok "questions list initially empty" || bad "questions list non-empty: $Q_LIST_EMPTY"

  Q_CREATE=$(jget -X POST $API/api/v1/maps/$MAP_ID/questions -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' -d '{"title":"Smoke Q1"}')
  Q_ID=$(echo "$Q_CREATE" | jq -er '.id' 2>/dev/null)
  [ -n "${Q_ID:-}" ] && ok "create question → $Q_ID" || bad "create question FAILED: $Q_CREATE"

  Q_UPDATE=$(jpost_status $API/api/v1/questions/$Q_ID "{\"title\":\"Smoke Q1 (edited)\"}" -H "Authorization: Bearer $ADM" -X PATCH)
  [ "$Q_UPDATE" = "200" ] && ok "update question → 200" || bad "update question → $Q_UPDATE"

  Q_LIST=$(jget $API/api/v1/maps/$MAP_ID/questions -H "Authorization: Bearer $ADM")
  Q_TITLE=$(echo "$Q_LIST" | jq -r '.[0].title')
  [ "$Q_TITLE" = "Smoke Q1 (edited)" ] && ok "question title persisted" || bad "question title wrong: $Q_TITLE"

  # worker MUST NOT be able to mutate questions (admin-only) but CAN read
  Q_WORKER_READ=$(probe $API/api/v1/maps/$MAP_ID/questions -H "Authorization: Bearer $WRK")
  [ "$Q_WORKER_READ" = "200" ] && ok "worker can read questions (assigned)" || bad "worker read questions → $Q_WORKER_READ"
  Q_WORKER_CREATE=$(probe -X POST $API/api/v1/maps/$MAP_ID/questions -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' -d '{"title":"x"}')
  [ "$Q_WORKER_CREATE" = "403" ] && ok "worker blocked from create question (403)" || bad "worker create question → $Q_WORKER_CREATE (expected 403)"

  Q_DEL=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X DELETE $API/api/v1/questions/$Q_ID -H "Authorization: Bearer $ADM")
  [ "$Q_DEL" = "204" ] && ok "delete question → 204" || bad "delete question → $Q_DEL"
fi

# ============================================================
section "13c. Legacy parity: Store CRUD (add/edit/delete)"
# ============================================================
if [ -n "${MAP_ID:-}" ]; then
  S_BODY='{"storeNumber":"E2E-9999","storeName":"E2E Manual Add","state":"IA","address":"1 Smoke Ln","zip":"50000","latitude":41.5,"longitude":-93.5,"type":"Test","manager":"Tester"}'
  S_CREATE=$(jget -X POST $API/api/v1/maps/$MAP_ID/stores -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' -d "$S_BODY")
  S_ID=$(echo "$S_CREATE" | jq -er '.id' 2>/dev/null)
  [ -n "${S_ID:-}" ] && ok "manual add store → $S_ID" || bad "manual add store FAILED: $S_CREATE"

  # duplicate storeNumber within same map should 409
  S_DUP=$(jpost_status $API/api/v1/maps/$MAP_ID/stores "$S_BODY" -H "Authorization: Bearer $ADM")
  [ "$S_DUP" = "409" ] && ok "duplicate storeNumber rejected (409)" || bad "duplicate storeNumber → $S_DUP (expected 409)"

  if [ -n "${S_ID:-}" ]; then
    S_UPDATE=$(jpost_status $API/api/v1/stores/$S_ID '{"storeName":"E2E Renamed","manager":"Tester2"}' -H "Authorization: Bearer $ADM" -X PATCH)
    [ "$S_UPDATE" = "200" ] && ok "edit store → 200" || bad "edit store → $S_UPDATE"
    S_GET=$(jget $API/api/v1/stores/$S_ID -H "Authorization: Bearer $ADM" | jq -r '.storeName')
    [ "$S_GET" = "E2E Renamed" ] && ok "store rename persisted" || bad "store rename mismatch: $S_GET"

    # worker should NOT be able to edit
    S_WORKER_EDIT=$(probe -X PATCH $API/api/v1/stores/$S_ID -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' -d '{"storeName":"x"}')
    [ "$S_WORKER_EDIT" = "403" ] && ok "worker blocked from edit store (403)" || bad "worker edit store → $S_WORKER_EDIT (expected 403)"

    S_DEL=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X DELETE $API/api/v1/stores/$S_ID -H "Authorization: Bearer $ADM")
    [ "$S_DEL" = "204" ] && ok "soft-delete store → 204" || bad "soft-delete store → $S_DEL"
    # listing should now exclude it
    S_LIST_ABSENT=$(jget $API/api/v1/maps/$MAP_ID/stores -H "Authorization: Bearer $ADM" | jq --arg id "$S_ID" 'map(select(.id == $id)) | length')
    [ "$S_LIST_ABSENT" = "0" ] && ok "deleted store hidden from list" || bad "deleted store still listed: $S_LIST_ABSENT row(s)"
  fi
fi

# ============================================================
section "14. Admin web pages (nginx-fronted)"
# ============================================================
for path in /login /forgot-password /reset-password \
            /maps /workers /vendors /viewers /audit-log /change-password /profile \
            "/maps/$MAP_ID" "/maps/$MAP_ID/view" "/maps/$MAP_ID/workers" "/maps/$MAP_ID/vendors" "/maps/$MAP_ID/viewers" \
            "/maps/$MAP_ID/tag-alerts" "/maps/$MAP_ID/tag-alert-log" "/maps/$MAP_ID/questions"; do
  CODE=$(probe "$PUBLIC$path")
  if [ "$CODE" = "200" ]; then
    ok "$path → 200"
  elif [ "$CODE" = "307" ] || [ "$CODE" = "308" ]; then
    ok "$path → $CODE (redirect, expected for auth gate)"
  else
    bad "$path → $CODE"
  fi
done

# completion read-only page (admin)
if [ -n "${STORE_ID:-}" ] && [ -n "${COMP_ID:-}" ]; then
  CODE=$(probe "$PUBLIC/maps/$MAP_ID/stores/$STORE_ID/completion")
  [ "$CODE" = "200" ] || [ "$CODE" = "307" ] && ok "completion-view page → $CODE" || bad "completion-view page → $CODE"
fi

# ============================================================
section "15. Cleanup smoke artefacts"
# ============================================================
if [ -n "${MAP_ID:-}" ]; then
  DEL=$(curl -sS -m 10 -o /dev/null -w '%{http_code}' -X DELETE $API/api/v1/maps/$MAP_ID -H "Authorization: Bearer $ADM")
  [ "$DEL" = "204" ] && ok "soft-delete smoke map" || bad "soft-delete smoke map → $DEL"
fi
rm -f /tmp/e2e-tiny.png /tmp/e2e-export.xlsx

# ============================================================
section "Summary"
# ============================================================
TOTAL=$((PASS+FAIL))
echo
printf '\033[1mResults: %d pass, %d fail (%d total)\033[0m\n' "$PASS" "$FAIL" "$TOTAL"
[ "$FAIL" = "0" ]
