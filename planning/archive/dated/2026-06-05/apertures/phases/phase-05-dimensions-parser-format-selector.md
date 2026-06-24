---
DATE: 2026-06-05
TIME: 18:25 EDT
STATUS: Done
AUTHOR: Claude
SCOPE: Ship the horizontal + vertical dimension strips with
       tickmarks, per-segment labels, edge-hover add buttons,
       row / column delete buttons (with confirmation rule for
       data loss), per-user per-system display-unit format
       selector (`mm | cm | m` and `in | ft | ft-in | in-frac`),
       V1 parser port with parens + precision preservation, and
       the total-dimensions caption above the canvas.
RELATED:
  - planning/features/apertures/PRD.md §10, §10.1, §10.2, §10.3
  - planning/features/apertures/PLAN.md (Phase 05 row)
  - ../ph-navigator/frontend/src/features/project_view/data_views/windows/pages/UnitBuilder/Dimensions/
    (V1 parser + formatter source — port targets)
  - frontend/src/lib/units/length/ (V2 destination for the parser)
  - phase-01 (delivers `editDimension`, `addRow`, `addColumn`,
    `deleteRow`, `deleteColumn` command stubs; this phase fills
    them in)
---

# Phase 5 — Dimensions panel + parser + format selector

## P0. Why this slice

Phase 05 makes the canvas **resizable from the user's keyboard**.
The user picks a display format (`mm`, `cm`, `m` in SI; `in`,
`ft`, `ft-in`, `in-frac` in IP), reads dimension labels in that
format, types new values in mixed forms (`2'-6"`, `100 + 50`,
`(1200 - 50) / 4`), and the canvas re-renders. Backend stays
SI-only.

This phase also fills in five of the Phase 01 command stubs:
`editDimension`, `addRow`, `addColumn`, `deleteRow`,
`deleteColumn`. These are pure structural mutations on
`row_heights_mm` / `column_widths_mm` and on the element span
shifts that follow. Coverage is re-validated after each.

By the end of Phase 05:

- A horizontal dimension strip renders below the canvas with one
  label per column. A vertical strip renders to the left of the
  canvas with one label per row. Tickmarks render at every grid
  line.
- An edge-hover hot-zone reveals a `+` button at each of the four
  canvas edges; hover tooltip names the action; clicking inserts
  a new row / column at that edge with default `1000 mm` width /
  height.
- Each dimension label has a hover-revealed `−` button. Clicking
  it deletes that row / column. Last-row / last-column delete is
  blocked with a tooltip. Confirmation dialog only when the row /
  column contains element assignments that would be lost (any
  non-default frame, glazing, operation, or non-`Unnamed` name).
- Display-unit format selector lives in the strip gutter.
  Selection persists per-user, per-system, via
  `userPreferences.aperture_builder_dim_format_si` and
  `aperture_builder_dim_format_ip`. The system toggle (global
  IP/SI) picks which preference is active.
- The total-dimensions caption renders above the canvas:
  `<width> × <height>` in the active display format.
- The V1 parser modules are ported into `frontend/src/lib/units/
  length/` so the rest of the V2 frontend can reuse them. The
  Apertures feature imports from the shared lib, not from a
  feature-local copy.
- Precision preservation matches V1: typing `12 1/16"` after the
  underlying mm value was `305.5625` round-trips exactly when
  the typed value parses back to the same mm within `< 0.5 mm`.
- Dimension edits dispatch through `applyApertureCommand`'s
  `editDimension` handler; the canvas + element rectangles
  recompute immediately on the next render.
- All dimension-strip affordances render read-only on locked
  versions / Viewer access. The selector + total-dim caption
  remain functional (viewing aids).

Phase 05 does **not** ship element cards, pickers, operation
symbols, or U-Value chip values. Adding a row creates a new
element per opposing-axis cell with the seeded default frame /
glazing (Phase 01 factory).

## P1. Acceptance — Phase 5 done when

1. New shared parser modules live in `frontend/src/lib/units/length/`:
   - `parseFeetInches.ts`
   - `evaluateExpression.ts` (now supports parens via a
     recursive-descent parser; V1 papercut closed)
   - `parseInput.ts` (top-level dispatcher: detects format and
     routes)
   - `displayUnitConverter.ts` (mm ↔ display unit)
   - `formatFeetInches.ts` (ft-in + in-frac formatters)
   - `index.ts` (public exports)
   - `__tests__/` — every V1 test case ported verbatim plus parens
     cases for `evaluateExpression`.
