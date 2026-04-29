# `.local-stack/` — local-dev replacement for Docker compose

This folder contains everything we need to run the production-like
stack locally **without Docker**. Each subprocess runs natively on
your Windows machine.

| What | Provider | Port | Purpose |
|---|---|---|---|
| Postgres | Native install (`C:\Program Files\PostgreSQL\17`) | 5432 | DB |
| MinIO | `minio.exe` (in this folder) | 9000 / 9001 | S3-compatible photo storage |
| Email | Console-print via API logs | — | (Mailhog requires Docker; the API logs every email it would have sent) |

## Files

- `minio.exe` — MinIO server binary (Windows AMD64). Launched by `start-stack.ps1`.
- `mc.exe` — MinIO client. Used once at startup to create the bucket.
- `data/` — MinIO storage (gitignored). Created on first run.

## How to use

You shouldn't need to run anything here directly — `pnpm infra:up` (from the repo root) calls `start-stack.ps1`. See `LOCAL_DEV.md` in the repo root for the full step-by-step.
