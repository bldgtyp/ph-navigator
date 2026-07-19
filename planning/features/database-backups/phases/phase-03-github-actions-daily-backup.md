---
DATE: 2026-07-19
TIME: 16:20 EDT
STATUS: Planned
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

## Proposed `.github/workflows/backup-db.yml`

```yaml
# Daily encrypted off-site backup of the production Postgres database.
#
# Produces one age-encrypted pg_dump per day in the R2 backup bucket
# (daily/…; a monthly/… copy on the 1st). This is the provider-independent,
# long-retention layer ON TOP OF Render's built-in PITR. It does not touch the
# app, the schema, or production runtime.
#
# Secrets/variables (Settings → Secrets and variables → Actions): see
# planning/features/database-backups/phases/phase-02-encryption-keys.md.
# The dump is encrypted to a public key whose private half is OFFLINE, so this
# workflow can create backups but cannot read them.
#
# Runbook: context/DATABASE_BACKUPS.md.

name: Backup Database

on:
  schedule:
    - cron: "30 6 * * *"     # 06:30 UTC ≈ 02:30 America/New_York (EDT). UTC only.
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: db-backup
  cancel-in-progress: false

jobs:
  backup:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    env:
      # rclone S3/R2 remote "R2" configured entirely from env — no config file.
      RCLONE_CONFIG_R2_TYPE: s3
      RCLONE_CONFIG_R2_PROVIDER: Cloudflare
      RCLONE_CONFIG_R2_ACCESS_KEY_ID: ${{ secrets.BACKUP_R2_ACCESS_KEY_ID }}
      RCLONE_CONFIG_R2_SECRET_ACCESS_KEY: ${{ secrets.BACKUP_R2_SECRET_ACCESS_KEY }}
      RCLONE_CONFIG_R2_ENDPOINT: ${{ secrets.BACKUP_R2_ENDPOINT }}
      RCLONE_CONFIG_R2_ACL: private
      BUCKET: ${{ vars.BACKUP_R2_BUCKET }}
      AGE_RECIPIENT: ${{ vars.BACKUP_AGE_RECIPIENT }}
    steps:
      - name: Preflight — required secrets/variables present
        run: |
          missing=
          for v in BACKUP_DATABASE_URL BACKUP_R2_ACCESS_KEY_ID \
                   BACKUP_R2_SECRET_ACCESS_KEY BACKUP_R2_ENDPOINT; do
            [ -n "${!v}" ] || missing="$missing $v"
          done
          [ -n "$BUCKET" ] || missing="$missing BACKUP_R2_BUCKET"
          [ -n "$AGE_RECIPIENT" ] || missing="$missing BACKUP_AGE_RECIPIENT"
          if [ -n "$missing" ]; then
            echo "::error::Missing required config:$missing" && exit 1
          fi
        env:
          BACKUP_DATABASE_URL: ${{ secrets.BACKUP_DATABASE_URL }}
          BACKUP_R2_ACCESS_KEY_ID: ${{ secrets.BACKUP_R2_ACCESS_KEY_ID }}
          BACKUP_R2_SECRET_ACCESS_KEY: ${{ secrets.BACKUP_R2_SECRET_ACCESS_KEY }}
          BACKUP_R2_ENDPOINT: ${{ secrets.BACKUP_R2_ENDPOINT }}

      - name: Install pg_dump 16, age, rclone
        run: |
          set -euo pipefail
          sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
          curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
            | sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/pgdg.gpg
          sudo apt-get update -qq
          sudo apt-get install -y -qq postgresql-client-16 age rclone
          pg_dump --version && age --version && rclone version | head -1

      - name: Dump, encrypt, upload
        env:
          BACKUP_DATABASE_URL: ${{ secrets.BACKUP_DATABASE_URL }}
        run: |
          set -euo pipefail
          umask 077
          work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
          ts="$(date -u +%Y%m%dT%H%M%SZ)"; y="$(date -u +%Y)"; m="$(date -u +%m)"
          dump="$work/ph_navigator-$ts.dump"

          # 1) Consistent custom-format dump (compressed; restore-into-fresh-db clean).
          pg_dump --format=custom --no-owner --no-privileges --compress=9 \
            --file="$dump" "$BACKUP_DATABASE_URL"

          # 2) Sanity floor — catch an empty/failed dump before it ships.
          size="$(stat -c%s "$dump")"
          echo "dump bytes: $size"
          if [ "$size" -lt 20000 ]; then
            echo "::error::Dump only $size bytes — refusing to upload a suspect backup." && exit 1
          fi

          # 3) Encrypt to the offline recipient. Runner cannot decrypt.
          age -r "$AGE_RECIPIENT" -o "$dump.age" "$dump"

          # 4) Upload the daily object; monthly copy on the 1st (UTC).
          key="daily/ph_navigator/$y/$m/ph_navigator-$ts.dump.age"
          rclone copyto "$dump.age" "R2:$BUCKET/$key" --s3-no-check-bucket
          echo "uploaded: $key"
          if [ "$(date -u +%d)" = "01" ]; then
            mkey="monthly/ph_navigator/$y/ph_navigator-$y-$m.dump.age"
            rclone copyto "$dump.age" "R2:$BUCKET/$mkey" --s3-no-check-bucket
            echo "monthly: $mkey"
          fi

          # 5) Remote integrity — object exists and size matches local ciphertext.
          local_enc="$(stat -c%s "$dump.age")"
          remote_enc="$(rclone size "R2:$BUCKET/$key" --json | grep -o '"bytes":[0-9]*' | cut -d: -f2)"
          echo "encrypted local=$local_enc remote=$remote_enc"
          if [ "$local_enc" != "$remote_enc" ]; then
            echo "::error::Remote size ($remote_enc) != local ($local_enc)." && exit 1
          fi
          echo "### DB backup OK — $key ($remote_enc bytes)" >> "$GITHUB_STEP_SUMMARY"
```

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
