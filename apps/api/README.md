# `@map-app/api` — Backend API

NestJS 10 + TypeScript + Prisma + PostgreSQL 16. Mints JWT bearer +
refresh-token pairs, presigns photo uploads to S3-compatible storage,
sends transactional email through Nodemailer (Mailhog in dev, Postmark
in prod). Full architecture in [REBUILD_PLAN §4](../../docs/REBUILD_PLAN.md#4-new-architecture); endpoint surface in [§6](../../docs/REBUILD_PLAN.md#6-api-structure).

## Quickstart

```bash
# from repo root
pnpm install
cp apps/api/.env.example apps/api/.env
pnpm infra:up                          # Postgres + MinIO + Mailhog
pnpm --filter @map-app/api prisma:migrate dev --name init
pnpm --filter @map-app/api prisma:seed
pnpm --filter @map-app/api dev         # http://localhost:3001/api/v1
```

OpenAPI docs at `http://localhost:3001/api/v1/docs`.

## Layout

```
src/
├── main.ts                 bootstrap (helmet, CORS, validation, OpenAPI)
├── app.module.ts           env validation + module registration
├── common/                 cross-cutting: filters, guards, decorators, pipes
├── prisma/                 PrismaService (@Global)
├── storage/                S3-compatible presign helpers
├── email/                  Nodemailer wrapper
├── auth/                   login, refresh, logout, change-password (JWT)
├── users/                  admin CRUD on workers/vendors/viewers
├── maps/                   list (RBAC-aware), CRUD, assignments
├── stores/                 list-by-map, detail, marker colour
├── tasks/                  store completion        (TODO week 2)
├── photos/                 presign + finalize handshake
├── tag-alerts/             tag-alert + email outbox (TODO week 3)
├── excel/                  Excel import + completed export (TODO weeks 1+2)
└── health/                 healthz / readyz (public)
```

## Implemented now

* Auth: `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `POST /auth/change-password` — full JWT flow with refresh-token rotation and bcrypt.
* Users: full admin CRUD + reset-password (admin role only).
* Maps: list (RBAC enforced — vendors are filtered by `map_assignments`, fixing legacy bug L1 by construction), detail, update, soft-delete, assign / unassign.
* Stores: list-by-map, detail, marker colour state machine.
* Photos: presign-upload + finalize handshake.
* Health: `/healthz`, `/readyz` (DB ping).

## Stubs (return 501; tracked in milestone plan)

* Excel import (week 1 hardening) — `POST /maps/import`
* Excel completed export (week 2) — `GET /maps/:id/excel`
* Store completion (week 2) — `POST /stores/:id/complete`
* Tag-alert creation + email send (week 3) — `POST /stores/:id/tag-alerts`

## Testing

```bash
pnpm --filter @map-app/api test
```

Vitest unit tests under `test/`. E2E tests use a separate Postgres
schema spun up by CI.
