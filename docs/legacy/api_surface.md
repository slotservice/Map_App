# Legacy API Surface — `crushtheworld.com`

_Reverse-engineered from `app_1119.apk` (com.crush.mapstore, debug build, 2020-11-19) and confirmed against the live server._
_Captured: 2026-04-29._

This is the exact API surface the legacy Android app speaks to. The new
backend should accept the **same shapes** during the parallel-run /
migration phase so the legacy app keeps working until cutover.

## Globals

| Field | Value |
|---|---|
| Base URL | `https://crushtheworld.com/api/` |
| Photo base URL | `https://crushtheworld.com/public/` |
| Auth | `api_token` — opaque 60-char string returned by `/login`, sent as either query param (`?api_token=...`) or JSON body field |
| HTTP client | Volley `PolicyJsonRequest` + `MultipartRequest` |
| Body encoding | JSON for non-file calls; `multipart/form-data` for `addPhoto`, `checkAndSign`, `addMissingTag` |
| Content-Type | Set automatically by Volley |
| Common error envelope | `{"err_code": <int>, "msg": "<text>"}` — `0` = success, anything else = failure |
| Common success envelope | `{"err_code": 0, "<resource>": {...}}` |
| Date format | ISO-8601 with microseconds, e.g. `2026-04-22T14:24:52.000000Z` (Laravel default) |

## User-type enum (from `AppConst.kt`)

| Code | Meaning |
|---|---|
| 1 | `USER_CLIENT` (admin / vendor / viewer — backend roles) |
| 4 | `USER_WORKER` (mobile app) |

(Verified live: `andrew@gmail.com` returns `type: 4`.)

## Task-status enum

| Code | Meaning |
|---|---|
| 0 | `TASK_STATUS_NEW` |
| 1 | `TASK_STATUS_PENDING` |
| 2 | `TASK_STATUS_COMPLETE` |

---

## Endpoints

### 1. POST `/login`

Login. Returns user record and `api_token`.

**Request body** (JSON):
```json
{ "email": "...", "password": "..." }
```

**Live response** (verified 2026-04-29 with `andrew@gmail.com`):
```json
{
  "err_code": 0,
  "user": {
    "id": 34,
    "email": "andrew@gmail.com",
    "username": "Andrew",
    "password": "$2y$10$HKcFsqj4o.l56Q80eZqfze7g29YRUl9MWk8.IU0ja6YOqYV/bOz46",  /* ⚠ SECURITY BUG */
    "type": 4,
    "phone": "3177777777",
    "address": "123 main street",
    "state": "IN",
    "zip": "46033",
    "status": 1,
    "api_token": "y1RTwzUhxnDtqLiT0P5VshLLwlcJxI5JXSYgmbp03aAJZXZHGOCCbfs67pHn",
    "email_verified_at": null,
    "created_at": "2026-04-22T14:24:52.000000Z",
    "updated_at": "2026-04-28T21:48:41.000000Z",
    "del_flg": 0
  }
}
```

**⚠ Critical security finding:** the legacy login response **leaks the
bcrypt password hash** (`user.password`). The new backend must scrub this
field from every response. It also sends `email_verified_at` and other
columns the client doesn't need; we'll trim to a minimum DTO.

### 2. POST `/register`

Worker self-registration (likely admin-disabled in production).

```json
{ "email": "...", "password": "...", "username": "..." }
```

Response: `{ "err_code": 0, "user": {...} }` (no api_token returned — login required after).

### 3. GET `/mapList?api_token=…`

List maps assigned to the current worker.

**Live response:**
```json
{
  "err_code": 0,
  "maps": [
    { "id": 206, "name": "C dilbeck stores" },
    { "id": 124, "name": "Caseys Test 2" }
  ]
}
```

(Only `id` + `name` — no task counts, no last-completed metadata.)

### 4. GET `/mapDetail/{map_id}?api_token=…&mobile=true`

Return the map plus all its stores ("tasks") with embedded `data`
(per-map columns) and any existing completion.

