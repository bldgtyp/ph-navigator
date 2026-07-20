#!/usr/bin/env bash
# Dump a PH-Navigator database, encrypt it, and store it.
#
# Driven by .github/workflows/backup-db.yml against production daily, and by
# drill-local.sh against a local database with a throwaway key. Same code path
# both ways — the drill exercises the real script, not an imitation of it.
#
# Required env:
#   BACKUP_DATABASE_URL   database to dump (read-only credentials are enough)
#   AGE_RECIPIENT         age public key; the private half stays offline
#   PHN_BACKUP_STORE      destination prefix; see config.sh (defaults to R2 here)
# Optional env:
#   PHN_BACKUP_FORCE_MONTHLY=1   also write the monthly copy on any day, so the
#                                drill can exercise a branch that would
#                                otherwise only run 12 times a year
#
# Writes one object under daily/, plus a monthly/ copy on the 1st (UTC).
# Prints the daily key on stdout; progress goes to stderr so callers can capture
# the key alone. Emits no CI-specific log syntax — the workflow owns that.
set -euo pipefail
umask 077

: "${PHN_BACKUP_STORE:=R2:${BACKUP_R2_BUCKET:-phn-db-backups}}"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=config.sh
. "$(dirname "${BASH_SOURCE[0]}")/config.sh"

# NOTE: .github/workflows/backup-db.yml preflights these same names before the
# expensive apt install. Keep the two lists in step.
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"
: "${AGE_RECIPIENT:?AGE_RECIPIENT is required}"

# Smallest plausible custom-format dump. Anything under this is a failure that
# exited 0, not a small database.
MIN_DUMP_BYTES=20000

log() { echo "$@" >&2; }
fail() { echo "$@" >&2; exit 1; }

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
ts="$(date -u +%Y%m%dT%H%M%SZ)"
dump="$work/$PHN_BACKUP_BASENAME-$ts.dump"

# 1) Consistent custom-format dump. --no-owner/--no-privileges keep a restore
#    into a fresh database clean (no Render-specific roles to satisfy).
#    Dump to a file rather than piping straight to storage: a broken pipe would
#    otherwise store a silently truncated "backup". Custom format compresses at
#    its default level; maxing it out costs several times the CPU for a percent
#    or two of size.
log "1/4 dump"
pg_dump --format=custom --no-owner --no-privileges \
  --file="$dump" "$BACKUP_DATABASE_URL"

# 2) Prove the archive is well-formed and non-trivial before it ships.
#    `pg_restore --list` parses the table of contents, catching corruption that
#    a size check alone would pass.
log "2/4 validate"
tables="$(pg_restore --list "$dump" | grep -c 'TABLE DATA' || true)"
size="$(file_bytes "$dump")"
log "    $size bytes, $tables tables"
if [ "$size" -lt "$MIN_DUMP_BYTES" ] || [ "$tables" -lt 1 ]; then
  fail "Suspect dump ($size bytes, $tables tables) — refusing to store."
fi

# 3) Encrypt to the recipient. Whoever runs this holds only the public half and
#    cannot read this or any previous backup. Drop the plaintext immediately:
#    it has no further use, and keeping it doubles peak disk on the runner.
log "3/4 encrypt"
age -r "$AGE_RECIPIENT" -o "$dump.age" "$dump"
rm -f "$dump"

# 4) Store the daily object and verify it reads back at the size we wrote.
log "4/4 store"
key="$(daily_key "$ts")"
rclone copyto "$dump.age" "$(backup_path "$key")" --s3-no-check-bucket
log "    $key"

local_enc="$(file_bytes "$dump.age")"
stored_enc="$(rclone size "$(backup_path "$key")" --json | jq -r '.bytes')"
[ "$local_enc" = "$stored_enc" ] ||
  fail "Stored size ($stored_enc) != local ($local_enc)."
log "    verified $stored_enc bytes"

# Only once the daily is verified: copy it server-side into the monthly slot, so
# a failed verification never publishes a monthly object. Byte-identical by
# construction, and costs no second upload.
if [ "$(date -u +%d)" = "01" ] || [ -n "${PHN_BACKUP_FORCE_MONTHLY:-}" ]; then
  mkey="$(monthly_key "$ts")"
  rclone copyto "$(backup_path "$key")" "$(backup_path "$mkey")" --s3-no-check-bucket
  log "    $mkey"
fi

echo "$key"
