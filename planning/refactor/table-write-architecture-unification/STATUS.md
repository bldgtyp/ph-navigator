---
DATE: 2026-06-25
TIME: 10:05 EDT
STATUS: Active — all code increments done (Phases 1–3a; Phase 3b increments 1–5). Only closeout 6 remains: e2e spec (mirror Pumps) + browser smoke as Ed, then archive the packet.
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
| 3b — frontend heat-pumps rewire + shim removal | `In progress` | none — all code done (inc 1–5); only closeout 6 (e2e + browser smoke) remains |

### Phase 3b increments
| # | Increment | State |
|---|---|---|
| 1 | outdoor-units delete-cascade → generic `previewReplace` (3a route) + generic delete | `Done` (commit `6b6ae359`; tsc + 78 vitest green; live smoke deferred) |
| 2a | option-delete = AirTable parity (clear refs to null): generalize the existing `editOptions` cascade (`apply_edit_options`) to clear across **all** tables sharing the option `namespace_key` (heat-pump `manufacturer` is shared across 2 leaves) + tests | `Done` (shared-namespace cascade in `options_ops.py`; `test_shared_option_cascade.py`; BE suite green) |
| 2b | point the 4 components' inline option add/edit/remove at the generic `editOptions` schema mutation (drop `useHeatPumpOptionMutation`) | `Done` (shared `makeHeatPumpOptionCreator` in `option-helpers.ts`; units tables route through the sibling equip controller; `useHeatPumpOptionMutation`/`HeatPumpOptionPatchOp` removed; tsc + 1907 vitest green) |
| 3 | rewire `VentilatorsTableSlot` off the bespoke HP client onto the generic indoor-units feature | `Done` (3 generic leaf queries replace `useHeatPumpsQuery`; indoor-unit save + link-picker batch through `useReplaceSliceMutation` + `fromCellWrites`; `useHeatPumpsQuery`/`useHeatPumpPatchMutation` now have zero consumers; tsc + 1907 vitest green) |
| 4 | drop bespoke FE client (`heat-pumps/api.ts` 3 hooks + `heatPumpsQueryKeys`); fix `hooks.ts` invalidation | `Done` (api.ts = 4 slice features + `requestPhiusExport` only; `heatPumpsQueryKeys` coupling gone from `hooks.ts` + `HeatPumpsPanel`; obsolete `hooks.test.ts` aggregate-invalidation test removed; dead `types.ts` pruned; tsc + 1906 vitest green) |
| 5 | remove backend PATCH shim (`apply_patch`/`apply_option_patch`/`HeatPumpRowPatch`/`OptionPatchOp` + routes); rename `dependent_link_delete_blocked` | `Done` (service.py 406→40 lines = `active_version_id_for_project` + `read_slice` only; 2 PATCH routes + aggregate GET removed, only `export-phius` left; glue removed from `tables/heat_pumps.py`; error code renamed; 5 redundant shim tests deleted, preview/phius tests migrated to generic seeding; `make ci-backend` green, **1110**) |
| 6 | tests + browser smoke as Ed (all four leaves) | `Pending` (e2e spec + interactive smoke) |

## Next step
**All code increments are done (1–5).** Heat-pumps now lives entirely on the generic
registered-contract + spine on both stacks; the bespoke FE client and BE PATCH shim are
gone. greps clean across FE+BE for the removed symbols and the old error code.

Only **closeout 6** remains, and it's the interactive/verification step:
- **e2e spec** mirroring the Pumps pattern for the heat-pump leaves (add/edit, delete-
  with-cascade-confirm, blocked-delete 409, option add + delete-clears-references,
  ventilator-side link picker).
- **Browser smoke as Ed** (the seed-project owner) — Equipment → Heat Pumps, all four
  leaves. Sign in as `ed@example.com` (single active session per user; do NOT re-seed,
  it wipes Ed's session). Catalog data is global, so catalog-only checks can smoke as
  `codex@example.com`.
- Then the **Final Completion Cleanup**: mark every packet doc done and move the packet
  to `planning/archive/2026-06-25/table-write-architecture-unification/`, fixing the
  index/links.

No further automated gates are blocking — `make ci` backend (1110) + frontend (1906)
are both green. The remaining work is the human-in-the-loop browser pass + archive.
- **6 (closeout).** Generic-path tests + e2e (mirror Pumps); full `make ci` green;
  greps clean for every deleted symbol; **browser smoke as Ed** (Equipment → Heat
  Pumps, all four leaves: add/edit, delete-with-cascade-confirm, blocked-delete 409,
  option add/edit/**delete-clears-references**, ventilator-side link picker). Then the
  Final Completion Cleanup (archive the packet).

5 needs a clean full `make ci`. The tree is clean now (modulo the concurrent
DataTable-UI WIP), so the Equipment-tab browser smoke is available.

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
