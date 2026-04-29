# Full Circle Map App — Project Status

_Last updated: 2026-04-29_
_Maintainer: Andrew (freelancer for Matt Grant / Full Circle FM)_

This file is the single source of truth for **what has been done, what has
not, and what comes next**. Every meaningful action must be appended to the
"Activity Log" section so future readers can reconstruct the full history.

---

## 1. One-line summary

A clean rebuild of the legacy "Map Store" / Full Circle FM field-service
app: Android + iOS clients, modern backend, role-based access for
Admin / Worker / Vendor / Viewer, Excel-driven map import, photo-driven
work entry, completion export for payroll. The 2018 PHP backend +
Android APK at `crushtheworld.com` / `app_1119.apk` is the legacy
reference; **its source code is permanently lost**, so we are rebuilding
from screenshots, the live admin panel, the database, and the client's
two Word docs.

## 2. Contract & timeline

| Item | Value |
|---|---|
| Client | Matt Grant, Full Circle FM (`matthewgrant@hotmail.com`) |
| Budget (agreed) | USD 5,500 – 7,000 (ballpark, locked after Phase-1 scope sign-off) |
| Timeline (agreed) | 2 – 3 weeks for Phase 1 MVP |
| Payment platform | Freelancer.com (escrow, milestone-based) |
| Payment status | Awaiting client funding (client said "by tomorrow" on 2026-04-28) |
| Stack agreed | React Native (Android + iOS) + modern Node/TS backend |
| Distribution | Google Play + Apple App Store (APK side-loading is being retired) |

## 3. Implementation status (today)

### 3.1. What has been built in this engagement

**Nothing yet.** No code, no repo, no database. The folder contains only
planning artifacts:

```
Matt G/
├── PROJECT_STATUS.md            ← this file (status of work)
├── REBUILD_PLAN.md              ← full ULTRADEEP technical plan (deliverable)
├── project_status&plan.md       ← original prompt template from the user
├── chat.md                      ← full client chat history (864 lines)
├── login_credential.md          ← legacy system creds (cPanel + admin + worker + vendor)
├── appscreen/                   ← 12 screenshots of legacy Android APK flow
└── client's file/               ← client Word docs, Excel samples, more screenshots
```

### 3.2. What exists in the legacy system (reference only)

The legacy live system at `https://www.crushtheworld.com/` and the APK at
`https://www.postitrighthere.com/app_1119.apk` is **functional** and is
our behavioural reference. We have:

* cPanel access (`postitri` / `f98p#d^!i!l` at
  `https://cp53-ga.privatesystems.net:2083`) → File Manager + phpMyAdmin
* Admin login (`matthewgrant@hotmail.com` / `1234`)
* Worker login (`andrew@gmail.com` / `password`)
* Vendor login (`andrew@hotmail.com` / `1234`)

These let us inspect the legacy DB schema, current map data, and live
behaviour but **do not** give us the source code (PHP backend code is on
disk and readable; Android source is gone).

### 3.3. Known bugs in the legacy system that the rebuild MUST fix

| # | Bug / limitation | Source |
|---|---|---|
| L1 | Vendors can see **all** maps; should be restricted to assigned maps | chat L60–61, L296, doc 1 ¶3 |
| L2 | Screen-3 "Comments" do **not** flow into the completed export | chat L491, L640 |
| L3 | Before / After photos must be added in one session (no "save before, come back for after") | chat L267 |
| L4 | "Change Password" button does not work | chat L299 |
| L5 | Timestamps display in military time / wrong timezone | doc 1 ¶3 |
| L6 | APK-only distribution; not on Play Store / App Store | chat L305, L307 |
| L7 | Property-view feature does not exist (only an unused "Tank Lid Screen ID" placeholder) | chat L423, doc 1 |
| L8 | Tag-alert email recipient list per-map not configurable cleanly | doc 1 |
| L9 | Some workflow fields (Handicap/Canopy/etc.) inconsistent across maps | chat L260, L437 |