2. The parser:
   - SI mode accepts arithmetic `+ - * /` with optional parens. No
     feet / inch markers allowed (returns NaN).
   - IP mode accepts feet (`2'`, `2ft`), inches (`6"`, `6in`),
     mixed (`2'-6"`, `2ft 6in`, `1' 6 1/2"`), fractions (`6-1/2"`,
     `1 1/16"`), and pure arithmetic (`24 + 12`) when no markers
     are present. Smart-quote normalization for `'` and `"`.
   - Empty, NaN, or `≤ 0` returns `null` (caller reverts).
   - Returns mm as a `number` for caller commits.
3. `parseToMm(input, system, format)` is the public entry. The
   format hint is used to choose IP vs SI parsing path; the
   parsed value is in mm regardless.
4. `formatMm(mmValue, system, format)` is the public formatter,
   returning the display string. `format=in-frac` rounds to the
   nearest `1/16"`. `format=ft-in` returns `<ft>' <in>"` style
   with feet ≥ 0 and inches always shown.
5. **Dimension strip layout** matches V1 (`Window Builder.png`):
   - Horizontal strip below the canvas, full canvas width, with
     a thin baseline, tickmarks at every grid line, and one
     label per column segment centered at the segment midpoint.
   - Vertical strip to the left of the canvas, full canvas
     height, with tickmarks at every grid line, and one label
     per row segment centered at the segment midpoint.
   - Strip gutter (top-left corner where the two strips meet)
     holds the display-format selector.
6. **Edge-hover add buttons:**
   - Four 40 px hot-zones (top / bottom / left / right of the
     canvas) reveal a circular `+` button on hover.
   - Tooltips: `Add row at top`, `Add row at bottom`,
     `Add column at left`, `Add column at right`.
   - On click, dispatches `addRow` / `addColumn` with the
     `position` argument (`"top" | "bottom" | "start" | "end"`).
     Default new dimension is `1000 mm`.
   - Backend handler also creates one element per opposing-axis
     cell, seeded with the default frame / glazing factory
     (Phase 01).
   - When adding at the start (`top` or `left`), backend shifts
     every existing element's `row_span` / `column_span` by +1
     in that axis before inserting the new cells.
7. **Delete-row / delete-column buttons:**
   - Each dimension label has a hover-revealed `−` button.
   - Disabled with a tooltip if it would leave the aperture
     with zero rows / columns:
     `An aperture type must have at least one row and one
     column.`
   - On click, evaluate the row / column's element-content
     state:
     - **Quiet path:** if every element overlapping this row /
       column has `name === "Unnamed"`, `operation === null`,
       glazing/frames all point at the seeded defaults
       (compared by `catalog_origin.catalog_record_id`), the
       backend deletes immediately.
     - **Confirmation path:** otherwise, open a shadcn
       `Dialog` (`Delete row 2?` / `Delete column 3?`) with
       body `2 elements with custom assignments will be
       removed. This can't be undone except by Discard
       Changes.` and Cancel / Delete buttons.
   - On confirm, dispatches `deleteRow` / `deleteColumn`.
8. **Edit a dimension label** — click swaps the label for an
   inline `<input>`:
   - Auto-focus, full-select.
   - `endAdornment` shows the unit (`mm`, `in`, `ft`) except in
     `ft-in` / `in-frac` modes where the value carries markers.
   - Tooltip per unit: SI `Tip: 1200 or 1200 / 4`; IP `Tip:
     2' 6", 6-1/2", or expressions like 24 + 12`.
   - Enter commits; Escape cancels; blur commits.
   - On commit, `parseToMm(input, system, format)` runs. If null
     or `≤ 0`, the field gets a red border + error icon with
     tooltip `Couldn't parse this — try 1200, 1' 6", 1200 / 4,
     or 1.2 m.` The unparseable value is not committed.
   - **Precision preservation:** on edit-mode entry, the prior
     mm value is captured. On commit, if `parseToMm(input) ===
     prevMm` (within `< 0.5 mm` tolerance), the prior value is
     restored verbatim instead of the parsed `formatMm` round-
     trip — this prevents typing `12 1/16"` from overwriting
     `305.5625` with `305.5`.
   - On successful commit, dispatches `editDimension` (carries
     `axis: "row" | "column"`, `index`, `new_mm`).
