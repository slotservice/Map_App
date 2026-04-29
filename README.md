# Full Circle Map App

Field-service workflow app for [Full Circle FM](https://fullcirclefm.com).
Workers receive maps generated from Excel uploads, complete on-site work
with photos and signatures, and submit data back to a payroll-ready
export. Replaces the legacy 2018 PHP/Android system at `crushtheworld.com`.

## Quickstart

Prerequisites: **Node 20**, **pnpm 9**, **Docker** (for Postgres/MinIO/Mailhog), Java 17 + Xcode if you're touching mobile.

```bash
pnpm install                                # install all workspaces
cp .env.example .env                        # docker-compose envs
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env.local
cp apps/mobile/.env.example apps/mobile/.env

pnpm infra:up                               # Postgres + MinIO + Mailhog
pnpm --filter @map-app/api prisma:migrate dev --name init
pnpm --filter @map-app/api prisma:seed      # seed admin/worker/vendor accounts

pnpm dev                                    # api (3001) + admin (3000) in parallel
pnpm --filter @map-app/mobile start         # Expo dev tools
```

Seed accounts (password: `password123`):

| Role | Email |
|---|---|
| Admin | `admin@fullcirclefm.local` |
| Vendor | `vendor@fullcirclefm.local` |
| Worker | `worker@fullcirclefm.local` |

OpenAPI docs: <http://localhost:3001/api/v1/docs>
Mailhog inbox: <http://localhost:8025>
MinIO console: <http://localhost:9001>

## Repository layout

```
.
├── apps/
│   ├── api/            NestJS + Prisma + JWT + RBAC
│   ├── admin/          Next.js (App Router) admin & vendor portal
│   └── mobile/         Expo + React Native worker app
├── packages/
│   ├── shared/         Zod schemas + types shared by API and clients
│   └── eslint-config/  Common lint config
├── infra/
│   ├── docker-compose.yml   Postgres, MinIO, Mailhog
│   └── migration/           Legacy → new ETL (Phase 3)
├── docs/
│   ├── PROJECT_STATUS.md    Single-source status + activity log
│   ├── REBUILD_PLAN.md      Full ULTRADEEP technical plan
│   └── legacy/              Reverse-engineered legacy system docs
└── .github/workflows/  CI (lint + typecheck + test)
```

## Stack at a glance

| Layer | Choice |
|---|---|
| Language | TypeScript everywhere |
| Backend | NestJS 10 + Prisma 5 + PostgreSQL 16 |
| Mobile | Expo SDK 51 + React Native 0.74 |
| Admin / Vendor web | Next.js 14 (App Router) + Tailwind + TanStack Query |
| Auth | JWT bearer + refresh-token rotation; bcrypt |
| Storage | S3-compatible (MinIO local, Cloudflare R2 prod) |
| Email | Nodemailer (Mailhog local, Postmark prod) |
| Validation | Zod schemas in `@map-app/shared` |
| Testing | Vitest |
| CI | GitHub Actions |

## Documentation

* **[Project Status](docs/PROJECT_STATUS.md)** — what's built, what's pending, append-only activity log.
* **[Rebuild Plan](docs/REBUILD_PLAN.md)** — architecture, DB schema, API surface, RBAC, migration plan.
* **[Legacy Schema](docs/legacy/legacy_schema.md)** — full reverse-engineered legacy system + 12 newly-found backend bugs.
* **[Legacy API Surface](docs/legacy/api_surface.md)** — exact endpoint contract from APK + live probes.
* **[Legacy APK Manifest](docs/legacy/manifest_summary.md)** — permissions, dependencies, security findings.

## Phase plan

* **Phase 0** — Discovery, plan, reverse-engineering — ✅ done
* **Phase 1** — MVP rebuild (this is what's currently scaffolded)
  * Week 1: API + admin map CRUD + auth + Excel import
  * Week 2: mobile worker flow + photos + completion + Excel export
  * Week 3: vendor portal + change-password + tag-alert email + QA
* **Phase 2** — Property-view, viewer role, push notifications, password reset
* **Phase 3** — Store release + data migration (`infra/migration`)

## License

Proprietary. © 2026 Full Circle FM. All rights reserved.
