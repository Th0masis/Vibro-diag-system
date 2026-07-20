-- 001_add_soft_delete.sql
--
-- Adds soft-delete support for sensors and service_notes so the UI can offer
-- "Undo" instead of a hard confirm-and-destroy dialog (see
-- docs/ux-audit-vibro-diag-system.md, P1-5).
--
-- This project has no migration framework (Alembic/Flyway) yet — init.sql is
-- only applied by Postgres on first container start against an empty data
-- volume (docker-entrypoint-initdb.d). Existing/already-initialized
-- databases must have this script applied manually, e.g.:
--
--   docker exec -i vibro-db psql -U vibro_user -d vibro_diag < db/migrations/001_add_soft_delete.sql
--
-- Safe to run multiple times (IF NOT EXISTS guards).

ALTER TABLE sensors
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;

ALTER TABLE service_notes
    ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone;
