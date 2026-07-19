---
DATE: 2026-07-19
TIME: 16:20 EDT
STATUS: Planned
AUTHOR: Claude (Opus) with Ed May
SCOPE: Weekly pull of the R2 backup bucket to a Dropbox folder on Ed's Mac, so a
  copy lives on hardware Ed controls (the truly provider-independent tier).
OWNER: Agent builds the script + plist; Ed installs on his Mac.
RELATED:
  - ../decisions.md  # D-3
---

# Phase 04 — Weekly Dropbox pull

**Goal:** once a week, sync the encrypted backup objects from R2 down to a
Dropbox folder on Ed's Mac. That gives a copy on local disk **and** in Dropbox
cloud — the copy that survives losing both Render and Cloudflare. Files stay
age-encrypted throughout; the private key is **not** on this path.

## Prereqs (Ed, one-time)

```bash
brew install rclone
```

Configure a **read-only** R2 remote using the Phase 00 read token. Keep this
config in the default `~/.config/rclone/rclone.conf` (Ed's home, not Dropbox, not
the repo):

```bash
rclone config create phn-backups-ro s3 \
  provider=Cloudflare \
  access_key_id=<READ-ONLY key id> \
  secret_access_key=<READ-ONLY secret> \
  endpoint=https://<account-id>.r2.cloudflarestorage.com \
  acl=private
```

Confirm the destination folder is **outside** the public repo and outside the
key store:

```
~/Dropbox/bldgtyp-00/00_PH_Tools/_backups/phn-db/
```

## Proposed `ops/backup/pull-to-dropbox.sh`

```bash
#!/usr/bin/env bash
# Weekly: mirror the R2 DB-backup bucket into a Dropbox folder on this Mac.
# Files are age-encrypted; this script never decrypts and needs no key.
set -euo pipefail

REMOTE="phn-backups-ro:phn-db-backups"
DEST="$HOME/Dropbox/bldgtyp-00/00_PH_Tools/_backups/phn-db"
LOG="$HOME/Library/Logs/phn-backup-pull.log"

mkdir -p "$DEST"
{
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) pull start ==="
  # Mirror daily/ and monthly/. --immutable: never rewrite an existing object
  # (dumps are write-once). No --delete: keep the full local history even after
  # R2 lifecycle expires the cloud copy, so the Dropbox tier retains longer.
  rclone copy "$REMOTE" "$DEST" --immutable --create-empty-src-dirs -v
  newest="$(ls -t "$DEST"/daily/ph_navigator/*/*/*.age 2>/dev/null | head -1 || true)"
  echo "newest daily local: ${newest:-<none>}"
  echo "=== $(date -u +%Y-%m-%dT%H:%M:%SZ) pull done ==="
} >> "$LOG" 2>&1
```

> Design choice: **no `--delete`**. R2 lifecycle prunes the cloud side (30/365
> days). The Dropbox tier intentionally keeps everything it has ever pulled, so
> the on-your-hardware copy can outlast the cloud retention. If that grows too
> large years out, add a dated prune later — a good problem to have.

## Proposed `ops/backup/com.bldgtyp.phn-backup-pull.plist` (launchd template)

Install to `~/Library/LaunchAgents/`. Runs Sundays at 09:00 local. `<REPO>` is
replaced with the absolute path to the checked-out repo (or copy the script to a
stable path and point at that).

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>            <string>com.bldgtyp.phn-backup-pull</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string><REPO>/ops/backup/pull-to-dropbox.sh</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>0</integer>   <!-- Sunday -->
    <key>Hour</key><integer>9</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <!-- launchd runs a missed StartCalendarInterval job once after wake. -->
  <key>StandardOutPath</key>  <string>/tmp/phn-backup-pull.out</string>
  <key>StandardErrorPath</key><string>/tmp/phn-backup-pull.err</string>
</dict>
</plist>
```

Install / load:

```bash
cp ops/backup/com.bldgtyp.phn-backup-pull.plist ~/Library/LaunchAgents/
# edit the <REPO> path first
launchctl load ~/Library/LaunchAgents/com.bldgtyp.phn-backup-pull.plist
launchctl start com.bldgtyp.phn-backup-pull      # run once now to test
```

## Verification

- After a manual `launchctl start` (or running the script directly), encrypted
  `.age` files appear under `~/Dropbox/.../_backups/phn-db/daily/…` and the
  Dropbox app shows them syncing.
- `~/Library/Logs/phn-backup-pull.log` shows a start/done pair and the newest
  file.
- The rclone remote used here is **read-only** (a write attempt would fail) —
  confirms least privilege.

## Notes / limits

- **Mac must be awake at the scheduled time** (or wake before the next weekly
  slot). launchd runs one missed occurrence on wake; if the Mac is off for a full
  week the pull is skipped — acceptable because R2 already holds dailies and this
  tier is the independence backstop, not the primary.
- The read token + rclone config live in Ed's home dir, never in Dropbox or the
  repo, so a leak of the backup files alone doesn't expose R2 credentials.

## Rollback

```bash
launchctl unload ~/Library/LaunchAgents/com.bldgtyp.phn-backup-pull.plist
rm ~/Library/LaunchAgents/com.bldgtyp.phn-backup-pull.plist
```
The Dropbox files and R2 remote are unaffected.
