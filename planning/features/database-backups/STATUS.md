---
DATE: 2026-07-20
TIME: 09:40 EDT
STATUS: Phase 03 built (branch `feature/database-backups`); Phases 00–02 pending Ed
AUTHOR: Claude (Opus) with Ed May
SCOPE: Live state ledger for the database-backups feature.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./decisions.md
---

# STATUS — Database Backups

## State: Phase 03 built; no cloud resources yet

On branch `feature/database-backups`: `.github/workflows/backup-db.yml` plus the
`ops/backup/` operator files (`create-readonly-role.sql`, `r2-lifecycle.json`,
`README.md`). Nothing under `context/` yet — the runbook is Phase 06.

No cloud resources and no secrets exist. The workflow is inert until Ed
completes Phases 00–02: without the secrets it fails preflight, and it has no
push trigger, so merging it deploys nothing.

## What's decided

- Topology: daily → R2 backup bucket + weekly Dropbox pull (D-3). **Accepted.**
- Compute: GitHub Actions, not Render cron (D-2). **Accepted.**
- Everything else (D-4..D-10): proposed defaults in `decisions.md`, awaiting
  Ed's sign-off in review.

## Immediate next step

Ed does Phases 00–02 (R2 bucket + tokens, `phn_backup` role, age keypair +
GitHub secrets), then dispatches "Backup Database" for the first green run.
`ops/backup/create-readonly-role.sql` and `ops/backup/r2-lifecycle.json` are the
artifacts those phases need. Phases 04–06 (Dropbox pull, restore drill, runbook)
are agent-buildable next and only need a real object in the bucket to verify
against.

## Open questions for review

1. **Workspace plan / PITR window** — is BLDGTYP's Render workspace Hobby
   (3-day PITR) or Pro+ (7-day)? Affects only how much the off-site layer is
   relied on, not the design. (Check: Render dashboard → workspace settings.)
2. **Read-only role feasibility (D-4)** — can the Render primary DB user
   `CREATE ROLE`? Phase 01 verifies; fallback is documented.
3. **Dropbox destination path** — exact folder for `phn-db-backups/` (proposal:
   `~/Dropbox/bldgtyp-00/00_PH_Tools/_backups/phn-db/`, *outside* the public
   repo tree). Confirm.
4. **Schedule time** — proposed daily 06:30 UTC (≈ 02:30 ET EDT). OK?
5. **Retention numbers** — 30 daily / 12 monthly (D-8). OK?
6. **Second Cloudflare account** for the backup bucket (true provider isolation)
   — do now or defer? Proposal: defer; the Dropbox pull already provides
   cross-provider independence.

## Blockers

None. Ready to implement on approval.

## Verification plan (per phase)

See `PLAN.md → Verification gates`. The feature is "done" when a restore drill
has reproduced production row counts from an off-site encrypted dump and the
runbook is in `context/`.
