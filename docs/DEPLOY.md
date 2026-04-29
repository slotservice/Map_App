# Production deployment — step-by-step

End-state:

```
mapapp.fullcirclefm.com   →  Vercel (admin web)
api.fullcirclefm.com      →  Railway (NestJS API)
photos.fullcirclefm.com   →  Cloudflare R2 (signed URLs only)
mailer                    →  Postmark (transactional email)
db                        →  Railway-managed Postgres
```

Cost target: ~$25/mo + Postmark usage. Significantly cheaper + more reliable than the legacy KnownHost shared box.

## 0 · Accounts to create

| Service | Plan | Cost | Why |
|---|---|---|---|
| [Cloudflare](https://dash.cloudflare.com/sign-up) | Free | $0 | DNS + R2 |
| [Cloudflare R2](https://developers.cloudflare.com/r2/) | Pay-as-you-go | ~$5/mo (1.6GB initial migration + growth) | photo storage; cheaper than S3, no egress fees |
| [Railway](https://railway.app/) | Hobby ($5/mo credit) | $10–15/mo | API + Postgres |
| [Vercel](https://vercel.com/signup) | Hobby | $0 | admin web |
| [Postmark](https://postmarkapp.com/) | Starter | $15/mo (10k msgs) | transactional email |
| [GitHub](https://github.com/) | Free | $0 | repo (already done) |

## 1 · Cloudflare R2 (10 min)

1. Create R2 bucket named `fcfm-photos-prod` in the Cloudflare dashboard.
2. Generate API token: **R2 → Manage R2 API Tokens → Create API token** with `Object Read & Write` for that bucket. Copy the access key + secret.
3. Note the S3 endpoint URL: `https://<account-id>.r2.cloudflarestorage.com`.
4. Lifecycle: optional — set up a 365-day cold-storage rule for the cost-minded.
5. CORS rule (so admin web can render signed URLs):
   ```json
   [
     {
       "AllowedOrigins": ["https://mapapp.fullcirclefm.com"],
       "AllowedMethods": ["GET", "PUT"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```

## 2 · Postmark (5 min)

1. Sign up, verify your sender domain (`fullcirclefm.com`) — Postmark walks you through SPF + DKIM DNS records. Without this, emails go to spam (this was the root cause of legacy bug L8).
2. Create a server: **Servers → Add server → Full Circle FM (transactional)**.
3. Copy the server's **Server API Token** (NOT account token).
4. Set:
   - `SMTP_HOST=smtp.postmarkapp.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=<server token>`
   - `SMTP_PASS=<server token>` (yes, Postmark uses the token for both)
   - `SMTP_FROM="Full Circle FM <no-reply@fullcirclefm.com>"`

## 3 · Railway — backend + database (15 min)

1. Sign up, link your GitHub.
2. **New Project → Deploy from GitHub** → pick `slotservice/Map_App`.
3. **Add a Postgres service** — Railway provisions one in <60s.
4. **Configure the API service:**
   - Root directory: `/`
   - Dockerfile path: `apps/api/Dockerfile`
   - Build command: `(empty, Dockerfile handles it)`
   - Start command: `(empty)`
5. Environment variables (see `apps/api/.env.example` for the schema):
   - `NODE_ENV=production`
   - `PORT=3001`
   - `DATABASE_URL=$<reference to Railway Postgres>` (Railway lets you reference the DB service)
   - `JWT_ACCESS_SECRET=<run: openssl rand -base64 48>`
   - `JWT_REFRESH_SECRET=<run: openssl rand -base64 48>`
   - `JWT_ACCESS_TTL=900`
   - `JWT_REFRESH_TTL=2592000`
   - `S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`
   - `S3_REGION=auto`
   - `S3_BUCKET=fcfm-photos-prod`
   - `S3_ACCESS_KEY=<from R2>`
   - `S3_SECRET_KEY=<from R2>`
   - `S3_PUBLIC_URL=https://photos.fullcirclefm.com` (optional CDN-front)
   - `S3_FORCE_PATH_STYLE=false`
   - `SMTP_HOST=smtp.postmarkapp.com`
   - `SMTP_PORT=587`
   - `SMTP_USER=<postmark token>`
   - `SMTP_PASS=<postmark token>`
   - `SMTP_FROM="Full Circle FM <no-reply@fullcirclefm.com>"`
   - `CORS_ORIGINS=https://mapapp.fullcirclefm.com`
   - `ADMIN_PUBLIC_URL=https://mapapp.fullcirclefm.com`
6. Generate a public URL: **Settings → Generate Domain** → copy the `*.up.railway.app` URL.
7. After first deploy succeeds, run the Prisma migration:
   ```
   railway run --service api -- pnpm --filter @map-app/api prisma migrate deploy
   ```
   And the seed:
   ```
   railway run --service api -- pnpm --filter @map-app/api prisma:seed
   ```
8. Hit `https://<railway-url>/healthz` — should return `{"status":"ok"}`.

## 4 · Vercel — admin web (5 min)

1. Sign up, link GitHub.
2. **Add New Project** → import `slotservice/Map_App`.
3. **Root Directory:** `apps/admin`.
4. **Framework Preset:** Next.js (auto-detected).
5. Environment variables:
   - `NEXT_PUBLIC_API_URL=https://<railway-url>` (we'll switch to `https://api.fullcirclefm.com` once DNS is set)
   - `NEXT_PUBLIC_APP_NAME=Full Circle FM`
6. **Deploy.** First deploy ~3 minutes.
7. Hit the assigned `*.vercel.app` URL — log in with seed credentials.

## 5 · DNS (Cloudflare, 5 min)

Assuming `fullcirclefm.com` is on Cloudflare:

| Subdomain | Type | Target | Proxy |
|---|---|---|---|
| `mapapp` | CNAME | `cname.vercel-dns.com` | DNS-only (Vercel manages cert) |
| `api` | CNAME | `<railway-domain>` | DNS-only |
| `photos` | CNAME | `pub-<account-hash>.r2.dev` (or set up R2 custom domain) | Proxied |

Then:
- In Vercel: **Project → Settings → Domains** → add `mapapp.fullcirclefm.com`, follow verification.
- In Railway: **API service → Settings → Domains → Custom domain** → add `api.fullcirclefm.com`.
- Update Vercel env: `NEXT_PUBLIC_API_URL=https://api.fullcirclefm.com`. Trigger redeploy.
- Update Railway env: `CORS_ORIGINS=https://mapapp.fullcirclefm.com`, `ADMIN_PUBLIC_URL=https://mapapp.fullcirclefm.com`. Trigger redeploy.

## 6 · Mobile (EAS) — production builds (~30 min)

Before you can submit to the stores, the API + admin must already be live (above) so the app talks to real prod URLs.

1. `cd apps/mobile`
2. `npx eas login`
3. `npx eas init` (links the project to EAS)
4. Update `apps/mobile/app.config.ts` `extra.apiUrl` to `https://api.fullcirclefm.com`.
5. **Android first** (faster cycle):
   ```
   npx eas build --profile production --platform android
   ```
6. Upload the resulting `.aab` to Play Console internal track. Add yourself + Matt as testers.
7. **iOS:**
   ```
   npx eas build --profile production --platform ios
   ```
   Requires Apple Developer account in good standing.
8. Submit to TestFlight: `npx eas submit --platform ios`.

## 7 · Data migration (cutover only — irreversible without legacy backup)

Pre-flight checks:
1. Take a fresh `pg_dump` of the new prod Postgres (Railway: dashboard → backups → on-demand).
2. Confirm legacy DB credentials still work via SSH tunnel to the cPanel server (or use the SQL dump we already have at `legacy/postitri_storemanage.sql`).
3. Configure `.env` in `infra/migration/`:
   ```
   LEGACY_DB_HOST=<…>
   LEGACY_DB_USER=postitri_storemanage
   LEGACY_DB_PASSWORD=<…>
   LEGACY_DB_NAME=postitri_storemanage
   LEGACY_PHOTOS_DIR=/path/to/extracted/public_html/public
   DATABASE_URL=<railway prod URL>
   S3_ENDPOINT=https://<r2>...
   S3_BUCKET=fcfm-photos-prod
   …
   ```
4. **Dry run first:**
   ```
   pnpm --filter @map-app/migration migrate
   ```
   Read the warnings. Investigate any "skipped" / "not found" entries.
5. **Real run:**
   ```
   DRY_RUN=false pnpm --filter @map-app/migration migrate
   ```
   Photo upload typically dominates runtime — expect ~5–10 min for 1.6 GB at 16-way concurrency.
6. **Verify:**
   ```
   pnpm --filter @map-app/migration migrate:verify
   ```
   All checks should pass within tolerances. Investigate any failures before cutover.

## 8 · Cutover

1. Send Matt a 1-hour heads-up window.
2. Disable writes on legacy: in cPanel, rename `crushtheworld.com/index.php` → `index_RO.php` and replace with a 'Maintenance' page that links to the new admin URL.
3. Run the migration if you haven't done a final pass since the dry run:
   ```
   DRY_RUN=false pnpm --filter @map-app/migration migrate
   pnpm --filter @map-app/migration migrate:verify
   ```
4. Smoke-test: log in as admin, click around, download an Excel of a known map, compare to legacy.
5. Notify Matt + crews. Send the new admin URL.
6. Monitor logs for 24 h.

## 9 · Decommission

After 30 days of stable operation:
- Take a full archive of the cPanel filesystem + DB dump → cold storage (Backblaze B2 / your local).
- Tell Matt to cancel the KnownHost subscription.
