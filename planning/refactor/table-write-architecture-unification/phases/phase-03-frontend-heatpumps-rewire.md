---
DATE: 2026-06-24
TIME: 18:25 EDT
STATUS: Split (2026-06-25) — 3a (backend preview enabler) COMPLETE; 3b (frontend rewire) READY, needs an interactive app pass.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 3 — rewire the heat-pumps frontend onto the generic table-write client.
RELATED: ../PRD.md, context/technical-requirements/data-table.md,
         frontend/src/features/equipment/ (Ventilators/Pumps = the target pattern)
DEPENDS_ON: Phase 2 (backend heat-pumps on the generic contract, old endpoint still alive).
---

# Phase 3 — Frontend Heat-Pumps Rewire (cross-stack closeout)

> **Phase split (2026-06-25).** Mapping the frontend showed the table cell/row
> edits already run through the generic `useSliceTableController` → `PUT
> /draft/tables/heat_pumps_*` path, but the rewire is more entangled than the
> original plan assumed (cross-feature coupling, no generic option-edit hook,
> shared query-key registry) and the endpoint removal + error-code rename must
> co-land with the frontend or the live app breaks. It was therefore split:
>
> - **Phase 3a — backend preview enabler (COMPLETE).** A generic dry-run cascade
>   preview on the table-replace surface: `POST /draft/tables/{table_name}:preview-replace`
>   → `preview_table_replace` (drafts.py) reuses `apply_replace` (cascade + 409
>   block + validate) to derive the removed set, then `preview_dependent_link_cascade`;
>   returns `TableReplacePreviewResponse {affected}`. `CascadePreviewRef`/
>   `TableReplacePreviewResponse` in contracts.py. Generic — any contract with
>   `dependent_links`. Backend suite green (1113). This is the enabling piece so
>   the delete-confirm UX can drop the bespoke heat-pump dry-run PATCH.
> - **Phase 3b — frontend rewire + shim removal (READY).** The interactive UI
>   pass below; needs a running app + Vitest/Playwright as Ed.

## Phase 3b — ordered plan (do interactively, app running)
Sequence (each increment verified in-app before the next; keep the app green).
Numbering matches the increment ledger in `../STATUS.md`. Ordering constraint:
2 and 3 (last FE consumers) before 4 (drop FE client) before 5 (remove BE
endpoints); the error-code rename in 5 must land FE+BE together.

1. **Delete-cascade onto the generic surface.** ✅ DONE (commit `6b6ae359`).
   Added a generic `previewReplace()` on the slice feature (POSTs to the 3a
   `:preview-replace` route); `OutdoorUnitsTable` (the only leaf still on the
   bespoke delete) now dry-runs via `previewReplace` and deletes via the generic
   `deleteHeatPumpRow(controller.onWrite)`. `CascadePreviewDialog`/
   `BlockedDeleteDialog` UX unchanged. tsc + 78 vitest green; live smoke deferred
   to the closeout.

