# ops/backup — database backup operator files

Supporting files for the off-site encrypted Postgres backup. Nothing here holds
a secret; every credential is entered by hand into Cloudflare, Render, GitHub, or
Apple Passwords.

| File | Used in | What it does |
| --- | --- | --- |
| `create-readonly-role.sql` | one-time setup | Creates the least-privilege `phn_backup` role whose URL becomes the `BACKUP_DATABASE_URL` secret. |
| `r2-lifecycle.json` | one-time setup | Object-lifecycle rules for the backup bucket (the retention windows live in the file). |

The daily job itself is `.github/workflows/backup-db.yml`.

## Bucket layout

Keys as produced by `backup-db.yml`, which is canonical:

```
daily/ph_navigator/<YYYY>/<MM>/ph_navigator-<YYYYMMDD>T<HHMMSS>Z.dump.age
monthly/ph_navigator/<YYYY>/ph_navigator-<YYYY-MM>.dump.age
```

## Applying the lifecycle rules

Enter the rules in the R2 dashboard: bucket → Settings → Object lifecycle rules.
Two rules, one per prefix, matching `r2-lifecycle.json`.

`r2-lifecycle.json` is the same policy in S3
`PutBucketLifecycleConfiguration` shape, kept as the checked-in record of what
the bucket should have. Any S3-compatible client can apply it directly, but this
repo installs no such client for one-time setup — the dashboard is the supported
path, and the file is what you check it against.

## Restoring

Restore steps live in the runbook, not here: `context/DATABASE_BACKUPS.md`.
Setup and rationale for each piece: `planning/features/database-backups/`.
