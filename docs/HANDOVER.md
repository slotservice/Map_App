# Handover — what Matt receives at end of project

This is the package handed to the client at end of Phase 3. Use as a checklist before requesting the final milestone payment.

## 1 · Live URLs

| URL | What |
|---|---|
| `https://mapapp.fullcirclefm.com` | Admin & vendor web |
| `https://api.fullcirclefm.com/api/v1` | Backend (read-only docs at `/docs`) |
| Play Store listing (TBD) | Worker Android app |
| TestFlight / App Store listing (TBD) | Worker iOS app |

## 2 · Source code

- **GitHub repo:** `https://github.com/<matt's-username>/Map_App`
- Repo ownership transferred from `slotservice` to Matt's account on hand-over day.
- Andrew kept as a collaborator with admin access for the 14-day bug-fix window.
- Developer onboarding: see `README.md` in the repo.
- Architecture + ops docs: `docs/REBUILD_PLAN.md`, `docs/DEPLOY.md`, `docs/DEMO_RUNBOOK.md`.
- Legacy reverse-engineering archive: `docs/legacy/`.

## 3 · Account credentials (handed over via password manager / encrypted PDF)

| Service | What to share | Why Matt needs it |
|---|---|---|
| GitHub | Repo admin invite (email) | Owns the source |
| Railway | Account + project access | Backend hosting; can scale up if needed |
| Vercel | Account access | Admin web hosting |
| Cloudflare | DNS + R2 access | Domains + photo storage |
| Postmark | Account + server token (read access) | Email delivery |
| Apple Developer | Already in his name | App Store distribution |
| Google Play Console | Already in his name | Play Store distribution |

⚠️ **Do NOT share Andrew's personal accounts.** Matt should be paying-account-holder for everything except where he prefers Andrew to remain as ops contact.

## 4 · Test accounts (delete before going public)

The seeded `admin@fullcirclefm.local`, `worker@fullcirclefm.local`, `vendor@fullcirclefm.local` accounts (password `password123`) are dev seeds. **Delete or block them before any external user has access to the system.**

```sql
-- Connect to prod DB and run:
UPDATE users SET status = 'blocked' WHERE email LIKE '%@fullcirclefm.local';
```

## 5 · Operational basics

### Add a new admin / worker / vendor / viewer

Web: log in as admin → Workers / Vendors / Viewers → **+ Add**. The system shows the initial password once — copy it and send it to the user. They change it on first login.

### Reset a user's password

Web: Workers / Vendors / Viewers → row actions → **Reset password**. The system generates and shows a new one once.

Or: user clicks **Forgot password?** on the login screen.

### Block a user

Web: row actions → **Block**. Their existing sessions are revoked and they can't log in until you unblock.

### Create a map

Web: Maps → **+ Create map** → name + Excel file. Required Excel layout: see `docs/legacy/api_surface.md` § Excel.

Recognised columns (case-insensitive):
- Required: `Store` or `Store #`, `Store Name`, `Latitude`, `Longitude`
- Optional fixed: `State`, `Address`, `Zip`, `Type`, `Manager`, `Regional`, `Notes`
- Task columns: any header ending with `Task` (e.g. "Outside Paint Task", "Lawn Task")
- Count columns: any other column (e.g. "Handicap", "Canopy_Poles")

### Assign a worker / vendor / viewer to a map

Web: Maps → click map → **Manage workers / vendors / viewers** → pick from dropdown → Add.

### Set tag-alert recipients

Web: Maps → click map → **Tag-alert recipients** → add the email addresses that should get the alert email when a worker raises a tag alert on this map.

### Download completed-stores Excel

Web: Maps → click map → **Download Excel**. Includes every original column + counts + comments + completed-by name + signed timestamps + signature URL + before/after photo URLs.

### See an audit trail

Web: sidebar → **Audit log**. Filterable by actor, resource type, resource id.

## 6 · What's NOT included (Phase 3 / Phase 4 follow-ups)

These were explicitly deferred and are good options for a Phase-4 contract if Matt wants:

- **Push notifications** (FCM/APNs) for "you've been assigned a map" or "tag alert email failed". Not implemented — the outbox + email pipeline is the existing notification surface.
- **Customer-interview sub-app** Matt mentioned in the audio call. Out of scope for Phase 1–3.
- **Property-image batch upload** (current UI is one-store-at-a-time).
- **Multi-org / multi-tenant** support. Current system is single-org for Full Circle FM.
- **Deeper analytics dashboard** (week-over-week completion charts, etc.). Audit log is the closest current feature.

## 7 · 14-day bug-fix window

Andrew remains available for bug fixes during 14 calendar days from cutover. Scope:

- ✅ Bugs in features delivered in this contract
- ❌ New features
- ❌ Changes Matt requests after testing
- ❌ Server downtime caused by hosting service outages (open a ticket with Railway / Cloudflare directly)

Communication during the window: Freelancer.com chat.

## 8 · Final invoice + escrow

Final milestone (15% of contract) released after:

- Live system accessible at the agreed URL
- Mobile builds available on Play Store internal track + TestFlight
- Data migration verified (script run + counts match within tolerance)
- Repo transferred to Matt
- Credentials handed over
- 30-min training call done (recording delivered)
- This document signed off
