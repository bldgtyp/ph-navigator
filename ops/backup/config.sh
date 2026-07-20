#!/usr/bin/env bash
# Shared configuration for the PH-Navigator database backup scripts.
#
# Sourced by backup.sh, pull-to-dropbox.sh, restore.sh, and drill-local.sh so the
# store location and the object-key scheme have exactly ONE definition. A key
# layout change here reaches every consumer; spelled out per script, a mismatch
# would surface as an empty result rather than an error.
#
# PHN_BACKUP_STORE is the whole destination prefix, in rclone's own notation —
# "remote:bucket" for a cloud store, a plain path for a local directory. Each
# entrypoint defaults it to what its credentials imply:
#   backup.sh        "R2:<bucket>"              env-configured write remote in CI
#   pull / restore   "phn-backups-ro:<bucket>"  named read-only remote on a Mac
#   drill-local.sh   "<tmpdir>/store"           a directory, so the drill needs
#                                               no cloud and no real credentials
#
# One variable, no empty-string convention: a store is a store, and there is no
# way to half-configure one into accidentally pointing at production.
#
# This file only defines variables and functions — it runs nothing.

: "${PHN_BACKUP_STORE:?PHN_BACKUP_STORE is required (see ops/backup/config.sh)}"

# Base name for every object. Deliberately a constant, not a knob: it is baked
# into every key ever written, so changing it orphans the existing history.
# Kept distinct from the database name so renaming one cannot retarget the other.
PHN_BACKUP_BASENAME=ph_navigator

DAILY_PREFIX="daily/$PHN_BACKUP_BASENAME"
MONTHLY_PREFIX="monthly/$PHN_BACKUP_BASENAME"

# Full rclone path for a key.
backup_path() {
  printf '%s/%s' "$PHN_BACKUP_STORE" "$1"
}

# Size of a file in bytes. `stat` is O(1) on both GNU (-c) and BSD/macOS (-f),
# unlike `wc -c`, which may read the whole file.
file_bytes() {
  stat -c%s "$1" 2>/dev/null || stat -f%z "$1"
}

# Key for a daily backup taken at UTC timestamp $1 (YYYYMMDDTHHMMSSZ).
# Nested by year/month purely so the store stays browsable.
daily_key() {
  local ts="$1"
  printf '%s/%s/%s/%s-%s.dump.age' \
    "$DAILY_PREFIX" "${ts:0:4}" "${ts:4:2}" "$PHN_BACKUP_BASENAME" "$ts"
}

# Key for the retained monthly copy covering the month of timestamp $1.
monthly_key() {
  local ts="$1"
  printf '%s/%s/%s-%s-%s.dump.age' \
    "$MONTHLY_PREFIX" "${ts:0:4}" "$PHN_BACKUP_BASENAME" "${ts:0:4}" "${ts:4:2}"
}

# Key of the newest daily backup in a store, or nothing if there are none.
# Always succeeds: "no backups" is a normal answer callers must handle, not an
# error that should abort them under `set -e`.
# $1 overrides the store (used to inspect a local mirror).
latest_daily_key() {
  local store="${1:-$PHN_BACKUP_STORE}" newest
  newest="$(rclone lsf --files-only --recursive --fast-list \
    --include '*.dump.age' "$store/$DAILY_PREFIX" 2>/dev/null | sort | tail -1)"
  [ -n "$newest" ] && printf '%s/%s' "$DAILY_PREFIX" "$newest"
  return 0
}

# Row counts for the tables that prove a restore carried real data. One
# definition so the restore output and the drill's comparison cannot disagree.
row_counts_sql() {
  cat <<'SQL'
select 'users' as t, count(*) as n from users
union all select 'projects', count(*) from projects
union all select 'project_versions', count(*) from project_versions
union all select 'project_version_drafts', count(*) from project_version_drafts
order by t;
SQL
}
