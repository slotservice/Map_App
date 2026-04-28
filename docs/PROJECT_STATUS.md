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

---

_Continue logging every commit, milestone hand-off, and scope change here._
