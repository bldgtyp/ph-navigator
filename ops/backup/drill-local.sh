#!/usr/bin/env bash
# Full local round-trip drill: dump → encrypt → store → decrypt → restore →
# verify, entirely against the local Docker Postgres.
#
# This exercises the REAL backup.sh and restore.sh, so it proves the scripts
# work — not that an imitation of them works. It touches no production data, no
# R2 bucket, and not the offline identity: a throwaway age keypair and a temp
# directory stand in for the recipient and the bucket, and both are deleted on
# exit.
#
# What it does NOT prove: that the production credentials, the R2 bucket, and
# the real age recipient are configured correctly. That is what the quarterly
# drill against a genuine production backup is for (see the runbook).
#
#   make backup-drill-local        # or: ops/backup/drill-local.sh
#
# Requires a running local Postgres (`make db-up`) with seeded data, plus the
# same client tools a real restore needs.
set -euo pipefail
umask 077

SRC_DB="${PHN_DRILL_SOURCE_URL:?PHN_DRILL_SOURCE_URL is required (make backup-drill-local sets it)}"
ADMIN_DB="${PHN_DRILL_ADMIN_URL:?PHN_DRILL_ADMIN_URL is required (make backup-drill-local sets it)}"
TARGET_DB_NAME=phn_restore_drill
TARGET_DB="${ADMIN_DB%/*}/$TARGET_DB_NAME"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
drop_scratch() {
  psql "$ADMIN_DB" --no-psqlrc -qc "drop database if exists $TARGET_DB_NAME;" \
    >/dev/null 2>&1 || true
}
trap 'rm -rf "$work"; drop_scratch' EXIT

# These are the same tools a real restore needs, so requiring them here is part
# of what the drill proves. `pg_dump`/`pg_restore`/`psql` come from libpq.
for tool in pg_dump pg_restore psql age rclone jq; do
  command -v "$tool" >/dev/null || {
    echo "Missing required tool: $tool" >&2
    echo "Install with: brew install libpq age rclone jq" >&2
    exit 1
  }
done

# A drill against an empty database passes vacuously — 0 rows restore to 0 rows
# and prove nothing moved. Refuse to report success on that.
src_projects="$(psql "$SRC_DB" --no-psqlrc -tAc "select count(*) from projects;")"
[ "$src_projects" -gt 0 ] || {
  echo "Source database has no projects — a drill against it would prove nothing." >&2
  echo "Seed it first (make db-seed), then re-run." >&2
  exit 1
}

echo "== drill: throwaway keypair"
age-keygen -o "$work/identity.txt" 2>"$work/keygen.err"
recipient="$(grep -o 'age1[0-9a-z]*' "$work/keygen.err" | head -1)"
[ -n "$recipient" ] || { echo "Could not derive a recipient from age-keygen." >&2; exit 1; }

echo "== drill: back up $src_projects projects into a local store"
# FORCE_MONTHLY exercises the monthly-copy branch, which otherwise only runs on
# the 1st — i.e. the least-tested line in the system, against production.
key="$(
  PHN_BACKUP_STORE="$work/store" \
  PHN_BACKUP_FORCE_MONTHLY=1 \
  BACKUP_DATABASE_URL="$SRC_DB" \
  AGE_RECIPIENT="$recipient" \
  "$here/backup.sh"
)"

echo "== drill: verify the monthly copy was written"
[ "$(find "$work/store/monthly" -name '*.dump.age' | wc -l)" -ge 1 ] || {
  echo "No monthly object was written." >&2; exit 1; }

echo "== drill: create scratch database $TARGET_DB_NAME"
psql "$ADMIN_DB" --no-psqlrc -qc "drop database if exists $TARGET_DB_NAME;" \
  -c "create database $TARGET_DB_NAME;"

echo "== drill: restore (newest in store, resolved by the same helper CI uses)"
PHN_BACKUP_STORE="$work/store" "$here/restore.sh" "$TARGET_DB" "$work/identity.txt"

echo "== drill: compare source and restored row counts"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=config.sh
PHN_BACKUP_STORE="$work/store" . "$here/config.sh"
counts() { psql "$1" --no-psqlrc -tAc "$(row_counts_sql)"; }
src_counts="$(counts "$SRC_DB")"
dst_counts="$(counts "$TARGET_DB")"
if [ "$src_counts" != "$dst_counts" ]; then
  echo "MISMATCH — source vs restored:" >&2
  diff <(echo "$src_counts") <(echo "$dst_counts") >&2 || true
  exit 1
fi
echo "$src_counts" | while IFS= read -r line; do echo "    $line"; done

echo "== drill: verify document bodies survived as JSON"
bad="$(psql "$TARGET_DB" --no-psqlrc -tAc \
  "select count(*) from project_versions where jsonb_typeof(body) is distinct from 'object';")"
[ "$bad" = "0" ] || { echo "$bad project_versions rows have a non-object body." >&2; exit 1; }

echo
echo "DRILL PASSED — restored $key; counts matched and document bodies are intact."
echo "Scratch database and throwaway key are removed on exit."