9. **Total-dimensions caption** renders above the canvas:
   - `<width> × <height>` in the active display format.
   - For SI, e.g. `1234.5 mm × 1000.0 mm`.
   - For IP `ft-in`, e.g. `3' 4-3/8" × 3' 3-3/8"`.
   - Renders on locked / Viewer access.
10. **Display-format selector:**
    - Shadcn `Select` in the strip gutter.
    - SI options: `Millimeters (mm)`, `Centimeters (cm)`,
      `Meters (m)`.
    - IP options: `Inches (in)`, `Feet (ft)`, `Feet & Inches
      (ft-in)`, `Fractional Inches (in-frac)`.
    - Selecting an option writes to user preferences and
      re-renders every label in the strip and the total caption.
    - System toggle (global IP/SI) auto-switches which
      preference is active.
11. **Backend `editDimension` / `addRow` / `addColumn` /
    `deleteRow` / `deleteColumn` handlers** in
    `aperture_commands/handlers/dimensions.py`:
    - All five run coverage validation after the mutation.
    - `editDimension` enforces `new_mm > 0`.
    - `addRow` / `addColumn` accept `position` and
      `default_dim_mm` (default `1000.0`); they create one new
      element per opposing-axis cell via the default-refs
      factory; spans on existing elements are clamped or
      shifted as needed.
    - `deleteRow` / `deleteColumn` reject the last-row / last-
      column case with a structured error
      (`aperture_dimension_min_violation`).
    - `deleteRow` / `deleteColumn` clamp every overlapping
      element's span; if an element ends up with an empty span,
      it is removed and the freed cells are merged into the
      next adjacent element. Implementation note: the
      "absorbed-by-neighbor" rule chooses the highest-index
      remaining neighbor on the same axis; document the choice
      in the handler so split semantics in Phase 08 line up.
12. `make ci` is green.

## P2. Files

### New (shared parser)

- `frontend/src/lib/units/length/parseFeetInches.ts`
- `frontend/src/lib/units/length/evaluateExpression.ts`
- `frontend/src/lib/units/length/parseInput.ts`
- `frontend/src/lib/units/length/displayUnitConverter.ts`
- `frontend/src/lib/units/length/formatFeetInches.ts`
- `frontend/src/lib/units/length/index.ts`
- `frontend/src/lib/units/length/__tests__/parseFeetInches.test.ts`
- `frontend/src/lib/units/length/__tests__/evaluateExpression.test.ts`
- `frontend/src/lib/units/length/__tests__/parseInput.test.ts`
- `frontend/src/lib/units/length/__tests__/formatFeetInches.test.ts`
- `frontend/src/lib/units/length/__tests__/displayUnitConverter.test.ts`

### New (apertures feature)

- `frontend/src/features/apertures/components/HorizontalDimensionStrip.tsx`
- `frontend/src/features/apertures/components/VerticalDimensionStrip.tsx`
- `frontend/src/features/apertures/components/DimensionLabel.tsx`
  (the click-to-edit label primitive shared by both strips)
- `frontend/src/features/apertures/components/EdgeAddButtons.tsx`
- `frontend/src/features/apertures/components/DeleteDimensionDialog.tsx`
- `frontend/src/features/apertures/components/DisplayFormatSelector.tsx`
- `frontend/src/features/apertures/components/TotalDimensionsCaption.tsx`
- `frontend/src/features/apertures/hooks/useDimensionDraft.ts`
  (handles edit-mode lifecycle + precision preservation)
- `frontend/src/features/apertures/__tests__/DimensionLabel.test.tsx`
- `frontend/src/features/apertures/__tests__/useDimensionDraft.test.tsx`
- `frontend/src/features/apertures/__tests__/HorizontalDimensionStrip.test.tsx`
- `frontend/src/features/apertures/__tests__/precision-preservation.test.ts`

### New (backend)

- `backend/features/project_document/aperture_commands/handlers/dimensions.py`
- `backend/features/project_document/__tests__/test_aperture_dimensions_commands.py`

### Modified