### 3.4. Open questions / blockers

| # | Question | Owner | Status |
|---|---|---|---|
| Q1 | 5th-screen exact behaviour (post-completion confirmation flow) | Client | Client said "no separate 5th screen — sign-off + complete on screen 4 closes the job" (chat L836–849) → treat as resolved |
| Q2 | Final RBAC matrix (Admin / Worker / Vendor / Viewer column-by-column) | Andrew → confirm w/ client | Drafted in REBUILD_PLAN §RBAC, awaiting client OK |
| Q3 | Property-image upload mechanism (per-store upload via admin, or auto-link from Excel "Property_Image" column?) | Client | Open — Andrew's recommendation in plan: per-store admin upload |
| Q4 | Client funds Freelancer escrow | Client | Pending |
| Q5 | Apple Developer account active? Google Play Console set up? | Client | Apple "yes but old"; Google not confirmed |

## 4. Phase plan (executive view)

| Phase | Scope | Duration | Status |
|---|---|---|---|
| 0 — Discovery | Full audit, this status doc, full plan, sign-off | done | ✅ this commit |
| 1 — MVP rebuild | Backend + DB + Admin web + Worker app (Android + iOS) covering: login, map list, map view (color-coded), store detail, work entry, photos (before/after independently), tag alert, signature & comments, Excel import/export | 2–3 weeks | ⏳ starts on payment |
| 2 — Enhancements | Property-view images, vendor portal polish, viewer role, push notifications, password-reset flow | +1 week | planned |
| 3 — Store release & data migration | Play Store + App Store submission, migrate data from legacy DB, decommission APK | +1 week | planned |

Detailed breakdown is in `REBUILD_PLAN.md`.

## 5. Activity Log

Append-only. Each entry: `YYYY-MM-DD — actor — action`.

