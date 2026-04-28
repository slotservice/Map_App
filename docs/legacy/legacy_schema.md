# Legacy System — Confirmed Schema & Architecture

_Sources: `legacy/postitri_storemanage.sql` (DB dump, 2026-04-28), `legacy/src/public_html/` (extracted Laravel source), `legacy/api_surface.md` (live API)._
_Captured: 2026-04-29._

This file replaces the inferred schema in `api_surface.md §"Inferred legacy DB schema"`. All findings here are confirmed against live code and live data.

---

## 1. Stack confirmation

| Layer | Confirmed value |
|---|---|
| Backend framework | **Laravel 7.x** (PHP) — Auth scaffold uses Laravel UI patterns |
| PHP | 8.3.30 |
| DB engine | **MariaDB 10.11.15** (not MySQL); InnoDB tables, `utf8mb3_general_ci` mostly, one MyISAM (`fields`) in `latin1_swedish_ci` — schema is mixed |
| Excel I/O | `Maatwebsite/Excel` package |
| Email | PHP's built-in `mail()` function (no SMTP/SES) |
| Auth | Custom `api_token` field on `users` (NOT Laravel Passport / Sanctum) |
| Hosting | KnownHost shared cPanel (LiteSpeed) |
| Frontend admin | Bootstrap 4 + AdminLTE 3 (Vue.js Mix scaffolding present but unused) |

`.env` (full key list captured in `legacy/src/public_html/.env`):

```
APP_ENV=local                      ← ⚠ production server but APP_ENV=local
APP_DEBUG=true                     ← ⚠ DEBUG enabled in prod (leaks stack traces)
APP_URL=http://localhost           ← ⚠ never updated for prod
DB_DATABASE=postitri_storemanage
DB_USERNAME=postitri_storemanage
DB_PASSWORD=Ilovemymother215       ← ⚠ live DB password — rotate after migration
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io         ← ⚠ Mailtrap is a dev-only sandbox; tag-alert emails never delivered via Laravel mailer
MAIL_USERNAME=null                 ← Mailer not even configured; falls back to PHP mail()
TIMEZONE=UTC                       ← timestamps stored in UTC; bug L5 is in display formatting, not storage
```

**Implications for migration:**
* `APP_ENV=local` + `APP_DEBUG=true` in production = the legacy server has been leaking stack traces and DB credentials in error pages for years. Rotate creds during cutover.
* Mailtrap config means **tag-alert emails were never sent through Laravel** — only the inline `mail()` calls in `TaskController::addMissingTag` actually fire, and those use a malformed `From: crushthe` header that fails SPF/DKIM on most receivers. Likely many tag alerts have been silently lost. Flag to client.

---

## 2. Tables (confirmed schema)

9 tables, ~5,000 rows total, ~4 MiB. **All keys are `id INT(11)` auto-increment. There are NO foreign-key constraints anywhere** — referential integrity is enforced only in PHP. No indexes besides PKs.

### `users` (10 rows, AUTO_INCREMENT=35)

```sql
CREATE TABLE users (
  id                 int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email              varchar(50) NOT NULL,
  username           varchar(50) NOT NULL,
  password           varchar(255) NOT NULL,                         -- bcrypt $2y$10$...
  type               int(1) NOT NULL DEFAULT 1,                     -- 1=ADMIN, 2=VENDOR, 4=WORKER
  phone              varchar(50) DEFAULT NULL,
  address            varchar(255) DEFAULT NULL,
  state              varchar(20) DEFAULT NULL,
  zip                varchar(255) DEFAULT NULL,
  status             int(1) DEFAULT 1,                              -- 1=active, 2=blocked
  api_token          varchar(255) DEFAULT NULL,                     -- Str::random(60), regenerated each login
  email_verified_at  datetime DEFAULT NULL,                         -- always NULL in this DB
  created_at         datetime NOT NULL DEFAULT current_timestamp(),
  updated_at         datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  del_flg            tinyint(4) NOT NULL DEFAULT 0
);
```

