---
DATE: 2026-07-19
TIME: 16:20 EDT
STATUS: Planned
AUTHOR: Claude (Opus) with Ed May
SCOPE: The restore procedure and the first (and recurring quarterly) restore
  drill that proves the backups are actually usable.
OWNER: Agent builds restore.sh; Ed runs the drill.
RELATED:
  - ../decisions.md  # D-5, D-7
  - ../../../../context/DATA_STORAGE.md
---

# Phase 05 — Restore runbook + drill

**Goal:** a documented, tested path from an encrypted R2 object back to a live,
verified database. **A backup that has never been restored is a hope, not a
backup** — this phase turns it into a backup.

## Prereqs on the restoring machine

```bash
brew install age rclone libpq   # libpq provides pg_restore/psql; or postgresql@16
# a target Postgres to restore INTO: local Docker PG16 is ideal for a drill.
```

The **private age identity** (Phase 02) must be available — from Apple Passwords
or the offline Dropbox key store. This is the only step that touches the private
key.

## Proposed `ops/backup/restore.sh`

```bash
#!/usr/bin/env bash
# Restore a PHN DB backup into a target database and sanity-check it.
# Usage:
#   ops/backup/restore.sh <r2-object-key> <target-db-url> <path-to-age-identity>
# Example (drill into a local scratch DB):
#   ops/backup/restore.sh \
#     daily/ph_navigator/2026/07/ph_navigator-20260719T063000Z.dump.age \
#     "postgresql://phn:phn@localhost:5433/phn_restore_test" \
#     ~/secure/phn-backup-identity.txt
set -euo pipefail
KEY="$1"; TARGET_URL="$2"; IDENTITY="$3"
REMOTE="phn-backups-ro:phn-db-backups"   # read-only rclone remote (Phase 04)

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
umask 077

echo "1/4 fetch $KEY"
rclone copyto "$REMOTE/$KEY" "$work/backup.dump.age"

echo "2/4 decrypt (needs the offline identity)"
age -d -i "$IDENTITY" -o "$work/backup.dump" "$work/backup.dump.age"

echo "3/4 pg_restore into target"
# --clean --if-exists lets you re-run into a non-empty scratch DB.
pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname "$TARGET_URL" "$work/backup.dump"

echo "4/4 sanity counts"
psql "$TARGET_URL" -c "\
  select 'users' t, count(*) n from users \
  union all select 'projects', count(*) from projects \
  union all select 'project_versions', count(*) from project_versions \
  union all select 'project_version_drafts', count(*) from project_version_drafts;"
echo "restore OK — compare counts against production, then drop the scratch DB."
```

## Drill procedure (Ed, ~20 min, first time then quarterly)

1. **Record production truth** (from a read-only prod connection or the Render
   dashboard SQL console):
   ```sql
   select count(*) from users;
   select count(*) from projects;
   select count(*) from project_versions;
   ```
2. **Spin up a scratch target** (local Docker PG16 is fine):
   ```bash
   createdb -h localhost -p 5433 -U phn phn_restore_test    # or CREATE DATABASE
   ```
3. **Run the restore** against the newest daily object:
   ```bash
   ops/backup/restore.sh \
     "$(rclone lsf phn-backups-ro:phn-db-backups/daily --recursive | sort | tail -1 | sed 's#^#daily/#')" \
     "postgresql://phn:phn@localhost:5433/phn_restore_test" \
     "<path to age identity>"
   ```
4. **Compare** the printed counts to Step 1. They should match the most recent
   nightly (small deltas from same-day activity are expected if prod changed
   after the dump).
5. **Spot-check a document body** is intact JSON:
   ```sql
   select id, jsonb_typeof(body) from project_versions limit 3;
   ```
6. **Tear down:** `dropdb phn_restore_test`. Delete any temp files.
7. **Log the drill** in `context/DATABASE_BACKUPS.md` (date, object restored,
   counts matched Y/N). Keeps an audit trail that restores actually work.

## What a real disaster recovery looks like (documented, not drilled)

If production is lost and must be rebuilt:
1. Provision a fresh Render Postgres (or restore Render PITR first if Render is
   healthy — that's faster and preferred when available).
2. `restore.sh <latest good key> <new prod URL> <identity>`.
3. Repoint the app's `DATABASE_URL` (Render auto-wires it for a Blueprint DB;
   for a hand-created DB, set it) and redeploy.
4. Note the **cross-store caveat** (PRD §6): `project_assets` rows will reference
   R2 object keys. If the R2 asset bucket survived, files resolve; if not, the
   documents are intact but some asset bytes are gone (that's D-9's deferred
   scope).

## Verification (this phase is "done" when…)

- One real drill has been executed and its counts matched production.
- The drill is recorded in `context/DATABASE_BACKUPS.md`.
- `restore.sh` ran unmodified (the runbook is correct, not aspirational).

## Rollback

Nothing persistent is created except the scratch DB, which the drill drops. The
private identity is used read-only and never copied into the repo/CI.
