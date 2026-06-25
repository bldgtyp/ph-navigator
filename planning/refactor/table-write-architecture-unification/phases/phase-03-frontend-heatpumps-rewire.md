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
Sequence (each step verified in-app before the next; keep the app green):
1. **Option editing onto the generic replace.** Replace `useHeatPumpOptionMutation`
   (PATCH `/options/{key}`) in all four table components' `createOption()` with the
   generic whole-slice replace carrying `single_select_options` (payload-builders
   already has `replaceOptions`). Preserve the option-in-use 409. No generic
   option-edit hook exists to copy — this defines the pattern.
2. **Delete-cascade onto the generic surface.** ✅ DONE (commit `6b6ae359`).
   Added a generic `previewReplace()` on the slice feature (POSTs to the 3a
   `:preview-replace` route); `OutdoorUnitsTable` (the only leaf still on the
   bespoke delete) now dry-runs via `previewReplace` and deletes via the generic
   `deleteHeatPumpRow(controller.onWrite)`. `CascadePreviewDialog`/
   `BlockedDeleteDialog` UX unchanged. tsc + 78 vitest green; live smoke deferred
   to the closeout (concurrent DataTable-UI WIP in the tree).
3. **Rewire `equipment/components/VentilatorsTableSlot.tsx`** off `useHeatPumpsQuery`
   + `useHeatPumpPatchMutation` (it edits HP indoor units from the ventilator side:
   the `IndoorUnitRowModal` save + the "Link HP indoor units" multi-row picker)
   onto the generic indoor-units slice feature.
4. **Drop the bespoke frontend client**: `heat-pumps/api.ts` (3 hooks) +
   `heatPumpsQueryKeys`; fix `project_document/hooks.ts` invalidation coupling.
   Keep field-defs/columns/types/row-builders/payload-builders.
5. **Remove the backend write shim**: `apply_patch`/`apply_option_patch`/
   `HeatPumpRowPatch`/`OptionPatchOp` + the two PATCH routes in
   `features/heat_pumps/routes.py` (KEEP the GET + `export-phius` + `read_slice`/
   `compose_read`). Then rename `DEPENDENT_LINK_DELETE_BLOCKED` →
   `"dependent_link_delete_blocked"` (update the FE handler + the two BE tests).
6. **Tests**: update `heat-pumps/__tests__/` for the generic write paths; add an
   e2e spec mirroring the Pumps pattern; `make ci` green; browser smoke as Ed
   (Equipment → Heat Pumps: add/edit/delete-with-cascade-confirm/option-edit on
   all four leaves).

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
