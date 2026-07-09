# Phase 02 — Frontend: carry units on convert, display formula results with units, modal picker

```
DATE:    2026-07-09
TIME:    11:46 EDT
STATUS:  Planned — not started.
AUTHOR:  Ed + Claude
SCOPE:   Shared data-table UI (frontend/src/shared/ui/data-table/*) + unit format lib.
         Table-agnostic — every table using DataTable inherits it (D9).
DEPENDS: Phase 01 (backend must accept + persist formula units first).
RELATED: PRD.md §5.2/§5.3/§5.5, decisions.md D2/D4/D5/D11
```

## Goal

Surface Phase 1 in the field-config modal and the grid: converting a unit-bearing number field
to a formula **keeps its units** in the payload, a numeric formula's computed cell **renders
through the unit path** (SI/IP toggle, precision, suffix), and the modal exposes a
**display-unit picker** on formula fields (carried-forward + editable, disabled when `fixed`).

## Edit sites (all in `frontend/src/shared/ui/data-table/`, table-agnostic)

### 1. Carry `units` forward when converting to a formula
File: `lib/customFieldMutations.ts` — `buildNextConfigForFieldTypeChange` (`:434-503`).

Today, for a non-number target the `else` branch deletes units (`:462-464`). Add a formula
carve-out so the source field's units ride into `after.config` (D5):
```ts
if (nextFieldType === "number") {
  // ...existing units handling...
} else if (nextFieldType === "formula") {
  // Carry the source field's display units forward (D5). The backend
  // threads them through set_formula and keeps them iff result_type
  // is number; a text/bool formula drops them server-side (D7).
  const srcUnits = (source.config as { units?: unknown }).units;
  if (request.numberUnits === null) {
    delete nextConfig.units;                 // explicit clear from the modal
  } else if (request.numberUnits !== undefined) {
    nextConfig.units = request.numberUnits;  // user retagged the output unit
  } else if (srcUnits !== undefined) {
    nextConfig.units = srcUnits;             // default: carry forward
  }
} else {
  delete nextConfig.units;
}
```
Keep the existing `source`/`ast`/`deps`/`result_type` handling (`:465-472`). Backend owns
ast/deps/result_type; the client only ships `source` (via `formulaSource`) + `units`.
Keep `typeConversionMatrix.ts` in lockstep (no matrix entry changes — PRD §7.11).

### 2. Map a numeric formula's units into `numberUnits` for display
File: `hooks/useTableSchema.ts` — the `formula` branch (`:235-252`).

After building `formula_config` / `computed_type`, also expose units so the shared display
path can format the result:
```ts
if (persisted.field_type === "formula") {
  // ...existing formula_config + computed_type...
  if (resultType === "number" && isNumberUnitsConfig(config.units)) {
    fieldDef.numberUnits = config.units;   // D4 — reuse the number display config verbatim
  }
}
```
`isNumberUnitsConfig` is already imported/used for the number branch (`:209`).

### 3. Render the computed cell through the unit formatter
Files: `components/ComputedCell.tsx` and `lib/rows/format.ts:8-25`.

- **Grid cell:** `ComputedCell` currently takes a flat `numberPrecision` (`:4-10`) and formats
  a number with `toFixed`. Extend it to accept optional `numberUnits` + `unitSystem`; when both
  present and the value is a finite number, format via
  `formatNumberUnitsDisplay(value, numberUnits, unitSystem)` instead of the flat path. The
  computed overlay value is already canonical SI (backend evaluates on stored SI), so it feeds
  `formatNumberUnitsDisplay` (a SI→display function) directly. Wire `numberUnits`/`unitSystem`
  from the formula `FieldDef` + the global unit preference at the cell's render site (mirror how
  number cells read `unitSystem` today).