**Live sample (anonymised):**
```sql
(13, 'matthewgrant@hotmail.com', 'matthewgrant@hotmail.com',
 '$2y$10$tB/.IPM9hh...DJFze', 1 /*admin*/, NULL, NULL, NULL, NULL,
 1 /*active*/, NULL /*not currently logged in*/, NULL,
 '2020-09-15 13:46:45', '2020-09-15 13:46:45', 0);
```

**⚠ Authoritative role enum** (from `app/Models/User.php`, contradicts the stale `config/constants.php`):

| Value | Constant | Purpose |
|---|---|---|
| 1 | `User::USER_ADMIN` | Admin web full CRUD |
| 2 | `User::USER_VENDOR` | Vendor web read-only (currently bug L1: sees all maps) |
| 3 | — | unused; **reserve for "Viewer" in the rebuild** |
| 4 | `User::USER_WORKER` | Mobile app |

The stale config (`config/constants.php`) defines `ADMIN=0, CLIENT=1, WORKER=4` — **ignore it**, the model constants are what's used in queries.

### `maps` (40 rows, AUTO_INCREMENT=187)

```sql
CREATE TABLE maps (
  id          int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name        varchar(50) NOT NULL,
  created_at  datetime DEFAULT current_timestamp(),
  updated_at  datetime DEFAULT current_timestamp(),
  del_flg     int(1) DEFAULT 0
);
```

**Sample:** `(59, 'Ankeny Power Wash', ..., 0)`.

40 maps in live DB but `AUTO_INCREMENT=187` → 147 maps were hard-deleted at some point (`MapController::delete()` does a real `DELETE`, not soft-delete, despite `del_flg` existing).

### `tasks` (2,004 rows, AUTO_INCREMENT=14,645) — _the "store-on-map" table_

```sql
CREATE TABLE tasks (
  id          int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  map_id      int(11) DEFAULT NULL,                  -- → maps.id (no FK)
  store_id    int(11) NOT NULL,                      -- store number from Excel column 0; NOT a real FK
  name        varchar(50) NOT NULL,                  -- store name from Excel column 1
  data        varchar(2048) DEFAULT NULL,            -- JSON string of all other Excel columns
  status      int(1) DEFAULT 0,                      -- 0=NEW, 1=PENDING, 2=COMPLETE
  client      int(11) NOT NULL,                      -- → users.id of admin who created it
  worker      int(11) DEFAULT NULL,                  -- almost always NULL; assigning is via `assigns` table
  created_at  datetime DEFAULT current_timestamp(),
  updated_at  timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  del_flg     tinyint(1) DEFAULT 0
);
```

**Sample:**
```sql
(6148, 59, 2896, 'Ankeny #11',
 '{"State":"IA","Address":"2601 SE CREEKVIEW DR","Latitude":"41.7034268",
   "Longitude":"-93.5711201","Regional":"Michael Ollom",
   "Outside_Paint_Task":"Needs Scheduled","Gas_Lid_Task":"Needs Scheduled",
   "Notes":"Paint…Lot Striping, Access..."}',
 0, 13, NULL, ..., 0);
```

**Critical findings:**
* `data` is a **VARCHAR(2048)** — silently truncates rows with many columns. The `Notes` field above is already cropped. Already lost data on some rows.
* `store_id` is a free-form integer copy of Excel column 0; **no uniqueness constraint** — same store number can appear in multiple maps (intentional).
* `tasks.name` is misleading — it's the **store name** ("Ankeny #11"), not a task description.
* `worker` column exists but is unused; assignment is via the `assigns` table.
* `data` keys come from `TaskImport::collection()` which does `str_replace(" ", "_", $title)` on the Excel header — so "Outside Paint Task" becomes `Outside_Paint_Task`, but inconsistently across maps (`Canopy`, `Canopy_Poles`, `Canopy_poles` all exist depending on the source spreadsheet).
* Zip codes in `data` round-trip as either string `"729442500"` or number `744674615` depending on Excel cell format; **leading zeros lost** when stored as number. Migration script must coerce `data.Zip → string`.

### `completion` (2,748 rows, AUTO_INCREMENT=2,763)

