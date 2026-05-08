#!/usr/bin/env bash
# Reset the demo DB to a pristine state for Matt:
#   - hard-delete all soft-deleted maps (cascades to stores/store_tasks/
#     completions/completion_counts/photos/tag_alerts/questions)
#   - hard-delete soft-deleted users that aren't the 3 seeded demo accounts
#   - truncate audit_log (test runs generate hundreds of entries)
#   - drop done/failed outbox items
#
# Run after any session of smoke / playwright / role-audit testing so
# Matt's "Maps" list doesn't show pw-mapview-... or smoke-debug rows
# and his Audit log doesn't show 300+ test events.
#
# Usage (on Tomas):  bash /root/map_app/repo/infra/reset-demo.sh
# Usage (locally):   ssh Tomas 'bash /root/map_app/repo/infra/reset-demo.sh'
#
# SAFE: only touches soft-deleted rows + audit/outbox. Active data
# (Matt's "Week 1 stripe", admin/worker/vendor seed users) is preserved.

set -euo pipefail

sudo -u postgres psql mapapp_dev <<'SQL'
BEGIN;

DELETE FROM maps WHERE deleted_at IS NOT NULL;

DELETE FROM users
  WHERE deleted_at IS NOT NULL
    AND email NOT IN (
      'admin@fullcirclefm.local',
      'worker@fullcirclefm.local',
      'vendor@fullcirclefm.local'
    );

TRUNCATE audit_log;

DELETE FROM outbox_items WHERE status IN ('failed', 'done');

-- Drop unfinalized photo rows on STILL-ACTIVE stores. These accumulate
-- when a presign succeeded but the PUT or finalize never happened (e.g.
-- failed property-image upload from a flaky network or pre-fix HTTPS
-- bug). They never become user-visible — Photo.url isn't shown until
-- finalized — but they show up as noise in audit / debugging.
DELETE FROM photos WHERE finalized_at IS NULL;

COMMIT;

\echo '---'
\echo 'Post-reset inventory (should be: 1 active map, 3 active users, 0 noise):'
SELECT 'maps active'        AS metric, count(*) FROM maps     WHERE deleted_at IS NULL
UNION ALL SELECT 'maps soft-deleted',     count(*) FROM maps     WHERE deleted_at IS NOT NULL
UNION ALL SELECT 'users active',          count(*) FROM users    WHERE deleted_at IS NULL
UNION ALL SELECT 'users soft-deleted',    count(*) FROM users    WHERE deleted_at IS NOT NULL
UNION ALL SELECT 'stores active',         count(*) FROM stores   WHERE deleted_at IS NULL
UNION ALL SELECT 'completions',           count(*) FROM completions
UNION ALL SELECT 'photos',                count(*) FROM photos
UNION ALL SELECT 'audit_log',             count(*) FROM audit_log
UNION ALL SELECT 'outbox pending',        count(*) FROM outbox_items WHERE status = 'pending';
SQL
