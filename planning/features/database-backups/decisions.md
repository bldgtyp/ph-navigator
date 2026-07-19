---
DATE: 2026-07-19
TIME: 16:20 EDT
STATUS: Accepted directionally by Ed (2026-07-19); implementation pending review
AUTHOR: Claude (Opus) with Ed May
SCOPE: Decision log for the database-backups feature.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./PLAN.md
---

# Decisions — Database Backups

Two decisions were made live with Ed on 2026-07-19 (topology; compute
substrate). The rest are proposed defaults for review.

## D-1 — Add independent off-site backups; keep Render PITR (ACCEPTED)

**Decision:** Build a scheduled, encrypted, off-site logical backup in addition
to Render's built-in PITR. Do **not** build self-operated WAL archiving or hot
standbys.
**Why:** For a paid production system-of-record holding irreplaceable client
work, off-site backup is standard practice (3-2-1). The cost is a few hours +
pennies/month. Self-operated PITR/standbys are the overkill tier for a 2-person
firm — rejected.

## D-2 — Compute: GitHub Actions, not a Render cron job (ACCEPTED)

**Decision:** Run the daily dump from a scheduled GitHub Actions workflow.
**Why:** Render's **native** runtimes can't `apt-get` `pg_dump 16`, so a Render
cron job would require building and hosting a custom Docker image
(`postgres:16` + tooling) with registry creds — an image we then own and patch.
A GitHub runner gets `postgresql-client-16` in seconds, reuses the existing
`.github/workflows` machinery, is free, and runs on a third provider (more
independent, not less).
**Cost of this choice (accepted):** the runner needs the **external** DB
connection string as a GitHub secret (a Render cron job would keep it internal).
Mitigated by D-4 (read-only role) and D-5 (public-key encryption of contents).
**Rejected:** Render cron + Docker image; native Render runtime (no pg_dump 16).

## D-3 — Topology: R2 daily + weekly Dropbox pull (ACCEPTED)

**Decision:** Daily encrypted dump → dedicated R2 backup bucket; weekly
`rclone sync` of that bucket to a Dropbox folder on Ed's Mac.
**Why:** R2 is a different provider than Render and R2 egress is free. The weekly
Dropbox pull puts a copy on hardware Ed controls + Dropbox cloud, which is the
copy that survives a total Render **and** Cloudflare loss. Together = 3-2-1.
**Rejected:** R2-only (no truly-independent copy); Dropbox-only from the Mac (Mac
must be on; no clean automated primary).

## D-4 — Least-privilege DB access: dedicated read-only role (PREFERRED, verify)

**Decision:** Create a `phn_backup` login role with `SELECT`-only on `public`,
and give GitHub only that credential.
**Why:** A leaked backup credential should not be able to write/drop production.
`pg_dump` only needs read access.
**Risk / fallback:** Render's primary DB user may lack `CREATEROLE`. Phase 01
verifies this. If a role can't be created, fall back to the primary connection
string as the GitHub secret (the dump contents are still protected by D-5;
rotate on suspicion). Mark the fallback explicitly in the runbook.

## D-5 — Encryption: `age` public-key, private key offline (PROPOSED)

**Decision:** Encrypt each dump with `age` to a **recipient public key**. The
matching identity (private key) is stored **offline** — Apple Passwords + a copy
in Dropbox — and used only at restore time.
**Why:** Public-key means the daily job holds only the public half, so a fully
compromised runner/R2/Render env **cannot decrypt existing backups**. This is
strictly stronger than a shared symmetric passphrase sitting in CI.
**Why `age` over GPG:** single small static binary, one-line encrypt, trivial on
both ubuntu runners (`apt-get install age`) and macOS (`brew install age`); no
keyring ceremony.
**Rejected:** symmetric passphrase in CI (a CI compromise decrypts everything);
relying only on R2/Dropbox at-rest encryption (doesn't protect against a
credentialed reader); GPG (heavier, keyring friction).

## D-6 — Transfer tool: `rclone` for both upload and pull (PROPOSED)

**Decision:** Use `rclone` (S3 backend, `provider = Cloudflare`) for the workflow
upload and the local pull.
**Why:** First-class R2 support, config entirely via env vars in CI, one tool on
both ends. Sidesteps recent `aws-cli` v2 default-checksum behavior that can 501
against S3-compatible stores like R2.
**Rejected:** `aws-cli` (checksum quirks vs R2 need workaround env vars); a
bespoke boto3 uploader (reusing the backend needs a Python+deps install on the
runner for no benefit over rclone).

## D-7 — Format & cadence: `pg_dump -Fc` custom format, daily (PROPOSED)

**Decision:** `pg_dump --format=custom --no-owner --no-privileges`, once daily.
**Why:** Custom format is compressed and supports selective/parallel
`pg_restore`; `--no-owner/--no-privileges` make restore into a fresh DB clean.
Daily (not weekly) because dumps are tiny and nearly free, and it tightens
worst-case loss. Monthly copies are just a tagged copy of a daily on the 1st.
**Rejected:** plain-SQL `-Fp` (larger, no selective restore); weekly-only (looser
RPO for no real saving).

## D-8 — Retention: 30 daily + 12 monthly, enforced by R2 lifecycle (PROPOSED)

**Decision:** Keep 30 rolling dailies under `daily/`, 12 monthlies under
`monthly/`, expired by R2 object-lifecycle rules keyed on prefix.
**Why:** A month to catch a fast problem, a year to catch a slow one; expiry is
automatic so storage never grows unbounded and no manual pruning is needed.

## D-9 — R2 asset-bucket backup: DEFERRED (PROPOSED)

**Decision:** Do not back up `ph-navigator-prod` (asset bytes) in this feature.
Track as a follow-up: enable R2 bucket versioning and, if desired, a periodic
`rclone sync` of the asset bucket to Dropbox/second provider.
**Why:** The DB is the irreplaceable crown jewel; most asset bytes are
re-derivable from the Dropbox source files. Lower priority; keep this feature
focused. R2 is also independently very durable.

## D-10 — Trigger safety on a public repo (PROPOSED)

**Decision:** The workflow uses only `schedule` + `workflow_dispatch` — never
`pull_request`. Secrets are unavailable to fork PRs by construction.
**Why:** Prevents a fork PR from ever executing the backup job or reading the
backup/DB secrets.