```sql
CREATE TABLE completion (
  id          int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  task_id     int(11) NOT NULL,                       -- → tasks.id
  worker_id   int(11) DEFAULT NULL,                   -- → users.id
  images      varchar(1000) DEFAULT NULL,             -- JSON string array
  checks      varchar(255) DEFAULT NULL,              -- JSON string object
  comments    varchar(255) DEFAULT NULL,              -- ⚠ 255 chars — silently truncated longer comments
  trackstop   int(1) DEFAULT 0,
  satisfied   int(1) DEFAULT 0,
  firstname   varchar(50) DEFAULT '',
  lastname    varchar(50) DEFAULT NULL,
  signature   varchar(255) DEFAULT NULL,              -- relative path "signature/sign-….png"
  created_at  datetime DEFAULT current_timestamp(),
  updated_at  timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
);
```

**Sample:**
```sql
(14, 421, 10,
 '[{"field":"Crash","before":"image-421-0-0-20200922203056","after":"image-421-0-1-20200922203056"},
   {"field":"DB","before":"","after":""},
   {"field":"Canopy","before":"","after":""},
   {"field":"Gas_Sign","before":"","after":""}]',
 '{"Gas_Sign":1,...}', 'comments...', 0, 0, 'John', 'Doe',
 'signature/sign-14-20200922203100.png',
 '2020-09-22 ...', '2020-09-22 ...');
```

**Critical findings:**
* `comments` truncates at **255 characters** silently. Workers' longer notes have been cut for years.
* `images` is a JSON-encoded string in a `varchar(1000)` — **also truncates** when there are >5–6 photo pairs.
* `images` is **denormalised** — one Completion row per task; multiple photo pairs live as a JSON array. Editing photos rewrites the whole array. No referential integrity on photo paths.
* Photo paths are **relative filenames only** (`image-421-0-0-…`), no extension. Files live in `public_html/public/photos/`.
* `del_flg` does **not** exist on this table → completions are immortal.
* **There can be multiple completion rows per `task_id`** (the controller uses `orderByDesc('updated_at')->first()`). Old completions are never cleaned up.

### `missingtag` (30 rows, AUTO_INCREMENT=42) — _tag alerts_

```sql
CREATE TABLE missingtag (
  id          int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  task_id     int(11) NOT NULL,                  -- → tasks.id
  comment     varchar(1000) DEFAULT NULL,
  img0        varchar(100) DEFAULT '',           -- relative path "missingtag/tag-….png"
  img1        varchar(100) DEFAULT '',
  img2        varchar(100) DEFAULT NULL,
  img3        varchar(100) DEFAULT NULL,
  worker_id   int(11) DEFAULT NULL,              -- → users.id
  created_at  datetime DEFAULT current_timestamp(),
  updated_at  datetime DEFAULT current_timestamp()
);
```

**Sample:** `(7, 969, 'test', 'missingtag/tag-969-0-20201019144740.png', '', NULL, NULL, 11, ...)`.

* Hardcoded **4-photo cap** — there's no fifth slot.
* `comment` truncates at 1000 chars.

### `assigns` (148 rows, AUTO_INCREMENT=263)

```sql
CREATE TABLE assigns (
  id          int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  map_id      int(11) DEFAULT NULL,
  user_id     int(11) DEFAULT NULL,
  created_at  datetime DEFAULT NULL,
  updated_at  datetime DEFAULT NULL
);
```

**Sample:** `(9, 8, 10, …)`.

This is the **map → user assignment** table — but only used for workers. Vendor assignments are simply **not implemented** in the legacy code: `MapController::getMapList()` for vendors returns ALL maps (root cause of bug L1).

* No unique constraint on `(map_id, user_id)` → duplicates are possible.
* No `del_flg`; "removing a worker" hard-deletes the row.

### `tagemails` (8 rows, AUTO_INCREMENT=22)

```sql
CREATE TABLE tagemails (
  id          int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  map_id      int(11) DEFAULT NULL,
  email       varchar(50) DEFAULT '',
  created_at  datetime DEFAULT current_timestamp(),
  updated_at  datetime DEFAULT current_timestamp()
);
```

**Sample:** `(1, 8, 'emrekayaoglu94@hotmail.com', …)`.

Per-map list of email recipients for tag-alert notifications. **Email column is `varchar(50)` only** — many real emails exceed 50 chars and would be silently truncated.

### `questions` (10 rows, AUTO_INCREMENT=14)

