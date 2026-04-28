# Full Circle Map App — ULTRADEEP Rebuild Plan

_Phase-0 deliverable, 2026-04-29. Author: Andrew._

This document fulfils tasks 1 – 9 in `project_status&plan.md` and produces
the requested 10-section output. It is the technical specification we will
build against during Phases 1–3.

---

## Table of contents

1. System Summary
2. Feature List (grouped by surface)
3. Problems List (legacy system + scope risks)
4. New Architecture
5. Database Design
6. API Structure
7. App Flow (screen by screen)
8. Migration Plan
9. Development Plan (phased)
10. Recommendations

Plus appendices:

* A. RBAC matrix
* B. Excel import/export schema
* C. Storage / image-handling policy
* D. Email-alert flow
* E. Map-icon colour state machine

---

## 1. System Summary

Full Circle Map App is a field-service workflow tool for a regional
maintenance business. The end-to-end loop is:

```
Excel sheet (admin's source of truth)
    │  upload via admin web
    ▼
Map record created in DB (latitude, longitude, address, task fields)
    │  admin assigns workers (and vendors / viewers) to that map
    ▼
Worker opens mobile app, sees only assigned maps
    │  taps a map → map view with colour-coded markers per store
    ▼
Worker taps a store marker → store detail (counts, tasks, manager)
    │  navigates → "Add Photos" screen (before/after, tag-alert, property-view)
    ▼
Worker taps "Save & Next" → "Check & Verification" screen
    │  enters first/last name + signature + general comments → "Complete"
    ▼
Marker turns red ("all done"); record moves to Completed Stores
    │  admin downloads Excel of completed stores → used for payroll
    ▼
Tag alerts (created any time on the photo screen) email a per-map list
of recipients with photos + comments.
```

Roles: **Admin** (full CRUD on backend), **Worker** (mobile app only,
edits assigned maps until completion, then read-only),
**Vendor** (backend read-only, restricted to assigned maps — currently
broken), **Viewer** (lighter read-only role per assignment, future).

## 2. Feature List

### A. Mobile App (Worker — primary actor)

A1. Login with email + password (JWT-based)
A2. Side menu: Maps, Profile, Change Password, Log out (legacy "Gas Lids" link removed per chat L755)
A3. Map list — only maps assigned to this worker; shows total count
A4. Map view — Google Maps with markers; marker label = Store #
A5. Marker colour state machine (see Appendix E):
   * Blue = all tasks needs-scheduled
   * Orange = at least one task needs-scheduled, at least one already-complete
   * Yellow = at least one already-complete, at least one needs-scheduled (mirror of orange in legacy; see app-flow §7 for resolution)
   * Red = all tasks complete