- `frontend/src/features/apertures/components/ApertureCanvasContainer.tsx`
  - Compose `TotalDimensionsCaption` above the canvas wrapper.
  - Compose `HorizontalDimensionStrip` below the canvas.
  - Compose `VerticalDimensionStrip` to the left of the canvas.
  - Compose `EdgeAddButtons` (4 hot-zones).
- `frontend/src/features/apertures/apertures.css`
  - Strip layout, tickmarks, label baseline, edge `+` button
    styling, error-state input border.
- User-preferences store — add
  `aperture_builder_dim_format_si` and
  `aperture_builder_dim_format_ip` keys with defaults.
- `backend/features/project_document/aperture_commands/models.py`
  - Fill in `EditDimension`, `AddRow`, `AddColumn`, `DeleteRow`,
    `DeleteColumn` command shapes (Phase 01 stubbed them).

### Deleted

None.

## P3. Component / model shapes

```ts
// frontend/src/lib/units/length/parseInput.ts — sketch

export function parseToMm(
  input: string,
  system: "si" | "ip",
  format: SiFormat | IpFormat,
): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (system === "ip") {
    const ft = parseFeetInches(trimmed);
    if (ft !== null) return ft.mm;
    const expr = evaluateExpression(trimmed);
    if (expr === null) return null;
    return convertToMm(expr, format);
  }
  const expr = evaluateExpression(trimmed);
  if (expr === null) return null;
  if (expr <= 0) return null;
  return convertToMm(expr, format);
}
```

```ts
// useDimensionDraft.ts — sketch

export function useDimensionDraft(initialMm: number, format: DisplayFormat) {
  const initialDisplay = formatMm(initialMm, format.system, format.unit);
  const initialMmRef = useRef(initialMm);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialDisplay);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    initialMmRef.current = initialMm;
    setDraft(initialDisplay);
    setError(null);
    setEditing(true);
  }

  function commit(): { ok: true; mm: number } | { ok: false } {
    const parsed = parseToMm(draft, format.system, format.unit);
    if (parsed === null || parsed <= 0) {
      setError("Couldn't parse this — try 1200, 1' 6\", 1200 / 4, or 1.2 m.");
      return { ok: false };
    }
    if (Math.abs(parsed - initialMmRef.current) < 0.5) {
      // precision preservation: typed value matches prior mm; keep prior
      setEditing(false);
      return { ok: true, mm: initialMmRef.current };
    }
    setEditing(false);
    return { ok: true, mm: parsed };
  }

  function cancel() {
    setDraft(initialDisplay);
    setError(null);
    setEditing(false);
  }

  return { editing, draft, error, setDraft, startEditing, commit, cancel };
}
```

```python
# backend/features/project_document/aperture_commands/handlers/dimensions.py
# — sketch

def apply_edit_dimension(
    body: ProjectDocumentV1,
    command: EditDimension,
    actor: str,
    catalog: CatalogReader,
) -> tuple[ProjectDocumentV1, dict[str, object]]:
    apertures = list(body.tables.apertures)
    idx, entry = _locate(apertures, command.aperture_type_id)
    if command.new_mm <= 0:
        raise api_error(422, "aperture_dimension_must_be_positive", ...)
    dims = list(
        entry.column_widths_mm if command.axis == "column" else entry.row_heights_mm
    )
    if command.index >= len(dims):
        raise api_error(422, "aperture_dimension_index_out_of_bounds", ...)
    dims[command.index] = command.new_mm
    next_entry = entry.model_copy(update={
        "column_widths_mm" if command.axis == "column" else "row_heights_mm": dims,
    })
    apertures[idx] = next_entry
    next_body = body.model_copy(
        update={"tables": body.tables.model_copy(update={"apertures": apertures})}
    )
    audit = {"command": "editDimension", "aperture_type_id": command.aperture_type_id,
             "axis": command.axis, "index": command.index, "new_mm": command.new_mm}
    return next_body, audit
```

## P4. Sequence

1. **Commit 1 — Shared parser.** Port all five parser modules
   into `frontend/src/lib/units/length/` with their V1 test cases
   verbatim plus parens cases. Public surface only.
