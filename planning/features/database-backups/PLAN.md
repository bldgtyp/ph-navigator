---
DATE: 2026-07-19
TIME: 16:20 EDT
STATUS: Planned — implementation not started
AUTHOR: Claude (Opus) with Ed May
SCOPE: High-level implementation sequence, ownership, and cost for the
  database-backups feature.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./decisions.md
  - ./phases/
---

# PLAN — Database Backups

## Phase map

| # | Phase | Owner | Output | Depends on |
|---|---|---|---|---|
| 00 | R2 backup bucket + tokens + lifecycle | **Ed** (console) | Bucket, write-only token, read-only token, lifecycle rules | — |
| 01 | Read-only Postgres backup role | **Ed** (SQL) | `phn_backup` role + external URL (or documented fallback) | — |
| 02 | Encryption keypair (`age`) + secret storage | **Ed** (local + console) | age identity offline; recipient public key; all GitHub secrets set | 00, 01 |
| 03 | GitHub Actions daily backup workflow | **Agent** builds · **Ed** enables | `.github/workflows/backup-db.yml` + first green run | 00, 01, 02 |
| 04 | Weekly Dropbox pull (launchd) | **Agent** builds · **Ed** installs | `ops/backup/` pull script + launchd plist on Mac | 00, 03 |
| 05 | Restore runbook + first drill | **Agent** builds · **Ed** runs drill | `ops/backup/restore.sh` + verified restore | 02, 03 |
| 06 | Docs + closeout | **Agent** | `context/DATABASE_BACKUPS.md`, dispatch-table row, cross-links | all |

Critical path: 00/01 → 02 → 03 → (04, 05) → 06. Phases 00 and 01 are
independent and can be done in either order. 04 and 05 are independent once 03 is
green.

## Ownership summary

- **Ed-only (needs console / secrets / hardware):** create the R2 bucket +
  tokens (00), create the DB role (01), generate + store the age identity and set
  GitHub secrets (02), install the launchd job (04), run the restore drill (05).
- **Agent-buildable (code + docs, reviewable in a PR, no secrets):** the workflow
  YAML (03), the `ops/backup/` scripts + plist template (04, 05), the runbook and
  doc wiring (06).

Nothing the agent writes contains a secret. Everything secret is entered by Ed
into Render, Cloudflare, GitHub, or his keychain.

## Files this feature will add (when implementation is approved)

```
.github/workflows/backup-db.yml         # Phase 03 — daily dump job
ops/backup/restore.sh                   # Phase 05 — fetch → decrypt → pg_restore → verify
ops/backup/pull-to-dropbox.sh           # Phase 04 — rclone sync R2 → Dropbox
ops/backup/com.bldgtyp.phn-backup-pull.plist   # Phase 04 — launchd template
ops/backup/r2-lifecycle.json            # Phase 00 — lifecycle rules (apply via API or dashboard)
ops/backup/create-readonly-role.sql     # Phase 01 — the phn_backup role SQL
ops/backup/README.md                    # operator index for the above
context/DATABASE_BACKUPS.md             # Phase 06 — canonical runbook
```

Plus edits: a dispatch-table row in `CLAUDE.md`, a cross-link in
`context/PRODUCTION_DEPLOYMENT.md`, and a `context/README.md` router line.

## Cost estimate

- **GitHub Actions:** free. Public-repo minutes are unlimited; the job is ~1
  minute/day.
- **R2 storage:** ~30 daily + 12 monthly of a small dump. Even at 50 MB/dump that
  is ~2 GB — under R2's 10 GB free tier. R2 egress (the weekly pull) is free.
- **Render:** $0 added (no new service; PITR already included in the DB plan).
- **Net:** ≈ $0/month. The real cost is setup time (~2–3h across the phases) plus
  a quarterly ~20-minute restore drill.

## Verification gates

- End of 03: a manual `workflow_dispatch` run produces an object in `daily/` of
  plausible size; the run log shows size but never contents/URL/creds.
- End of 04: after a manual run of the launchd script, encrypted files appear in
  the Dropbox folder and sync to the cloud.
- End of 05: a restore into a scratch DB reproduces production row counts for
  `users`, `projects`, `project_versions`; scratch DB dropped afterward.
- End of 06: `make format` clean; docs cross-links resolve; a memory note written.

## Rollback

Every phase is additive and reversible: delete the R2 bucket + tokens, drop the
`phn_backup` role, delete the GitHub secrets + workflow, `launchctl unload` the
plist, and remove the docs. No production app code, schema, or runtime path is
touched by any phase.