A6. Store-detail dialog (screen 2 / first card): read-only header (Store #, Store Name, State, Address, Zip, Lat, Lon, Type, Manager) + per-task status fields + per-map count fields (Handicap, Canopy_Poles, Crash_Bars, Dog_Bones, Gas_Lids, Lines — schema is per-map, see Appendix B)
A7. "Get Directions" button → opens device map app with the lat/lon
A8. "Add Photos" screen with:
   * Field Name free-text (per-photo label, e.g. "asdf" in Screenshot_8)
   * Before column (multi-photo, take or pick from gallery)
   * After column (multi-photo, take or pick from gallery)
   * "Add More" appends another before/after pair on the same screen
   * **NEW:** photos persist server-side as soon as picked, so worker can save Before now and add After in a later session (fixes legacy bug L3)
   * Top-right "Tag Alert" link → tag-alert sub-screen
   * Top-right "Tank Lid Screen ID" link → renamed **"Property View"** (overhead image of the property; see Appendix C)
A9. Tag-alert sub-screen: title + description + photo(s); on submit, enqueues an email to that map's tag-alert recipient list (Appendix D)
A10. "Check & Verification" final screen: First Name, Last Name, **General Comments** (this is screen-3 comments; will appear in completed export — fixes legacy bug L2), Signature canvas, "Complete" button
A11. Completed-store read-only view (worker can re-open finished stores to verify but cannot edit — req from doc 1 ¶4)
A12. Profile screen — name, email, phone (read-only here; admin edits)
A13. Change Password screen — old password + new + confirm; talks to a working API (fixes legacy bug L4)
A14. Offline-tolerant photo upload (queue on network failure, retry on reconnect — important because workers are in rural lots)
A15. Local timestamp on the device, stored in UTC, rendered to user's locale on display (fixes legacy bug L5)

### B. Admin Backend (web — primary admin actor)

B1. Login (email + password); session via JWT cookie
B2. Sidebar: Map list, Worker list, Vendor list, Account (Profile, Change Password)
B3. Map list — table of all maps with Detail / Map / Manage Workers / Tag Alerts / Edit / Delete actions, plus "Create New Map"
B4. Create-map flow: name + Excel upload; server validates schema (Appendix B), creates `Map` row + `Store` rows + per-map task-column metadata
B5. Map detail screen — same map view as the app, plus completed-store table with "Download Excel" (must include the count fields **and** the screen-3 general comments — fixes legacy bug L2)
B6. Manage Workers (per map): assign / unassign workers
B7. Manage Vendors (per map, mirror of workers UI — was missing in legacy, see chat L286): assign / unassign vendors so they only see those maps (fixes legacy bug L1)
B8. Tag Alerts (per map): list of recipient emails + tag-alert log; admin can edit recipients
B9. Worker list — Add / Edit / Delete worker; reset password; block / unblock
B10. Vendor list — same CRUD, plus an "Assigned Maps" column
B11. Add-store action — admin can manually add a store to an existing map (without re-uploading Excel)
B12. Property-image upload — per-store on the map detail page (admin uploads the overhead photo for that store; appears as Property View in the app — Appendix C)
B13. Profile + Change Password (real, working)

### C. Vendor Portal (web, read-only)

C1. Login
C2. Sees only maps assigned to this vendor (fixes legacy bug L1)
C3. For each assigned map: read-only map view, completed stores list, before/after photos, sign-off names, signature, comments, tag-alert log
C4. Excel download of completed stores for assigned maps
C5. Cannot create / edit / delete anything

### D. Data Flow (Excel → DB → App → Export)

D1. Admin uploads Excel during map creation
D2. Server parses headers; identifies fixed columns (Store #, Store Name, State, Address, Zip, Latitude, Longitude) and free-form **task columns** (e.g. "Outside Paint Task", "Gas Lid Task", "Lawn Task") and **count columns** (e.g. Handicap, Canopy, Crash, Dog Bones, Gas Lids, Lines)
D3. Per-map metadata records which columns are tasks vs counts (so the same backend handles the "Lawn 2026" map and the "C Dilbeck" map without code changes)
D4. App reads map → store rows + per-map column metadata → renders the right fields on screens 2 and 3
D5. Worker completes work; server writes `task_completion` rows + photo URLs + signature blob + general comments
D6. Admin clicks Download Excel → server emits a workbook with one row per completed store, columns = original Excel columns + completion metadata (timestamp UTC + worker tz, completed-by name, signature image link, **general comments**, photo links). One worksheet per map.

## 3. Problems List

Carry-overs from `PROJECT_STATUS.md §3.3` plus rebuild-specific risks:

* **L1–L9** — see status doc.
* **R1** — Original Android source code is irrecoverable; we cannot reuse any UI assets except by re-implementation from screenshots.
* **R2** — Legacy DB schema is undocumented; we will reverse-engineer it via phpMyAdmin to support data migration but **not** to dictate the new schema.
* **R3** — Excel formats vary per map (different task/count columns). The new schema must support arbitrary task and count columns per map without code changes.
* **R4** — Photo blobs in legacy may be stored on the cPanel filesystem; we need to copy to S3-compatible storage during migration.
* **R5** — Apple Developer account is "old" — may be expired; renewal can take days.
* **R6** — Workers operate in rural lots → unreliable mobile data. Needs offline-tolerant uploads.
* **R7** — Client is non-technical, busy running crews; expect slow doc turnaround. Mitigate by deriving spec from the live system + this plan, not waiting on more documents.
* **R8** — Currency / tax / contractor invoicing is via Freelancer.com; ensure escrow funded **before** any code is written.

## 4. New Architecture

### 4.1. Stack

| Layer | Choice | Rationale |
|---|---|---|
| Mobile (Android + iOS) | **React Native + Expo (bare workflow)** + TypeScript | Single codebase, agreed with client; bare workflow gives access to native modules (camera, signature canvas, Google Maps SDK); Expo dev-client gives faster iteration |
| Maps | **react-native-maps** + Google Maps SDK on Android, Apple Maps fallback on iOS (Google Maps key reused if client provides) | Same UX as legacy; supports custom marker colour + label |
| Signature | `@react-native-community/signature-pad` or `react-native-signature-canvas` | Matches Screenshot_10 |
| Backend | **NestJS (Node.js + TypeScript)** | Clean module structure, dependency injection, OpenAPI generation, fits a senior-team handoff later |
| Database | **PostgreSQL 16** | Strong JSONB support for per-map dynamic columns; mature replication; same SQL the legacy team understood |
| Auth | **JWT (access + refresh)** with bcrypt-hashed passwords; HTTPS-only cookies for the web admin, bearer token for mobile | Standard, audit-friendly |
| File storage | **S3-compatible** (Cloudflare R2 or AWS S3) | Cheap, durable, presigned-URL upload from mobile; legacy cPanel storage retired |
| Email | **Postmark** (or SES) for transactional tag-alert emails | Reliable inbox delivery, easy webhooks for failures |
| Admin web | **Next.js (App Router) + TypeScript + shadcn/ui + TanStack Query** | Same TS stack as backend; SSR for fast first paint; component library replaces the old Bootstrap admin look but keeps the same column-driven UX from Screenshot 9.54.21 AM |
| Hosting | Backend + Postgres on **Railway** or **Render** (managed, low ops); web admin on **Vercel**; storage on **R2** | Eliminates the cPanel-shared-hosting fragility |
| CI / CD | GitHub Actions; OTA mobile updates via **Expo EAS** | Standard; OTA gives us instant fixes without full app-store re-submit |
| Observability | **Sentry** (mobile + backend) + structured logs to a managed sink | Catches field crashes |

### 4.2. High-level diagram

```
┌──────────────────┐        ┌──────────────────┐
│ Worker (RN app)  │        │ Vendor (web)     │
│ Android + iOS    │        │ Read-only        │
└────────┬─────────┘        └────────┬─────────┘
         │  HTTPS / JWT              │  HTTPS / JWT
         ▼                           ▼
   ┌─────────────────────────────────────────┐
   │            NestJS API (TS)              │
   │  Auth │ Maps │ Stores │ Tasks │ Photos  │
   │  Comments │ Alerts │ Excel │ RBAC       │
   └────────┬───────────────┬───────────┬────┘
            │               │           │
            ▼               ▼           ▼
      ┌──────────┐    ┌──────────┐ ┌──────────┐
      │ Postgres │    │ R2 / S3  │ │ Postmark │
      │  (RDS)   │    │  photos  │ │  email   │
      └──────────┘    └──────────┘ └──────────┘
            ▲
            │
   ┌────────┴────────┐
   │ Admin (Next.js) │
   │ Full CRUD       │
   └─────────────────┘
```

### 4.3. RBAC

See Appendix A. Implemented as a single `policy.guard.ts` interceptor in
NestJS that checks `(role, resource, action, ownership/assignment)` for
every endpoint.

### 4.4. Offline / unreliable network strategy

* Photo uploads use presigned-URL multipart upload directly from device → R2.
* If upload fails, the local photo path stays in an `OutboxItem` row
  (SQLite via expo-sqlite); a background task retries when connectivity
  returns.
* All mutations are idempotent (`Idempotency-Key` header, deterministic
  client-generated UUIDs).

## 5. Database Design

PostgreSQL. All tables have `id uuid pk`, `created_at`, `updated_at`. Soft
deletes via `deleted_at` where it matters. UTC stored, never local.

```sql
-- 5.1. Identity & RBAC
users (
  id uuid pk, email citext unique, password_hash text,
  first_name text, last_name text, phone text, status text  -- active|blocked
);
roles (id, name)  -- 'admin','worker','vendor','viewer'
user_roles (user_id, role_id)

-- 5.2. Maps
maps (
  id uuid pk, name text, created_by uuid → users,
  source_filename text,   -- original Excel name
  task_columns jsonb,     -- ordered list e.g. ["Outside Paint Task","Gas Lid Task"]
  count_columns jsonb,    -- ordered list e.g. ["Handicap","Canopy_Poles", ...]
  tag_alert_recipients text[],  -- emails for this map's tag alerts
  archived_at timestamptz
);

map_assignments (
  map_id uuid → maps, user_id uuid → users, assigned_role text  -- worker|vendor|viewer
);                                                                -- composite pk

-- 5.3. Stores (rows from the Excel)
stores (
  id uuid pk, map_id uuid → maps,
  store_number text, store_name text, state text, address text, zip text,
  latitude numeric(10,7), longitude numeric(10,7), type text, manager text, regional text,
  property_image_url text,                       -- Property View
  raw jsonb                                      -- the full original row, including tasks+counts
);

-- 5.4. Per-store task state (one row per (store, task_column))
store_tasks (
  store_id uuid → stores, task_name text,        -- composite pk
  initial_status text,                           -- 'Needs Scheduled' | 'COMPLETE or SCHEDULED ALREADY'
  current_status text                            -- updated as worker completes
);

-- 5.5. Per-store completion record
completions (
  id uuid pk, store_id uuid → stores, completed_by uuid → users,
  first_name text, last_name text, signature_image_url text,
  general_comments text,
  completed_at timestamptz,
  device_timezone text
);

-- 5.6. Counts entered by the worker (per completion, per count_column)
completion_counts (
  completion_id uuid → completions, count_name text, value integer  -- composite pk
);

-- 5.7. Photos
photos (
  id uuid pk, store_id uuid → stores, completion_id uuid → completions nullable,
  kind text,                                     -- 'before'|'after'|'tag_alert'|'property_view'
  field_name text,                               -- per-photo label
  url text, content_type text, size_bytes int,
  uploaded_by uuid → users, uploaded_at timestamptz
);

-- 5.8. Tag alerts
tag_alerts (
  id uuid pk, store_id uuid → stores, map_id uuid → maps, raised_by uuid → users,
  title text, description text, raised_at timestamptz,
  email_sent_at timestamptz, email_status text   -- 'pending'|'sent'|'failed'
);
tag_alert_photos (tag_alert_id uuid → tag_alerts, photo_id uuid → photos)

-- 5.9. Audit
audit_log (id, actor_id, action, resource_type, resource_id, payload jsonb, at timestamptz)

-- 5.10. Outbox (server-side email queue)
outbox (id, kind, payload jsonb, status, attempts, last_error, scheduled_at)
```

Notes:

* **Per-map dynamic columns** are stored as `task_columns` / `count_columns`
  in `maps`. This is what lets one schema serve "Lawn 2026" (one task
  column, no counts) and "C Dilbeck" (two task columns, six count columns).
* `completion_counts` is a normalised table, not JSON, so we can sum
  across maps for payroll without parsing JSON.
* `photos.url` is an R2 path; signed URLs are minted on read.

## 6. API Structure

REST + JSON, OpenAPI 3.1 documented. All endpoints under `/api/v1`. Auth
header `Authorization: Bearer <jwt>`. Errors follow RFC 7807.

### Auth
```
POST  /auth/login              → { accessToken, refreshToken, user }
POST  /auth/refresh
POST  /auth/logout
POST  /auth/change-password    → { oldPassword, newPassword }   (fixes L4)
POST  /auth/forgot-password    (Phase 2)
POST  /auth/reset-password     (Phase 2)
```

### Users (admin only)
```
GET   /users                      ?role=worker|vendor|viewer
POST  /users
PATCH /users/:id                  (name, phone, status, role)
POST  /users/:id/reset-password
DELETE /users/:id                 (soft)
```

### Maps
```
GET   /maps                       (admin: all; worker/vendor/viewer: assigned only)
POST  /maps                       multipart: name + Excel file        (admin)
GET   /maps/:id                   includes stores summary
PATCH /maps/:id                   (rename, recipients, archive)        (admin)
DELETE /maps/:id                                                       (admin)
POST  /maps/:id/assignments       { user_id, role }                    (admin)
DELETE /maps/:id/assignments/:user_id                                  (admin)
GET   /maps/:id/excel             completed stores → .xlsx download
GET   /maps/:id/tag-alerts
PATCH /maps/:id/tag-alert-recipients  { emails: [...] }                (admin)
```

### Stores & tasks
```
GET   /maps/:id/stores            list w/ marker colour state
POST  /maps/:id/stores            manually add store                   (admin)
GET   /stores/:id                 full detail
PATCH /stores/:id                 (admin only — edit fields)
PATCH /stores/:id/property-image  presigned upload                     (admin)
GET   /stores/:id/photos
```

### Work entry (worker)
```
POST  /stores/:id/photos          presigned-URL handshake
                                  body: { kind:'before'|'after'|'tag_alert'|'property_view',
                                          field_name, content_type, size_bytes }
                                  → { upload_url, photo_id }
POST  /stores/:id/photos/:pid/finalize   (after S3 PUT succeeded)
DELETE /photos/:pid                       (worker can delete own pre-completion)

POST  /stores/:id/tag-alerts      { title, description, photo_ids }
POST  /stores/:id/complete        { first_name, last_name, signature_image_id,
                                    general_comments, counts: { Handicap: 3, ... },
                                    completed_at, device_timezone }
GET   /stores/:id/completion      read-back (worker post-complete; vendor)
```

### Health
```
GET   /healthz
GET   /readyz
```

## 7. App Flow

The legacy app has 4 effective screens after login (the original "5th
screen" debate was resolved per chat L836–849: the verification screen
ends the flow and there is no separate page after it).

```
┌──────────────────────────────────┐
│ 0. Splash → Login                │  email + password → /auth/login
└──────────┬───────────────────────┘
           │
           ▼
┌──────────────────────────────────┐
│ 1. Maps list                     │  GET /maps  → "Total N Maps", drawer w/ Profile, Change Password, Log out (no "Gas Lids")
└──────────┬───────────────────────┘
           │  tap a map
           ▼
┌──────────────────────────────────┐
│ 2. Map view                      │  Google Maps; marker per store, label = Store #;
│                                  │  marker colour by Appendix E state machine;
│                                  │  top-right "Completed Stores" link
└──────────┬───────────────────────┘
           │  tap a marker
           ▼
┌──────────────────────────────────┐
│ 3. Store detail (modal)          │  Read-only header + per-task statuses + per-count fields;
│                                  │  "Get Directions" → opens device map app;
│                                  │  "Close" / "Complete" buttons
└──────────┬───────────────────────┘
           │  Complete
           ▼
┌──────────────────────────────────┐
│ 4. Add Photos                    │  Field Name + Before/After columns + "Add More";
│                                  │  Top-right links: "Tag Alert" → 4a, "Property View" → 4b
│                                  │  "Save" (persists current photos, returns to 2 — fixes L3)
│                                  │  "Save & Next" (persists + moves to 5)
│                                  │
│  4a. Tag Alert sub-screen        │  title + desc + photos; submit → /stores/:id/tag-alerts
│                                  │
│  4b. Property View               │  read-only image of the property for context
└──────────┬───────────────────────┘
           │  Save & Next
           ▼
┌──────────────────────────────────┐
│ 5. Check & Verification          │  First Name, Last Name, **Comments**, Signature canvas;
│                                  │  "Complete" → POST /stores/:id/complete
│                                  │  on success: marker turns red; back to 2
└──────────────────────────────────┘
```

Key change vs legacy: **Save vs Save & Next**. The legacy "Add Photos"
screen had only "Save" which moved on, forcing one-shot before+after.
The new flow has both: workers can persist before-photos, leave the
store, come back later, add after-photos, then proceed.

## 8. Migration Plan

Goal: zero-downtime cutover, no lost map data, no lost photo evidence.

### Step 1 — Read-only DB snapshot
Use phpMyAdmin to export the legacy DB. Inspect tables, column names,
foreign keys. Document the mapping in `migration/legacy_schema.md`.

### Step 2 — Photo blob copy
Identify the legacy photo storage path on cPanel; rsync to a holding
bucket on R2, preserving filenames; record path → object-key mapping.

### Step 3 — ETL
Write a one-off migration script (TypeScript, run locally via `tsx`):

* For each legacy map row → create `maps` (decode task/count columns from the original Excel preserved in cPanel uploads).
* For each legacy store row → create `stores`, populate `raw`, `store_tasks`.
* For each legacy completion → create `completions`, `completion_counts`, `photos`. Re-link photo URLs to the new R2 path.
* For each legacy tag-alert / comment → create `tag_alerts`.
* Reconstruct `general_comments` from legacy "screen-3 comments" if they exist anywhere (likely in a separate `reviews` table, per chat L491).

### Step 4 — Dual-run
For 1 week, the new system runs in parallel. Workers stay on the legacy
APK (still works) while admin/vendor traffic moves to the new admin web
read-only. Daily ETL re-runs to keep new DB current.

### Step 5 — Cutover
* Publish new mobile builds to Play Store internal track + TestFlight.
* Field-test with a small crew on one real map for 2–3 days.
* Hard cutover: legacy APK distribution removed; legacy admin redirected to new admin URL; phpMyAdmin frozen.

### Step 6 — Decommission
After 30 days of stable operation, archive the cPanel content offline,
drop the legacy DB.

## 9. Development Plan

### Phase 1 — MVP rebuild (2–3 weeks)

| Wk | Deliverable |
|---|---|
| 1 | Repo bootstrap (NestJS API + Postgres + Next.js admin + RN app skeleton); auth + RBAC; users CRUD; map CRUD with Excel parser; store creation; admin map list & map detail; **milestone payment 1** |
| 2 | Mobile worker flow: login, maps list, map view with markers, store detail, Add Photos with Save vs Save & Next, Tag Alert, Check & Verification; photo upload via presigned URLs; completion endpoint; download Excel including comments + counts; **milestone payment 2** |
| 3 | Vendor portal (read-only restricted maps); change-password (real); tag-alert email pipeline; offline-tolerant photo queue; QA pass on Caseys Test 2 + a fresh Lawn map; bug fixes; **milestone payment 3** |

### Phase 2 — Enhancements (~1 week)

* Property-view image upload in admin; Property View tab in app.
* Viewer role (lighter than vendor — assigned-map list only, no photos).
* Push notifications (FCM / APNs) for tag-alert subscribers and "map assigned to you".
* Forgot-password / reset flow with Postmark.
* Audit log UI in admin.

### Phase 3 — Store release & data migration (~1 week)

* Apple Developer renewal (client task).
* Google Play Console set-up (client task).
* Internal-track Android build; TestFlight iOS build; submission.
* Run the §8 migration; cutover.
* Production-grade observability dashboards (Sentry, log alerts).

### Out of scope (Phase 1)

* The "customer interview" sub-app referenced as a future add-on (chat L491)
* Web embedding into `fullcirclefm.com` for SEO (chat L319)
* Payroll automation beyond the Excel export

## 10. Recommendations

1. **Fund Freelancer escrow before any code commit.** Confirmed open as Q4.
2. **Pin the Phase-1 RBAC matrix in writing** (Appendix A). RBAC is the single biggest source of legacy bugs; ambiguity here is what made the vendor see all maps.
3. **Treat the Excel file as the spec** — every per-map peculiarity (task columns, count columns) is encoded in the workbook headers; do not hard-code task names.
4. **Storage-first for photos** — never store image bytes in Postgres; presigned URLs only.
5. **All timestamps in UTC at the column level**, render in user's locale on the client. The legacy "military time in another country" bug is a stored-as-local-time mistake.
6. **Idempotent mutations** — workers will retry on flaky cell signal; without idempotency keys we will see duplicate completions and double-counted payroll items.
7. **Automated tests on the Excel parser** — feed it `Week 1 Lawn 2026.xlsx` and `C Dilbeck Stores.xlsx` as fixtures; both must round-trip (import, then export) without data loss.
8. **Don't migrate the legacy code patterns** — the legacy bugs (vendor visibility, comment loss) are baked in. We migrate **data**, not code.
9. **Apple / Google account renewal is a long-pole risk** — start the client on this in Phase-1 week 1, not week 3.
10. **Keep the side-menu identical** to the legacy app on Phase 1 (Maps / Profile / Change Password / Log out) — the client explicitly asked to keep "the familiar feel" (chat L630). Move UI redesign to Phase 2.

---

## Appendix A — RBAC matrix

Read = R, Write/Update = W, Delete = D, Restricted-by-assignment = A.

| Resource | Admin | Worker | Vendor | Viewer |
|---|---|---|---|---|
| Maps (list) | RWD | R(A) | R(A) | R(A) |
| Map (create / edit / delete) | RWD | — | — | — |
| Map assignments | RWD | — | — | — |
| Stores | RWD | R(A); W only on `current_status` via `/complete` | R(A) | R(A) |
| Property image | RWD | R(A) | R(A) | R(A) |
| Photos | RWD | R(A); W if pre-completion on assigned store | R(A) | R(A) |
| Tag alerts | RWD | RW(A) | R(A) | R(A) |
| Completions | RWD | R(A) own; W only via `/complete` | R(A) | R(A) |
| Excel export | RW | — | R(A) | R(A) |
| Users | RWD | own profile + own password | own profile + own password | own profile + own password |

(Worker becomes effectively read-only on a store once `completions.id` exists for it — fulfils doc 1 ¶4.)

## Appendix B — Excel import / export schema

### Required columns (must be present)
`Store #` (or `Store`), `Store Name`, `State`, `Address`, `Latitude`, `Longitude`

### Recognised columns (auto-detected)
* `Zip`, `Type`, `Manager`, `Regional` → fixed store fields
* Anything ending in `Task` (case-insensitive) → task column. Allowed values: `Needs Scheduled`, `COMPLETE or SCHEDULED ALREADY` (or "Complete", normalised).
* Any other numeric-typed column → count column (Handicap, Canopy, Crash, Dog Bones, Gas Lids, Lines, Lawn-…, etc.).
* `Notes` → captured to `stores.raw.notes`, surfaced read-only in store detail.

### Export (completed-stores workbook)
One worksheet per map. Columns:

```
[ original Excel columns... ]
+ Completed_At_UTC
+ Completed_At_Local  (with worker's tz)
+ Completed_By_First_Name
+ Completed_By_Last_Name
+ General_Comments               (fixes L2)
+ Signature_URL
+ Before_Photo_URLs              (semicolon-separated)
+ After_Photo_URLs               (semicolon-separated)
+ count columns are filled in with the entered values
```

## Appendix C — Storage / image-handling policy

* Bucket: `fcfm-photos-prod` on Cloudflare R2.
* Object key pattern: `{map_id}/{store_id}/{photo_id}.{ext}`
* Upload: server returns presigned PUT URL, mobile uploads directly, then calls finalize.
* Read: server mints short-lived (15 min) signed GET URLs.
* Property images uploaded by admin go to the same bucket under
  `{map_id}/{store_id}/property.{ext}`.
* Lifecycle: photos are kept indefinitely in Phase 1; an archive policy
  (e.g. 2-year cold-storage) can be added later.

## Appendix D — Email-alert flow (tag alerts)

```
worker submits tag-alert
   │
   ▼
POST /stores/:id/tag-alerts
   │
   ▼
DB insert tag_alerts (email_status='pending')
   │
   ▼
outbox row enqueued
   │
   ▼
worker (BullMQ) picks up → renders email template (title, desc, store, map, link, photos)
   │
   ▼
Postmark API → recipients = maps.tag_alert_recipients
   │
   ▼
on 2xx: email_status='sent', email_sent_at=now()
on 4xx/5xx: retry with exponential backoff; after 5 failures email_status='failed' + admin notification
```

## Appendix E — Map-icon colour state machine

For a store with N task columns:

| Condition | Marker colour |
|---|---|
| All tasks `Needs Scheduled` and not yet completed | **Blue** |
| Mix: ≥1 task `Needs Scheduled` AND ≥1 task `COMPLETE or SCHEDULED ALREADY` (initial pre-existing complete) | **Orange** |
| Worker has completed at least one task on this visit but not all | **Yellow** |
| All tasks complete (initial + worker work) AND a `completions` row exists | **Red** |

The legacy doc described orange and yellow as "mirrors of each other".
The above resolves the ambiguity by making yellow specifically mean
"work-in-progress on this visit", which matches the field workflow
client described in the audio call (chat L260, L437).