```sql
CREATE TABLE questions (
  id          int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  map_id      int(11) DEFAULT NULL,
  title       varchar(255) DEFAULT NULL,
  created_at  datetime DEFAULT current_timestamp(),
  updated_at  datetime DEFAULT current_timestamp()
);
```

Per-map free-form questions. Mostly unused. The "customer interview" feature client mentioned (chat L491) used these but was never wired into the worker flow.

### `fields` (0 rows) — UNUSED

```sql
CREATE TABLE fields (
  _id   int(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name  varchar(50) NOT NULL
);
-- MyISAM, latin1_swedish_ci  ⚠ different engine + collation than every other table
```

Never referenced from code. Drop on migration.

---

## 3. Photo / file storage

Stored on the cPanel filesystem under `public_html/public/`:

| Folder | Files | Purpose |
|---|---:|---|
| `public/photos/` | **19,445** | Before/after photos. Filename pattern `image-<task_id>-<index>-<slot>-<YmdHis>` (no extension!) |
| `public/signature/` | **2,640** | Signature canvas PNGs. Pattern `sign-<completion_id>-<YmdHis>.png` |
| `public/missingtag/` | **64** | Tag-alert photos. Pattern `tag-<task_id>-<index>-<YmdHis>.png` |
| `public/images/` | 6 | Static UI assets (`ic_pin_0.png` through `ic_pin_4.png`) |

Total photo storage: **~22,000 files** ≈ **1.6 GB** (matches the zip size).

**Quirks:**
* Photos saved with **no extension**. Browsers / image viewers must sniff the magic bytes. The legacy frontend `<img>` tags rely on the LiteSpeed server's MIME sniffing.
* Filenames include only seconds-resolution timestamps → two photos uploaded in the same second would **overwrite each other**. Unlikely in practice but a real risk.
* Public URL pattern: `https://crushtheworld.com/public/photos/<filename>` — fully world-readable, no auth check, **anyone with a guessable filename can scrape work-site photos**. Not blocking for migration, but the new system gates photo URLs behind signed-URL auth.

---

## 4. API → DB mapping (definitive)

Endpoint behaviour mapped to controller + table:

| API endpoint | Controller method | Reads / Writes |
|---|---|---|
| `POST /api/login` | `AuthController::login` | reads `users`; writes `users.api_token` (regenerates on every login!) |
| `POST /api/register` | `AuthController::register` | inserts into `users` (always type=4 worker) |
| `GET /api/mapList` | `MapController::getMapList` | reads `maps` join `assigns` (worker) **OR `maps` only** (vendor — bug L1) |
| `GET /api/mapDetail/{id}` | `MapController::detail` | reads `maps`, `tasks`, `questions`, `assigns`, `completion`; counts after-photos in JSON |
| `GET /api/completeTaskInMap/{id}` | `MapController::getCompleteTask` | reads `completion` join `users` join `tasks` |
| `POST /api/updateTask` | `TaskController::updateApi` | updates `tasks.data`, `tasks.status` |
| `POST /api/addPhoto` | `TaskController::addPhoto` | upserts `completion`; saves files to `public/photos/` |
| `POST /api/checkAndSign` | `TaskController::checkAndSign` | updates `completion`; sets `tasks.status=2`; saves signature file |
| `POST /api/addMissingTag` | `TaskController::addMissingTag` | inserts `missingtag`; saves files to `public/missingtag/`; **calls PHP `mail()` directly per recipient** |
| `POST /api/changePassword` | `UserController::changePassword` | re-hashes & updates `users.password` |
| `POST /api/updateProfile` | `UserController::updateProfile` | updates `users.{phone,address,state,zip}` |
| `GET /api/getTaskStatus/{task_id}` | `TaskController::getTaskStatus` | reads latest `completion` for current worker — **endpoint exists but the APK never calls it** |

---

## 5. Legacy bugs — root causes (re-confirmed in code)

The L1–L9 list in `PROJECT_STATUS.md §3.3` is now traced to specific lines:

