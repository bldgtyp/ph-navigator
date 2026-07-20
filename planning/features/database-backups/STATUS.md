---
DATE: 2026-07-20
TIME: 10:20 EDT
STATUS: All agent-buildable phases built; Phases 00-02 + production drill are Ed's
AUTHOR: Claude (Opus) with Ed May
SCOPE: Live state ledger for the database-backups feature.
RELATED:
  - ./README.md
  - ./PLAN.md
  - ./decisions.md
  - ../../../context/DATABASE_BACKUPS.md
---

# STATUS — Database Backups

## State: code complete, not yet operating

Phases 03–06 are built and merged/in review. Phases 00–02 need Ed at a console;
until they are done **no backup is being taken**.

| Phase | State |
| --- | --- |
| 00 R2 bucket + tokens + lifecycle | ⛔ Ed — not started |
| 01 `phn_backup` read-only role | ⛔ Ed — not started |
| 02 age keypair + GitHub secrets | ⛔ Ed — not started |
| 03 Daily backup workflow | ✅ built (merged, `fd8c54c3`) |
| 04 Weekly Dropbox pull | ✅ script + plist + `.last-success` stamp built; Ed installs |
| 05 Restore + drill | ✅ `restore.sh` + `drill-local.sh` built and passing; production drill pending 00–02 |
| 06 Docs + closeout | ✅ runbook + router wiring built; archive pending first production drill |

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

**Not proven:** anything involving production or the cloud. The workflow has
never run against the real database, no R2 bucket exists, and the real age
recipient has never encrypted anything. The local drill deliberately cannot
cover that.

## Immediate next step — Ed

1. **Phase 00** — create the `phn-db-backups` R2 bucket, two scoped tokens, and
   the lifecycle rules (`ops/backup/r2-lifecycle.json` is the reference).
2. **Phase 01** — run `ops/backup/create-readonly-role.sql` (pass
   `-v db_name=ph_navigator`; production, *not* the `ph_navigator_v2` in
   `render.yaml`). Fall back to the primary URL if `CREATEROLE` is unavailable.
3. **Phase 02** — `age-keygen`, store the identity offline in both places, set
   the four secrets and two variables.
4. Dispatch "Backup Database" from `main` and watch it go green.
5. Install the launchd job (Phase 04) and run the first production drill
   (Phase 05), then log it in `context/DATABASE_BACKUPS.md`.

Only after step 4 does the system actually protect anything.

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
