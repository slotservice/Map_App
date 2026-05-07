#!/usr/bin/env bash
# Role-based access audit. Logs in as admin/worker/vendor and probes
# every endpoint that has a role implication. Asserts:
#   - admin sees the right things (200)
#   - non-admin is blocked from admin-only mutations (403)
#   - non-admin can read what they're assigned to, gets 403/404 for the rest

set -uo pipefail
PASS=0; FAIL=0
ok()  { printf '  \033[32m✔\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }
section() { printf '\n\033[1m== %s ==\033[0m\n' "$1"; }
api=${API:-http://127.0.0.1:3001}/api/v1

login() {
  curl -sS -X POST "$api/auth/login" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"password123\"}" | jq -er .tokens.accessToken
}

probe() {
  local expected=$1; local desc=$2; shift 2
  local code
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$@")
  if [ "$code" = "$expected" ]; then ok "$desc → $code"; else bad "$desc → $code (expected $expected)"; fi
}

ADM=$(login admin@fullcirclefm.local)
WRK=$(login worker@fullcirclefm.local)
VND=$(login vendor@fullcirclefm.local)

# Setup: import a fresh map, assign worker + vendor
TS=$(date +%s)
MAP=$(curl -sS -X POST $api/maps/import -H "Authorization: Bearer $ADM" \
  -F "name=role-audit-$TS" -F 'file=@/tmp/c_dilbeck.xlsx' | jq -er .mapId)
WORKER_ID=$(curl -sS "$api/users?role=worker" -H "Authorization: Bearer $ADM" \
  | jq -er '.[] | select(.email == "worker@fullcirclefm.local") | .id')
VENDOR_ID=$(curl -sS "$api/users?role=vendor" -H "Authorization: Bearer $ADM" \
  | jq -er '.[] | select(.email == "vendor@fullcirclefm.local") | .id')
curl -sS -X POST $api/maps/$MAP/assignments -H "Authorization: Bearer $ADM" \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$WORKER_ID\",\"role\":\"worker\"}" > /dev/null
curl -sS -X POST $api/maps/$MAP/assignments -H "Authorization: Bearer $ADM" \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$VENDOR_ID\",\"role\":\"vendor\"}" > /dev/null
STORE=$(curl -sS "$api/maps/$MAP/stores" -H "Authorization: Bearer $ADM" | jq -er '.[0].id')
ok "setup: map=$MAP store=$STORE worker=$WORKER_ID vendor=$VENDOR_ID"

# A map THEY ARE NOT assigned to
OTHER=$(curl -sS -X POST $api/maps/import -H "Authorization: Bearer $ADM" \
  -F "name=role-audit-other-$TS" -F 'file=@/tmp/c_dilbeck.xlsx' | jq -er .mapId)
ok "setup: other-map=$OTHER (no assignments)"

section "1. Map list visibility (legacy bug L1)"
# Admin sees both
A_COUNT=$(curl -sS $api/maps -H "Authorization: Bearer $ADM" | jq 'length')
[ "$A_COUNT" -ge 2 ] && ok "admin sees ≥2 maps ($A_COUNT)" || bad "admin sees $A_COUNT (expected ≥2)"
# Worker sees only assigned
W_MAPS=$(curl -sS $api/maps -H "Authorization: Bearer $WRK" | jq -r '.[].id' | sort -u)
echo "$W_MAPS" | grep -q "$MAP" && ok "worker sees assigned map" || bad "worker missing assigned map"
echo "$W_MAPS" | grep -q "$OTHER" && bad "worker sees unassigned map (L1)" || ok "worker does NOT see unassigned map"
# Vendor sees only assigned
V_MAPS=$(curl -sS $api/maps -H "Authorization: Bearer $VND" | jq -r '.[].id' | sort -u)
echo "$V_MAPS" | grep -q "$MAP" && ok "vendor sees assigned map" || bad "vendor missing assigned map"
echo "$V_MAPS" | grep -q "$OTHER" && bad "vendor sees unassigned map (L1)" || ok "vendor does NOT see unassigned map (L1 fix)"

section "2. Map detail access"
probe 200 "admin GET /maps/<assigned>"   $api/maps/$MAP   -H "Authorization: Bearer $ADM"
probe 200 "admin GET /maps/<other>"      $api/maps/$OTHER -H "Authorization: Bearer $ADM"
probe 200 "worker GET /maps/<assigned>"  $api/maps/$MAP   -H "Authorization: Bearer $WRK"
probe 403 "worker GET /maps/<other>"     $api/maps/$OTHER -H "Authorization: Bearer $WRK"
probe 200 "vendor GET /maps/<assigned>"  $api/maps/$MAP   -H "Authorization: Bearer $VND"
probe 403 "vendor GET /maps/<other>"     $api/maps/$OTHER -H "Authorization: Bearer $VND"

section "3. Map mutations (admin only)"
probe 200 "admin PATCH /maps/<id>"  -X PATCH $api/maps/$MAP -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' -d '{"tagAlertRecipients":["x@y.com"]}'
probe 403 "worker PATCH /maps/<id>" -X PATCH $api/maps/$MAP -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' -d '{"tagAlertRecipients":["x@y.com"]}'
probe 403 "vendor PATCH /maps/<id>" -X PATCH $api/maps/$MAP -H "Authorization: Bearer $VND" -H 'Content-Type: application/json' -d '{"tagAlertRecipients":["x@y.com"]}'

section "4. Stores: list + detail visibility"
probe 200 "admin list stores <assigned>"  $api/maps/$MAP/stores   -H "Authorization: Bearer $ADM"
probe 200 "worker list stores <assigned>" $api/maps/$MAP/stores   -H "Authorization: Bearer $WRK"
probe 200 "vendor list stores <assigned>" $api/maps/$MAP/stores   -H "Authorization: Bearer $VND"
probe 403 "worker list stores <other>"    $api/maps/$OTHER/stores -H "Authorization: Bearer $WRK"
probe 403 "vendor list stores <other>"    $api/maps/$OTHER/stores -H "Authorization: Bearer $VND"
probe 200 "admin GET /stores/<id>"  $api/stores/$STORE -H "Authorization: Bearer $ADM"
probe 200 "worker GET /stores/<id>" $api/stores/$STORE -H "Authorization: Bearer $WRK"
probe 200 "vendor GET /stores/<id>" $api/stores/$STORE -H "Authorization: Bearer $VND"

section "5. Stores CRUD (admin only — legacy parity)"
S_BODY="{\"storeNumber\":\"audit-$TS\",\"storeName\":\"audit\",\"latitude\":41.5,\"longitude\":-93.5}"
probe 201 "admin POST /maps/<id>/stores"  -X POST $api/maps/$MAP/stores -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' -d "$S_BODY"
probe 403 "worker POST /maps/<id>/stores" -X POST $api/maps/$MAP/stores -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' -d "$S_BODY"
probe 403 "vendor POST /maps/<id>/stores" -X POST $api/maps/$MAP/stores -H "Authorization: Bearer $VND" -H 'Content-Type: application/json' -d "$S_BODY"
probe 403 "worker PATCH /stores/<id>"  -X PATCH $api/stores/$STORE -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' -d '{"manager":"x"}'
probe 403 "vendor PATCH /stores/<id>"  -X PATCH $api/stores/$STORE -H "Authorization: Bearer $VND" -H 'Content-Type: application/json' -d '{"manager":"x"}'
probe 403 "worker DELETE /stores/<id>" -X DELETE $api/stores/$STORE -H "Authorization: Bearer $WRK"
probe 403 "vendor DELETE /stores/<id>" -X DELETE $api/stores/$STORE -H "Authorization: Bearer $VND"

section "6. Questions module"
probe 200 "admin GET /maps/<id>/questions"   $api/maps/$MAP/questions -H "Authorization: Bearer $ADM"
probe 200 "worker GET /maps/<id>/questions"  $api/maps/$MAP/questions -H "Authorization: Bearer $WRK"
probe 200 "vendor GET /maps/<id>/questions"  $api/maps/$MAP/questions -H "Authorization: Bearer $VND"
probe 403 "worker GET /maps/<other>/questions"  $api/maps/$OTHER/questions -H "Authorization: Bearer $WRK"
probe 201 "admin POST /maps/<id>/questions"   -X POST $api/maps/$MAP/questions -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' -d '{"title":"audit Q"}'
probe 403 "worker POST /maps/<id>/questions"  -X POST $api/maps/$MAP/questions -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' -d '{"title":"audit Q"}'
probe 403 "vendor POST /maps/<id>/questions"  -X POST $api/maps/$MAP/questions -H "Authorization: Bearer $VND" -H 'Content-Type: application/json' -d '{"title":"audit Q"}'

section "7. Users + audit log (admin only)"
probe 200 "admin GET /users"         $api/users -H "Authorization: Bearer $ADM"
probe 403 "worker GET /users"        $api/users -H "Authorization: Bearer $WRK"
probe 403 "vendor GET /users"        $api/users -H "Authorization: Bearer $VND"
probe 200 "admin GET /audit-log"     $api/audit-log -H "Authorization: Bearer $ADM"
probe 403 "worker GET /audit-log"    $api/audit-log -H "Authorization: Bearer $WRK"
probe 403 "vendor GET /audit-log"    $api/audit-log -H "Authorization: Bearer $VND"

section "8. Edit-store + initialStatus regression check"
# Get current task statuses
INIT=$(curl -sS "$api/stores/$STORE" -H "Authorization: Bearer $ADM" \
  | jq -r '.tasks[0] | "\(.name)|\(.initialStatus)|\(.currentStatus)"')
TASK_NAME=$(echo "$INIT" | cut -d'|' -f1)
INIT_STATUS=$(echo "$INIT" | cut -d'|' -f2)
ok "before edit: $INIT"
# Toggle currentStatus to scheduled_or_complete
curl -sS -X PATCH $api/stores/$STORE -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
  -d "{\"taskStatuses\":{\"$TASK_NAME\":\"scheduled_or_complete\"}}" > /dev/null
AFTER=$(curl -sS "$api/stores/$STORE" -H "Authorization: Bearer $ADM" \
  | jq -r ".tasks[] | select(.name == \"$TASK_NAME\") | \"\(.initialStatus)|\(.currentStatus)\"")
AFTER_INIT=$(echo "$AFTER" | cut -d'|' -f1)
AFTER_CURR=$(echo "$AFTER" | cut -d'|' -f2)
[ "$AFTER_INIT" = "$INIT_STATUS" ] && ok "edit preserves initialStatus ($AFTER_INIT)" \
  || bad "edit overwrote initialStatus: $INIT_STATUS → $AFTER_INIT"
[ "$AFTER_CURR" = "scheduled_or_complete" ] && ok "edit updates currentStatus" \
  || bad "currentStatus = $AFTER_CURR (expected scheduled_or_complete)"

section "9. Cleanup"
curl -sS -X DELETE -o /dev/null $api/maps/$MAP   -H "Authorization: Bearer $ADM"
curl -sS -X DELETE -o /dev/null $api/maps/$OTHER -H "Authorization: Bearer $ADM"
ok "cleaned up audit maps"

echo
TOTAL=$((PASS+FAIL))
printf '\033[1mResults: %d pass, %d fail (%d total)\033[0m\n' $PASS $FAIL $TOTAL
exit $FAIL
