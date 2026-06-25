---
DATE: 2026-06-25
TIME: 01:15 EDT
STATUS: Active — Phases 1–2 (backend) complete; Phase 3 (frontend rewire) ready.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: State, blockers, sequencing for the table-write-architecture unification.
RELATED: ./README.md, ./PRD.md, planning/archive/dated/2026-06-24/backend-data-architecture-cleanup/
---

# STATUS

## Current state
Both external blockers cleared (aperture v12 + sibling Phase 3). **The backend
half of the refactor is done.**

- **Phase 1** — `features/project_document/write_spine.py` owns the draft write
  lifecycle (`apply_document_write` + `load_draft_context`); `replace_table_slice`,
  schema-mutation, aperture-command, and envelope-command surfaces all run through
  it (envelope's duplicate `_load_command_context` deleted). −133 lines.
- **Phase 2** — heat-pumps folded onto the registered contract + spine. New
  generic `tables/dependent_links.py` (declarative cross-table delete cascade:
  block required / clear optional + dry-run preview); the bespoke heat-pump write
  service (`JsonPatchOp`/`_apply_patch_to_body`/`_validate_slice`/`_delete_preview`/
  `_apply_delete_cascades` + double-validate) is gone; the old PATCH endpoints
  survive as a thin shim until Phase 3. `make ci` green (BE 1111, FE 1900).

## Phase ledger
| Phase | State | Blocker |
|---|---|---|
| 1 — backend write spine | `Complete` | none — `make ci` green |
| 2 — heat-pumps onto registry (backend) | `Complete` | none — `make ci` green (BE 1111, FE 1900) |
| 3 — frontend heat-pumps rewire | `Ready` | none (Phase 2 done; old endpoint kept alive) |

## Next step
Start Phase 3 (frontend, cross-stack closeout): point the four heat-pump leaf
tables at the generic table-write client (Ventilators/Pumps pattern), preserve
the cascade-confirm + dry-run-preview affordances, then remove the old PATCH
endpoints + the `service.py` translation shim. When the frontend no longer keys
on it, rename the `heat_pump_delete_blocked` error code to a neutral one.

## Blockers
- None. Phase 3 is frontend-only + the old-endpoint removal.

## Deferred follow-ups (recorded)
- **Module split** of `tables/heat_pumps.py` (~982 lines): soft target, high-churn
  re-export wiring; recipe in `phases/phase-02-*.md`. Optional.
- **Rename `heat_pump_delete_blocked`** → neutral code: do in Phase 3 with the
  frontend (wire-contract change).
- **Migrate ventilators/rooms** onto the generic `dependent_links` cascade (TODO
  comments left in both files) — collapses the last two hand-rolled cascades.
- **Assets attachment path** + **`save_draft`/`save_draft_as`** still hand-roll
  spine-overlapping plumbing (divergent no-op / not-draft-mutate semantics) —
  possible follow-ups, out of this refactor's named scope.

## Design note carried forward
The spine keeps a **two-outcome** model (persist vs no-op). Heat-pumps' dry-run
preview fits it: the preview is computed read-only (`preview_dependent_link_cascade`)
and returned with the unchanged body — no third "compute-but-don't-persist"
outcome was needed on the spine.

## Verification posture
Each phase ends green (`make ci` backend + frontend). The cross-stack cut keeps
the old heat-pumps endpoint alive through Phase 2 and removes it only after the
Phase 3 frontend rewire, so the app is never broken mid-flight. Heat-pumps
cascade/preview acceptance tests are ported **before** the bespoke service is
deleted.
