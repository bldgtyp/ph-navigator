---
DATE: 2026-06-24
TIME: 17:58 EDT
STATUS: Complete locally
AUTHOR: Codex
SCOPE: Phase 5 — fold decisions into context/, run the closeout gate, hand off
  to the report-pages feature.
RELATED: ../README.md, ../../apertures-glazings-frames-reports/
---

# Phase 5 — Closeout

Implementation through Phase 4 is complete locally. The final closeout pass
ran: simplify, docs-pass, `graphify update .`, `make format`, and `make ci`.
Commit/archive is pending a clean staging pass because the worktree already
contains unrelated modified/untracked planning/context files.

## Fold decisions into `context/`

- `context/technical-requirements/data-model.md`: document the new
  `project_glazings` / `project_frames` tables, the element-FK shape, the
  dedup rule (D-2), the shared-edit semantics (D-6), and the v11→v12 migration.
  These are now stable contracts, not feature-local intent.
- `context/GLOSSARY.md`: add `ProjectGlazing`, `ProjectFrame` (and note the
  distinction from the catalog `glazing_types`/`frame_types` and from the
  `GlazingRef`/`FrameRef` pick DTO).
- If the apertures asset/datasheet behavior is documented anywhere in
  `context/DATA_STORAGE.md`, add the two new attachment table keys.

## Closeout gate (repo CLAUDE.md)

1. `simplify` skill on the diff.
2. `docs-pass` skill on the diff.
3. `make format`.
4. `make ci` (substantial change → required).
5. Re-inspect if format changed files; rerun `make ci`.
6. Nothing red.

## Hand off

- Mark this feature `Merged to main` / `Complete` in `STATUS.md` with evidence.
- Unblock `planning/features/apertures-glazings-frames-reports/` — its STATUS
  notes it was waiting on this. Confirm the apertures slice now returns
  `project_glazings` / `project_frames` (its read API builds on that).
- Archive per `planning/.instructions.md` when merged + verified.

## Exit criteria

- Met locally. `context/` updated; closeout gate green; STATUS reflects local
  completion. Merge/archive still pending.
