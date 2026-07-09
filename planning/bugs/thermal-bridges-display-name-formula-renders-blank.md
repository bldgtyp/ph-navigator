---
DATE: 2026-07-09
TIME: 13:15
STATUS: Open
AUTHOR: Ed May (reported), Claude (recorded)
SCOPE: THERMAL BRIDGES table — DISPLAY NAME field set to a Formula renders
       blank in every cell (grid render path), while the field-config modal
       preview evaluates it correctly
RELATED:
  - feedback_datatable_uniformity_ironlaw
  - planning/features/formula-field-units/ (active formula-field work)
  - context/UI_UX.md
---

# THERMAL BRIDGES: DISPLAY NAME as a Formula renders blank in the grid

## Summary

On the **THERMAL BRIDGES** table, changing the **DISPLAY NAME** field to a
**Formula** (`(({Sheet Name} & "-") & {Drawing Number})`) produces **no rendered
value** — every DISPLAY NAME cell is blank — even though the field-config
modal's **Preview** evaluates the same expression correctly ("A2.2-XF").

## Observed behavior

- DISPLAY NAME column header switches to the formula (ƒ) icon (schema change
  took), but all 5 rows render empty in that column.
- The FieldConfig modal shows **"Preview based on row at modal open: A2.2-XF"** —
  so the formula parses and evaluates fine given a row.
- SHEET NAME (`A2.2`) and DRAWING NUMBER (`XF`) — the referenced fields — have
  values and render normally.

## Expected behavior

The DISPLAY NAME cells should show the evaluated formula (`A2.2-XF`, etc.),
exactly like the modal preview — the same way the **Rooms** table renders its
`{Number} — {Name}` display-name formula.

## Root cause — formula-as-Display-Name is per-table opt-in, only Rooms wired it

Render-time formula display does **not** evaluate the AST in the cell. It reads a
**precomputed overlay** (`rowsComputed` / `slice.rows_computed`) through
`computedFieldColumnDef`, which renders `<ComputedCell>`
(`frontend/src/shared/ui/data-table/feature/customFieldColumns.tsx:106-137`).
`<ComputedCell>` renders an **empty span when the value is null/undefined**
(`components/ComputedCell.tsx`) — hence blank cells when the overlay has no value
for that field.

The asymmetry between the two tables is decisive:

- **`features/equipment/components/RoomsTable.tsx` (works).** Lines 144-149 carry
  the comment *"Rooms is the formula exception: the Display Name identifier is
  the `{Number} — {Name}` formula kept on the `record_id` field"* and build that
  column via `computedFieldColumnDef<RoomRow>({ …, rowsComputed })`, and pass
  `formulaFieldRegistry` + `getFormulaRowValues` + `rowsComputed` to the
  `DataTable` (lines ~235-236).

- **`features/assets/thermal-bridges/ThermalBridgesTable.tsx` (broken).** It only
  routes `slice.rows_computed` through `customFieldColumnDefs(...)` for **custom**
  fields (line 77). Its **DISPLAY NAME** is rendered by the ordinary built-in
  identifier column (which shows the stored `display_name` string), NOT via
  `computedFieldColumnDef`. It does not pass `formulaFieldRegistry` /
  `getFormulaRowValues`. So when DISPLAY NAME becomes a formula: there is no
  stored `display_name` string, and no computed-overlay renderer for that column
  → blank.

The modal Preview works because it evaluates the AST client-side
(`components/FieldConfigSectionFormula.tsx:95`, `evaluate(...)`), independent of
the grid's overlay-based render path.

## Two defects here

1. **Missing render wiring.** ThermalBridges (and presumably every non-Rooms
   table) never wired the computed-display-name path, so a formula display-name
   silently renders blank.
2. **Silent failure in the field editor.** The FieldConfig modal lets the user
   choose **Formula** for the DISPLAY NAME on a table that can't render it, saves
   the schema change (header flips to ƒ), and shows a valid Preview — with **no
   error** and no rendered result. Either the render path must support it, or the
   editor must refuse/warn.

## Iron-law note

Formula-as-Display-Name is a basic capability implemented as a **per-table
opt-in** (only Rooms). That's the DataTable-uniformity iron-law failure mode
([[feedback_datatable_uniformity_ironlaw]]): the computed-display-name path
should be parent-owned and available to every table, not hand-wired per table.
The real fix is to make `DataTable` render a formula-typed identifier/DISPLAY
NAME column uniformly (evaluate + overlay) for all tables, so Thermal Bridges,
Equipment, etc. get it for free — rather than copying the Rooms wiring into each.

## Where to look / fix direction

- `ThermalBridgesTable.tsx:77` (columns) — the DISPLAY NAME/identifier column is
  not a `computedFieldColumnDef`; mirror `RoomsTable.tsx:144-159` **or** (better)
  lift the computed-identifier handling into the shared `DataTable` so it's
  uniform.
- Confirm the backend populates `slice.rows_computed` with the DISPLAY NAME
  formula result for the Thermal Bridges table (all calc lives in the backend);
  if the overlay is empty, the column change alone won't help.
- `DataTable.tsx:250-273` — `formulaFieldRegistry` / `getFormulaRowValues`
  defaults exist; verify ThermalBridges provides referenceable field values
  (`{Sheet Name}`, `{Drawing Number}`) to the evaluator.
- FieldConfig modal — decide the silent-failure policy (support vs. refuse/warn).

## Repro

1. Open a project → THERMAL BRIDGES.
2. Edit the DISPLAY NAME field → set type = **Formula** →
   `(({Sheet Name} & "-") & {Drawing Number})`.
3. Note the modal Preview shows `A2.2-XF`; Save.
4. DISPLAY NAME column header shows the ƒ icon but every cell is blank.
5. Compare with SPACES/Rooms, where the `{Number} — {Name}` display-name formula
   renders correctly.

## Status

Open — not yet triaged or fixed. Recorded from user report.
