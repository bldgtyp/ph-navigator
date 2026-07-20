---
DATE: 2026-07-20
TIME: 10:20 EDT
STATUS: Built — pull script + launchd template committed; Ed installs on his Mac
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

## As built

`ops/backup/pull-to-dropbox.sh` and `ops/backup/com.bldgtyp.phn-backup-pull.plist`
are committed; those files are canonical. Deltas from the sketch above:

- **Store config is shared, not hardcoded.** The script sources
  `ops/backup/config.sh` and reads `PHN_BACKUP_STORE` (default
  `phn-backups-ro:phn-db-backups`), so the remote and key scheme have one
  definition across every script — decision D-11.
- **A `.last-success` stamp** (UTC timestamp + newest key) is written into the
  destination on every successful run. This tier has no equivalent of the daily
  job's failure email — launchd records an exit nobody reads — so without a
  stamp a dead pull is undetectable. The runbook has a staleness check.
- `--fast-list` added; the `--immutable` / no-`--delete` policy is unchanged and
  its reasoning now lives in the script.
- Destination and log path are overridable (`PHN_BACKUP_DROPBOX_DIR`,
  `PHN_BACKUP_LOG`); the defaults are the paths above.

The plist install command is in the file's own header comment.

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