2. **Commit 2 — Backend dimension commands.** Fill in
   `editDimension`, `addRow`, `addColumn`, `deleteRow`,
   `deleteColumn` handlers. Tests cover happy paths, last-row/col
   reject, span clamping, and the absorbed-by-neighbor rule on
   delete.
3. **Commit 3 — Dimension label primitive + edit hook.** Add
   `DimensionLabel`, `useDimensionDraft`, and the precision-
   preservation test fixture. No strip composition yet — render
   in isolation.
4. **Commit 4 — Horizontal + vertical strips.** Compose strips
   with tickmarks + labels + per-segment delete buttons.
5. **Commit 5 — Edge-add buttons + delete dialog.** Wire
   `EdgeAddButtons` and `DeleteDimensionDialog`. Quiet-vs-confirm
   logic implemented client-side.
6. **Commit 6 — Display-format selector + total-dim caption.**
   Persist preferences. Wire system-toggle interaction.
7. **Commit 7 — Mount in `ApertureCanvasContainer` + CSS
   polish.** `make ci` green.

## P5. Tests

### Unit — parser

- `parseFeetInches`: every V1 test case ported verbatim.
- `evaluateExpression`: V1 cases plus
  `(1200 - 50) / 4 === 287.5`, `((1+2)*3) === 9`, mismatched parens
  return null.
- `parseInput`: dispatch correct branch by system; reverts on
  empty / NaN / ≤ 0.
- `displayUnitConverter`: round-trip mm → display → parseToMm
  preserves value within `< 0.5 mm` for every supported format.
- `formatFeetInches`: `305.5625 mm` → `1' 0-1/16"` in ft-in;
  `305.5625 mm` → `12-1/16"` in in-frac.

### Unit — `useDimensionDraft`

- Precision preservation: initial mm `305.5625`, draft input
  `12 1/16"` → commit returns `{ ok: true, mm: 305.5625 }` (not
  `305.5`).
- Parse error: empty input → `{ ok: false }`, error tooltip set.
- Cancel: draft reverts to original display.

### Component — strips

- Horizontal strip renders one label per column, tickmarks at
  every grid line, total caption matches sum.
- Vertical strip mirrors.
- Hover reveals `−` button on labels; tooltip on last-row/col
  is shown; click on non-last opens dialog when content is
  customized, commits quietly when not.

### Component — `EdgeAddButtons`

- Four hot-zones reveal their `+` button on hover.
- Each click dispatches the correct command with the right
  position arg.
- Disabled / hidden on locked / Viewer.

### Backend — dimension commands

- `editDimension` updates the array, re-validates coverage.
- `addRow` at `start` shifts all element row_spans by +1 and
  creates one default element per column.
- `deleteRow` last-row → 422.
- `deleteRow` non-last → element spans clamp; orphan elements
  absorbed into adjacent neighbor on the same axis.
- `addColumn` / `deleteColumn` mirror.

### Browser

- Open an aperture; switch display format from `mm` to `ft-in`;
  labels and total caption update in place.
- Type `1' 6"` into a label; press Enter; canvas updates.
- Type a malformed value; verify red border + tooltip; canvas
  unchanged.
- Hover the bottom edge, click `+`, verify a new row appears
  with one new default-frame / default-glazing element per
  column.
- Hover a row label, click `−`, verify confirmation when the
  row contains customized elements.

### Regression

- The shared `lib/units/length/` parser does not break other V2
  surfaces that import it later (e.g. Envelope dimension
  editors will migrate to the same shared lib in their own
  phase).

## P6. Out of scope (lands in later phases)

- Element cards / pickers — Phase 06.
- Operation symbols — Phase 07.
- Merge / split — Phase 08.
- U-Value chip values — Phase 09.

## P7. Risks

- **R-05-1. V1 parser may carry edge-case bugs we don't want
  to inherit.** Mitigation: port tests verbatim first; any V1
  bug is exposed as a new test, then fixed in a follow-up
  commit inside this same phase with the fix documented in
  the commit message.
- **R-05-2. Precision preservation is subtle.** Mitigation:
  `useDimensionDraft.test.ts` covers eight fixtures pulled from
  the V1 PR that introduced `initialEditValue` (V1 ref §17).
- **R-05-3. `deleteRow` absorbed-by-neighbor rule must compose
  with merge / split (Phase 08).** Mitigation: handler exports
  a pure helper `absorb_orphan_span(entry, freed_span)` that
  Phase 08 reuses for the split-undo path; this keeps the rule
  in one place.
