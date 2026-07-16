---
DATE: 2026-07-15
TIME: 20:44 EDT
STATUS: ✅ Complete — implemented 2026-07-15 on branch `refactor/datatable-ui-fixes` (commit c49fa22c)
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

## ✅ Status — COMPLETE (2026-07-15)

Implemented on branch `refactor/datatable-ui-fixes` (off `main`), commit
`c49fa22c`. Both items done.

**Item 11 (z-index):** dropped the `z+9` override on
`.data-table td.data-table-cell-active[data-row-edge="bottom"]` in
`DataTable.css` so the bottom-row active cell keeps the normal active `z+2`,
below the frozen column (`z+5`) and gutter (`z+7`). The sticky summary bar
(`z+8`) now correctly covers a bottom-row active cell scrolled behind it
(AirTable footer parity); the fill handle is pinned inside the cell so it is
never clipped in the normal scrolled-to-bottom state. Root cause was the
`2026-07-09` summary-bar z-fix, which raised the active cell above the whole
frozen lane to clear the summary bar.

**Item 12 (modal redesign):**
- New shared `components/OptionColorPicker.tsx` — clean circular swatch trigger
  → Radix popover with the curated quick-pick grid **plus a native custom-hex
  input** (Ed chose "curated palette + custom hex"; `FieldOption.color` is a
  free-form string, so **no schema change** — the Open Q below is resolved).
  Used by **both** the create and edit option editors.
- Reorder handle: fixed the permanently-invisible grip (its hover-reveal
  selector keyed off `.data-table-view-popover-rule`, a parent the option row
  never has) → `GripVertical`, revealed on row hover, reusing
  `.data-table-view-popover-drag`.
- Deferred validation: blank rows are the "add option" affordance, dropped from
  the saved set instead of erroring; only real conflicts (duplicate labels, or
  an in-use option blanked) surface.
- Palette expanded 6→10; spacing/typography polish; orphaned CSS removed.

**Verification:** `make ci-frontend` green (format + lint 0-errors + typecheck +
2167 tests + build); guards `check:z-index` / `check:css-vars` / `check:hex` /
`check:data-table` green; 2 new unit tests lock the deferred-validation
behavior. **Browser spot-check NOT done** — the Playwright profile was locked by
another session all run; recommend a manual pass (open a single-select header →
manage options: grip visible on hover, swatch opens palette + custom picker, add
blank option shows no error; then bottom-row selection + horizontal scroll to
confirm the frozen gutter paints over it).

**Deferred follow-ups (not in this packet's scope):**
- **Shared `OptionRow` / `OptionListEditor` primitive** so the *create* modal
  also gains drag-to-reorder (today reorder is edit-only). The create + edit
  editors still carry parallel `updateOption`/`removeOption`/`addOption` +
  blank-row validation. This overlaps the "one shared reorder primitive" work
  tracked in [`sidebar-organization`](../../2026-07-16/sidebar-organization/README.md)
  — do them together.
- **Named z-index token ladder** (`--z-dt-active/-frozen/-gutter/-summary`) to
  replace the ~9 scattered `calc(var(--z-base) + N)` offsets in `DataTable.css`,
  so frozen-vs-summary-vs-active ordering lives in one source of truth. Only
  worth it if these z-fights keep recurring.

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
  [`sidebar-organization`](../../2026-07-16/sidebar-organization/README.md). Build
  or reuse **one** shared reorder primitive across both.
- [`features_v1.1/catalog-manage-options-modal`](../../../../features_v1.1/catalog-manage-options-modal/README.md)
  is about making this same modal *reachable* for catalog single-selects
  (frame-types / materials), which drive their grids via a bespoke `onWrite`
  controller. That's a wiring gap, not a redesign — but any redesign here should
  stay compatible with that path. Check it before touching the modal shell.

**Open Q (RESOLVED):** `FieldOption.color` is already a free-form `string`
(stores arbitrary hex), so the true color picker needed **no schema change**.
Shipped as a curated quick-pick palette + a native custom-hex input (Ed's call).