2. **Option editing via the generic `editOptions` mutation — AirTable parity.**
   **Decision (Ed, 2026-06-25):** deleting a single-select option must **unset it
   on the records** (set the cell to `null`), NOT block the delete. That is
   AirTable parity and the correct UX. The bespoke `/options/{key}` endpoint
   (which 409s `heat_pump_option_in_use` on an in-use delete) is therefore the
   *wrong* behavior — and redundant: the generic `editOptions` schema mutation
   (`mutations/options_ops.py::apply_edit_options`) **already does exactly this**:
   it diffs `deleted_ids = current − next`, cascade-clears those ids out of row
   values (sets the cell to `None` for a normal single-select), and for built-ins
   in `required_field_keys` demands an explicit *replacement* instead of clearing.
   - **Nullable-vs-locked is already encoded** (Ed's rule): user-editable owned
     options (`manufacturer`, `system_family`, `refrigerant`, `model_type`,
     `install_type`) are nullable → clearable. `status` (and any locked
     single-select) is required / not user-option-editable, so its options are
     never deleted through the UI; `required_field_keys` + `validate_default_option_id`
     guard the non-UI (MCP / hand-crafted) case. So the cascade needs no new
     nullable-detection — it clears the clearable set and leaves the required set
     to the existing replacement guard.
   - **2a (backend) — ✅ DONE.** `apply_edit_options` now resolves *every*
     `(table, field)` whose option-list `namespace_key` matches the edited list
     (via `_option_field_bindings` over `iter_table_contracts()`) and clears
     deleted options on all of them — not just `mutation.table_key`. A custom /
     mutable built-in single-select stays table-local (its namespace embeds the
     `table_path`); a locked-type built-in (`heat_pumps.manufacturer`, shared by
     the outdoor- and indoor-equip leaves) cascades to both, so the sibling leaf
     no longer dangles → `422`. Tests in `tests/features/heat_pumps/test_shared_
     option_cascade.py` (manufacturer cleared on both leaves from one edit; rename
     leaves rows untouched). Needs the full `make ci` gate at commit.
   - **2b (frontend) — ✅ DONE.** A shared `makeHeatPumpOptionCreator`
     (`option-helpers.ts`) builds an option-add through the generic `editOptions`
     schema mutation, routing by `(tableKey, fieldId)` with the controller's
     schema fingerprint and dispatching via `controller.onWrite({kind:
     "schemaMutation", variant:"typed"})`. The two equip tables use their own
     controller; the two units tables route through the sibling equip controller
     (units leaves don't carry the manufacturer/model lists). `useHeatPumpOptionMutation`
     and `HeatPumpOptionPatchOp` removed; `api.test.ts` (which only covered that
     hook) replaced by `option-helpers.test.ts`. tsc + 1907 vitest green. (Inline
     edit/recolor/reorder/delete from these modals never existed — only add; the
     generic editOptions delete-clears references when wired into the grid editor.)

3. **Rewire `equipment/components/VentilatorsTableSlot.tsx`** ✅ DONE. Off
   `useHeatPumpsQuery` + `useHeatPumpPatchMutation` onto the generic indoor-units
   slice feature: three `useSliceQuery` reads (indoor-units + the sibling
   indoor-equip / outdoor-units leaves the `IndoorUnitRowModal` references) and a
   `useReplaceSliceMutation`. The `IndoorUnitRowModal` save and the "Link HP indoor
   units" multi-row picker both build `CellWrite[]` and go through one atomic
   `fromCellWrites` replace (batched — the leaf endpoint rewrites the whole rows
   list, so a per-row loop would hit a stale etag on its second write). tsc + 1907
   vitest green. `useHeatPumpsQuery`/`useHeatPumpPatchMutation` now have no
   consumers (removed in increment 4).
4. **Drop the bespoke frontend client** ✅ DONE. `heat-pumps/api.ts` is now just
   the four slice features + `requestPhiusExport` — `useHeatPumpsQuery`,
   `useHeatPumpPatchMutation`, `previewHeatPumpDelete`, `useHeatPumpOptionMutation`,
   `fetchHeatPumps`, and `heatPumpsQueryKeys` are gone. Removed the
   `heatPumpsQueryKeys` invalidation coupling in `project_document/hooks.ts` and the
   `invalidateHeatPumpsAggregate` plumbing in `HeatPumpsPanel` (the generic leaf
   queries self-refresh via the shared `applyAcceptedSlice` path); deleted the now-
   obsolete aggregate-invalidation test in `hooks.test.ts`. Pruned dead `types.ts`
   (`HeatPumpTableKey`, `HeatPumpPatchOp`, `HeatPumpPatchRow`, `CascadePreview`,
   `HeatPumpsPatchResponse`; kept `CascadeReference`). Kept `requestPhiusExport`, the
   four slice features, and field-defs/columns/row-builders/payload-builders. tsc +
   1906 vitest green; FE greps clean for every removed symbol.
5. **Remove the backend write shim** (`features/heat_pumps/`): `apply_patch`,
   `apply_option_patch` (+ `_apply_option_patch_to_body`, `_option_is_referenced`,
   `_OPTION_KEY_TO_CELL`), `HeatPumpRowPatch`, `OptionPatchOp`, the patch→replace
   glue (`_rows_after_patch`; and `build_leaf_replace_payload`/`leaf_contract_for`/
   `_LeafWriteSpec` in `tables/heat_pumps.py`), and the two `PATCH` routes (incl.
   `/options/{key}` and its `heat_pump_option_in_use` 409). Confirm nothing reads
   the aggregate `GET /equipment/heat-pumps` after step 4, then remove
   `compose_read` + that route too; KEEP `read_slice` + `export-phius` +
   `active_version_id_for_project`. Then rename `DEPENDENT_LINK_DELETE_BLOCKED` →
   `"dependent_link_delete_blocked"` (FE 409 handler + the two BE tests).
6. **Tests + closeout**: update `heat-pumps/__tests__/` for the generic paths; add
   an e2e spec mirroring the Pumps pattern; full `make ci` green; greps clean for
   every deleted symbol; browser smoke as Ed (Equipment → Heat Pumps, all four
   leaves: add/edit, delete-with-cascade-confirm, blocked-delete 409, option
   add/edit/**delete-clears-references**, ventilator-side link picker). Then the
   Final Completion Cleanup (archive the packet).

## Goal
Heat-pumps editing uses the same generic table-write client and `<DataTable>`
plumbing as every other equipment table. The bespoke
`src/features/equipment/heat-pumps/{api,payload-builders}.ts` is removed or
reduced to declarative column/field-def config — matching how
`VentilatorsTable` / Pumps are wired.

## Background (verified 2026-06-24)
`src/features/equipment/heat-pumps/` has its own `api.ts`, `payload-builders.ts`,
and `types.ts`, distinct from the shared equipment-table write pattern. The
generic table-write client used by the other tables lives alongside
`features/equipment/api.ts` + `features/project_document/` hooks; Ventilators is
the reference (`features/equipment/components/VentilatorsTable.tsx`).

## Changes
- Point the four heat-pump leaf tables at the generic table-write client (the one
  Ventilators/Pumps use), driven by the field-def registry the backend now
  serves uniformly.
- Replace `heat-pumps/payload-builders.ts` (bespoke patch payloads) with the
  generic table-replace payload path; keep only heat-pump-specific column/field
  config (`*-columns.tsx`, `field-defs.ts`, `option-helpers.ts`).
- Reconcile `heat-pumps/types.ts` with the generated API types where the wire
  shape changed; regenerate the OpenAPI client if used.
- Preserve the heat-pumps UX (cascade confirmation on delete, dry-run preview) on
  the generic client — the backend exposes these as generic capabilities (Phase
  2), so the frontend consumes them through the shared affordance, not a bespoke
  one.
- **Remove the old heat-pumps backend endpoint** (kept alive through Phase 2) once
  the frontend no longer calls it.

## Step sequence
1. Rewire reads/writes for one heat-pump leaf table onto the generic client;
   verify in-app (Equipment tab) against a seeded project.
2. Roll the remaining three leaf tables.
3. Wire cascade-confirm + preview through the generic affordance.
4. Delete the bespoke `api.ts`/`payload-builders.ts`; remove the dead backend
   endpoint.

## Acceptance criteria
- No bespoke heat-pumps write client remains (only declarative column/field
  config); heat-pumps matches the Ventilators/Pumps wiring.
- Editing heat-pumps in the Equipment tab works end-to-end: add/edit/delete,
  delete-cascade confirmation, dry-run preview, ETag conflict handling — via the
  shared client.
- Old heat-pumps backend endpoint removed; `grep` clean across BE + FE.
- `make ci` (frontend + backend) green; `pnpm run format` clean; manual
  Equipment-tab smoke as Ed (the seed-project owner) passes.

## Risks
- Behavior parity in the UI (cascade/preview affordances). Mitigation: smoke the
  Equipment tab against the seed project before deleting the bespoke client.
- Generated-client drift if OpenAPI types are regenerated — run the type
  generation and fix call sites in the same PR.
