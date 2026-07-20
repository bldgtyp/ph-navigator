---
DATE: 2026-07-20
TIME: 10:20 EDT
STATUS: Complete — operating in production since 2026-07-20; first backup + restore drill passed
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

## As built

`ops/backup/restore.sh` is committed and canonical. Deltas from the sketch above:

- **Signature reordered and the key made optional:**
  `restore.sh <target-db-url> <age-identity> [object-key]`. With no key it
  resolves the newest daily via the shared `latest_daily_key` helper, replacing
  the fragile `rclone lsf ... | sed 's#^#daily/#'` incantation the drill
  procedure used to need.
- **Fetch and decrypt are streamed** (`rclone cat | age -d`), so there is one
  temp file rather than two. The plaintext still lands on disk before
  `pg_restore`, so a broken transfer cannot half-restore a database.
- **Row-count SQL is shared** with the drill via `row_counts_sql` in
  `config.sh`, so the two cannot drift apart.

### Plus a local round-trip drill — `ops/backup/drill-local.sh`

Not in the original plan; enabled by D-11 and the reason that decision was
worth taking. `make backup-drill-local` runs the **real** `backup.sh` →
`restore.sh` against local Postgres, using a throwaway age keypair and a temp
directory as the store — no production, no R2, no offline key. It:

- refuses to run against a database with no projects (an empty drill passes
  vacuously and proves nothing);
- forces the monthly-copy branch, which otherwise executes only on the 1st,
  against production, untested;
- asserts source and restored row counts match and every
  `project_versions.body` is still a JSON object;
- drops the scratch database and the key on exit.

It found two real bugs on first run (see D-11). What it does **not** cover:
production credentials, the R2 bucket, and the real recipient — that is the
quarterly production drill below.

## Drill procedure

The operating procedure now lives in `context/DATABASE_BACKUPS.md` → "Drills",
which is where an operator will actually look for it, and where the drill log
table lives. It is not duplicated here.

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