**Live response (truncated):**
```json
{
  "err_code": 0,
  "map": {
    "id": 124, "name": "Caseys Test 2",
    "created_at": "...", "updated_at": "...", "del_flg": 0
  },
  "tasks": [
    {
      "id": 7864,                /* primary key in the `tasks` table */
      "map_id": 124,
      "store_id": 3510,          /* primary key of the underlying store */
      "name": "Sallisaw",        /* this is actually the STORE NAME — legacy naming bug */
      "status": 0,               /* 0|1|2 — see enum above */
      "count": 0,
      "data": {                  /* full per-store payload, mirrors Excel columns */
        "State": "OK",
        "Address": "1420 W CHEROKEE AVE",
        "Zip": "749554250",
        "Latitude": "35.4593645",
        "Longitude": "-94.8064732",
        "Type": "O-2",
        "": "",                  /* ⚠ stray empty-string key, present on every row */
        "Manager": "Donny McMillan",
        "Outside_Paint_Task": "COMPLETE or SCHEDULED ALREADY",
        "Gas_Lid_Task": "Needs Scheduled",
        "Handicap": "", "Canopy_Poles": "", "Crash_Bars": "",
        "Dog_Bones": "", "Gas_Lids": "", "Lines": ""
      },
      "completion": null         /* or a Completion object — see §6 */
    },
    ...
  ],
  "questions": [...],            /* ad-hoc per-map question list (mostly unused) */
  "fields": ["..."]              /* ad-hoc per-map field list */
}
```

**Findings:**
* Legacy `tasks` table = "store-on-map" wrapper; `stores` table is separate.
* Legacy `tasks.name` = store name. Confusing; new schema renames to `store.name` directly.
* `data` is a JSON blob that varies per map (different columns per Excel).
* Numeric columns sometimes round-trip as strings, sometimes as numbers — **leading-zero zips are lost** when the legacy code stores zip as a number (`744674615`, `729442500`). New backend must store zip as text.
* Empty-string key `""` in `data` is residue from an unnamed Excel column. Drop on import.

### 5. GET `/completeTaskInMap/{map_id}?api_token=…&worker_id=…`

List of completed tasks in a map. Used for the "Completed Stores" view.

Response: `{ "err_code": 0, "data": [Task, ...] }`

### 6. POST `/updateTask`

Update or transition a task; used to create the initial Completion stub.

```json
{
  "api_token": "...",
  "task_id": "7864",
  "data": { /* optional, passes through to tasks.data */ },
  "status": 0|1|2     /* optional; -1 means "do not change" */
}
```

Response:
```json
{
  "err_code": 0,
  "task": {
    "id": ..., "map_id": ..., "store_id": ..., "name": "...",
    "status": 1, "data": {...}, "count": ...,
    "completion": {            /* a fresh stub if status went 0 → 1 */
      "id": "...", "task_id": "...", "worker_id": "...",
      "firstname": "", "lastname": "", "comments": "",
      "signature": "", "checks": {}, "images": "[]"
    }
  }
}
```

### 7. POST `/addPhoto` (multipart)

Upload before/after photo pairs for a completion.

**Form parts:**
* `params` (JSON):
  ```json
  {
    "api_token": "...",
    "completion_id": "...",
    "task_id": "...",
    "fields": [
      { "field": "asdf", "beforeUrl": "<existing-url-if-edit>", "afterUrl": "<existing-url>" },
      ...
    ]
  }
  ```
* For each `(i, slot)` where slot ∈ {0=before, 1=after}: file part named `image-{i}-{slot}` with binary content (PNG/JPEG).

**Response:**
```json
{ "err_code": 0, "completion": { /* updated completion incl. images array */ } }
```

The completion's `images` field is a stringified JSON array of objects:
```json
[{ "field": "asdf", "before": "<url>", "after": "<url>" }, ...]
```

(See `Completion.java` and `BeforeAfterImage.java`.)

### 8. POST `/checkAndSign` (multipart)

Final completion: signature + comments + per-task verification checks.

**Form parts:**
* `params` (JSON):
  ```json
  {
    "api_token": "...",
    "completion_id": "...",
    "firstname": "Asdf", "lastname": "Asdf",
    "comments": "asdfasdf",      /* ⚠ legacy bug L2: this never reaches the Excel export */
    "trackstop": 0|1,             /* trouble situation flag */
    "satisfied": 0|1,
    "checks": { "<field>": 0|1, ... }
  }
  ```
* `signature` (file): `image/png` of the signature canvas.

**Response:** `{ "err_code": 0, "msg": "Saved" }`

### 9. POST `/addMissingTag` (multipart)

Tag-alert submission — title/description + up to 4 photos sent to that
map's tag-alert email recipients.