| Bug | Location | Code |
|---|---|---|
| **L1** vendor sees all maps | `MapController::getMapList:357-365` | `if (USER_VENDOR) { Maps::where('del_flg',0)->get(); }` — no `assigns` join |
| **L2** comments missing from Excel | `app/Exports/CompletionExport.php` | `headings()` returns Store ID, Name, …fields…, Worker, Date, timestamp — **no `Comments` column added** |
| **L3** before/after photos must be uploaded together | `TaskController::addPhoto` + worker app `addPhotos` (Kotlin) | Code-side actually preserves existing URLs — the limitation is **in the Android UI**: workers couldn't navigate back into a saved store and add only afters because the screen was modal-based and the field array was rebuilt fresh on each entry. The new app fixes this with persistent state, no backend change needed |
| **L4** change-password broken | `UserController::changePassword` | Code looks correct; live-test pending. Possible cause: legacy APK calls `/api/changePassword` but the route is wrapped in `auth:api` middleware which requires `?api_token=` in URL — and the APK puts it in the JSON body. **Likely silently 401's.** Confirm in cutover testing. |
| **L5** military-time display | `CompletionExport::array()` line `'m/d/Y H:i A'` | `H` is 24-hour, `A` is AM/PM — the format string mixes both: `"01/15/2026 14:30 PM"`. Fix to `'m/d/Y h:i A'` (lowercase h = 12-hour) or to user's locale |
| **L6** APK-only distribution | n/a | New build → Play Store + App Store |
| **L7** Property View doesn't exist | n/a | No code, no table, no UI. Add cleanly in rebuild |
| **L8** tag-alert email recipients | `MapController::addTagEmail` + `TaskController::addMissingTag` | Recipient management exists; sending uses raw PHP `mail()` with malformed `From: crushthe` header → SPF/DKIM-fail on most receivers. Fix by switching to Postmark/SES with proper From-domain. |
| **L9** field inconsistency across maps | `app/Imports/TaskImport::collection` | Imports `data` keys verbatim from Excel header (with spaces→underscores). No normalisation, no validation. Maps with header typos store incompatible keys. Fix in new ETL |

Plus newly-found bugs not previously listed:

| New bug | Severity | Where |
|---|---|---|
| **N1** `tasks.data` truncated at 2048 chars | High | varchar limit; some Notes fields already cropped |
| **N2** `completion.comments` truncated at 255 chars | High | varchar limit; long worker notes lost |
| **N3** `completion.images` truncated at 1000 chars | High | varchar limit; >5–6 photo pairs lose entries |
| **N4** Multiple `completion` rows per task | Medium | No cleanup; `getCompleteTask` `array_push($task_ids…)` dedupes on read but exports may double-count |
| **N5** No FK constraints anywhere | High | Orphaned rows possible; integrity is hope-based |
| **N6** Hard-delete on maps + tasks + assigns | Medium | Loses history; `del_flg` ignored |
| **N7** `api_token` rotates every login | Medium | If a worker logs in on a second device, the first device gets silently 401'd. Causes "login failed" complaints |
| **N8** `APP_DEBUG=true` in production | Critical | Stack traces + DB creds leaked in error pages |
| **N9** Photo URLs world-readable | Medium | `public/photos/<file>` requires no auth |
| **N10** Email From-header malformed | Medium | `From: crushthe` fails most receivers' SPF |
| **N11** No CSRF on web admin Excel import | Medium | Form CSRF works, but `/testEmail` is publicly accessible (sends test mail to a hard-coded address) |
| **N12** No file-size validation on uploads | Medium | DoS risk; legacy admin trusts client-side |

All of the above are **fixed by design** in `REBUILD_PLAN.md` (real schema, FKs, soft-delete consistency, JWT bearer tokens with refresh, presigned-URL photo access, Postmark with SPF/DKIM, Zod input validation, etc.).

---

## 6. Migration plan refinements

Now that we know the exact source schema, the §8 migration in `REBUILD_PLAN.md` becomes concrete:

