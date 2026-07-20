---
DATE: 2026-07-20
TIME: 10:20 EDT
STATUS: In progress — criteria 1-4 built but unproven in production; 5-6 pending drill
AUTHOR: Claude (Opus) with Ed May
SCOPE: Behavior contract and success criteria for independent, off-site,
  encrypted Postgres backups + tested restore.
RELATED:
  - ./README.md
  - ./decisions.md
  - ../../../context/DATA_STORAGE.md
  - ../../../context/PRODUCTION_DEPLOYMENT.md
---

# PRD — Database Backups

## 1. Problem

We rely 100% on Render's built-in backups. There is **no backup tooling in the
repo today** (no `pg_dump`, no scheduled job). Render's protection is inside
Render and short-window. We want a copy of the production database that:

- lives outside the Render account (survives its total loss),
- is retained far longer than 3–7 days,
- is encrypted at rest wherever it lands (the dump contains PII + Argon2 password
  hashes + licensed/project data, and **this repo is public**),
- can actually be restored, proven by a periodic drill.

## 2. Threat model — what a backup must survive

| Scenario | Render PITR covers it? | This feature covers it? |
|---|---|---|
| Fat-fingered data / bad delete, noticed within days | ✅ (spin up recovery instance) | ✅ (daily dump) |
| Bad migration / silent corruption noticed **after** the PITR window | ❌ (aged out) | ✅ (30 daily + 12 monthly) |
| Render account suspended (billing) / locked | ❌ (no access to anything) | ✅ (copy in R2 + Dropbox) |
| Render service or DB accidentally deleted | ❌ | ✅ |
| Render-side regional incident / data loss | ❌ | ✅ |
| Cloudflare R2 account also lost | ❌ (R2 copy gone) | ✅ (weekly Dropbox + local-disk copy) |
| Laptop lost/stolen | n/a | ✅ (dumps are age-encrypted; key is separate) |

The last two rows are why the design is **3-2-1** (≥3 copies, ≥2
providers/media, ≥1 off-site), not just "dump to R2."

## 3. Targets

- **RPO (max acceptable data loss)**: within Render's PITR window, effectively
  minutes (unchanged). For a disaster that also takes Render's backups: **≤ 24h**
  (daily dump). Weekly-only Dropbox copy gives **≤ 7 days** at the fully
  provider-independent tier.
- **RTO (time to restore)**: a documented restore into a scratch DB should take
  **< 1 hour** for someone following the runbook. This is a small database, so
  the dump and restore themselves are minutes; the budget is for locating the
  key and following steps.
- **Retention**: 30 rolling daily backups + 12 monthly backups. A corruption
  has up to a year (monthly) or a month (daily) to be caught.
- **Cadence**: daily automated; weekly independent pull.

## 4. Success criteria

1. A daily GitHub Actions run produces an age-encrypted `pg_dump` in the R2
   backup bucket, on a schedule, with `workflow_dispatch` for manual runs.
2. Backups older than retention are auto-expired by an R2 lifecycle rule.
3. A weekly job on Ed's Mac lands the same encrypted files in Dropbox + on local
   disk with no manual step.
4. The dump is **never** decryptable by anything that only holds
   GitHub/Render/R2 credentials (public-key encryption; private key offline).
5. A restore drill has been executed at least once and documented (row counts of
   `users` / `projects` / `project_versions` verified against production).
6. The runbook (`context/DATABASE_BACKUPS.md`) tells a future operator exactly
   how to restore, with zero tribal knowledge required.

## 5. Non-goals

- Not disabling or replacing Render PITR — it remains the primary
  short-window/point-in-time net; this is the disaster + long-retention layer.
- Not building self-operated continuous WAL archiving, log shipping, or hot
  standbys. Explicitly rejected as overkill (see `decisions.md` D-1).
- Not backing up the R2 asset bucket in this feature (deferred, D-9). Assets
  (datasheets, HBJSON, EPW) are largely re-derivable from the Dropbox source
  files; the DB is the irreplaceable crown jewel and comes first.
- Not backing up local dev / the V0 database.

## 6. Data being protected (from context/DATA_STORAGE.md)

The dump captures **all of Postgres**: relational metadata (Class ①) and the
versioned JSONB documents (Class ②) — including `project_versions.body`, the
immutable saved energy models. It does **not** capture object-store bytes
(Classes ③/④: assets + climate bundles) — those are R2 and out of scope here
(D-9). Cross-store integrity note: after a DB-only restore, `project_assets`
rows will point at R2 object keys; if R2 is intact those resolve, if not the
document is intact but some file bytes are missing. Acceptable for MVP.

## 7. Constraints that shape the design

- **Public repo**: no secrets, no DB URLs, no dumps in git. Ever. The workflow
  file is world-readable; all credentials are GitHub Actions secrets.
- **Render native runtime can't `apt-get pg_dump 16`** → the dump runs on a
  GitHub-hosted runner, not a Render cron job (D-2).
- **Small DB** (≤ 1 GB disk; real dump likely tens of MB) → temp-file-then-verify
  is cheap; storage cost is negligible; full logical dumps are fine (no need for
  incremental/WAL complexity).
- **Two-person firm** → operational simplicity beats sophistication. One
  scheduled workflow + one launchd job + one runbook.
