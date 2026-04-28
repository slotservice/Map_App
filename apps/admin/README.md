# `@map-app/admin` — Admin & Vendor Web

Next.js (App Router) + TypeScript + shadcn/ui + TanStack Query. Replaces the legacy Laravel + AdminLTE admin at `crushtheworld.com`.

**Status:** Not yet scaffolded. Phase 1 week 1–2.

Routes (planned):

* `/login`, `/forgot-password`, `/reset-password`
* `/maps` — list with task counts, assigned-user counts, actions
* `/maps/[id]` — map detail (view + completed stores tab + Excel download)
* `/maps/[id]/workers` — worker assignment manager
* `/maps/[id]/vendors` — vendor assignment manager (fixes legacy bug L1)
* `/maps/[id]/tag-alerts` — log + per-map email recipient editor
* `/workers` — admin CRUD on workers
* `/vendors` — admin CRUD on vendors
* `/profile`, `/change-password`

Vendor experience uses the **same Next.js app** with role-gated routes
(`/maps`, `/maps/[id]` only, no edit actions).
