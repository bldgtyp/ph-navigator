---
DATE: 2026-06-25
TIME: 01:15 EDT
STATUS: Active — backend complete (Phases 1, 2, 3a); Phase 3b in progress (increment 1/6 done); remaining increments paused on a concurrent DataTable-UI WIP in the tree.
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
| 3a — generic table-replace cascade preview (backend) | `Complete` | none — `:preview-replace` route; BE suite 1113 |
| 3b — frontend heat-pumps rewire + shim removal | `In progress` | none — tree clean again; increments 2–6 ready |

### Phase 3b increments
| # | Increment | State |
|---|---|---|
| 1 | outdoor-units delete-cascade → generic `previewReplace` (3a route) + generic delete | `Done` (commit `6b6ae359`; tsc + 78 vitest green; live smoke deferred) |
| 2a | option-delete = AirTable parity (clear refs to null): generalize the existing `editOptions` cascade (`apply_edit_options`) to clear across **all** tables sharing the option `namespace_key` (heat-pump `manufacturer` is shared across 2 leaves) + tests | `Pending` (needs full `make ci`) |
| 2b | point the 4 components' inline option add/edit/remove at the generic `editOptions` schema mutation (drop `useHeatPumpOptionMutation`) | `Pending` |
| 3 | rewire `VentilatorsTableSlot` off the bespoke HP client onto the generic indoor-units feature | `Pending` |
| 4 | drop bespoke FE client (`heat-pumps/api.ts` 3 hooks + `heatPumpsQueryKeys`); fix `hooks.ts` invalidation | `Pending` |
| 5 | remove backend PATCH shim (`apply_patch`/`apply_option_patch`/`HeatPumpRowPatch`/`OptionPatchOp` + routes); rename `dependent_link_delete_blocked` | `Pending` (needs full `make ci`) |
| 6 | tests + browser smoke as Ed (all four leaves) | `Pending` |

## Next step
Resume Phase 3b at increment 2 (ordered plan in `phases/phase-03-*.md`
§"Phase 3b — ordered plan"). Start with **2a** (backend: generalize the
`editOptions` cascade to shared option keys — this is the AirTable-parity
"delete option ⇒ null the references" behavior Ed chose; the bespoke `/options`
endpoint is redundant and gets removed in increment 5), then **2b** (point the
heat-pump option editor at the generic `editOptions` mutation). 2a + 5 are
backend changes that need a clean full `make ci`; 2b/3/4 can use targeted gates
(tsc + vitest). The tree is clean now, so a real Equipment-tab browser smoke is
available throughout.

## Blockers
- None. The concurrent DataTable-UI WIP landed (it ended up bundled into the
  increment-1 commit `6b6ae359` — accepted as-is by Ed rather than rewriting
  history; `tsc -b` clean). The tree is clean, so increments 2–6 can resume with
  clean full-`make ci` gates + a real Equipment-tab browser smoke. See
  [[feedback_concurrent_committer]] — when committing alongside the concurrent
  committer, use `git commit -- <paths>` (path-scoped) so a pre-staged index from
  the other party can't get swept into the commit.

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
