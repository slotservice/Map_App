# `@map-app/admin` — Admin & Vendor Web

Next.js 14 App Router + TypeScript + Tailwind CSS + TanStack Query +
Zustand. Replaces the legacy Laravel + AdminLTE admin at
`crushtheworld.com`.

## Quickstart

```bash
# from repo root, with the API already running on :3001
cp apps/admin/.env.example apps/admin/.env.local
pnpm --filter @map-app/admin dev      # http://localhost:3000
```

Test login (after `pnpm prisma:seed` on the API):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@fullcirclefm.local` | `password123` |
| Vendor | `vendor@fullcirclefm.local` | `password123` |
| Worker | `worker@fullcirclefm.local` | (mobile only) |

## Layout

```
src/
├── app/
│   ├── layout.tsx                Root shell (Providers)
│   ├── page.tsx                  Index → redirects to /maps
│   ├── globals.css
│   ├── (auth)/login/page.tsx     Sign-in form
│   └── (dashboard)/
│       ├── layout.tsx            Auth gate + sidebar
│       ├── maps/page.tsx         Map list (live API)
│       ├── workers/page.tsx      stub — week 1
│       ├── vendors/page.tsx      stub — week 1
│       └── profile/page.tsx      Read-only; edit form week 1
├── components/
│   └── providers.tsx             QueryClientProvider
└── lib/
    ├── api.ts                    ky instance, Bearer header injection
    └── auth.ts                   Zustand store + login/logout
```

## Implemented now

* Login flow → calls `POST /api/v1/auth/login`, stores tokens in localStorage.
* Auth-gated dashboard layout with sidebar + sign-out.
* Live map list page wired to `GET /api/v1/maps`.
* Profile page reads user from store.

## Stubs (filled in per milestone)

* Map detail / store list / completed table / Excel download — week 1–2
* Worker CRUD table — week 1
* Vendor CRUD table + per-vendor map assignment — week 1
* Tag-alert log + per-map email recipient editor — week 3
* Property-image upload — Phase 2
