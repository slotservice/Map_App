# Credentials handover — template

> ⚠️ **DO NOT COMMIT FILLED-IN VERSION.** Fill this in on a piece of paper or in a password manager (1Password, Bitwarden) and share the export with Matt directly. Never commit real secrets.

Replace every `<…>` placeholder before sending.

---

# Map Store — production credentials

Last updated: `<YYYY-MM-DD>`

## Live URLs

| What | URL |
|---|---|
| Admin web | `<https://mapapp.fullcirclefm.com>` |
| API | `<https://api.fullcirclefm.com/api/v1>` |
| OpenAPI docs | `<https://api.fullcirclefm.com/api/v1/docs>` |
| GitHub repo | `<https://github.com/.../Map_App>` |

## Admin user

| Field | Value |
|---|---|
| Email | `<your-real-admin@fullcirclefm.com>` |
| Initial password | `<one-time>` (change immediately) |

## Hosting accounts

| Service | Login email | Notes |
|---|---|---|
| Cloudflare | `<…>` | DNS + R2 storage |
| Railway | `<…>` | Backend + Postgres |
| Vercel | `<…>` | Admin web |
| Postmark | `<…>` | Transactional email |
| Apple Developer | `<…>` | Already in your name |
| Google Play Console | `<…>` | Already in your name |

## API tokens / secrets (rotate post-handover if you want)

These are stored only as env vars on the hosting platforms — never check them into git.

### Railway (backend)

- `JWT_ACCESS_SECRET` — `<rotated>`
- `JWT_REFRESH_SECRET` — `<rotated>`
- `S3_ACCESS_KEY` — `<from R2>`
- `S3_SECRET_KEY` — `<from R2>`
- `SMTP_USER` / `SMTP_PASS` — `<Postmark server token>`

### Cloudflare R2 bucket

- Bucket name: `fcfm-photos-prod`
- Endpoint: `https://<account-id>.r2.cloudflarestorage.com`

### Postmark

- Server: `Full Circle FM (transactional)`
- Sender domain: `fullcirclefm.com` (SPF + DKIM verified — keep the DNS records intact)

## Mobile

| Platform | Where to find the build | Internal testers |
|---|---|---|
| Android | Play Console → `Internal testing` track | matt + andrew |
| iOS | App Store Connect → TestFlight | matt + andrew |

EAS project id: `<from app.config.ts>`

## Old / legacy (kept for the 30-day soak window)

- Legacy admin: `https://www.crushtheworld.com/` (READ-ONLY after cutover)
- Legacy hosting (KnownHost): `https://cp53-ga.privatesystems.net:2083/`
- Username: `<unchanged>`

After 30 days of stable operation on the new system, cancel the KnownHost subscription.

## Bug-fix window

Andrew (`<freelancer-account>`) is on Freelancer.com chat for `<14>` calendar days from `<cutover date>` for any issues with delivered features.

## Day-to-day operations

- See `docs/HANDOVER.md` in the repo for everything you can do as admin.
- See the recorded training call: `<link>` for a walkthrough.
- See `docs/DEPLOY.md` for ops-level details (re-deploys, DB migrations, scaling).
