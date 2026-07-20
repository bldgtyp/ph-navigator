# ops/backup — database backup operator files

Scripts and setup artifacts for the off-site encrypted Postgres backup. Nothing
here holds a secret; every credential is entered by hand into Cloudflare, Render,
GitHub, or Apple Passwords.

**The full runbook is `context/DATABASE_BACKUPS.md`** — read that to operate or
restore. This file is just the index.

| File | What it is |
| --- | --- |
| `config.sh` | Store location + object-key scheme. One definition, sourced by every script. Not executable — it is sourced, never run. |
| `backup.sh` · `pull-to-dropbox.sh` · `restore.sh` · `drill-local.sh` | The four operational scripts. **What each does, and how to run them, is in the runbook** — this file does not repeat it. |
| `com.bldgtyp.phn-backup-pull.plist` | launchd template for the weekly pull. Replace `<REPO>` and install to `~/Library/LaunchAgents/`. |
| `create-readonly-role.sql` | Creates the least-privilege `phn_backup` role whose URL becomes `BACKUP_DATABASE_URL`. One-time setup. |
| `r2-lifecycle.json` | Object-lifecycle rules for the backup bucket (retention windows live in the file). One-time setup. |

The daily job that calls `backup.sh` is `.github/workflows/backup-db.yml`.

## Configuration

Scripts read their destination from `PHN_BACKUP_STORE` — the whole prefix in
rclone's own notation: `remote:bucket` for a cloud store, a plain path for a
local directory. Each entrypoint defaults it to what its credentials imply
(`R2:...` for the daily job, `phn-backups-ro:...` for the read-only pull and
restore, a temp directory for the drill). `backup.sh` additionally needs
`BACKUP_DATABASE_URL` and `AGE_RECIPIENT`. See `config.sh` for the details and
the key scheme.

## Verifying changes to these scripts

```bash
make backup-drill-local                      # real round-trip, local DB, no prod
shellcheck -x ops/backup/*.sh                # clean at time of writing
```

The drill exercises `backup.sh` and `restore.sh` themselves, so it catches
breakage before it reaches the nightly job. It does **not** prove the production
credentials, R2 bucket, or real age recipient are configured — that is the
quarterly production drill in the runbook.

## Applying the lifecycle rules

Enter the rules in the R2 dashboard: bucket → Settings → Object lifecycle rules.
Two rules, one per prefix, matching `r2-lifecycle.json`.

`r2-lifecycle.json` is the same policy in S3 `PutBucketLifecycleConfiguration`
shape, kept as the checked-in record of what the bucket should have. Any
S3-compatible client can apply it directly, but this repo installs no such client
for one-time setup — the dashboard is the supported path, and the file is what
you check it against.
