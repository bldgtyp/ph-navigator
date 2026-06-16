---
DATE: 2026-06-16
TIME: 16:09 EDT
STATUS: Planned
AUTHOR: Ed (via Claude)
SCOPE: Bring Heat Pumps onto the shared controller / shell / TableContract
  path (design spike + implementation), retiring the forked view-state
  hook and OptionPicker and unlocking custom fields and uniform
  validation.
RELATED:
  - planning/refactor/data-table-consolidation/PRD.md
  - planning/code-reviews/2026-06-16/data-table-consistency-review.md
  - frontend/src/features/equipment/heat-pumps/
  - frontend/src/shared/ui/data-table/feature/
  - backend/features/heat_pumps/
  - backend/features/project_document/tables/registry.py
---

# Phase 05 - Heat Pumps On Shared Abstraction

## Goal

Eliminate the Heat-Pump fork. Bring all four heat-pump tables onto the
shared `useSliceTableController` + `<SliceTableShell>` + `<DataTable>`
stack and onto the generic backend `TableContract` path, so Heat Pumps
renders, behaves, and validates like every other table and gains custom
fields, locks, and formulas (review F1, F10, F5, B5). This is the largest
item and starts with a design spike.

## Preconditions

- Phases 00-04 complete: shared single-select cell, shared column
  builders, shared row modal / single-select editor / linked-record
  picker, and the contract-driven backend validator all exist, so Heat
  Pumps migrates onto finished building blocks.
- Plan-31 custom-field/locks state confirmed (per PLAN cross-cutting risk
  6) so heat-pump custom-field support does not reshape storage twice.

## Tasks

1. **Design spike (gate).** Resolve, with a short written decision in
   this folder:
   - Heat-pump slice shape: one multi-row-type controller variant vs each
     heat-pump sub-table as its own slice (the slice currently carries
     indoor units / indoor equip / outdoor units / outdoor equip +
     option lists together).
   - Custom-field storage: whether heat-pump rows can carry
     `field_defs` / `custom_values` / `custom_links` (rows are currently
     flat models). If a storage reshape is required, scope it here or
     document deferring custom-field support with an explicit gap.
   - Backend path: bring heat pumps under the generic slice-replace +
     `FieldSchemaMutation` contract, or keep JSON-Patch with documented
     justification.
2. **Frontend controller adoption (F1/F10).** Introduce
   `HeatPumpsTableSlot` + `SlicePayloadBuilders` for the heat-pump
   table(s); delete the four bespoke `handleWrite` switches, the inline
   CRUD verbs, and the duplicated stale-etag cache dance. Remove
   `useHeatPumpTableViewState` and let the controller own view state.
3. **Shared rendering adoption (F5/F6).** Replace `OptionPicker` with the
   shared single-select editor (from Phase 03); replace the raw-`<select>`
   linked-record pickers with the shared `Picker`; move the heat-pump row
   modals onto the shared `<RowEditModal>` (from Phase 03); use the
   unified inverse/incoming-link column.
4. **Column source (F1).** Have the heat-pump columns consume server
   `tableSchema.fieldDefs` + `customFieldColumnDefs` (like Rooms) instead
   of statically building `FieldDef[]` client-side, so custom fields and
   locks render.
5. **Backend migration (B5).** Per the spike decision, either register
   heat-pump tables as generic `TableContract`s (gaining custom-field +
   uniform validation for free) or keep the feature but move its request
   DTOs into `models.py` and single-source its validation. Reconcile the
   identifier-uniqueness behavior with the Phase 04 decision.
6. **Cleanup.** Remove `CascadePreviewDialog` / `BlockedDeleteDialog`
   duplication by reusing a shared destructive-confirm primitive if one
   exists; keep `PhiusExportDialog` as legitimately feature-specific but
   align its server-state fetch with TanStack Query.
7. **Tests.** Cover heat-pump tables through the shared controller path:
   cell/fill/insert/delete/duplicate, single-select parity, linked-record
   parity, custom-field add/edit/delete (or the documented gap), view
   state persistence, and locked/viewer read-only mode.

## Acceptance Criteria

- All four heat-pump tables compose the shared controller + shell +
  DataTable; no bespoke `handleWrite` switches remain.
- `useHeatPumpTableViewState` and `OptionPicker` are removed.
- Heat-pump single-selects, links, and row modals use the shared
  components and behave identically to the rest of the app.
- Heat-pump tables support user custom fields, locks, and formulas - or
  the gap is explicitly documented with a reason.
- Backend heat-pump writes go through the generic contract path, or the
  divergence is documented and its DTO/validation layering is cleaned up.
- Focused frontend and backend tests pass; browser smoke confirms parity
  across all heat-pump leaves.

## Stop Conditions

- Stop at the spike gate if neither slice shape fits the shared
  controller without unacceptable complexity; record the decision and
  re-scope before writing migration code.
- Stop if custom-field storage for heat-pump rows requires a schema
  reshape that conflicts with in-flight Plan-31 work; coordinate
  sequencing before proceeding.
- Stop if the backend migration would change saved heat-pump documents in
  a way that cannot be migrated safely.

## File Entry Points

- `frontend/src/features/equipment/heat-pumps/components/*Table.tsx`
- `frontend/src/features/equipment/heat-pumps/*-columns.tsx`
- `frontend/src/features/equipment/heat-pumps/components/*RowModal.tsx`
- `frontend/src/features/equipment/heat-pumps/useHeatPumpTableViewState.ts`
- `frontend/src/features/equipment/heat-pumps/components/OptionPicker.tsx`
- `frontend/src/features/equipment/heat-pumps/routes/HeatPumpsPanel.tsx`
- `frontend/src/shared/ui/data-table/feature/`
- `backend/features/heat_pumps/`
- `backend/features/project_document/tables/registry.py`
