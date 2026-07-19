---
DATE: 2026-07-19
TIME: 16:20 EDT
STATUS: Planned
AUTHOR: Claude (Opus) with Ed May
SCOPE: Generate the age keypair, store the private identity offline, and set all
  GitHub Actions secrets/variables.
OWNER: Ed (local machine + GitHub settings)
RELATED:
  - ../decisions.md  # D-5, D-10
---

# Phase 02 — Encryption keys and secrets

**Goal:** the daily job can encrypt but not decrypt. The private key that can
decrypt backups lives **only** offline. All credentials are set as GitHub
Actions secrets — never in the repo.

## Step 1 — Generate the age keypair (Ed's Mac)

```bash
brew install age                      # if not present
age-keygen -o phn-backup-identity.txt
# prints: Public key: age1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxq9k...
```

- `phn-backup-identity.txt` is the **private identity**. Anyone with it can
  decrypt every backup. It is the single most sensitive artifact in this system.
- The `age1...` string is the **recipient public key**. Not secret; safe to put
  in CI as a variable.

## Step 2 — Store the private identity offline (two copies, no CI)

- **Copy 1:** paste the full contents of `phn-backup-identity.txt` into Apple
  Passwords as a secure note (e.g. "PHN DB Backup — age identity").
- **Copy 2:** save the file into a private, non-repo Dropbox location (e.g.
  `~/Dropbox/bldgtyp-00/00_PH_Tools/_backups/_keys/phn-backup-identity.txt`).
  Rationale: if the Mac dies, the key that unlocks the Dropbox-stored backups
  must not die with it — but it must live **outside** the `phn-db-backups/`
  folder so a leak of the backup files alone is still useless.
- **Then delete** the working copy from the Downloads/CWD:
  `shred -u phn-backup-identity.txt` (or move it into the secure location).
- **Never** put the identity in GitHub, Render, R2, the repo, or any CI system.

> Key-loss = permanent backup loss. Key-leak = all backups readable. Both copies
> above are private stores Ed already controls; the split (Passwords + Dropbox)
> guards against losing one.

## Step 3 — Set GitHub Actions secrets and variables

Repo: `bldgtyp/ph-navigator` → Settings → Secrets and variables → Actions.

**Secrets** (encrypted; unreadable after entry):

| Name | Value | From |
|---|---|---|
| `BACKUP_DATABASE_URL` | read-only role URL (or fallback) | Phase 01 |
| `BACKUP_R2_ACCESS_KEY_ID` | write-token access key id | Phase 00 |
| `BACKUP_R2_SECRET_ACCESS_KEY` | write-token secret | Phase 00 |
| `BACKUP_R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` | Phase 00 |

**Variables** (non-secret; visible — fine):

| Name | Value |
|---|---|
| `BACKUP_R2_BUCKET` | `phn-db-backups` |
| `BACKUP_AGE_RECIPIENT` | `age1...` public key from Step 1 |

CLI equivalent (Ed, authenticated `gh`):

```bash
gh secret set BACKUP_DATABASE_URL       --repo bldgtyp/ph-navigator   # paste value
gh secret set BACKUP_R2_ACCESS_KEY_ID   --repo bldgtyp/ph-navigator
gh secret set BACKUP_R2_SECRET_ACCESS_KEY --repo bldgtyp/ph-navigator
gh secret set BACKUP_R2_ENDPOINT        --repo bldgtyp/ph-navigator
gh variable set BACKUP_R2_BUCKET        --repo bldgtyp/ph-navigator --body "phn-db-backups"
gh variable set BACKUP_AGE_RECIPIENT    --repo bldgtyp/ph-navigator --body "age1..."
```

## Step 4 — Local decrypt sanity check (proves the key works before relying on it)

```bash
echo "hello backup" | age -r "age1..." -o /tmp/t.age
age -d -i "<path to phn-backup-identity.txt>" /tmp/t.age   # must print: hello backup
rm -f /tmp/t.age
```

## Verification

- `gh secret list` / `gh variable list` show all six entries.
- The Step 4 round-trip prints the cleartext (public key encrypts, identity
  decrypts).
- The identity file exists in both offline stores and **not** in the repo,
  GitHub, R2, or the `phn-db-backups` bucket.

## Rollback

Delete the GitHub secrets/variables. To rotate the encryption key later:
generate a new keypair, update `BACKUP_AGE_RECIPIENT`; old backups still need the
old identity to decrypt, so retain retired identities until their backups expire.

## Hand-off to Phase 03

All secrets/variables the workflow references now exist. The agent can wire the
workflow to them.
