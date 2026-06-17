---
DATE: 2026-06-17
TIME: 14:10 EDT
STATUS: Complete - Phase 05 design gate accepted
AUTHOR: Ed (via Codex)
SCOPE: Design decision for migrating Heat Pumps onto the shared
  DataTable abstraction.
RELATED:
  - planning/archive/data-table-consolidation/phases/phase-05-heat-pumps-on-shared-abstraction.md
  - planning/archive/data-table-consolidation/PLAN.md
  - context/technical-requirements/data-table.md
  - planning/archive/editable-fields/PRD.md
---

# Phase 05 Design Spike - Heat Pumps

## Decision

Use **four per-leaf table contracts** under the existing
`equipment.heat_pumps` aggregate:

- `heat_pumps_outdoor_equip`
- `heat_pumps_indoor_equip`
- `heat_pumps_outdoor_units`
- `heat_pumps_indoor_units`

Each leaf becomes a normal `{ field_defs, rows }` envelope with rows
that inherit the standard custom-field bags:

- `custom_values` for scalar custom fields and mutable built-ins;
- `custom_links` for linked-record custom fields;
- top-level typed columns only where domain invariants or cross-table
  references need Pydantic validation.

Do this as a **dev-schema v10 document reshape**. Assuming V2 remains in
the current pre-deploy/no-production-user posture, no
backwards-compatible reader or transform is required.

## Alternatives Rejected

### One Multi-Row-Type Controller

Rejected. The shared controller is deliberately one table key, one row
type, one field-def list, one schema fingerprint, and one view-state key.
Heat Pumps currently groups four row types for feature convenience, but
the DataTable behavior belongs at the leaf-table grain. A multi-row
controller would either hide four independent schemas behind one state
object or add polymorphism to the shared controller for one outlier.

### Keep Flat Rows And Defer Custom Fields

Rejected for this refactor. Deferring custom-field storage would leave
Heat Pumps as the only project table unable to use locks, formulas, and
schema mutations. The current Plan-31/custom-field backbone already
assumes field-def-capable tables use `{ field_defs, rows }`, so the
cleanest path is to join that shape.

### Keep Bespoke JSON-Patch Writes

Rejected for normal table edits. Leaf table edits should use the generic
`PUT /draft/tables/{table_name}` replacement and
`POST /draft/tables/{table_name}/custom-fields:mutate` schema-mutation
surface. Heat-pump-specific commands may remain separate only where they
represent a feature workflow rather than normal cell/row edits:

- Phius export;
- destructive delete preview/confirm if the generic row delete cannot
  express cascade warnings cleanly at first.

## Backend Shape

Add four heat-pump table modules or one shared table-contract module
that exports four `TableContract`s. The contracts should:

- use table paths below `("equipment", "heat_pumps", "<leaf>")`;
- expose server `field_defs` and `single_select_options` in the same
  response shape as the other equipment tables;
- register field registries so schema mutations, formulas, locks,
  custom single-select options, and linked-record custom fields work;
- keep Heat Pump referential rules in one shared validator used by all
  four contracts:
  - outdoor units require existing outdoor equipment;
  - indoor units require existing indoor equipment;
  - indoor units may reference an existing outdoor unit;
  - outdoor equipment may pair to existing indoor equipment;
  - indoor units may link to existing ventilators and served rooms.

The canonical option namespaces remain document-level
`heat_pumps.manufacturer`, `heat_pumps.system_family`,
`heat_pumps.refrigerant`, `heat_pumps.model_type`, and
`heat_pumps.install_type`. Manufacturer is intentionally shared by the
outdoor- and indoor-equipment leaves; the leaf contracts must both map
their `manufacturer` field to the same option namespace.

## Frontend Shape

Build one `HeatPumpTableSlot` shell that receives a leaf config and
plugs into `useSliceTableController`, plus four thin leaf bindings for
columns, empty-row builders, payload builders, and feature-specific row
modal content.

Each leaf should:

- fetch through the generic project-document table-slice query/mutation
  path, not `/equipment/heat-pumps/{table}`;
- use the shared `SliceTableShell` owned by the Heat Pumps panel;
- use server `tableSchema.fieldDefs` as the source of columns;
- replace `OptionPicker` with the shared single-select editor;
- replace raw linked-record selects with the shared picker/cell helpers;
- remove `useHeatPumpTableViewState` in favor of the shared
  per-table-view-state hook inside `useSliceTableController`.

Keep the Heat Pumps nested route and leaf tabs. The aggregate route can
continue to fetch all four leaves for cross-link label resolution and
Phius export, but normal edits should be leaf-table writes.

## Sequencing

Phase 05 should be split into implementation sub-slices:

1. **05A - Backend leaf contracts and v10 document shape.**
   Add the four `{ field_defs, rows }` envelopes, seed built-in field
   defs, register contracts, preserve Heat Pump referential validation,
   and cover generic table read/replace/schema mutation.
2. **05B - Frontend shared controller adoption.**
   Replace the bespoke PATCH/edit/cache/view-state path with generic
   table-slice hooks and `useSliceTableController` for each leaf.
3. **05C - Shared render/modal cleanup.**
   Remove `OptionPicker`, move linked-record modal controls to shared
   pickers, retire duplicated delete dialogs where a shared primitive
   fits, and keep Phius export feature-specific.
4. **05D - Focused parity tests.**
   Cover row insert/delete/duplicate, cell writes, single-select option
   edits, linked-record fields, custom-field add/edit/delete/formula,
   and locked/viewer read-only mode. Keep browser smoke, broad
   end-to-end cascade checks, and Phius-export closeout in Phase 06
   unless a 05A-05C implementation edit touches those paths directly.

## Verification For This Spike

- Current backend model/source inspection confirmed Heat Pumps is one
  nested flat slice with four row lists and no `field_defs`,
  `custom_values`, or `custom_links`.
- Current generic table contract inspection confirmed the shared
  `TableContract` + `TableFieldRegistry` path expects one table path,
  one field-def list, and row custom-field accessors.
- Current frontend controller inspection confirmed
  `useSliceTableController` is intentionally one row type per table key.
- Plan-31/current data-table docs confirm built-in locks and field-def
  registry behavior are already the active contract.
