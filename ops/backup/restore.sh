#!/usr/bin/env bash
# Restore a PH-Navigator backup into a target database and sanity-check it.
#
# Usage:
#   ops/backup/restore.sh <target-db-url> <path-to-age-identity> [object-key]
#
# With no object key, restores the NEWEST daily backup in the store.
#
# Example — drill into a local scratch DB:
#   ops/backup/restore.sh \
#     "postgresql://phn:phn_local_only@localhost:5433/phn_restore_test" \
#     ~/secure/phn-backup-identity.txt
#
# This is the only script that touches the private age identity. It never writes
# to the backup store, and it never touches production unless you hand it a
# production URL.
set -euo pipefail
umask 077

TARGET_URL="${1:?usage: restore.sh <target-db-url> <age-identity> [object-key]}"
IDENTITY="${2:?usage: restore.sh <target-db-url> <age-identity> [object-key]}"
KEY="${3:-}"

: "${PHN_BACKUP_STORE:=phn-backups-ro:phn-db-backups}"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=config.sh
. "$(dirname "${BASH_SOURCE[0]}")/config.sh"

log() { echo "$@" >&2; }

[ -r "$IDENTITY" ] || { log "No readable age identity at: $IDENTITY"; exit 1; }

if [ -z "$KEY" ]; then
  KEY="$(latest_daily_key)"
  [ -n "$KEY" ] || { log "No daily backups found in $PHN_BACKUP_STORE."; exit 1; }
  log "newest daily: $KEY"
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# Stream the fetch straight through decryption: one temp file instead of two,
# and no extra full-size write+read of the ciphertext. The plaintext still lands
# on disk before pg_restore, so a broken transfer cannot half-restore a database.
log "1/3 fetch and decrypt"
rclone cat "$(backup_path "$KEY")" | age -d -i "$IDENTITY" -o "$work/backup.dump"

log "2/3 pg_restore"
# --clean --if-exists makes this re-runnable into a non-empty scratch database.
pg_restore --no-owner --no-privileges --clean --if-exists \
  --dbname "$TARGET_URL" "$work/backup.dump"

log "3/3 row counts"
psql "$TARGET_URL" --no-psqlrc -c "$(row_counts_sql)"

log ""
log "Restored $KEY into the target database."
log "Compare the counts above against production, then drop the scratch DB."