- **R-05-4. Default-refs factory failure inside `addRow` /
  `addColumn` fails the whole command.** Mitigation: surface
  the same `aperture_default_refs_missing` 503 as Phase 01;
  the UI handles it with the toast pattern from Phase 02.
- **R-05-5. The shared parser lib touches more than this
  feature.** Mitigation: scope this phase to *creating* the
  shared module + apertures consumer; Envelope migration to the
  same module is a separate phase under the envelope feature.

## Implementation note (2026-06-05)

Shipped in two PRs rather than the phase doc's seven sub-commits — at the
size the changes split cleanly along a parser+backend / UI seam, which
keeps each diff reviewable on its own.

Deviations from the spec:

- **Sub-PR A — parser path:** `frontend/src/lib/units/length/index.ts`
  was *not* created. A file `frontend/src/lib/units/length.ts` already
  exists with the `formatLengthFromMm` / `parseLengthToMm` surface used
  by Envelope; adding `length/index.ts` invites a TS module-resolution
  collision where `./length` is ambiguous between the file and the
  directory's index. Consumers import the new modules by file
  (`from "../../../lib/units/length/parseInput"`). The bundler test
  passed; a follow-up cleanup phase can rename the directory to
  `length-input/` or merge surfaces if the duplication becomes
  confusing.
- **Sub-PR A — backend command fields:** `editDimension`,
  `addRow`, `addColumn` kept Phase 01's field names (`new_value_mm`,
  `at_index`, `height_mm`, `width_mm`) instead of renaming to the
  phase doc's `new_mm` / `position` / `default_dim_mm`. The Phase 01
  wire contract is already deployed and would have rippled through
  the dispatcher + mocks; the renames carry no functional benefit.
- **Sub-PR A — addRow/addColumn handler shape:** the `position`
  ("top" / "bottom" / "start" / "end") argument is computed on the
  frontend (`at_index = 0` for start, `length` for end). Backend
  receives a numeric `at_index` only. Same end behavior, smaller wire
  shape.
- **Sub-PR A — delete-row absorption:** the "highest-index neighbor on
  same axis" rule is satisfied by clamp-and-shift in every valid
  layout we tested (1xN, Nx1, multi-cell straddles, full-row spans);
  no explicit reassignment pass was needed. The handler comment
  documents this so Phase 08 split-undo can rely on the same
  ordering.
- **Sub-PR B — format pref persistence:** the phase doc asks for two
  server-backed preference keys
  (`aperture_builder_dim_format_si` / `_ip`). V2's preference store
  is currently server-backed for the SI/IP toggle only and adding
  two more keys would have required backend schema + session payload
  changes that don't justify the surface area for an in-progress
  feature. Shipped as `localStorage`-backed via
  `useApertureDimFormat` so a future swap to server-side doesn't
  ripple through call sites.
- **Sub-PR B — quiet-vs-confirm rule:** the phase doc compares
  frame/glazing refs to seeded `catalog_origin.catalog_record_id`
  values to decide whether to confirm. Those default record ids are
  not exposed to the frontend yet (the Alembic seed is also still
  deferred), so `delete-dimension-impact.ts` approximates: an
  element is "customized" if it has a non-`Unnamed` name or a
  non-null operation. Once the pickers ship (Phase 06+), this check
  extends to compare against the seeded ids. The rule errs toward
  confirming (false positives are safe; false negatives lose work).
- **Sub-PR B — dialog primitive:** reused the existing
  `ConfirmDestructiveDialog` (already used by the data-table delete
  flows) rather than shipping a one-off shadcn `Dialog` instance.
  Copy matches the spec verbatim.
- **Sub-PR B — sub-commit count:** shipped as one commit per sub-PR
  rather than the phase doc's seven small commits. Sub-commits would
  have left intermediate states where the wire shape compiled but
  the UI was incomplete; bundling keeps each commit shippable.

The `editDimension` happy-path → `addRow` → `editDimension` →
`deleteRow` flow is wired end-to-end: `AperturesTab` → `dispatch` →
`POST /apertures/command` → backend handler → coverage re-check →
`validate_document` → response → optimistic store update. No new
mutations or repositories were needed.
