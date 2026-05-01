#!/usr/bin/env bash
set -e
API=http://localhost:3001
JQ() { jq -er "$1"; }

echo '== 1. admin login =='
ADM_RES=$(curl -sS -X POST "$API/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@fullcirclefm.local","password":"password123"}')
ADM=$(echo "$ADM_RES" | JQ '.tokens.accessToken')
echo "  admin token len: ${#ADM}"

echo
echo '== 2. import C Dilbeck Stores.xlsx =='
IMPORT=$(curl -sS -X POST "$API/api/v1/maps/import" \
  -H "Authorization: Bearer $ADM" \
  -F 'name=C Dilbeck Smoke 2026' \
  -F 'file=@/tmp/c_dilbeck.xlsx')
echo "$IMPORT" | jq .
MAP_ID=$(echo "$IMPORT" | JQ '.mapId')
echo "  mapId: $MAP_ID"

echo
echo '== 3. list maps as admin =='
curl -sS "$API/api/v1/maps" -H "Authorization: Bearer $ADM" | jq '.[] | {id, name, storeCount, assignedUserCount, taskColumns, countColumns}'

echo
echo '== 4. list stores in the map =='
STORES=$(curl -sS "$API/api/v1/maps/$MAP_ID/stores" -H "Authorization: Bearer $ADM")
echo "  store count: $(echo "$STORES" | jq 'length')"
echo "  first 3 stores:"
echo "$STORES" | jq '.[0:3] | map({id, storeNumber, storeName, markerColor})'
STORE_ID=$(echo "$STORES" | JQ '.[0].id')
echo "  first storeId: $STORE_ID"

echo
echo '== 5. get worker user id, assign worker to map =='
WORKER_ID=$(curl -sS "$API/api/v1/users?role=worker" -H "Authorization: Bearer $ADM" | JQ '.[0].id')
echo "  worker id: $WORKER_ID"
ASSIGN_CODE=$(curl -sS -X POST "$API/api/v1/maps/$MAP_ID/assignments" \
  -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
  -d "{\"userId\":\"$WORKER_ID\",\"role\":\"worker\"}" -w '%{http_code}' -o /tmp/assign.json)
echo "  assign HTTP $ASSIGN_CODE"
cat /tmp/assign.json; echo