* `2026-04-22` — Andrew — first client call; reviewed live admin (`crushtheworld.com`) and APK; created test map id 39 from `Week 1 Lawn 2026.xlsx`; completed test store id 3487 in `Caseys Test 2`.
* `2026-04-22` — Andrew — confirmed legacy bugs (vendor sees all maps; comments missing from export; before/after photo limitation; broken change-password).
* `2026-04-22` — Andrew — established that original Android source code is lost (developer Aleksandar deceased, hosting account closed, no GitHub/Stack Overflow trace).
* `2026-04-22` — Client — provided first scope doc `Full Circle Map App.docx`.
* `2026-04-22` — Andrew — recommended full rebuild instead of patch; client agreed.
* `2026-04-23` — Client — provided extended scope doc `Full Circle Map App (1).docx` with Admin Backend + 5-screen App flow.
* `2026-04-23` — Andrew — proposed React Native + modern backend; budget ballparked 5500–7000 USD; timeline 2–3 weeks; client agreed.
* `2026-04-28` — Client — confirmed Freelancer escrow funding "by tomorrow"; project formally accepted.
* `2026-04-29` — Andrew — produced this `PROJECT_STATUS.md` and the full `REBUILD_PLAN.md` (Phase-0 deliverable).
* `2026-04-29` — Andrew — established cPanel firewall blocks scripted access; documented the manual cPanel + phpMyAdmin export procedure (handed to client/user as a step-by-step guide).
* `2026-04-29` — Andrew — downloaded legacy `app_1119.apk` (9.69 MB, SHA-256 `6226d59…3be7`); decompiled with apktool 2.9.3 + jadx 1.5.0 into `legacy/apktool-out` and `legacy/jadx-out`.
* `2026-04-29` — Andrew — extracted full legacy API surface (11 endpoints, base `https://crushtheworld.com/api/`) into `legacy/api_surface.md`; live-verified `/login`, `/mapList`, `/mapDetail/:id` with real worker creds.
* `2026-04-29` — Andrew — documented APK manifest, permissions, activities, dependencies, and 6 security findings in `legacy/manifest_summary.md`; flagged critical issues (debug build, SSL validation disabled via `NuckSSLCerts.nuke()`, plaintext worker password in SharedPreferences, leaked Google Maps API key, login response leaks bcrypt hash).
* `2026-04-29` — Awaiting — client/user to upload `legacy/public_html.zip` and `legacy/db_dump.sql` so the legacy DB schema can be confirmed and the migration script written.
* `2026-04-29` — User — uploaded `legacy/public_html.zip` (1.63 GB) and `legacy/postitri_storemanage.sql` (2.6 MB).
* `2026-04-29` — Andrew — extracted Laravel source (931 KB sans vendor/storage); discovered the legacy backend is **Laravel 7 + AdminLTE 3** (not raw PHP) and that **the full backend source is intact** — only the Android source was lost. Documented the confirmed 9-table schema, all 11 controller methods, and 12 newly-found backend bugs in `legacy/legacy_schema.md`.
* `2026-04-29` — Andrew — bootstrapped the monorepo at `https://github.com/slotservice/Map_App` (initial commit `9fd978c`). Phase-0 deliverables (PROJECT_STATUS, REBUILD_PLAN, legacy/* docs) and folder skeleton (apps/api, apps/admin, apps/mobile, packages/shared, infra/migration) pushed to `main`. No feature code yet — Phase-1 implementation begins after escrow funding confirmation.
* `2026-04-29` — Awaiting — client confirmation that Freelancer.com escrow is funded; user confirmation to begin Phase-1 monorepo scaffolding (NestJS API + Next.js admin + Expo mobile).
* `2026-04-29` — User — confirmed Freelancer.com escrow is funded; Phase-1 scaffolding green-lit.
* `2026-04-29` — Andrew — Phase-1 monorepo scaffolded in 6 batches: (1) workspace tooling (pnpm, TS, ESLint, Prettier, Husky, GitHub Actions CI, Docker compose for Postgres+MinIO+Mailhog); (2) `packages/shared` (Zod schemas for auth/users/maps/stores/photos/tag-alerts/completions + role/status/marker enums + RFC-7807 error envelope); (3) `apps/api` (NestJS 10 with Prisma schema mirroring REBUILD_PLAN §5, full auth flow with JWT + refresh rotation + bcrypt, users CRUD, maps CRUD with RBAC-enforced vendor filtering — fixes legacy bug L1 by construction, stores list + marker colour state machine, photos presign+finalize handshake, OpenAPI auto-gen, helmet + CORS + Zod env validation, Dockerfile, seed script with admin/worker/vendor accounts); (4) `apps/admin` (Next.js 14 App Router + Tailwind + TanStack Query, login/logout, sidebar dashboard with map list wired to live API); (5) `apps/mobile` (Expo SDK 51 bare-workflow + TypeScript + drawer/stack navigation + secure-store token persistence + login screen wired live + maps list wired live + change-password wired live + screen stubs for week-2/3 work); (6) `infra/migration` (TypeScript ETL skeleton with 7-phase orchestrator and per-phase transform stubs documenting concrete logic for Phase 3 cutover).
* `2026-04-29` — Andrew — pushed Phase-1 scaffold to `github.com/slotservice/Map_App` across multiple commits. Full quickstart documented in root README. Stub endpoints/screens are clearly marked with `TODO(week-N)` references. No feature gaps from the agreed Phase-1 scope; weekly milestones now begin against this foundation.
* `2026-04-29` — Andrew — Phase-1 week-1 milestone delivered. **API:** `POST /maps/import` parses uploaded Excel (Store#/Store Name fixed; State/Address/Zip/Latitude/Longitude/Type/Manager/Regional/Notes auto-detected; columns ending in "Task" → StoreTask rows; everything else → count columns), validates lat/lon, preserves zip as text (fixes leading-zero loss), creates Map+Stores+StoreTasks atomically; unit tests cover both real client layouts (C Dilbeck + Lawn 2026) plus the legacy empty-string-key bug. `GET /maps/:id/excel` returns a workbook with the right header row (completion rows are week-2). Map summary now populates `storeCount`/`completedStoreCount`/`assignedUserCount`. New `GET /maps/:id/assignments?role=…` endpoint. **Admin web:** create-map dialog (name + Excel upload → live import → redirect to detail); map detail page (stores table with marker-colour pill, per-task status, links to assign workers/vendors/tag-alert recipients, Download-Excel); workers + vendors CRUD pages (add, reset password with reveal-once secret, block/unblock, soft-delete) using a shared `UserList` component; per-map worker + vendor assignment pages (the vendor flow is the user-facing fix for legacy bug L1); per-map tag-alert recipients editor; change-password page; role-aware sidebar; reusable Button/Input/Dialog primitives.
* `2026-04-29` — Andrew — Phase-1 week-2 milestone delivered (mobile worker flow + completion pipeline). **API:** `POST /stores/:id/complete` validates payload (counts must match map.countColumns; photo ids must belong to this store; signature photo must be of kind 'signature'), inserts Completion + CompletionCount rows in one transaction, links before/after photos, marks all StoreTasks scheduled_or_complete; `GET /stores/:id/completion` reads back with signed signature URL. New `GET /stores/:id/photos?kind=…` lists finalized photos with short-lived signed read URLs. New `DELETE /photos/:id` lets workers remove photos before completing (server checks ownership + that no completion link exists). `GET /maps/:id/excel` now fills in actual completion rows: original Excel cols + each task's current status + completion counts + UTC + locale-formatted local time in the worker's tz (fixes legacy L5 military-time bug) + Completed_By name & email + General_Comments (fixes legacy L2 end-to-end) + signed signature URL + before/after photo URLs. **Mobile:** MapView with `react-native-maps` showing per-store markers tagged with the store number and tinted by the colour state machine; auto-fitting initial region; tap → StoreDetail. StoreDetail with header, fixed fields (Address/State/Zip/Lat/Lon/Type/Manager), per-task status, count input fields persisted to a Zustand draft store, Get Directions (opens Google Maps), Continue → AddPhotos. AddPhotos with Field Name input, Before/After columns showing already-uploaded photos with Remove, Tap-to-Add (camera or gallery via expo-image-picker), and the L3-fix Save (returns to Maps preserving photos server-side) vs Save & Next (proceeds to CheckSign) buttons; uploads stream straight to S3 via presigned PUT and finalize with SHA-256 verified server-side. TagAlert sub-screen with title/description/up to 8 photos and submit (the email pipeline lands in week 3 — submission today returns a soft "saved, email pending" message). CheckSign with First/Last name inputs, General Comments (synced to draft, persisted into Excel via /complete), 220-px `react-native-signature-canvas` capture surface; Complete button persists the signature PNG to a temp file, uploads it as kind=signature, then submits the full /complete payload; on success draft is cleared and worker returns to the map. Photo upload helper uses `expo-file-system` streaming + `expo-crypto` SHA-256 so images never round-trip through JS memory. Vitest schema tests cover the completion DTO contract.
* `2026-04-29` — Andrew — Phase-1 week-3 milestone delivered (tag-alert email pipeline + vendor read-only views + QA hardening). **API:** `POST /stores/:id/tag-alerts` properly implemented — validates that referenced photos belong to the store and are of kind `tag_alert`, inserts TagAlert + TagAlertPhoto rows in a transaction, and **enqueues an OutboxItem in the same transaction** (transactional outbox pattern). New `GET /maps/:id/tag-alerts` lists tag alerts on a map with email status (`pending`/`sent`/`failed` + `emailSentAt`). `OutboxWorker` polls every 5 s with a 5-item batch, dispatches by kind through pluggable handlers, and applies exponential backoff (30 s → 2 m → 8 m → 32 m, max 5 attempts). `TagAlertEmailHandler` renders an HTML + plaintext email with map name, store, raised-by, comments, and clickable photos signed for 7 days; sends through the existing `EmailService` (Mailhog locally, Postmark in prod). When the per-map recipient list is empty the alert is marked sent so it doesn't sit in the outbox forever. **Replaces the legacy raw `mail()` call which used `From: crushthe` and silently SPF-failed at most receivers.** **Admin web:** new `/maps/[id]/stores/[storeId]/completion` read-only page (counts grid, general comments, signature image, before/after photo grids opening to full size); new `/maps/[id]/tag-alert-log` page (per-map list of raised alerts with email-status badge); map detail page is now role-aware — admins see "Manage workers/vendors/Tag-alert recipients", vendors see only Tag-alert log + Download Excel + per-store completion view. Stores table grows a "View" link on red (completed) rows. **QA hardening:** new `assertMapAccess` and `assertStoreAccess` helpers (`apps/api/src/common/access.ts`) wired into `StoresService.findById/listByMap`, `PhotosService.presignUpload/listByStore`, `CompletionService.complete/readByStore`, and `TagAlertsService.create/listByMap` — eliminates the per-endpoint risk that a non-admin authenticated user could read or mutate stores on un-assigned maps. Re-completion now correctly returns 409 Conflict (was 400). Mobile fixes: AddPhotos Save now `nav.pop(2)` to land on the map view (was navigating to drawer root), CheckSign Complete `nav.pop(3)` so worker sees the freshly-red marker; TagAlert error message updated now that the endpoint is real (was a soft "saved, email pending" 501 fallback); MapView markers carry `tracksViewChanges={false}` for iOS perf when rendering custom-view bubbles.
* `2026-04-29` — Andrew — Phase-1 MVP scope feature-complete; sandbox-side runtime test deferred (no Docker in the dev sandbox). Wrote a step-by-step `docs/DEMO_RUNBOOK.md` so the local end-to-end demo can be run on the user's machine.
* `2026-04-29` — Andrew — Phase-2 milestone delivered (Property View + Forgot-password + Viewer role + Audit log). **Property View (closes legacy L7):** new `POST /stores/:id/property-image` (admin only) returns presigned PUT URL; `POST /stores/:id/property-image/:photoId/finalize` swaps the active key on the store atomically; `DELETE /stores/:id/property-image` clears it. `GET /stores/:id` now signs `propertyImageUrl` for 1 hour. Admin map-detail stores table grows a Property column with thumbnail-or-add button per row; click opens a dialog that handles upload + preview + remove. New mobile **PropertyView** screen reachable from AddPhotos's top-right link — pulls the signed URL and renders. **Forgot-password (closes legacy L4 end-to-end):** new `password_reset_tokens` Prisma model; `POST /auth/forgot-password` is public, never reveals existence, mints a 30-min single-use token and enqueues a `password_reset_email` outbox item; `POST /auth/reset-password` redeems the token, sets the new password, revokes every refresh token for the user. New `PasswordResetEmailHandler` registered alongside `TagAlertEmailHandler`. Admin web has new `/forgot-password` and `/reset-password` pages plus a "Forgot password?" link on the sign-in screen. New `ADMIN_PUBLIC_URL` env var feeds the email link. **Viewer role:** new `/viewers` admin page using the shared `UserList` component, new `/maps/[id]/viewers` per-map assignment page using `MapAssignmentList`, sidebar gains a Viewers link for admins. **Audit log:** new global `AuditModule` + `AuditService.record` (fire-and-forget) + paginated `GET /audit-log` (admin only). Audit writes wired on `map.create` (Excel import), `map.update`, `map.soft_delete`, `map.assign`, `map.unassign`, `user.create`, `user.update`, `user.reset_password`, `user.soft_delete`. New admin `/audit-log` page with paginated table showing actor email, action, resource, payload, timestamp.

---

_Continue logging every commit, milestone hand-off, and scope change here._
