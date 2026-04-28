# `infra/migration` — Legacy → New ETL

One-shot data migration scripts to move from the legacy
`postitri_storemanage` MariaDB + cPanel filesystem to the new
PostgreSQL + Cloudflare R2 stack.

**Status:** Not yet scaffolded. Phase 3 (cutover).

Inputs:

* `postitri_storemanage.sql` — phpMyAdmin export (kept locally, never committed).
* `public_html.zip` photo storage — `public/photos/`, `public/signature/`, `public/missingtag/`.

Plan: see [REBUILD_PLAN §8](../../docs/REBUILD_PLAN.md#8-migration-plan)
and [legacy_schema.md §6](../../docs/legacy/legacy_schema.md#6-migration-plan-refinements).

Notes:

* Coerce zip codes to text (legacy stores some as numbers, losing leading zeros).
* Drop the empty-string key `""` in `tasks.data` JSON.
* Sniff magic bytes to add file extensions before R2 upload (legacy stored without extensions).
* Hash content (SHA-256) for dedup; key pattern `{map_id}/{store_id}/{sha}.{ext}`.
* Soft-deletes: map legacy `del_flg=1` → new `deleted_at = updated_at`.
* Role mapping: legacy `users.type` 1→admin, 2→vendor, 4→worker.
