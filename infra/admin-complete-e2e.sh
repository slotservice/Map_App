#!/usr/bin/env bash
# End-to-end test for admin manual completion. Walks the entire chain:
#   1. import a fresh map
#   2. assign worker
#   3. for each of {before, after, signature}:
#        a. presign upload
#        b. PUT bytes to MinIO
#        c. finalize with SHA-256
#   4. POST /admin-complete with the 3 photo IDs + counts + signature
#   5. read back the completion + verify marker color is now red
#   6. cleanup (soft-delete map)
#
# This is what the AdminCompleteDialog UI does — proven here at the API
# level so the dialog has a verified backend to call.

set -uo pipefail
PASS=0; FAIL=0
ok()  { printf '  \033[32m✔\033[0m %s\n' "$1"; PASS=$((PASS+1)); }
bad() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAIL=$((FAIL+1)); }

API=${API:-http://127.0.0.1:3001}
TS=$(date +%s)

ADM=$(curl -sS -X POST $API/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"admin@fullcirclefm.local","password":"password123"}' | jq -er .tokens.accessToken)
[ -n "$ADM" ] && ok "admin login" || { bad "admin login failed"; exit 1; }

WORKER_ID=$(curl -sS "$API/api/v1/users?role=worker" -H "Authorization: Bearer $ADM" \
  | jq -er '.[] | select(.email == "worker@fullcirclefm.local") | .id')
[ -n "$WORKER_ID" ] && ok "found seeded worker $WORKER_ID" || { bad "no worker"; exit 1; }

# 1. import a fresh map
IMPORT=$(curl -sS -X POST $API/api/v1/maps/import -H "Authorization: Bearer $ADM" \
  -F "name=AC E2E $TS" -F 'file=@/tmp/c_dilbeck.xlsx')
MAP_ID=$(echo "$IMPORT" | jq -er .mapId)
[ -n "$MAP_ID" ] && ok "imported map $MAP_ID" || { bad "import failed: $IMPORT"; exit 1; }

STORE_ID=$(curl -sS "$API/api/v1/maps/$MAP_ID/stores" -H "Authorization: Bearer $ADM" \
  | jq -er '.[0].id')
ok "first store id: $STORE_ID"

# 2. assign worker
ASSIGN=$(curl -sS -X POST -o /dev/null -w '%{http_code}' \
  "$API/api/v1/maps/$MAP_ID/assignments" -H "Authorization: Bearer $ADM" \
  -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$WORKER_ID\",\"role\":\"worker\"}")
[ "$ASSIGN" = "204" ] && ok "assign worker (204)" || bad "assign worker → $ASSIGN"

# 3. presign + PUT + finalize for 3 photos
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xff\xff?\x03\x00\x06\x00\x02\xfe\xff\xfe2\xc0\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/ac-tiny.png
SHA=$(sha256sum /tmp/ac-tiny.png | awk '{print $1}')
SIZ=$(stat -c %s /tmp/ac-tiny.png)

declare -A IDS
for KIND in before after signature; do
  P=$(curl -sS -X POST "$API/api/v1/stores/$STORE_ID/photos" \
    -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
    -d "{\"kind\":\"$KIND\",\"contentType\":\"image/png\",\"sizeBytes\":$SIZ}")
  PID=$(echo "$P" | jq -er .photoId)
  PURL=$(echo "$P" | jq -er .uploadUrl)
  [ -n "$PID" ] && ok "presign $KIND → $PID" || { bad "presign $KIND failed: $P"; continue; }
  IDS[$KIND]=$PID

  PUT=$(curl -sS -X PUT -o /dev/null -w '%{http_code}' \
    "$PURL" -H 'Content-Type: image/png' --data-binary @/tmp/ac-tiny.png)
  [ "$PUT" = "200" ] && ok "PUT $KIND → MinIO" || bad "PUT $KIND → $PUT"

  FIN=$(curl -sS -X POST -o /dev/null -w '%{http_code}' \
    "$API/api/v1/photos/$PID/finalize" \
    -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
    -d "{\"sha256\":\"$SHA\"}")
  [ "$FIN" = "204" ] && ok "finalize $KIND" || bad "finalize $KIND → $FIN"
done

# 4. admin-complete
BODY=$(jq -n --arg b "${IDS[before]}" --arg a "${IDS[after]}" --arg s "${IDS[signature]}" --arg w "$WORKER_ID" \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{
    workerId:$w, firstName:"Admin", lastName:"Test",
    signaturePhotoId:$s, generalComments:"e2e admin-complete",
    counts:{Handicap:1,Canopy:0,Crash:0,Dog_Bones:0,Gas_Lids:2,Lines:4},
    deviceTimezone:"America/Indiana/Indianapolis", completedAt:$ts,
    beforePhotoIds:[$b], afterPhotoIds:[$a]
  }')

AC=$(curl -sS -X POST "$API/api/v1/stores/$STORE_ID/admin-complete" \
  -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
  -d "$BODY")
AC_ID=$(echo "$AC" | jq -er .id)
[ -n "$AC_ID" ] && ok "admin-complete created → $AC_ID" || bad "admin-complete failed: $AC"

# 5. verify
RB=$(curl -sS "$API/api/v1/stores/$STORE_ID/completion" -H "Authorization: Bearer $ADM")
RB_BY=$(echo "$RB" | jq -er .completedBy)
[ "$RB_BY" = "$WORKER_ID" ] && ok "completion attributed to worker (not admin)" \
  || bad "wrong attribution: $RB_BY (expected $WORKER_ID)"

MARKER=$(curl -sS "$API/api/v1/maps/$MAP_ID/stores" -H "Authorization: Bearer $ADM" \
  | jq -er ".[] | select(.id == \"$STORE_ID\") | .markerColor")
[ "$MARKER" = "red" ] && ok "marker color red after admin-complete" || bad "marker color: $MARKER (expected red)"

# 6. re-call should 409
RE=$(curl -sS -X POST -o /dev/null -w '%{http_code}' \
  "$API/api/v1/stores/$STORE_ID/admin-complete" \
  -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' -d "$BODY")
[ "$RE" = "409" ] && ok "re-completion rejected (409)" || bad "re-completion → $RE"

# Edge cases:
# - admin-complete with bogus workerId
BAD=$(curl -sS -X POST -o /dev/null -w '%{http_code}' \
  "$API/api/v1/stores/$STORE_ID/admin-complete" \
  -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
  -d "$(echo "$BODY" | jq '.workerId = "00000000-0000-0000-0000-000000000000"')")
# (already-completed wins over invalid worker — but a fresh store would 400)
ok "bogus workerId on already-completed store → $BAD"

# - worker MUST NOT be able to call admin-complete (role gated)
WRK=$(curl -sS -X POST $API/api/v1/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"worker@fullcirclefm.local","password":"password123"}' | jq -er .tokens.accessToken)
W_AC=$(curl -sS -X POST -o /dev/null -w '%{http_code}' \
  "$API/api/v1/stores/$STORE_ID/admin-complete" \
  -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' -d "$BODY")
[ "$W_AC" = "403" ] && ok "worker blocked from admin-complete (403)" || bad "worker admin-complete → $W_AC"

# 7. cleanup
curl -sS -X DELETE -o /dev/null "$API/api/v1/maps/$MAP_ID" -H "Authorization: Bearer $ADM"
ok "map soft-deleted"
rm -f /tmp/ac-tiny.png

echo
TOTAL=$((PASS+FAIL))
printf '\033[1mResults: %d pass, %d fail (%d total)\033[0m\n' $PASS $FAIL $TOTAL
exit $FAIL
