# Local development on this machine — quickstart

This is the Windows-friendly setup we worked out for **your specific machine** (PostgreSQL 17 native, no Docker required, AV-friendly pnpm config). For a generic dev machine see `docs/DEMO_RUNBOOK.md`.

## What's already prepared

| | What | Where |
|---|---|---|
| ✅ | Node 22 + pnpm 9 | already in PATH |
| ✅ | PostgreSQL 17 | running as Windows service `postgresql-x64-17` |
| ✅ | MinIO + mc binaries | `.local-stack/minio.exe`, `.local-stack/mc.exe` (downloaded) |
| ✅ | pnpm store path | set to `.pnpm-store/` inside the project (less AV interference) |
| ✅ | `.env` files | filled in for all three apps with local-dev defaults |
| ✅ | Postgres bootstrap SQL | `infra/local-postgres-bootstrap.sql` |
| ✅ | Stack start/stop scripts | `.local-stack/start-stack.ps1`, `stop-stack.ps1` |
| ⏳ | `pnpm install` | running (or done — check below) |

## You need to do — 3 steps, ~2 minutes

### 1. Bootstrap the Postgres database (one-time)

You need your `postgres` superuser password (set when you installed PostgreSQL 17). Open **PowerShell** in the repo root and run:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -h localhost -U postgres -f infra/local-postgres-bootstrap.sql
```

It'll prompt for the postgres password once. The script:
- Creates a `mapapp` role with password `mapapp_dev_only`
- Creates a `mapapp_dev` database owned by `mapapp`
- Enables `citext` and `uuid-ossp` extensions

**It's idempotent** — safe to run again if anything fails halfway.

### 2. Start the local stack (every dev session)

```powershell
pnpm infra:up
```

This calls `.local-stack/start-stack.ps1` which:
- Verifies the Postgres service is running (starts it if needed)
- Boots MinIO server in the background on `:9000` (admin console on `:9001`)
- Creates the `fcfm-photos-dev` bucket via `mc`

To stop later: `pnpm infra:down`.

### 3. First-time DB migrate + seed (one-time)

```powershell
pnpm --filter @map-app/shared build
pnpm --filter @map-app/api prisma:migrate dev --name init
pnpm --filter @map-app/api prisma:seed
```

This creates all the tables and seeds three test accounts (password `password123`):

| Role | Email |
|---|---|
| Admin | `admin@fullcirclefm.local` |
| Vendor | `vendor@fullcirclefm.local` |
| Worker | `worker@fullcirclefm.local` |

## Run

```powershell
pnpm dev
```

Watches the API + admin web in parallel. After a few seconds you'll see:
- API on `http://localhost:3001/api/v1`
- OpenAPI docs at `http://localhost:3001/api/v1/docs`
- Admin at `http://localhost:3000`
- MinIO console at `http://localhost:9001` (login `mapapp` / `mapapp_dev_only`)

## Mobile app (separate terminal)

```powershell
pnpm --filter @map-app/mobile start
```

Then either:
- **Android emulator:** press `a` in the Expo prompt
- **Physical phone:** install **Expo Go** from the Play Store/App Store, scan the QR code. **Important:** edit `apps/mobile/.env` and replace `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001` with your Windows machine's LAN IP (e.g. `http://192.168.1.42:3001`) — the `10.0.2.2` address only works for Android emulators.

Worker login on mobile: `worker@fullcirclefm.local` / `password123`.

## End-to-end smoke test (optional)

Once `pnpm dev` is running, in another terminal:

```bash
bash infra/smoke-test.sh
```

Verifies `/healthz`, `/readyz`, login, RBAC enforcement, OpenAPI reachability. No phone or browser required.

## Tear down

```powershell
pnpm infra:down              # stops MinIO; Postgres stays running
```

If you ever want a clean slate:

```powershell
& 'C:\Program Files\PostgreSQL\17\bin\dropdb.exe' -h localhost -U postgres mapapp_dev
# then re-run step 1 above.
```

## Troubleshooting

### `pnpm install` is still running / errored with EBUSY

Windows Defender holds file locks on tarballs while it scans them. We're using `--network-concurrency=1` to serialize, which avoids it. If you ever need to redo:

```powershell
# Add the project's pnpm store to Windows Defender exclusions (one-off):
Add-MpPreference -ExclusionPath 'D:\Freelancer-Project\Andrew\Matt G\repo\.pnpm-store'

# Then retry:
pnpm install --network-concurrency=1
```

### Port already in use

Postgres on 5432, MinIO on 9000 / 9001, API on 3001, admin on 3000. If something else is on these ports:

```powershell
# Find what
netstat -ano | findstr :3001
# Then kill that PID:
taskkill /F /PID <pid>
```

### "Postgres password is wrong"

The Postgres password is whatever you set when installing PostgreSQL 17. If you don't remember:

```powershell
# Reset it
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -c "ALTER USER postgres WITH PASSWORD 'newpass';"
```

(That command only works if you can already run psql — if not, edit `pg_hba.conf` to set `local all all trust`, restart, and reset the password.)

### MinIO console password rejection

Login is `mapapp` / `mapapp_dev_only` (the bootstrap script writes those env vars in). If you've changed the secret, update `apps/api/.env` and `.local-stack/start-stack.ps1` to match.

### Mobile can't reach the API

Common cause: phone is on Wi-Fi, dev machine is on a different LAN, or Windows Defender Firewall blocks port 3001 inbound. Allow it once:

```powershell
New-NetFirewallRule -DisplayName "Map Store dev API" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```
