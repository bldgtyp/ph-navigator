---
DATE: 2026-07-09
TIME: 11:50
STATUS: Fixed (2026-07-09)
AUTHOR: Ed May (reported), Claude (recorded)
SCOPE: EQUIPMENT / VENTILATORS table — "HP Indoor Units" field
RELATED:
  - feedback_datatable_uniformity_ironlaw
  - context/UI_UX.md
---

# VENTILATORS: "HP Indoor Units" field cannot be hidden or reordered

## Summary

In **EQUIPMENT / VENTILATORS**, the **"HP Indoor Units"** column/field
behaves differently from every other field and appears to be missing the
standard DataTable affordances.

## Observed behavior

1. **Cannot be hidden.** Neither the right-click context menu nor the
   "Hide Fields" control will hide it. The field stays visible regardless.
2. **Cannot be reordered.** Attempting to drag/reorder it always snaps it
   back to the **last position** — it will not hold any other position.
3. **Missing the built-in field bottom-border highlight.** It does not
   render the standard "built-in" field bottom border that other built-in
   fields show.

## Why it matters

This violates the DataTable uniformity iron-law
([[feedback_datatable_uniformity_ironlaw]]): basic affordances
(hide, reorder, built-in styling) are supposed to be parent-owned and
uniformly enforced, not opt-in per field. This field is escaping that
contract.

## Hypothesis / where to look

The always-last-position + can't-hide + missing-built-in-border trio
suggests "HP Indoor Units" is being treated as a special/pinned or
computed/derived column outside the normal field list — likely appended
by the table config rather than registered as a normal built-in field, so
the hide/reorder/border machinery never sees it.

Start in the VENTILATORS table definition and the shared DataTable
field-config / column-ordering logic.

## Repro

1. Open a project → EQUIPMENT → VENTILATORS.
2. Right-click the "HP Indoor Units" header → note no working "hide" option.
3. Open "Hide Fields" → note it can't be toggled off.
4. Try to drag it left → note it snaps back to the last position.
5. Compare its header bottom border to adjacent built-in fields.

## Root cause (confirmed)

Two independent defects, both now fixed:

1. **Can't hide / snaps to last (symptoms 1 & 2).** The "HP indoor units"
   column is a synthetic incoming-link column that `VentilatorsTable`
   appends on top of the slice schema (`incomingIndoorUnitsFieldDef` /
   `incomingIndoorUnitColumnDef`, id `incoming_indoor_unit_ids`). But the
   view-state sanitizer (`sanitizeViewStateForSchema`) is fed a **stub
   column list built only from `slice.field_defs`**
   (`ventilatorsTableColumnsForSanitize`), which omitted that id. So on
   every render the sanitizer stripped `incoming_indoor_unit_ids` from
   `view.columnOrder` and `view.hiddenColumns` — hide never stuck and a
   drag-reorder was reverted (re-appended in declaration order ≈ last).
2. **Missing built-in border (symptom 3).** `incomingLinkFieldDef` did
   not set `built_in`, so `isBuiltInField` returned false and the header
   never got the `data-schema-locked` bottom border.

## Fix

- `shared/ui/data-table/incoming-links.tsx`: `incomingLinkFieldDef` now
  marks the projection `built_in: true` + fully `locked` (uniform for
  **every** incoming/inverse-link column — Ventilators, heat-pumps,
  Pumps, Space-Types — so they all get the built-in border + no
  edit/delete/duplicate). This is the iron-law-correct place: the
  affordance is parent-owned, not per-table.
- `shared/ui/data-table/DataTable.tsx`: `isFormulaReferenceableField`
  now excludes read-only **linked-record** projections by shape, so they
  stay out of the formula registry despite `built_in`.
- `features/equipment/lib.ts`: `ventilatorsTableColumnsForSanitize`
  appends the `incoming_indoor_unit_ids` stub so hide/reorder survive.
- `features/equipment/heat-pumps/routes/HeatPumpsPanel.tsx`: same
  sanitize omission fixed for the outdoor-equip / indoor-equip /
  outdoor-units tables (each renders an incoming-link column).

Reference for the correct pattern: `spaceTypeColumnStubs` already threads
`inverse_link_fields` into its sanitize stubs — Space-Types was never
affected.

## Verification

- `pnpm exec vitest run` across `data-table`, `equipment`, `spaces`:
  1291 passed. New tests: `columns.test.tsx` asserts the built-in/locked
  contract; `equipment/lib.test.ts` asserts the incoming column id is in
  the ventilators sanitize stub.
- `make frontend-dev-check`: green (typecheck + lint + build).

## Deferred follow-up

`PumpsTable` builds inverse columns dynamically from
`pumpsSlice.inverse_link_fields`, but `pumpsTableColumnsForSanitize` (via
`useEquipmentTablePreview`, which only passes `field_defs`) still omits
them — the same latent defect. It only bites if some table links **to**
pumps (non-empty `inverse_link_fields`). Fixing it cleanly means
threading the inverse fields into the sanitize stub the way
`spaceTypeColumnStubs` does, which changes the shared
`useEquipmentTablePreview` contract — left as a separate bite.

## Status

Fixed 2026-07-09. Recorded from user report.
