---
DATE: 2026-07-20
TIME: 10:20 EDT
STATUS: In progress — Phases 03-06 built; Phases 00-02 (Ed) gate everything
AUTHOR: Claude (Opus) with Ed May
SCOPE: Add an independent, off-site, encrypted backup of the production
  PH-Navigator Postgres database (the versioned JSONB project documents +
  relational metadata) that survives a total loss of the Render account, and a
  documented restore path. Render's built-in PITR is retained as the primary
  short-window safety net; this adds the long-retention, provider-independent
  layer it does not provide.
RELATED:
  - ./PRD.md
  - ./PLAN.md
  - ./STATUS.md
  - ./decisions.md
  - ./phases/phase-00-r2-backup-bucket.md
  - ./phases/phase-01-readonly-role.md
  - ./phases/phase-02-encryption-keys.md
  - ./phases/phase-03-github-actions-daily-backup.md
  - ./phases/phase-04-weekly-dropbox-pull.md
  - ./phases/phase-05-restore-runbook-and-drill.md
  - ./phases/phase-06-docs-and-closeout.md
  - ../../../context/PRODUCTION_DEPLOYMENT.md
  - ../../../context/DATA_STORAGE.md
---

# Database Backups

Planning router for adding independent, off-site, encrypted backups of the
production Postgres database, plus a tested restore path.

## Why this exists (one paragraph)

The production DB (`ph-navigator-db`, Render managed PG16, `basic_256mb`, 1 GB
disk, Ohio) holds the **versioned JSONB project documents** — the actual energy
models — and all relational metadata (users, sessions, catalogs, the asset
registry, the audit log). As PHN takes over as the firm's system-of-record off
AirTable, that data is irreplaceable. Render's built-in backups (continuous
PITR, 3-day window on a Hobby workspace / 7-day on Pro+, plus manually-triggered
logical backups retained 7 days) are real but have two gaps: **(1)** every copy
lives inside Render, so an account compromise, billing suspension, accidental
service deletion, or a Render-side incident takes the data *and* its backups at
once; **(2)** the 3–7 day window means a silent corruption or bad migration
discovered a week later is unrecoverable. This feature closes both gaps.

## Read order

1. `PRD.md` — what we protect against, targets (RPO/RTO), retention, scope.
2. `decisions.md` — the choices already made and the alternatives rejected.
3. `PLAN.md` — the phase map, the who-does-what matrix, and cost.
4. `phases/phase-00..06` — the detailed, step-by-step runbooks. Each phase marks
   whether Ed or the agent owns each step, gives exact commands, a verification
   check, and a rollback. Phase 03 is built; the rest are still plans.
5. `STATUS.md` — current state, immediate next step, open questions.

## Shape at a glance

```
DAILY  (GitHub Actions, ~02:30 ET)
  pg_dump -Fc (read-only role, external URL)
    → age encrypt (public key; private key stays offline)
      → rclone → R2 backup bucket   daily/…  (kept 30 days)
                                     monthly/… on the 1st (kept 12 months)

WEEKLY (launchd on Ed's Mac, Sun ~09:00)
  rclone sync  R2 backup bucket → ~/Dropbox/…/phn-db-backups/
    → encrypted copies on local disk + Dropbox cloud   (real 3-2-1)

RESTORE (on demand + quarterly drill)
  rclone pull → age -d (offline identity) → pg_restore into a scratch DB → verify
```

## What is NOT in scope (see PRD §Non-goals)

- Replacing or disabling Render's built-in PITR — it stays as the primary
  short-window net.
- Self-operated continuous WAL archiving / hot standbys — overkill for a
  two-person firm.
- R2 asset-bucket (`ph-navigator-prod`) backup — tracked as a deferred,
  lower-priority follow-up in `decisions.md` (D-9), not built here.
