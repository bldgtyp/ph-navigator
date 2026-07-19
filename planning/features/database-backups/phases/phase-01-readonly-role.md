---
DATE: 2026-07-19
TIME: 16:20 EDT
STATUS: Planned
AUTHOR: Claude (Opus) with Ed May
SCOPE: Create a least-privilege read-only Postgres role for backups, or document
  the fallback if Render does not permit it.
OWNER: Ed (SQL via Render dashboard / psql)
RELATED:
  - ../decisions.md  # D-4
---

# Phase 01 — Read-only backup role

**Goal:** the credential handed to GitHub can only `SELECT`, so a leaked backup
secret can never write, drop, or exfiltrate-by-modifying production. `pg_dump`
needs nothing more than read access.

## Step 1 — Check whether Render lets us create a role

Connect to the production DB as the primary user (Render dashboard → the DB →
"Connect" → external `psql` command, or Render Shell). Then:

```sql
-- Does the current user have CREATEROLE?
SELECT rolname, rolcreaterole, rolsuper FROM pg_roles WHERE rolname = current_user;
```

- If `rolcreaterole = t` → proceed to Step 2.
- If `f` → **fallback path** (Step 4). Render's primary user sometimes lacks
  `CREATEROLE`; this is expected and handled.

## Step 2 — Create the role (proposed `ops/backup/create-readonly-role.sql`)

```sql
-- Least-privilege, read-only role for logical backups.
-- Run as the database owner. Choose a strong password and store it in
-- Apple Passwords; it becomes part of BACKUP_DATABASE_URL (Phase 02).
CREATE ROLE phn_backup WITH LOGIN PASSWORD :'backup_pw';

GRANT CONNECT ON DATABASE ph_navigator TO phn_backup;
GRANT USAGE ON SCHEMA public TO phn_backup;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO phn_backup;

-- Future tables created by later Alembic migrations must also be readable,
-- or pg_dump will fail after the next schema change.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO phn_backup;
```

Invoke with the password passed as a psql variable so it never sits in the file:

```bash
psql "<primary connection string>" \
  -v backup_pw="'<chosen-strong-password>'" \
  -f ops/backup/create-readonly-role.sql
```

> Note the SQL uses `:'backup_pw'` (quoted variable). Pass the value **without**
> the surrounding quotes on the CLI: `-v backup_pw="MyStr0ngPw"`. Verify by
> connecting as the new role (Step 3).

## Step 3 — Build and test the read-only external URL

Take the Render **external** connection string and swap in the `phn_backup`
user + password (same host/port/dbname/`sslmode=require`):

```
postgresql://phn_backup:<pw>@<render-external-host>:5432/ph_navigator?sslmode=require
```

Test it actually dumps (from any machine with `pg_dump 16`):

```bash
pg_dump --format=custom --no-owner --no-privileges \
  --file=/tmp/roletest.pgc "postgresql://phn_backup:...@.../ph_navigator?sslmode=require"
pg_restore --list /tmp/roletest.pgc | head   # sanity: tables listed
shred -u /tmp/roletest.pgc
```

If `pg_dump` errors on a table it can't read, re-check the GRANTs (Step 2). A
correct run dumps schema + all data.

## Step 4 — Fallback (only if Step 1 said no CREATEROLE)

Use the Render **primary** external connection string as `BACKUP_DATABASE_URL`.
The dump contents are still protected by age public-key encryption (Phase 02);
the only added exposure is the credential itself living in a GitHub secret.
Compensating controls to document in the runbook:
- Treat the secret as high-value; rotate on any suspicion.
- The workflow never logs the URL and runs only on `schedule`/`workflow_dispatch`
  (D-10), so fork PRs can't read it.

## Verification

- Connecting as `phn_backup` succeeds and can `SELECT`, but `CREATE`/`INSERT`
  into `public` is denied.
- `pg_dump` with the read-only URL produces a valid custom-format archive
  (`pg_restore --list` shows tables).

## Rollback

```sql
DROP ROLE phn_backup;
```
(No dependent objects — the role owns nothing.)

## Hand-off to Phase 02

Ed holds `BACKUP_DATABASE_URL` (read-only role URL, or the fallback primary URL)
in Apple Passwords, ready to set as a GitHub secret.
