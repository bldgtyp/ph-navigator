---
DATE: 2026-07-19
TIME: 16:20 EDT
STATUS: Planned
AUTHOR: Claude (Opus) with Ed May
SCOPE: Provision the dedicated R2 backup bucket, scoped tokens, and lifecycle.
OWNER: Ed (Cloudflare dashboard / API)
RELATED:
  - ../decisions.md  # D-3, D-6, D-8, D-9
  - ../../../../context/DATA_STORAGE.md
---

# Phase 00 — R2 backup bucket, tokens, and lifecycle

**Goal:** a private R2 bucket that only backup tooling can reach, with a
**write-only** token for the daily job, a **read-only** token for the weekly
pull, and lifecycle rules that auto-expire old dumps.

**Why a separate bucket (not `ph-navigator-prod`):** blast-radius isolation. The
app's R2 credentials can't touch backups and vice-versa; a bug or compromise in
one path can't corrupt the other. Same Cloudflare account is fine for now — the
Dropbox pull (Phase 04) provides the cross-provider copy (D-3, D-9).

## Steps (Ed, Cloudflare dashboard)

1. **Create the bucket.** R2 → Create bucket.
   - Name: `phn-db-backups` (or `ph-navigator-backups`).
   - Location: ENAM (same hint as prod; not critical for backups).
   - Public access: **off**. No `r2.dev`, no custom domain, no CORS. This bucket
     is never browser-facing.

2. **Create the write-only token (daily job).** R2 → Manage R2 API Tokens →
   Create API Token.
   - Permissions: **Object Read & Write**, scoped to **only** `phn-db-backups`.
     (R2 has no pure "write-only"; "Object Read & Write on this one bucket" is
     the tightest standard scope. The dump is age-encrypted regardless, so read
     access to ciphertext via this token is not a decryption risk.)
   - Record: Access Key ID, Secret Access Key, and the S3 endpoint
     `https://<account-id>.r2.cloudflarestorage.com`.
   - These become GitHub secrets in Phase 02 — store in Apple Passwords now.

3. **Create the read-only token (weekly pull).** Another API token:
   - Permissions: **Object Read only**, scoped to **only** `phn-db-backups`.
   - Record Access Key ID / Secret. Goes into Ed's Mac rclone config in Phase 04
     (Apple Passwords / Keychain — never in Dropbox, never in the repo).

4. **Apply lifecycle rules.** R2 → the bucket → Settings → Object lifecycle
   rules. Add two rules (or apply `ops/backup/r2-lifecycle.json` via the S3 API,
   Phase 03 note):
   - `daily/` → delete objects **30 days** after creation.
   - `monthly/` → delete objects **365 days** after creation.

   Proposed `ops/backup/r2-lifecycle.json` (S3 `PutBucketLifecycleConfiguration`
   shape, apply-able with `aws s3api ... --endpoint-url <r2>` or rclone):

   ```json
   {
     "Rules": [
       { "ID": "expire-daily-30d",
         "Filter": { "Prefix": "daily/" },
         "Status": "Enabled",
         "Expiration": { "Days": 30 } },
       { "ID": "expire-monthly-365d",
         "Filter": { "Prefix": "monthly/" },
         "Status": "Enabled",
         "Expiration": { "Days": 365 } }
     ]
   }
   ```

## Key layout inside the bucket (set by the Phase 03 job)

```
daily/ph_navigator/<YYYY>/<MM>/ph_navigator-<YYYYMMDD>T<HHMMSS>Z.dump.age
monthly/ph_navigator/<YYYY>/ph_navigator-<YYYY-MM>.dump.age
```

## Verification

- Bucket exists, public access disabled, no CORS.
- Two tokens exist, each scoped to **only** this bucket.
- `rclone lsd R2:phn-db-backups` (with the write token configured) lists the
  bucket without error.
- Lifecycle rules visible in the dashboard.

## Rollback

Delete the two API tokens, then delete the bucket. No other resource references
it until Phase 03.

## Hand-off to Phase 02

Ed holds (in Apple Passwords): bucket name, endpoint URL, write-token key/secret,
read-token key/secret. These feed the GitHub secrets and the Mac rclone config.
