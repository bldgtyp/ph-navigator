#!/usr/bin/env bash
# Weekly: mirror the R2 DB-backup store into a Dropbox folder on this Mac.
#
# This is the provider-independent tier — a copy on hardware you control plus
# Dropbox cloud, which survives losing both Render and Cloudflare. Files stay
# age-encrypted the whole way: this script never decrypts and needs no key.
#
# Installed as a launchd job; see com.bldgtyp.phn-backup-pull.plist.
set -euo pipefail

# Read-only remote (Phase 00 read token, configured in ~/.config/rclone).
: "${PHN_BACKUP_STORE:=phn-backups-ro:phn-db-backups}"
# shellcheck source-path=SCRIPTDIR
# shellcheck source=config.sh
. "$(dirname "${BASH_SOURCE[0]}")/config.sh"

DEST="${PHN_BACKUP_DROPBOX_DIR:-$HOME/Dropbox/bldgtyp-00/00_PH_Tools/_backups/phn-db}"
LOG="${PHN_BACKUP_LOG:-$HOME/Library/Logs/phn-backup-pull.log}"
STAMP="$DEST/.last-success"

mkdir -p "$DEST" "$(dirname "$LOG")"
{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) pull start ==="

  # --immutable: dumps are write-once, so a changed object is corruption or
  # tampering and should fail loudly rather than overwrite the local copy.
  # No --delete: R2 lifecycle prunes the cloud side (30/365 days), but this tier
  # deliberately keeps everything it has ever pulled, so the copy on your own
  # hardware can outlast cloud retention. If it grows unwieldy years out, add a
  # dated prune then — that is a good problem to have.
  rclone copy "$PHN_BACKUP_STORE" "$DEST" \
    --immutable --create-empty-src-dirs --fast-list -v

  # Report what actually landed on disk, not what R2 holds.
  newest="$(latest_daily_key "$DEST")"
  echo "newest daily local: ${newest:-<none>}"

  # Success stamp. This tier has no equivalent of the daily job's failed-run
  # email — launchd records a nonzero exit that nobody reads — so the stamp is
  # what makes a silently dead pull (expired token, renamed folder, --immutable
  # conflict) detectable. The runbook checks its age.
  printf '%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${newest:-<none>}" >"$STAMP"

  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) pull done ==="
} >>"$LOG" 2>&1
