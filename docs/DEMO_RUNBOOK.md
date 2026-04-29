# Demo runbook — local stack end-to-end

This walks you through the full Excel-import → assign worker → mobile
completion → admin Excel download flow on your machine. Everything runs
locally except the final mobile step, which needs an Android emulator
or a real device.

> **You'll need:** Node 20+, pnpm 9+, Docker Desktop, ~10 minutes.
> Optional: Android Studio (emulator) **or** a real Android phone with the
> Expo Go app and the dev machine on the same Wi-Fi.

## 1. Bootstrap (one-time, ~3 min)

```bash
cd <your-clone-of>/Map_App
pnpm install
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm infra:up               # Postgres + MinIO + Mailhog (Docker)
pnpm --filter @map-app/shared build
pnpm --filter @map-app/api prisma:migrate dev --name init
pnpm --filter @map-app/api prisma:seed
```

Seeds three accounts (password = `password123`):

| Email | Role |
|---|---|
| `admin@fullcirclefm.local` | admin |
| `vendor@fullcirclefm.local` | vendor |
| `worker@fullcirclefm.local` | worker |

## 2. Run API + admin web

```bash
pnpm dev
```

Wait for both lines:
- `✔ API listening on http://localhost:3001/api/v1`
- `▲ Next.js ... - Local: http://localhost:3000`

You can now visit:
- **Admin:** <http://localhost:3000>
- **OpenAPI docs:** <http://localhost:3001/api/v1/docs>
- **Mailhog inbox** (any email the API sends): <http://localhost:8025>
- **MinIO console** (uploaded photos): <http://localhost:9001> (login `mapapp` / `mapapp_dev_only`)

## 3. Admin demo (~3 min)

1. Open <http://localhost:3000>, sign in as `admin@fullcirclefm.local` / `password123`.
2. Click **+ Create map**, upload `legacy/client's file/Week 1 Lawn 2026.xlsx` (or any of the other client samples). Name it whatever you like.
3. You'll be redirected to the map detail page. Confirm:
   - Stores list loads, all blue markers
   - Each row has a "+ Add" button under **Property** (Phase 2 — try uploading any image)
4. Click **Manage workers** → add `worker@fullcirclefm.local` to this map.
5. **Optional:** click **Tag-alert recipients** and add your own email so you can see the email arrive in Mailhog later.
6. **Optional:** click **Manage viewers** to test the new viewer role.

## 4. Worker demo on mobile (~5 min)

Pick A or B:

### A. Android emulator
```bash
cd apps/mobile
npx expo run:android
```

### B. Physical device with Expo Go
```bash
cd apps/mobile
npx expo start --dev-client
```
Then scan the QR code with Expo Go. **Network gotcha:** if your phone is
on Wi-Fi, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to your dev
machine's LAN IP, e.g. `http://192.168.1.42:3001`.

Once the app loads:

1. Sign in: `worker@fullcirclefm.local` / `password123`.
2. Tap your map → MapView opens with blue store markers.
3. Tap any marker → StoreDetail. Try **Get directions** (opens Google Maps).
4. **Continue** → AddPhotos.
5. Add a "Before" photo (camera or gallery), tap **Save** — verify the marker is still blue and the photo persists when you reopen the store.
6. Reopen the store → AddPhotos → add an "After" photo → **Save & Next**.
7. CheckSign: enter first/last name, leave a comment, sign, **Complete**.
8. **Optional:** before completing, tap **Tag Alert** → fill it out → submit. Watch Mailhog (`http://localhost:8025`) for the email.
9. **Optional:** tap **Property View** to see the image you uploaded in step 3 of admin demo.

## 5. Verify on admin (~1 min)

Back on <http://localhost:3000>:

1. Map detail page → store row should show a **red** marker pill and a **View** link → click it.
2. Completion view shows: counts grid, comments, signature image, before/after photo grids.
3. Click **Tag-alert log** → you should see the alert with email status `sent` (if recipients were configured) or `pending` for a few seconds.
4. Click **Download Excel** — open the file. Verify:
   - Comments appear in the **General_Comments** column ✅ (legacy L2)
   - Counts populate against their column names ✅ (legacy L9)
   - **Completed_At_Local** is in your phone's timezone, no `14:30 PM` weirdness ✅ (legacy L5)
   - Signature URL + photo URLs are clickable

## 6. Forgot-password demo (~30 s)

1. Sign out.
2. Click **Forgot password?** on the login screen.
3. Enter `admin@fullcirclefm.local` → submit.
4. Check Mailhog → click the link → set a new password → sign in with it.

## 7. Audit log

As admin, click **Audit log** in the sidebar — you should see entries for:
- `map.create` (your import)
- `map.assign` (worker assignment)
- `user.update` (the password change after the reset)

## Common problems

| Symptom | Fix |
|---|---|
| `Connection refused` on API call | `pnpm infra:up` not run, or port 5432/9000/1025 already in use |
| Mobile login fails | `EXPO_PUBLIC_API_URL` doesn't match your machine's LAN IP for physical devices |
| Excel import 400 | First column must be `Store` or `Store #`; second must be `Store Name`; Latitude + Longitude required |
| Signature button doesn't render on iOS sim | known WebView quirk on certain Xcode versions; works on real device |

## Tear down

```bash
pnpm infra:down              # stops Docker; data persists in volumes
docker volume rm mapapp_postgres-data mapapp_minio-data   # if you want a clean slate
```
