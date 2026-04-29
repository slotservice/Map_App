# `@map-app/migration` — Legacy → New ETL

One-shot migration tool to move from the legacy `postitri_storemanage`
MariaDB + cPanel filesystem to the new PostgreSQL + R2 stack. Run
during the Phase 3 cutover (see [REBUILD_PLAN §8](../../docs/REBUILD_PLAN.md#8-migration-plan)).

## Inputs (kept locally, NOT committed)

```
legacy/
├── postitri_storemanage.sql     ← phpMyAdmin export
├── public_html.zip              ← full backup (1.6 GB)
└── public_html/public/          ← extracted photo storage
    ├── photos/      (~19,445)
    ├── signature/   (~2,640)
    └── missingtag/  (~64)
```

## Run

```bash
cp .env.example .env
# fill in legacy and new DB credentials, S3 creds

pnpm migrate                    # DRY_RUN=true by default
DRY_RUN=false pnpm migrate      # writes to target DB + uploads to R2
```

## Phases

Each phase logs `read / written / warnings`. Order matters — later
phases depend on cross-references (e.g. `photos` needs `stores` to
already have `legacyTaskId` set).

1. **users**       legacy users → users (preserves bcrypt hashes)
2. **maps**        legacy maps → maps (derives task/count columns)
3. **stores**      legacy tasks → stores + store_tasks
4. **photos**      filesystem → R2 (sniffs magic bytes, dedupes by SHA-256)
5. **completions** legacy completion → completions + completion_counts + photo links
6. **tag_alerts**  legacy missingtag → tag_alerts + photo links; tagemails → map.tag_alert_recipients
7. **assignments** legacy assigns → map_assignments[role=worker]

## Implementation status

Skeleton only — every phase currently returns "TODO Phase 3 cutover".
The orchestrator, env validation, and phase contract all work; the
transforms will be filled in during cutover.