- **Clipboard / CSV / plain display:** `formatDisplayCellValue` (`format.ts:8-25`) currently
  unit-formats only `field_type === "number"`; a formula falls through to `formatClipboardValue`
  (raw). Add a branch so a formula with `numberUnits` and a numeric value formats consistently
  with the grid (so copy/paste and any text export match what's on screen):
  ```ts
  if (fieldDef?.field_type === "formula" && fieldDef.numberUnits && typeof value === "number") {
    return formatNumberUnitsDisplay(value, fieldDef.numberUnits, unitSystem);
  }
  ```
  Keep the existing error/empty handling in `ComputedCell` (`#ERROR`, blank) unchanged.

### 4. Modal: a display-unit section on formula fields + payload wiring
Files: `components/FieldConfigModal.tsx` (handleSave `:461-542`; formula/units section render
around `:700-760`), `components/FieldConfigSectionNumberUnits.tsx`,
`components/FieldConfigSectionFormula.tsx`.

- **Render the existing `FieldConfigSectionNumberUnits` verbatim** (D11 — no bespoke control)
  when `draftType === "formula"` (alongside `FieldConfigSectionFormula`), fed by the same
  `numberUnits` draft state. Pass `fixed={numberUnits?.mode === "fixed"}` — the section already
  disables its controls and shows "Units are fixed by this catalog field." This gives the full
  unit-type picker (needed for the `W÷CFM → electric_efficiency` retag), the "none" state, and
  the fixed-locked state with zero new UI. Two copy/behavior deltas only:
  - **Relabel** the section header "Units" → **"Display units"** and add a one-line hint
    ("Formats the computed result; applies to numeric formulas") — a formula's unit is a
    formatting choice, not data entry. Parameterize the label/hint on the shared component (or
    wrap it) rather than forking it.
  - **Visibility:** show it for every formula field; the backend is authoritative and drops the
    units if `result_type` isn't numeric (D7). Soft-hiding for a detected text formula is a
    later refinement (decisions O3), not v1.
- **Seed** the modal's `numberUnits` draft from the field's existing units on open, whether the
  field is currently number or formula, so a converted field shows its carried unit.
- **handleSave:** today the units payload is number-only (`:485`,
  `...(draftType === "number" && numberUnitsDirty ? { numberUnits } : {})`). Extend to include
  `numberUnits` for a formula target too, so `EditCustomFieldBundleRequest.numberUnits` flows
  into `buildNextConfigForFieldTypeChange` (site 1). Continue sending `formulaSource` (`:486-488`).
  A `null` `numberUnits` means "clear the unit" (bare-number formula).

## What is NOT changing

- Formula authoring (source editor, suggestions, cycle errors) — untouched.
- Number fields' unit UX — untouched; formula reuses the same section/component and lib.
- The unit registry — reused as-is (see registry-drift watch-item below).

## Tests (frontend, `pnpm`, Vitest/RTL)

Extend the data-table + RoomsTable suites (e.g.
`shared/ui/data-table/__tests__/`, `features/equipment/__tests__/RoomsTable.formulaField.test.tsx`,
`RoomsTable.airflowFields.test.tsx`). Include one non-Rooms table harness for generality (D9).

1. **Carry-forward payload:** converting a number-with-airflow-units field to a formula emits an
   `editFieldBundle` whose `after.config.units` equals the source units (and `formulaSource` set).
2. **Display SI/IP:** a formula `FieldDef` with `numberUnits` + numeric overlay value renders
   `259.7 m³/h` in SI and `152.9 cfm` in IP as the toggle flips; precision honored.
3. **Bare-number formula:** a formula without units still renders as a plain number (no regression).
4. **Fixed disables controls:** the modal's units section is disabled + shows the fixed copy when
   `numberUnits.mode === "fixed"`; an `editable` formula lets the user change the unit type.
5. **Clear units:** setting units to null on a formula produces `after.config` with no `units`.
6. **Clipboard parity:** `formatDisplayCellValue` for a formula-with-units matches the grid cell.

## Verification

- `make frontend-dev-check` then `make ci` (frontend slice green).
- Manual (Playwright / browser, signed in as Ed per the seed-owner memory): on the Rooms table,
  add a custom airflow number field, convert "a custom sum target" to a formula
  `{that field} / 0.77`, confirm the cell shows airflow and flips with the topbar SI/IP toggle,
  and that the modal shows the (locked, if fixed) unit section.

## Risks / watch-items

- **Overlay value units.** Confirm the computed overlay is canonical SI at the point
  `ComputedCell` reads it (it is — backend evaluates on stored SI). If any table post-processes
  the overlay, re-verify before formatting.
- **Registry drift (PRD §7.9).** Frontend `NUMBER_UNIT_TYPES` has `power` / `length_mm` absent
  from the backend registry; a formula tagged with those would pass the modal but be rejected by
  the backend validator. Either hide unsupported types in the picker or add a shared snapshot
  test. Coordinate with Phase-1 watch-item.
- **Shared-component relabel (D11).** Parameterize the "Units"→"Display units" label + hint on
  `FieldConfigSectionNumberUnits` (or a thin wrapper) so the number-field usage is unchanged.
  Don't fork the component.
