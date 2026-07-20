-- Least-privilege, read-only Postgres role for logical backups (`phn_backup`).
--
-- The credential handed to GitHub Actions should only be able to SELECT, so a
-- leaked backup secret can never write to or drop production. `pg_dump` needs
-- nothing more than read access.
--
-- Run as the database owner against the production database. Both the password
-- and the database name are psql variables: the password so it never lives in
-- this file (or in git), the database name because it differs per environment
-- (production `ph_navigator`, staging/local `ph_navigator_v2`).
--
--   psql "<primary connection string>" \
--     -v backup_pw="<chosen-strong-password>" \
--     -v db_name=ph_navigator \
--     -f ops/backup/create-readonly-role.sql
--
-- Requires the connecting user to have CREATEROLE. Check first with:
--   SELECT rolname, rolcreaterole, rolsuper FROM pg_roles WHERE rolname = current_user;
-- If CREATEROLE is not available, use the fallback documented in
-- planning/features/database-backups/phases/phase-01-readonly-role.md (Step 4).
--
-- Expect two harmless warnings on Render: "no privileges were granted for
-- pg_stat_statements[_info]". Those views belong to a Render-owned extension,
-- and pg_dump never dumps extension-owned objects, so the backup is unaffected.
--
-- Rollback: DROP ROLE phn_backup;  (the role owns no objects)

CREATE ROLE phn_backup WITH LOGIN PASSWORD :'backup_pw';

GRANT CONNECT ON DATABASE :"db_name" TO phn_backup;
GRANT USAGE ON SCHEMA public TO phn_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO phn_backup;

-- Sequences too: pg_dump reads each sequence's last_value, so a tables-only
-- grant fails with "permission denied for sequence <name>_id_seq".
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO phn_backup;

-- Objects added by later Alembic migrations must also be readable, or the dump
-- starts failing after the next schema change.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO phn_backup;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON SEQUENCES TO phn_backup;
