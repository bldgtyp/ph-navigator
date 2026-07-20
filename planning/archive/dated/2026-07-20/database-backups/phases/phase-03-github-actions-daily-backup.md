---
DATE: 2026-07-20
TIME: 10:20 EDT
STATUS: Complete — operating in production since 2026-07-20; first backup + restore drill passed
AUTHOR: Claude (Opus) with Ed May
SCOPE: The scheduled GitHub Actions workflow that dumps, encrypts, and uploads
  the daily backup, with the monthly copy and integrity checks.
OWNER: Agent builds the YAML; Ed confirms secrets (Phase 02) and watches the
  first run.
RELATED:
  - ../decisions.md  # D-2, D-5, D-6, D-7, D-8, D-10
  - ../../../../.github/workflows/deploy.yml  # house style reference
---

# Phase 03 — Daily backup workflow

**Goal:** `.github/workflows/backup-db.yml` that, once a day, produces one
age-encrypted `pg_dump` in the R2 backup bucket, tags a monthly copy on the 1st,
and fails loudly on any problem — without ever logging secrets or contents.

## Design notes (why the steps are shaped this way)

- **Dump to a temp file, verify, then upload** (not a straight
  `pg_dump | age | rclone` pipe). A streamed pipe can upload a truncated object
  if `pg_dump` dies mid-stream. The DB is small, the runner disk is ephemeral and
  wiped after the job, so a temp file is cheap and lets us assert the dump
  succeeded and is non-trivial in size before it leaves the runner.
- **`postgresql-client-16` via the PGDG apt repo**, pinned to 16, so the client
  matches the server regardless of which ubuntu image `ubuntu-latest` currently
  is. (A client older than the server refuses to dump.)
- **`age` public-key encryption on the runner** (D-5): the runner has only the
  recipient, so even a compromised runner can't read past backups.
- **`rclone` for R2** (D-6): config entirely from env; avoids aws-cli/R2 checksum
  friction.
- **`schedule` + `workflow_dispatch` only** (D-10): fork PRs can't run it or see
  secrets. `permissions: contents: read` (minimal).
- **Concurrency guard** so a slow run can't overlap the next day's.
- **Never** `echo` the URL, secrets, or dump bytes. Log only sizes and the object
  key.

## As built — `.github/workflows/backup-db.yml`

The workflow is committed; that file is canonical (an inline copy here would only
drift). It implements the design notes above, with three deltas worth recording:

- **Archive validation, not just a size floor.** Before encrypting, the job runs
  `pg_restore --list` and requires at least one `TABLE DATA` entry alongside the
  20 KB floor. A size check alone would pass a corrupt archive.
- **`jq` for the remote size check** instead of `grep -o` on `rclone size --json`
  (jq is preinstalled on GitHub runners and is not sensitive to field order).
- **Preflight reads the `RCLONE_CONFIG_R2_*` job env vars** it actually depends
  on, rather than a parallel list of secret names, so the check can't pass while
  the rclone remote is misconfigured. The GPG dearmor step passes `--yes` so a
  re-run cannot wedge on an existing keyring file.

Companion files added at the same time (they unblock Ed's Phases 00–01):
`ops/backup/create-readonly-role.sql`, `ops/backup/r2-lifecycle.json`, and
`ops/backup/README.md`.

## First-run procedure (Ed)

1. Merge the workflow to `main` (it does nothing on merge — no push trigger).
2. Actions → "Backup Database" → Run workflow → from `main`.
3. Watch it go green. The run summary shows the object key + size; the logs show
   only sizes, never the URL/secrets/contents.
4. Confirm the object exists: `rclone ls R2:phn-db-backups/daily/` (Ed's machine,
   any token) or the R2 dashboard.

## Verification

- A `workflow_dispatch` run succeeds end-to-end.
- One object appears under `daily/…` of plausible size (tens of MB range,
  well above the 20 KB floor).
- Grep the run log: no connection string, no key material, no dump bytes.
- Re-run: a second object appears (timestamped), not an overwrite.

## Edge cases handled / noted

- **GitHub cron drift:** scheduled runs can be delayed minutes under load — fine
  for backups. `workflow_dispatch` is always available for an on-demand dump.
- **Client/server version:** pinned `postgresql-client-16` matches PG16 server.
- **R2 checksum friction:** avoided by using rclone (Cloudflare provider) rather
  than aws-cli.
- **Truncated upload:** guarded by the size floor + remote-size compare.
- **Suspended/paused DB:** `pg_dump` fails → job fails red → Ed is notified by
  GitHub's default failed-workflow email.

## Rollback

Delete `.github/workflows/backup-db.yml` (and optionally the secrets). No other
system depends on it yet; Phase 04 (pull) only reads whatever objects exist.

## Follow-ups wired later

- Phase 04 reads these `daily/`/`monthly/` objects for the Dropbox pull.
- Phase 05's restore drill decrypts one of these objects.
- Consider a failure notification beyond GitHub's default email (e.g. a
  scheduled "no backup in 36h" alert) — noted in `decisions.md` as a possible
  hardening, not built in MVP.
