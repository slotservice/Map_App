# Full Circle Map App

Field-service workflow app for [Full Circle FM](https://fullcirclefm.com).
Workers receive maps generated from Excel uploads, complete on-site work
with photos and signatures, and submit data back to a payroll-ready
export. Replaces the legacy 2018 PHP/Android system at `crushtheworld.com`.

| Surface | Stack | Status |
|---|---|---|
| Mobile (Worker) | React Native + Expo + TypeScript | Phase 1 |
| Admin web | Next.js + TypeScript + shadcn/ui | Phase 1 |
| Vendor portal | Next.js (read-only role on admin) | Phase 1 |
| Backend API | NestJS + TypeScript | Phase 1 |
| Database | PostgreSQL 16 | Phase 1 |
| Photo storage | Cloudflare R2 (S3-compatible) | Phase 1 |
| Email | Postmark | Phase 1 |

## Repository layout

```
.
├── apps/
│   ├── api/            NestJS backend (REST, OpenAPI, RBAC)
│   ├── admin/          Next.js admin web (full CRUD + Excel import/export)
│   └── mobile/         Expo / React Native worker app (Android + iOS)
├── packages/
│   ├── shared/         Shared TypeScript types, validation schemas, constants
│   └── eslint-config/  Common lint config
├── docs/
│   ├── PROJECT_STATUS.md   Single-source status + activity log
│   ├── REBUILD_PLAN.md     Full ULTRADEEP technical plan
│   └── legacy/             Reverse-engineering of the legacy system
└── infra/                  Migration scripts + IaC (Phase 3)
```

## Getting started (Phase 1, once scaffolded)

Prerequisites: Node 20+, pnpm 9+, PostgreSQL 16, Java 17 (Android dev),
Xcode (iOS dev).

```bash
pnpm install
cp .env.example .env       # fill in DB + R2 + Postmark creds
pnpm dev                   # runs api + admin in parallel
pnpm --filter mobile start # Expo dev client
```

## Documentation

* **[Project Status](docs/PROJECT_STATUS.md)** — what's built, what's pending, append-only activity log.
* **[Rebuild Plan](docs/REBUILD_PLAN.md)** — architecture, DB schema, API surface, RBAC, migration plan.
* **[Legacy Schema](docs/legacy/legacy_schema.md)** — full reverse-engineered legacy system + 12 newly-found bugs.
* **[Legacy API Surface](docs/legacy/api_surface.md)** — exact endpoint contract from APK + live probes.
* **[Legacy APK Manifest](docs/legacy/manifest_summary.md)** — permissions, dependencies, security findings.

## Business loop

1. Admin uploads Excel of stores → creates a Map.
2. Admin assigns Workers / Vendors / Viewers per map.
3. Worker opens app, sees only assigned maps; map view colour-codes
   each store by task state.
4. Worker taps a store → records counts (handicap, canopy, …),
   uploads before/after photos, optionally raises a tag-alert (which
   emails per-map recipients), then signs off.
5. Marker turns red; record moves to "Completed Stores".
6. Admin downloads completed-stores Excel → drives payroll.

See [REBUILD_PLAN §1](docs/REBUILD_PLAN.md#1-system-summary) for the full
diagram.

## License

Proprietary. © 2026 Full Circle FM. All rights reserved.
