---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: Active — captured, not scheduled
AUTHOR: Claude (Opus 4.8) for Ed May
SCOPE: Two shared-DataTable fixes: (11) selected-cell overlay z-index behind the
  frozen gutter, and (12) a redesign of the single-select field-config "manage
  options" modal (look, color picker, reorder handles, deferred validation).
  Both are parent-owned in the shared DataTable, so they apply to every table.
RELATED:
  - frontend/src/shared/ui/data-table/DataTable.css (item 11 — z-index; item 12 — swatch styling)
  - frontend/src/shared/ui/data-table/DataTable.tsx (item 11 — frozen/sticky columns + selection overlay)
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionOptions.tsx (item 12)
  - frontend/src/shared/ui/data-table/components/FieldConfigSectionCreateOptions.tsx (item 12)
  - frontend/src/shared/ui/data-table/components/CreateFieldConfigModal.tsx (item 12 — modal shell)
  - planning/features_v1.1/catalog-manage-options-modal/ (RELATED — wires this modal open for catalog fields; different concern, cross-check both)
---

# Data-Table UI fixes

Both items live in the shared `DataTable` component, so a single fix propagates
to every table (consistent with the DataTable-uniformity iron-law).

## Item 11 — Selected-cell overlay renders above the frozen gutter (bug)

When a cell is selected, its selection outline/highlight renders **above** the
frozen columns (left row-number gutter / pinned cells) as content scrolls behind
them. It should sit **behind** the frozen layer.

**Desired:** the selected-cell overlay's z-index sits **below** the frozen/pinned
column layer, so the gutter always paints over it. Fix in `DataTable.css` /
`DataTable.tsx` stacking context. Small, low-risk.

## Item 12 — Single-select field-config modal redesign (redesign)

Double-clicking a single-select field header opens the "manage options" modal.
It looks poor and has several concrete problems. **Use the `frontend-design`
skill** for the visual pass; model it on the **AirTable** single-select modal
(Ed's reference screenshot) — cleaner spacing, typography, and controls.

Sub-issues:

1. **Overall look.** Fix padding, font, size, margins, spacing. AirTable modal is
   the quality bar.
2. **Reference.** AirTable's single-select field editor = the "good" example to
   emulate (layout, control styling, footer).
3. **Color swatches broken.** `data-table-field-editor-color-circle` swatches
   look terrible: bad colors, weird stretched shape, and a nonsensical down
   chevron. Clicking does nothing. **Desired:** a clean swatch that, when
   clicked, opens a **color picker** so the user sets that option's color.
4. **Missing reorder handles.** No drag-to-reorder affordance. Add the standard
   6-dot reorder handle (like AirTable) so options can be reordered.
5. **Premature validation.** Adding a new option immediately shows "Every option
   needs a label." before the user types anything. **Desired:** validate only on
   **Save** attempt — don't yell before the user has entered data.

**Acceptance:**

- Modal reads as intentional and uncramped; comparable polish to the AirTable
  reference.
- Each option has a clean color swatch that opens a working color picker.
- Options show a 6-dot handle and can be dragged to reorder.
- A freshly added blank option shows no error until Save is attempted.

**Notes / cross-refs:**

- The **reorder handle** (#4) shares the drag-reorder interaction with the
  sidebar manual-ordering work in
  [`sidebar-organization`](../../features/sidebar-organization/README.md). Build
  or reuse **one** shared reorder primitive across both.
- [`features_v1.1/catalog-manage-options-modal`](../../features_v1.1/catalog-manage-options-modal/README.md)
  is about making this same modal *reachable* for catalog single-selects
  (frame-types / materials), which drive their grids via a bespoke `onWrite`
  controller. That's a wiring gap, not a redesign — but any redesign here should
  stay compatible with that path. Check it before touching the modal shell.

**Open Q:** does the option model already carry a free-form color value, or only
a fixed palette index? A true color picker (#3) may need the option schema to
store an arbitrary hex. Confirm before committing to picker vs. expanded palette.
