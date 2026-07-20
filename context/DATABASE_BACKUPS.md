# Database Backups & Disaster Recovery

Canonical runbook for backing up and restoring the PH-Navigator production
database. If you are reading this during an incident, jump to
[Restore](#restore-a-backup).

Design rationale and the decision log live in
`planning/features/database-backups/`; this file is what you operate from.

## What is protected

**Backed up:** all of Postgres — relational metadata (users, sessions, catalogs,
the asset registry, the audit log) and the versioned JSONB documents in
`project_versions.body`, which are the actual energy models. This is the
irreplaceable data.

**Not backed up here:** object-store bytes in R2 (datasheets, HBJSON, EPW
bundles). Deferred by decision D-9 — most are re-derivable from the Dropbox
source files. After a DB-only restore, `project_assets` rows still reference R2
keys: if R2 is intact they resolve; if not, the documents are intact but some
file bytes are missing. See `context/DATA_STORAGE.md`.

## The two layers

| Layer | Covers | Window | Where |
| --- | --- | --- | --- |
| **Render PITR** (primary) | fat-finger deletes, bad migrations caught quickly | see `PRODUCTION_DEPLOYMENT.md` | inside Render |
| **Off-site dumps** (this system) | Render account loss, long-undetected corruption | 30 daily + 12 monthly | Cloudflare R2 + Dropbox |

Render PITR is faster and preferred **when Render is healthy**. Reach for these
dumps when it is not, or when the damage predates the PITR window.

## Where things live

- **R2 bucket** `phn-db-backups` (private, no public access, no CORS), keys:
  ```
  daily/ph_navigator/<YYYY>/<MM>/ph_navigator-<YYYYMMDD>T<HHMMSS>Z.dump.age
  monthly/ph_navigator/<YYYY>/ph_navigator-<YYYY-MM>.dump.age
  ```
  Lifecycle expires `daily/` at 30 days and `monthly/` at 365.
- **Dropbox mirror** `~/Dropbox/bldgtyp-00/00_PH_Tools/_backups/phn-db/` — pulled
  weekly by launchd; keeps everything ever pulled, so it outlasts R2 retention.
- **GitHub secrets** (names only): `BACKUP_DATABASE_URL`,
  `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY`, `BACKUP_R2_ENDPOINT`.
  **Variables:** `BACKUP_R2_BUCKET`, `BACKUP_AGE_RECIPIENT`.
- **The age private identity** — Apple Passwords ("PHN DB Backup — age identity")
  and a copy in the private key store outside the backup folder. It is in no CI
  system, no repo, and not in `phn-db-backups/`.

> **Key loss = permanent backup loss.** Nothing else can decrypt these files.
> Key leak = every backup readable. Both copies are stores Ed controls; the split
> guards against losing one.

## Scripts

All in `ops/backup/`, all sharing `config.sh` so the store location and key
scheme have one definition:

| Script | Runs where | Does |
| --- | --- | --- |
| `backup.sh` | GitHub Actions, daily | dump → validate → encrypt → store → verify |
| `pull-to-dropbox.sh` | Ed's Mac, weekly (launchd) | mirror R2 → Dropbox, never decrypts |
| `restore.sh` | anywhere, on demand | fetch → decrypt → `pg_restore` → row counts |
| `drill-local.sh` | any dev machine | full round-trip against local Postgres |

## Routine operations

**Run a backup now:** Actions → "Backup Database" → Run workflow (from `main`).
The summary shows the object key; logs show sizes only, never credentials or
contents.

**Check the latest backup exists:**
```bash
rclone lsl phn-backups-ro:phn-db-backups/daily --recursive | sort | tail -3
```

**Check the weekly pull is alive.** Unlike the daily job, a dead pull sends no
email — launchd just records an exit nobody reads. `pull-to-dropbox.sh` writes a
`.last-success` stamp; this fails if it is more than 10 days old (i.e. it missed
a week):

```bash
find ~/Dropbox/bldgtyp-00/00_PH_Tools/_backups/phn-db/.last-success \
  -mtime -10 | grep -q . && echo "pull OK: $(cat ~/Dropbox/bldgtyp-00/00_PH_Tools/_backups/phn-db/.last-success)" \
  || echo "STALE — the weekly pull has not succeeded in 10+ days"
```

Worth running at the same time as the quarterly drill. Common causes of a silent
death: an expired read token, a renamed Dropbox folder, or an `--immutable`
conflict. Full log: `~/Library/Logs/phn-backup-pull.log`.

**A red workflow email** means no backup was taken that day. Yesterday's is still
in R2, so this is not an emergency — but do not let it run. Common causes: the
database is paused/suspended, rotated credentials, or an expired R2 token. Open
the run log; the failing step names the problem. Re-run via `workflow_dispatch`
once fixed.

## Restore a backup

```bash
ops/backup/restore.sh <target-db-url> <path-to-age-identity> [object-key]
```

With no object key it restores the **newest daily**. This is the only procedure
that touches the private identity.

```bash
# Restore the newest backup into a local scratch database
createdb -h localhost -p 5433 -U phn phn_restore_test
ops/backup/restore.sh \
  "postgresql://phn:phn_local_only@localhost:5433/phn_restore_test" \
  ~/secure/phn-backup-identity.txt
```

It prints row counts for `users`, `projects`, `project_versions`, and
`project_version_drafts`. Compare against production.

### Full disaster recovery

If production is lost and must be rebuilt:

1. If Render is healthy, **restore Render PITR first** — faster and preferred.
2. Otherwise provision a fresh Postgres 16 and run `restore.sh` against it with
   the latest good key.
3. Repoint the app's `DATABASE_URL` and redeploy (see
   `context/PRODUCTION_DEPLOYMENT.md`).
4. Expect the cross-store caveat above: asset rows point at R2 keys.

## Drills

**A backup that has never been restored is a hope, not a backup.**

**Local round-trip** (free, no production, no real key — run it any time,
especially after changing these scripts):
```bash
make backup-drill-local
```
It backs up the local database with a throwaway keypair into a temp directory,
restores into a scratch DB, and asserts row counts and document bodies match.
It exercises the same `backup.sh`/`restore.sh` that production uses. What it does
**not** prove: that the production credentials, R2 bucket, and real age recipient
are configured correctly.

**Quarterly production drill** (~20 min) — that is what this table is for:

1. Record production counts for `users`, `projects`, `project_versions`.
2. Create a scratch database.
3. `restore.sh <scratch-url> <identity>` (no key ⇒ newest daily).
4. Compare counts; small deltas from same-day activity are expected.
5. Spot-check: `select id, jsonb_typeof(body) from project_versions limit 3;`
6. `dropdb` the scratch database.
7. **Add a row below.**

| Date | Object restored | Counts matched | By |
| --- | --- | --- | --- |
| _(none yet — first drill pending Phases 00–02)_ | | | |

## Rotation

**Encryption key:** generate a new keypair, update the `BACKUP_AGE_RECIPIENT`
variable. Old backups still need the **old** identity, so retain retired
identities until every backup encrypted to them has expired.

**R2 tokens / database credential:** issue the replacement, update the GitHub
secret, then revoke the old one. Rotate on any suspicion — the backup credential
is read-only (D-4) but still grants read access to production data.

## Related

- `context/PRODUCTION_DEPLOYMENT.md` — production topology, deploys, Render.
- `context/DATA_STORAGE.md` — what lives in Postgres vs the object store.
- `ops/backup/README.md` — operator index for the scripts.
- `planning/features/database-backups/` — PRD, decisions (D-1…D-11), phases.
