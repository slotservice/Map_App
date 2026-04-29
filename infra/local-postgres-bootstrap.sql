-- Local-dev Postgres bootstrap. Run once as the `postgres` superuser:
--
--   "C:\Program Files\PostgreSQL\17\bin\psql.exe" -h localhost -U postgres ^
--      -f infra/local-postgres-bootstrap.sql
--
-- Idempotent — safe to re-run.

-- ----------------------------------------------------------------------------
-- 1. Application role + database
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'mapapp') THEN
    CREATE ROLE mapapp LOGIN PASSWORD 'mapapp_dev_only';
  END IF;
END$$;

-- CREATE DATABASE can't run inside a DO block (no transactions allowed).
-- Use \gexec to run it conditionally.
SELECT 'CREATE DATABASE mapapp_dev OWNER mapapp ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'mapapp_dev')
\gexec

GRANT ALL PRIVILEGES ON DATABASE mapapp_dev TO mapapp;

-- ----------------------------------------------------------------------------
-- 2. Required extensions inside the new database
-- ----------------------------------------------------------------------------

\connect mapapp_dev

CREATE EXTENSION IF NOT EXISTS citext;          -- case-insensitive emails
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";     -- uuid generators
ALTER DATABASE mapapp_dev OWNER TO mapapp;
GRANT ALL ON SCHEMA public TO mapapp;

-- Done.
\echo
\echo '✔ Created role mapapp + database mapapp_dev with citext + uuid-ossp.'
\echo '  Connection string: postgresql://mapapp:mapapp_dev_only@localhost:5432/mapapp_dev'
\echo
