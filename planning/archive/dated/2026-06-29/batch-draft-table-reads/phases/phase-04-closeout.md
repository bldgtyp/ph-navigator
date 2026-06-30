---
DATE: 2026-06-29
TIME: 21:55 EDT
STATUS: COMPLETE (2026-06-29) — closeout gate passed; folded back into the parent triage; packet archived
AUTHOR: Claude (Opus 4.8)
SCOPE: Repo closeout gate and fold-back of the result.
RELATED:
  - ../README.md
  - ../PLAN.md
  - ./phase-03-verification.md
---

# Phase 04 — Closeout

## Goal

Land cleanly through the repo closeout gate and record the outcome, closing out
the equipment fan-out investigation.

## Steps

1. Run the `simplify` skill on the diff; wait for it to finish.
2. Run the `docs-pass` skill on the diff; wait for it to finish.
3. `make format` from the repo root.
4. `make ci` (substantial change — backend + frontend + e2e).
5. If `make format` changed files, re-inspect the diff and re-run `make ci`.
6. Do not treat the work as done while any `make ci` step is red — and never
   merge with the `table-draft-etag-coordination` e2e red.

## Fold-back

- Update this folder's `STATUS.md` to `Implemented on branch` → `Merged to main`
  with evidence: before/after `equipment` API#, the one-load-vs-seven server
  delta, and the e2e green.
- Mark Finding 2 in the parent triage card
  (`../../production-frontend-performance/scorecards/2026-06-29-phase-06-triage.md`)
  **done** (both halves now shipped) and **close**
  `../../production-frontend-performance/handoffs/step-2-equipment-fanout-investigation.md`.
- If the new batch read is worth recording as a contract, add it to the relevant
  `context/` reference per the planning `.instructions.md` fold-back rule.

## Branch / deploy note

`main` deploys production (Render). Work on a feature branch; merge to `main`
only when ready to deploy. Backend is additive (new read route); the frontend
seed is behind a per-table fallback — but because this sits on the just-fixed
draft-etag write path, **gate the merge on the e2e coordination spec + a green
`make ci` + the perf re-run**, not just compile-clean.

## Outcome (2026-06-29)

- **Closeout gate:** per-phase `simplify` (4 cleanup agents each) + `docs-pass`
  ran on Phases 1–2; `make format` clean; `make ci` green (Phase 3). Phase 4
  adds no code, so no further simplify pass was warranted.
- **Fold-back:** parent triage Finding 2 marked **✅ DONE (both halves)** and the
  `step-2-equipment-fanout-investigation.md` handoff marked **CLOSED**
  (`../../production-frontend-performance/`).
- **Archive:** packet moved to
  `planning/archive/dated/2026-06-29/batch-draft-table-reads/`.
- **Merge/deploy — PENDING (intentionally not done):** the branch
  `refactor/batch-draft-table-reads` is implemented + verified but **not merged
  to `main`**. Merging deploys production; the gate requires the user-gated
  production perf re-run + an explicit deploy decision. Left for the user.
- **`context/` contract note:** not added — the batch read is an internal
  read-path optimization that mirrors the already-documented table-views batch
  convention; it introduces no new persisted contract worth a `context/` entry.