echo
echo '== 6. login as worker, list maps =='
WRK=$(curl -sS -X POST "$API/api/v1/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"worker@fullcirclefm.local","password":"password123"}' | JQ '.tokens.accessToken')
WMAPS=$(curl -sS "$API/api/v1/maps" -H "Authorization: Bearer $WRK")
echo "  worker visible maps: $(echo "$WMAPS" | jq 'length')"
echo "$WMAPS" | jq '.[] | {id, name, storeCount}'

echo
echo '== 7. presign + upload before-photo to MinIO =='
# tiny 1x1 transparent PNG (compute size first so presign matches)
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\xfc\xff\xff?\x03\x00\x06\x00\x02\xfe\xff\xfe2\xc0\x00\x00\x00\x00IEND\xaeB`\x82' > /tmp/tiny.png
SHA256=$(sha256sum /tmp/tiny.png | awk '{print $1}')
SIZE=$(stat -c %s /tmp/tiny.png)
echo "  png size: $SIZE bytes, sha256: $SHA256"

PHOTO_INIT=$(curl -sS -X POST "$API/api/v1/stores/$STORE_ID/photos" \
  -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
  -d "{\"kind\":\"before\",\"fieldName\":\"smoke-test\",\"contentType\":\"image/png\",\"sizeBytes\":$SIZE}")
echo "$PHOTO_INIT" | jq .
PHOTO_ID=$(echo "$PHOTO_INIT" | JQ '.photoId')
PUT_URL=$(echo "$PHOTO_INIT" | JQ '.uploadUrl')
echo "  photoId: $PHOTO_ID"
BEFORE_ID=$PHOTO_ID
PUT_CODE=$(curl -sS -X PUT "$PUT_URL" -H 'Content-Type: image/png' --data-binary @/tmp/tiny.png -w '%{http_code}' -o /tmp/put.out)
echo "  PUT to MinIO: HTTP $PUT_CODE"
[ "$PUT_CODE" = "200" ] || cat /tmp/put.out

echo
echo '== 8. finalize photo =='
FINALIZE_RES=$(curl -sS -X POST "$API/api/v1/photos/$PHOTO_ID/finalize" \
  -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
  -d "{\"sha256\":\"$SHA256\"}" -w '\nHTTP %{http_code}')
echo "$FINALIZE_RES"

echo
echo '== 9. list before-photos for store =='
curl -sS "$API/api/v1/stores/$STORE_ID/photos?kind=before" -H "Authorization: Bearer $WRK" | jq

echo
echo '== 9b. set tag-alert recipients on map =='
curl -sS -X PATCH "$API/api/v1/maps/$MAP_ID" \
  -H "Authorization: Bearer $ADM" -H 'Content-Type: application/json' \
  -d '{"tagAlertRecipients":["alerts@example.com","ops@example.com"]}' -w 'HTTP %{http_code}\n' -o /dev/null

echo
echo '== 10. raise tag-alert =='
# first upload a tag_alert photo
TAP=$(curl -sS -X POST "$API/api/v1/stores/$STORE_ID/photos" \
  -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
  -d "{\"kind\":\"tag_alert\",\"contentType\":\"image/png\",\"sizeBytes\":$SIZE}")
TAP_ID=$(echo "$TAP" | JQ '.photoId')
TAP_URL=$(echo "$TAP" | JQ '.uploadUrl')
curl -sS -X PUT "$TAP_URL" -H 'Content-Type: image/png' --data-binary @/tmp/tiny.png -o /dev/null
curl -sS -X POST "$API/api/v1/photos/$TAP_ID/finalize" \
  -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
  -d "{\"sha256\":\"$SHA256\"}" -o /dev/null
echo "  tag-alert photo: $TAP_ID"

TA_RES=$(curl -sS -X POST "$API/api/v1/stores/$STORE_ID/tag-alerts" \
  -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Smoke test alert\",\"description\":\"This is an automated smoke-test tag alert.\",\"photoIds\":[\"$TAP_ID\"]}")
echo "$TA_RES" | jq

echo "  waiting 8s for outbox to drain..."
sleep 8

echo
echo '== 11. check Mailhog inbox =='
curl -sS http://localhost:8025/api/v2/messages | jq '{total, latest: .items[0].Content.Headers | {Subject, To}}'

echo
echo '== 12. complete the store (counts + signature) =='
# upload an after-photo + signature first
for KIND in after signature; do
  P=$(curl -sS -X POST "$API/api/v1/stores/$STORE_ID/photos" \
    -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
    -d "{\"kind\":\"$KIND\",\"contentType\":\"image/png\",\"sizeBytes\":$SIZE}")
  PID=$(echo "$P" | JQ '.photoId')
  PURL=$(echo "$P" | JQ '.uploadUrl')
  curl -sS -X PUT "$PURL" -H 'Content-Type: image/png' --data-binary @/tmp/tiny.png -o /dev/null
  curl -sS -X POST "$API/api/v1/photos/$PID/finalize" \
    -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
    -d "{\"sha256\":\"$SHA256\"}" -o /dev/null
  if [ "$KIND" = "signature" ]; then SIG_ID=$PID; fi
  if [ "$KIND" = "after" ]; then AFTER_ID=$PID; fi
  echo "  $KIND photo: $PID"
done

COMPLETE_BODY=$(jq -n \
  --arg first "Smoke" \
  --arg last "Tester" \
  --arg comments "Automated smoke-test completion" \
  --arg tz "America/Indiana/Indianapolis" \
  --arg completedAt "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg sig "$SIG_ID" \
  --arg before "$BEFORE_ID" \
  --arg after "$AFTER_ID" \
  '{
    firstName:$first, lastName:$last, generalComments:$comments,
    deviceTimezone:$tz, completedAt:$completedAt, signaturePhotoId:$sig,
    beforePhotoIds:[$before], afterPhotoIds:[$after],
    counts:{Handicap:1, Canopy:0, Crash:0, Dog_Bones:0, Gas_Lids:2, Lines:4}
  }')
COMPLETE_RES=$(curl -sS -X POST "$API/api/v1/stores/$STORE_ID/complete" \
  -H "Authorization: Bearer $WRK" -H 'Content-Type: application/json' \
  -d "$COMPLETE_BODY" -w '\nHTTP %{http_code}')
echo "$COMPLETE_RES" | tail -5

echo
echo '== 13. download Excel export =='
curl -sS "$API/api/v1/maps/$MAP_ID/excel" -H "Authorization: Bearer $ADM" -o /tmp/export.xlsx -w 'HTTP %{http_code}, %{size_download} bytes\n'
file /tmp/export.xlsx 2>&1

echo
echo '== DONE =='
