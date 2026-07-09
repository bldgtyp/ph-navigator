# Phase 03 — Frontend: carry units on convert, display formula results with units, modal picker

```
DATE:    2026-07-09
TIME:    13:38 EDT
STATUS:  Planned — not started. Revised per the 2026-07-09 pre-implementation review:
         units ship as a TOP-LEVEL displayUnits request field (D12), never inside a
         formula target's config; backend reconciliation (D14) means formulaSource
         stays dirty-gated.
AUTHOR:  Ed + Claude
SCOPE:   Shared data-table UI (frontend/src/shared/ui/data-table/*) + unit format lib.
         Table-agnostic — every table using DataTable inherits it (D9).
DEPENDS: Phase 02 (backend must accept + persist formula units first).
RELATED: PRD.md §5.2/§5.3/§5.5, decisions.md D2/D4/D5/D11/D12/D14
```

## Goal

Surface Phase 2 in the field-config modal and the grid: converting a unit-bearing number field
to a formula **keeps its units**, a numeric formula's computed cell **renders through the unit
path** (SI/IP toggle, precision, suffix), and the modal exposes a **display-unit picker** on
formula fields (carried-forward + editable, disabled when `fixed`).

## Edit sites (all in `frontend/src/shared/ui/data-table/`, table-agnostic)

### 1. Ship units as top-level `displayUnits`, never in a formula target's config (D12)

Files: `lib/customFieldMutations.ts` — `buildNextConfigForFieldTypeChange` (`:434-503`) and
the bundle-request/WriteOp builder that emits `EditFieldBundleMutation`.

**Changed from the original plan.** Do NOT add a formula carve-out that writes
`nextConfig.units` — `EditFieldBundleMutation.after` is validated at request parse, and a
formula config carrying `units` without a server-side `result_type` 422s before the bundle
runs (D12). Instead:

- `buildNextConfigForFieldTypeChange` keeps its existing behavior: `delete nextConfig.units`
  for **every** non-number target, formula included. A formula's `after.config` carries only
  `source` (when the modal edited it) — exactly as today.
- The request/mutation gains a top-level `displayUnits` field mirroring `formulaSource`,
  with the D12 tri-state mapped explicitly:
  - `undefined` (omit) → backend carries forward the existing/source units — the default
    for a conversion where the user didn't touch the units section, and for any formula
    edit that leaves units alone;
  - explicit clear (the modal's "no units" state, when dirty) → backend clears to a
    bare-number formula;
  - a units object → set/retag (the `W÷CFM → electric_efficiency` case).
- Keep the existing `source`/`ast`/`deps`/`result_type` deletes for non-formula targets
  (`:465-472`). Backend owns ast/deps/result_type. Keep `typeConversionMatrix.ts` in
  lockstep (no matrix entry changes — PRD §7.11).

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
`isNumberUnitsConfig` is already imported/used for the number branch (`:209`). (The *stored*
config does carry `units` — D12 only changes the wire shape of the mutation, not the
persisted document.)

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
  Keep the existing error/empty handling in `ComputedCell` (`#ERROR`, blank) unchanged —
  units formatting must never touch an error overlay.

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
  `...(draftType === "number" && numberUnitsDirty ? { numberUnits } : {})`). For a formula
  target, emit the top-level `displayUnits` **only when `numberUnitsDirty`** (site 1's
  tri-state: dirty-with-value → set/retag; dirty-to-none → explicit clear; not dirty → omit,
  backend carries forward). `formulaSource` **stays dirty-gated** (`:486-488`) — the review
  originally flagged that a units-only retag would be dropped, but the fix landed backend-side
  (D14: step 5 reconciles on every formula-target bundle), so the frontend does NOT need to
  force-send the source. Don't add that workaround.

## What is NOT changing

- Formula authoring (source editor, suggestions, cycle errors) — untouched.
- Number fields' unit UX — untouched; formula reuses the same section/component and lib.
- The unit registry — reused as-is. The frontend↔backend registry drift (`power`,
  `length_mm`) is closed as a **Phase-2 prerequisite** (O4), so by this phase the picker and
  the backend agree; if Phase 2 chose "hide in picker", apply that here.

## Tests (frontend, `pnpm`, Vitest/RTL)

Extend the data-table + RoomsTable suites (e.g.
`shared/ui/data-table/__tests__/`, `features/equipment/__tests__/RoomsTable.formulaField.test.tsx`,
`RoomsTable.airflowFields.test.tsx`). Include one non-Rooms table harness for generality (D9).

1. **Conversion payload (D12):** converting a number-with-airflow-units field to a formula emits
   an `editFieldBundle` whose `after.config` has **no `units` key** and (units untouched) **no
   `displayUnits`** — carry-forward is the backend's job. With the units section edited pre-save,
   `displayUnits` is present top-level.
2. **Retag payload (D14):** editing only the Display-units section on an existing formula (source
   untouched) emits `displayUnits` **without** `formulaSource`.
3. **Clear units:** setting the section to "none" emits the explicit-clear form, not an omit.
4. **Display SI/IP:** a formula `FieldDef` with `numberUnits` + numeric overlay value renders
   `259.7 m³/h` in SI and `152.9 cfm` in IP as the toggle flips; precision honored.
5. **Bare-number formula:** a formula without units still renders as a plain number (no regression).
6. **Error overlay:** a formula error row still renders `#ERROR` / blank — never unit-formatted.
7. **Fixed disables controls:** the modal's units section is disabled + shows the fixed copy when
   `numberUnits.mode === "fixed"`; an `editable` formula lets the user change the unit type.
8. **Clipboard parity:** `formatDisplayCellValue` for a formula-with-units matches the grid cell.
9. **Display-string consumers:** any DataTable feature that consumes `formatDisplayCellValue`
   (search/filter, CSV, clipboard) now sees unit suffixes on formula columns — audit existing
   snapshot tests for intended-but-breaking diffs rather than silencing them.

## Verification

- `make frontend-dev-check` then `make ci` (frontend slice green).
- Manual (Playwright / browser, signed in as Ed per the seed-owner memory): on the Rooms table,
  add a custom airflow number field, convert the **built-in** "Supply airflow rate" to a formula
  `{that field} / 0.77` (no interim lock exists — Phase 1 landed first), confirm the cell shows
  airflow and flips with the topbar SI/IP toggle, the modal shows the locked (fixed) unit
  section, and converting back restores the plain number field with its units.

## Risks / watch-items

- **Overlay value units.** Confirm the computed overlay is canonical SI at the point
  `ComputedCell` reads it (it is — backend evaluates on stored SI). If any table post-processes
  the overlay, re-verify before formatting.
- **Tri-state mapping (D12).** `undefined` vs explicit-clear vs value must survive the request
  builder → WriteOp → wire serialization without collapsing (JSON drops `undefined` silently —
  make the explicit-clear form structurally distinct, matching whatever Phase 2 chose).
- **Shared-component relabel (D11).** Parameterize the "Units"→"Display units" label + hint on
  `FieldConfigSectionNumberUnits` (or a thin wrapper) so the number-field usage is unchanged.
  Don't fork the component.
