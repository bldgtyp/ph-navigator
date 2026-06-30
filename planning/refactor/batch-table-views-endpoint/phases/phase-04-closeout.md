---
DATE: 2026-06-29
TIME: 21:35 EDT
STATUS: Not started
AUTHOR: Claude (Opus 4.8)
SCOPE: Repo closeout gate and fold-back of the result.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ./phase-03-verification.md
---

# Phase 04 — Closeout

## Goal

Land the change cleanly through the repo's closeout gate and record the outcome
where the next reader will find it.

## Steps

1. Run the `simplify` skill on the diff; wait for it to finish.
2. Run the `docs-pass` skill on the diff; wait for it to finish.
3. `make format` from the repo root.
4. `make ci` (substantial change — backend + frontend).
5. If `make format` changed files, re-inspect the diff and re-run `make ci`.
6. Do not treat the work as done while any `make ci` step is red.

## Fold-back

- Update this folder's `STATUS.md` to `Implemented on branch` → `Merged to main`
  with evidence: the before/after `equipment` API# and the captured request list.
- Update the parent packet's triage card
  (`../../production-frontend-performance/scorecards/2026-06-29-phase-06-triage.md`)
  Finding 2 to mark the table-views half **done**, leaving the draft-tables half
  pointing at `batch-draft-table-reads`.
- If a new endpoint contract is worth recording, add it to the relevant
  `context/` reference per the planning `.instructions.md` fold-back rule.

## Branch / deploy note

`main` deploys production (Render). Do the work on a feature branch and merge to
`main` only when ready to deploy. This change is additive on the backend (new
route) and behind a per-table fallback on the frontend, so it is low-risk to
ship, but still gate on a green `make ci` and the perf re-run before merging.
