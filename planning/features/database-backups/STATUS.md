---
DATE: 2026-07-19
TIME: 16:20 EDT
STATUS: Planned — implementation not started (awaiting review)
AUTHOR: Claude (Opus) with Ed May
SCOPE: Live state ledger for the database-backups feature.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./decisions.md
---

# STATUS — Database Backups

## State: Planned (review packet only)

No code, no cloud resources, no secrets created. This folder is a review
artifact. Nothing under `.github/`, `ops/`, or `context/` has been written.

## What's decided

- Topology: daily → R2 backup bucket + weekly Dropbox pull (D-3). **Accepted.**
- Compute: GitHub Actions, not Render cron (D-2). **Accepted.**
- Everything else (D-4..D-10): proposed defaults in `decisions.md`, awaiting
  Ed's sign-off in review.

## Immediate next step

Ed reviews this packet (start with `phases/`). On approval, implementation
proceeds in phase order per `PLAN.md`. Agent can build Phases 03–06 (code +
docs) into a branch/PR immediately; Ed does the console/secret steps of Phases
00–02 in parallel.

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