**Form parts:**
* `params` (JSON):
  ```json
  {
    "api_token": "...",
    "task_id": "...",
    "comment": "..."
  }
  ```
* `img0`, `img1`, `img2`, `img3` (file, optional): `image/png` each.

**Response:** `{ "err_code": 0, "msg": "..." }`

### 10. POST `/changePassword`

```json
{ "api_token": "...", "old": "...", "new": "..." }
```

Response: `{ "err_code": 0|<nonzero> }`

(Legacy bug L4: mobile call returns success but the password is not
actually changed server-side — only the admin web "Reset Password"
action works.)

### 11. POST `/updateProfile`

```json
{
  "api_token": "...", "mobile": true,
  "phone": "...", "address": "...", "state": "...", "zip": "..."
}
```

Response: `{ "err_code": 0, "msg": "..." }`

---

## Inferred legacy DB schema (confirmed by API responses)

The new backend should **not** copy this schema, but the migration script
must read from it. Best guesses based on observed payloads:

```
users        (id, email, username, password (bcrypt $2y$10$...),
              type tinyint, phone, address, state, zip,
              status tinyint, api_token char(60),
              email_verified_at, created_at, updated_at, del_flg tinyint)

maps         (id, name, created_at, updated_at, del_flg)

tasks        (id, map_id fk maps, store_id fk stores, name varchar  /* = store name */,
              status tinyint, data json, count int,
              created_at, updated_at, del_flg)

stores       (id, ...derived columns from Excel...)
              -- might exist as a separate table or might be denormalised inside tasks.data;
              -- needs phpMyAdmin export to confirm

completions  (id, task_id fk tasks, worker_id fk users,
              firstname, lastname, comments, signature (path),
              checks json, images text /* stringified JSON array */,
              trackstop tinyint, satisfied tinyint,
              created_at, updated_at, del_flg)

missing_tags (id, task_id fk tasks, worker_id fk users,
              worker_name, comment, img0..img3 paths,
              created_at, updated_at, del_flg)

map_workers  (map_id fk maps, worker_id fk users)              /* assignment table */

questions    (id, map_id fk maps, title, ...)                   /* unused per-map Q&A */
```

Unknowns awaiting `db_dump.sql`:

* Vendor/viewer assignment table (probably `map_vendors` and missing in
  legacy; that's why bug L1 happens — code path falls back to "all maps"
  when no rows exist).
* Tag-alert email recipients table (probably `map_emails(map_id, email)`).
* Completed-store Excel export — server-side route hidden behind admin
  auth; documented separately once we have `public_html.zip`.

---

## What the new backend MUST replicate (parallel-run window)

During the dual-run period (REBUILD_PLAN §8 step 4) the legacy APK keeps
working. To keep it working against the new backend, our `/api/v1/legacy/*`
shim should:

1. Accept `api_token` as a query param **and** as a JSON field — the APK
   uses both interchangeably.
2. Return the **exact** envelope shapes documented above (especially the
   `err_code` field and the `tasks → data` JSON blob).
3. **Strip the `password` field from `/login`** — fixes the security
   leak. The legacy APK doesn't read it, so it's safe to remove.
4. Preserve the `tasks.data` JSON blob structure key-for-key (the APK's
   `Task.data` is a raw `JSONObject`; renaming any key breaks it).
5. Log all incoming requests so we can detect any usage we don't fully
   understand before cutover.

After cutover (REBUILD_PLAN §8 step 5) this shim is retired in favour of
the clean `/api/v1/*` surface defined in `REBUILD_PLAN.md §6`.

## Security findings to remediate in the rebuild

1. **L4-bcrypt-leak:** `/login` returns the bcrypt hash. → New backend never returns `password`.
2. **L4-token-in-URL:** `api_token` is sent as a query string — leaks into web-server access logs. → New backend uses `Authorization: Bearer` only.
3. **No HTTPS HSTS** on the legacy admin (LiteSpeed default). → New deploy enforces HSTS + secure cookies.
4. **debug build flag = true** in `BuildConfig.java` of the legacy APK (`BUILD_TYPE = "debug"`, `DEBUG = true`). → New mobile build defaults to release for store distribution.
5. **`NuckSSLCerts.INSTANCE.nuke()`** is called at app start — this disables SSL certificate validation in `APIFactory` constructor. The legacy APK accepts any certificate. → New app uses the system trust store; certificate pinning optional Phase 2.
