# `@map-app/api` — Backend API

NestJS + TypeScript + PostgreSQL. See [REBUILD_PLAN §4](../../docs/REBUILD_PLAN.md#4-new-architecture) for the full architecture and [§6](../../docs/REBUILD_PLAN.md#6-api-structure) for the endpoint surface.

**Status:** Not yet scaffolded. Phase 1 week 1.

Planned modules:

* `auth` — login / refresh / change-password (JWT bearer + bcrypt)
* `users` — admin CRUD on workers / vendors / viewers
* `maps` — Excel import → maps + stores; assignment management; per-map tag-alert recipients
* `stores` — store CRUD; per-store property image upload
* `tasks` — task-status updates, completion, count entry
* `photos` — presigned-URL upload handshake (R2)
* `tag-alerts` — tag-alert creation + email outbox via Postmark
* `excel` — completed-stores export (fixes legacy bug L2: comments included)
* `legacy-shim` — `/api/v1/legacy/*` shape-compatible with `crushtheworld.com/api/*` for parallel-run window

Migration script lives at `../../infra/migration/`.