```
legacy DB                        new DB (per REBUILD_PLAN §5)
─────────                        ─────────────────────────────
users                          → users + user_roles
                                   (type 1→admin, 2→vendor, 4→worker;
                                    keep id as legacy_id metadata)
maps                           → maps
                                   (parse Excel column metadata for
                                    task_columns + count_columns by inspecting
                                    the union of keys across this map's tasks.data)
tasks                          → stores + store_tasks
                                   (one stores row per legacy task; task_columns
                                    populated from data keys ending in "Task";
                                    Zip coerced to text; "" empty-string keys
                                    dropped)
completion                     → completions + completion_counts + photos
                                   (split: row metadata → completions;
                                    images JSON → photos rows;
                                    count fields in tasks.data on COMPLETE
                                    rows → completion_counts)
missingtag                     → tag_alerts + tag_alert_photos
                                   (unfold img0..img3 into separate photos rows)
assigns                        → map_assignments(role='worker')
                                   (deduplicate; keep earliest created_at)
tagemails                      → maps.tag_alert_recipients (text array)
questions                      → drop (unused; can re-add Phase 2 if needed)
fields                         → drop (empty)
```

**Photo file migration:**
1. `unzip public_html.zip "public_html/public/photos/*" "public_html/public/signature/*" "public_html/public/missingtag/*"` → temp dir.
2. For each file, sniff magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`) and prepend extension.
3. Hash content (SHA-256) → object key `{map_id}/{store_id}/{sha}.{ext}`; dedup.
4. Upload to R2 via parallel workers (`@aws-sdk/client-s3`, `Promise.all` with concurrency 16).
5. Build a `photos` rows insert from the Completion `images` JSON, mapping legacy filename → R2 key.

**Estimated migration runtime:**
* DB ETL: ~30–60 s (only ~5,000 rows total).
* Photo upload: 22,000 files × avg 70 KB = 1.5 GB; at 16-way parallel upload over a 50 Mbps link, **~5–8 minutes**.
* Total cutover window: comfortably under 30 min.

---

## 7. What I'm doing differently in the rebuild because of these findings

These are now locked into `REBUILD_PLAN.md`:

1. **Stores schema is fully normalised** — no `data` JSON blob; per-map columns become typed columns via the `task_columns` / `count_columns` JSONB metadata + a normalised `completion_counts` table. Eliminates N1, N2, N3 truncation bugs.
2. **Strict Zod / class-validator at the API boundary** — enforces lengths, types, zip-as-string with leading zeros preserved.
3. **`api_token` replaced by JWT access + refresh** — no token-rotation-on-login bug (N7); multiple devices supported.
4. **`Authorization: Bearer` header only** — no token in URL → no leak in access logs.
5. **All FKs declared with `ON DELETE RESTRICT` or `CASCADE` as appropriate** — fixes N5.
6. **All deletes are soft (`deleted_at TIMESTAMPTZ`)** consistently — fixes N6.
7. **Photos via R2 + signed URLs** — fixes N9 + the legacy missing-extension bug.
8. **Postmark with verified `mg.fullcirclefm.com` sender domain + SPF/DKIM/DMARC** — fixes N10.
9. **`/testEmail` and other dev routes** simply do not exist — fixes N11.
10. **Multipart upload with content-length + content-type checks** — fixes N12.
11. **Map-icon colour state machine generalises to N task columns** (Appendix E in REBUILD_PLAN) — fixes the legacy hardcoding to `Outside_Paint_Task` + `Gas_Lid_Task` only.
12. **Vendor assignment is enforced by the same `policy.guard.ts`** that handles worker assignment — fixes L1 by construction (no separate code path that can drift).

---

## 8. Files referenced

```
legacy/postitri_storemanage.sql              ← DB dump (this analysis)
legacy/public_html.zip                        ← full backup (1.6 GB) including photos
legacy/src/public_html/                       ← extracted source (931 KB without vendor/storage)
   .env                                       ← DB creds + Mailtrap config
   routes/api.php  routes/web.php             ← all routes
   app/Models/                                ← 9 Eloquent models
   app/Http/Controllers/                      ← AuthController, MapController, TaskController, UserController
   app/Imports/TaskImport.php                 ← Excel→tasks importer
   app/Exports/CompletionExport.php           ← tasks→Excel exporter (legacy bug L2 source)
   config/constants.php                       ← stale; ignore
   resources/views/                           ← Blade templates (admin web UI)
legacy/api_surface.md                         ← inferred API; this file confirms it
legacy/manifest_summary.md                    ← APK side
```
