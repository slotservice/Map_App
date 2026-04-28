# `@map-app/shared`

Shared TypeScript types and Zod schemas used by both the API and the
clients (admin web + mobile). Source of truth for request / response
shapes.

**Status:** Not yet scaffolded. Phase 1 week 1.

Contents (planned):

* `src/dto/` — Zod schemas for every endpoint (login, map, store, photo, tag-alert, completion, …)
* `src/types/` — inferred TS types from the Zod schemas
* `src/constants/` — role enum, task-status enum, marker-colour enum, error codes
