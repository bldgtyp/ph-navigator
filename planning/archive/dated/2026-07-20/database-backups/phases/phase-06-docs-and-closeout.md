---
DATE: 2026-07-20
TIME: 10:20 EDT
STATUS: Complete — operating in production since 2026-07-20; first backup + restore drill passed
AUTHOR: Claude (Opus) with Ed May
SCOPE: Canonical runbook doc + wiring into the docs router, and the closeout gate.
OWNER: Agent.
RELATED:
  - ../../../../context/PRODUCTION_DEPLOYMENT.md
  - ../../../../context/README.md
  - ../../../../CLAUDE.md
---

# Phase 06 — Docs and closeout

## As built

Steps 1–3 are done: `context/DATABASE_BACKUPS.md` is written, and the router
wiring landed in `CLAUDE.md` (dispatch row), `context/README.md` (on-demand
reference), and `context/PRODUCTION_DEPLOYMENT.md` (the "Database Recovery"
section gained an off-site row, and its "no automatic nightly export" claim was
corrected to say the off-site layer is built but not yet operating).

Step 4's gate ran with `shellcheck -x` clean on all five scripts, as this phase
asked. Step 5 is **not** done and cannot be: this feature is not `Complete`
until a production drill has passed, which needs Phases 00–02 first. Do not
archive the folder before then.

**Goal:** the backup/restore system is discoverable and operable by a future
person (or agent) with zero tribal knowledge, and the repo's status docs reflect
reality.

## Step 1 — Author `context/DATABASE_BACKUPS.md` (canonical runbook)

Single source of truth for operating backups. Sections:

- **What is backed up and what is not** (DB only; R2 assets deferred — link
  DATA_STORAGE.md and D-9).
- **The two layers** (Render PITR — how to trigger a Render restore; the off-site
  daily/weekly system built here).
- **Where things live**: R2 bucket + key layout; GitHub secrets/variables list
  (names only, never values); the age key's offline locations (described, not
  disclosed); the Dropbox folder; the launchd job.
- **Routine operations**: run a manual backup (`workflow_dispatch`); check the
  latest backup exists; read the workflow/pull logs.
- **Restore**: inline the Phase 05 runbook (or link it).
- **Quarterly drill**: the checklist + a running log table (date / object /
  counts matched).
- **Key rotation** and **credential rotation** procedures.
- **Failure response**: what a red workflow email means and first steps.
- **Cross-links**: PRODUCTION_DEPLOYMENT.md, DATA_STORAGE.md, this planning
  folder.

## Step 2 — Wire it into the router

- `CLAUDE.md` "Working by area" dispatch table: add a row —
  *When you're… changing/operating **database backups / disaster recovery** →
  Read first `context/DATABASE_BACKUPS.md` → essentials: DB dumps are off-site +
  encrypted (age, key offline); Render PITR is the short-window net; deploys/keys
  are Ed's call.*
- `context/README.md` numbered router: add `DATABASE_BACKUPS.md` near
  `PRODUCTION_DEPLOYMENT.md` (it's operational infra).
- `context/PRODUCTION_DEPLOYMENT.md`: add a short "Backups & disaster recovery"
  subsection that points to `context/DATABASE_BACKUPS.md` (so anyone on the
  production runbook finds it). Optionally note the backup workflow alongside the
  deploy workflow.

## Step 3 — `ops/backup/README.md`

Operator index for the `ops/backup/` scripts: one line per file, what it does,
who runs it, and a pointer to `context/DATABASE_BACKUPS.md` for the full runbook.

## Step 4 — Closeout gate (per repo-root CLAUDE.md)

The implementation PR (Phases 03–06 code + docs) must pass the standard gate:

1. `simplify` skill on the diff.
2. `docs-pass` skill on the diff.
3. `make format`.
4. `make ci` if the change is non-trivial. **Note:** this feature adds a YAML
   workflow, shell scripts, and docs — no Python/TS app code — so `make ci`
   mostly proves nothing regressed. Add `shellcheck` on the new scripts as the
   meaningful lint (call it out in the PR).
5. Re-inspect if `make format` changed files.

## Step 5 — Memory + STATUS

- Write a project memory note: backups are off-site encrypted (age, key offline),
  daily via GitHub Actions → R2, weekly pull → Dropbox; runbook at
  `context/DATABASE_BACKUPS.md`; quarterly restore drill is the living proof.
- Flip this feature's `STATUS.md` to `Complete` once a drill has passed, then
  archive the folder per `planning/.instructions.md` (move to
  `planning/archive/dated/<date>/database-backups/`, one line in
  `planning/archive/README.md`).

## Verification

- Every cross-link resolves; the dispatch-table row and router line are present.
- A cold read of `context/DATABASE_BACKUPS.md` alone is enough to run a manual
  backup and a restore.
- `make format` clean; `shellcheck ops/backup/*.sh` clean.

## Rollback

Docs are additive; remove the doc + router lines to revert. No runtime impact.
