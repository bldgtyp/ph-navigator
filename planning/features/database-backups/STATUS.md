---
DATE: 2026-07-20
TIME: 15:55 EDT
STATUS: OPERATING — first production backup + restore drill passed 2026-07-20
AUTHOR: Claude (Opus) with Ed May
SCOPE: Live state ledger for the database-backups feature.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./decisions.md
  - ../../../context/DATABASE_BACKUPS.md
---

# STATUS — Database Backups

## State: OPERATING

All seven phases are done. The first production backup ran green on 2026-07-20
(run `29773541404`, 967 KB, 26 tables) and was restored and verified the same
day. Backups now run daily at 06:30 UTC.

| Phase | State |
| --- | --- |
| 00 R2 bucket + tokens + lifecycle | ✅ bucket, 30/365 lifecycle, 2 scoped tokens; read token write-denial verified |
| 01 `phn_backup` read-only role | ✅ created; dumps 26 tables; `CREATE TABLE` denied |
| 02 age keypair + GitHub secrets | ✅ identity offline; 4 secrets + 2 variables set |
| 03 Daily backup workflow | ✅ built (merged, `fd8c54c3`) |
| 04 Weekly Dropbox pull | ✅ script + plist + `.last-success` stamp built; Ed installs |
| 05 Restore + drill | ✅ **production drill PASSED** — counts matched, bodies intact |
| 06 Docs + closeout | ✅ runbook + router wiring; drill logged. Ready to archive |

## What is proven, and what is not

**Proven:** `make backup-drill-local` runs the real `backup.sh` → `restore.sh`
round-trip against local Postgres and passes — 56 projects / 56 project_versions
/ 17 users / 31 drafts restored, counts matched, `project_versions.body` intact
as JSON, and the monthly-copy branch exercised. The drill refuses to run against
an empty database (negative-tested). `shellcheck -x` clean on all five scripts.

D-11 was accepted and implemented: the backup body moved out of the workflow
into `ops/backup/backup.sh` over a shared `config.sh`. It paid for itself
immediately — the first drill run caught two real bugs (`${VAR:=default}`
overriding a deliberately empty store, and BSD `wc -c` padding breaking a size
comparison) that would otherwise have surfaced as a failed 02:30 production job.

**Proven in production (2026-07-20):** the workflow dumped the real database
(966,938 bytes, 26 tables), encrypted it to the real recipient, and stored it at
`daily/ph_navigator/2026/07/ph_navigator-20260720T194939Z.dump.age`. Restoring
that object with the offline identity reproduced production exactly — 2 users /
5 projects / 7 project_versions / 0 drafts, all `body` values intact JSON. The
run log contains no credential material.

**Found by doing it:** `create-readonly-role.sql` granted SELECT on tables but
not sequences, so `pg_dump` failed on `user_action_log_id_seq`. Fixed in the
file. Also: the live database is `ph_navigator_74vs`, not the `ph_navigator`
declared in `render.prod.yaml` — Render appends a suffix, and no file in this
repo had the real name. Now recorded in the runbook.

## Remaining

1. Move `~/Downloads/phn-backup-identity.txt` into Apple Passwords and the
   Dropbox key store, then delete it from Downloads. **Until this is done the
   only copy of the decryption key is in a Downloads folder.**
2. Install the launchd job for the weekly Dropbox pull (Phase 04).
3. Delete the Phase 02 scratchpad file.
4. Archive this folder per `planning/.instructions.md`.

## Open questions still unanswered

1. **Workspace plan / PITR window** — Hobby (3-day) or Pro+ (7-day)? Affects only
   how much weight the off-site layer carries.
2. **Read-only role feasibility (D-4)** — can the Render primary user
   `CREATE ROLE`? Phase 01 verifies; the fallback is documented.
3. **Dropbox destination path** — the scripts default to
   `~/Dropbox/bldgtyp-00/00_PH_Tools/_backups/phn-db/`, overridable via
   `PHN_BACKUP_DROPBOX_DIR`. Confirm it is where you want it.
4. **Schedule time** — currently 06:30 UTC (≈ 02:30 ET). Fine?
5. **Second Cloudflare account** for true provider isolation — deferred; the
   Dropbox pull already provides cross-provider independence.

Items 3 and 4 are now defaults in code rather than proposals, so they only need
attention if you disagree.

## Definition of done

The feature is done when a **production** restore drill has reproduced
production row counts from an off-site encrypted dump, and that drill is logged
in `context/DATABASE_BACKUPS.md`. Then archive this folder per
`planning/.instructions.md`.
