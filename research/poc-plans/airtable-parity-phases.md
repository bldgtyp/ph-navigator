---
DATE: 2026-05-07
STATUS: Draft phase plan — turns airtable-wishlist.md into a vertical-slice
        execution sequence. Update as phases land.
RELATED: airtable-wishlist.md (source of truth for parity features),
         catalog-poc-plan.md §4–§5 (the original plan this supersedes),
         grid-spike-results.md (TanStack adoption decision)
---

# AirTable Parity — Phase Plan

## 1. Purpose

`airtable-wishlist.md` records *what* AirTable behaviors must be replicated
to pass the binding success criterion in plan §2. This document records
*the order in which we build them and demo them in the browser*, grouped
into phases that each land a coherent, end-to-end-testable slice.

This plan supersedes the per-week scope in `catalog-poc-plan.md` §4–§5.
That plan budgeted "weeks 1–2" for read-only DataTable + write-capable
DataTable; the wishlist scope is materially larger than what those weeks
contemplated, so we recalibrate (see §13 below).

## 2. Sequencing rules (binding for this plan)

These are Ed's working rules. Every phase obeys all of them.

1. **Vertical slice, every phase.** Each phase ends with a literal
   click-by-click demo Ed can perform in the browser to verify the work.
   No phase ships purely-internal plumbing without a visible payoff.
2. **No surprise infrastructure late.** Every backend dependency a phase
   needs is identified up front. If Phase N's demo requires a backend
   route that doesn't exist, that route is built (or stubbed) in Phase N,
   not after.
3. **Stay in-memory through Phase 5.** All edits live in browser state
   only; the spike's `_spike/materials` endpoint stays read-only. Real
   persistence (DB writes, per-user view state, audit log) lands as a
   single block after the gate is passed in §11. Rationale: the parity
   gate is a UX question. Adding DB round-trips slows iteration without
   answering the gate's question. The trade-off is that Phase 3 undo and
   Phase 4 option-add do not survive page reload, which is acceptable
   because we're not yet using the catalog for real work.
4. **Evolve the sandbox in place.** Keep building inside
   `frontend/src/features/catalog/_components/SandboxTanStack.tsx` and
   the `/catalog-poc/sandbox-tanstack` route. Do **not** extract a
   `<DataTable>` component until §11.1 (the post-gate refactor). Until
   then, the sandbox file is the prototype.
5. **No half-finished phases.** A phase is "done" when its demo passes
   in the browser. If a sub-feature is too risky / too long, descope it
   from the phase explicitly in writing rather than half-shipping it.
6. **Demo gates the next phase.** After each phase, sit with John for a
   short walkthrough; only start the next phase if the current one
   passes. If a phase fails its demo, fix or descope before advancing.
7. **Defer aggressively.** Every "nice to have" not on the wishlist gets
   pushed to a follow-up. The phases below already make many such cuts
   (see §12).

## 3. Phase summary (one-line each)

| # | Phase | Wishlist items | Browser demo in one sentence |
|---|---|---|---|
| 1 | Active cell + single-cell copy | (foundations) | Click any cell, see a focus border, arrow-key around, Enter to edit, ⌘C copies the value to your text editor. |
| 2 | Range selection + structured copy | #1, #2 | Click-drag a rectangle (or click a row gutter / column header), see one contiguous outline, ⌘C and paste into Excel as a properly-shaped block. |
| 3 | Bulk write gestures with undo | #1b, #1g, #1h | Paste a 10-row block into a 5-row table, accept the auto-add-rows prompt; drag the fill handle from one cell across 100; ⌘Z reverts each step. |
| 4 | Single-select field type | #1c | Edit a `category` cell with a popover, add a new option mid-edit; paste a column of new category strings, see options auto-created with palette colors. |
| 5 | Stacked sort/filter/group + toolbar tinting | #1d, #1e | Stack 2 filters + 2 sorts + 2 group levels, see toolbar buttons fill with their tints, see column headers and cells tint to match, see grouped accordion with counts and means. |
| 6 | (gated) Inline schema editor | #1f | Click "+" in the header row, modal opens, add a new column; double-click an existing header, change type from text → single-select with a preview of the conversion. |

Phases 1–5 close the parity gate. Phase 6 only happens if the gate
evaluation in §11 says it must.

## 4. Phase 1 — Active cell + single-cell copy

### 4.1 Goal

Establish the foundation that every later phase depends on: a single
"focused cell" model, keyboard navigation, the inline-edit cycle, and a
single-cell ⌘C copy. Without this, nothing else in the wishlist can be
built.

### 4.2 Wishlist items addressed

None directly. This is implicit prerequisite work that Ed didn't list
because it's not an "AirTable feature" per se — it's the table behaving
like a table at all. Calling it Phase 1 honors the no-surprise rule:
this work has to happen, and it has to happen first.

### 4.3 What's built

**Frontend** (all in `SandboxTanStack.tsx`):

- **Active cell state** — `{ rowIndex, colId } | null`. Click on any cell
  sets focus. Visible border around the focused cell (~2 px AirTable
  blue) without affecting layout.
- **Keyboard navigation** —
  - `ArrowLeft` / `ArrowRight` / `ArrowUp` / `ArrowDown` move focus,
    clamped to table bounds.
  - `Tab` / `Shift+Tab` move horizontally, wrapping to next/prev row.
  - `Enter` enters edit mode on the focused cell.
  - `Esc` cancels an in-progress edit; second `Esc` clears focus.
  - `Home` / `End` move to first / last column in the row.
- **Click-to-focus / Enter-to-edit semantics** — replaces the spike's
  current double-click-only edit. Single-click → focus, Enter or
  double-click → edit, blur or Enter commits.
- **Auto-scroll-into-view on focus change** — virtualizer scrolls so the
  focused cell is visible. Critical when arrow-key navigation crosses
  the viewport edge.
- **Frozen first column** (`name`) — sticky-left, with a hairline border
  separating it from the scrolling region. Matches the AirTable layout
  and pre-empts a Phase 2 issue (range selection across a non-frozen vs.
  frozen boundary).
- **Single-cell ⌘C** — when a cell is focused and not editing,
  ⌘C / Ctrl+C copies the cell's plain-text value to the clipboard.
- **Density / banding / hover polish** — 32 px row height, hover row
  highlight (no banding), single 1 px dividers. Matches AirTable visual
  density.
- **Empty cell rendering** — null values render as empty space, not
  `null` or `—`.

### 4.4 Backend dependencies

**None.** Existing `_spike/materials` endpoint suffices. All edits live
in component state.

### 4.5 Browser demo

1. Load `/catalog-poc/sandbox-tanstack`.
2. Click the cell in row 5, column `name` → focus border appears.
3. Press `ArrowDown` four times → focus moves to row 9; viewport
   scrolls if needed.
4. Press `ArrowRight` until focus crosses out of the frozen `name`
   column → frozen column stays visible while focus moves into the
   scrolling region.
5. Press `Enter` → cell enters edit mode, input is focused.
6. Type a value, press `Enter` → edit commits, focus stays on the cell.
7. Press `Esc` once → if editing, edit cancels.
8. Press `⌘C` → switch to a text editor, paste → see the cell's
   current value.
9. Single-click a different cell → focus moves; the prior edit is
   discarded if mid-edit.

### 4.6 Test plan

- **Manual checklist** — the nine demo steps above, executed against
  Materials data in Chrome and Safari.
- **Automated** — small Vitest+Testing-Library spec covering keyboard
  arrow movement, Enter-to-edit, Esc-to-cancel, and the focus-restore
  after edit commit. Skip clipboard tests (browser sandbox restrictions
  make them flaky).
- **Accessibility quick-pass** — the focused cell has `tabindex="0"`,
  the table container is a roving-tabindex region (one cell takes
  focus at a time), and `role="grid"` / `role="gridcell"` are present.
  Full a11y audit deferred to §11.1.

### 4.7 Risks

- **Hit-testing collisions in the header.** Header already has click-to-
  sort; Phase 5 adds click-to-tint. Define a clear visual layout (sort
  caret on the right, drag-handle on the left, click anywhere else =
  filter popover open). Document in code.
- **Focus management vs. virtualizer recycling.** When the virtualizer
  unmounts the focused row, focus is lost. Handle: when focus leaves
  the visible region, store it in component state (rowId, not DOM
  ref) and reapply on re-mount.
- **Sticky frozen column + virtualizer.** TanStack-Virtual is row-
  virtualized; frozen columns are CSS-positioned. Should compose
  without surprises but verify with the Materials dataset before
  declaring Phase 1 done.

### 4.8 Effort estimate

~6–10 evening hours.

### 4.9 Deferred to later phases

- Range selection (Phase 2).
- Multi-cell copy (Phase 2).
- Edit validation, undo (Phase 3).
- Number formatting per display-unit context (post-gate; PHN already has
  this infrastructure — wire in §11).

---

## 5. Phase 2 — Range selection + structured copy + row/column select

### 5.1 Goal

Excel-feel selection model: drag a rectangle, see one contiguous
outline, ⌘C copies as TSV that pastes into Excel cleanly. Plus full-row
and full-column select via gutter / header click.

### 5.2 Wishlist items addressed

- #1 — Excel-style cell range selection + copy.
- #2 — Full-row and full-column select via gutter / header click.

### 5.3 What's built

**Frontend:**

- **Selection state** — `{ anchor: {r,c}, head: {r,c} } | null`. The
  visible range is the rectangle from anchor → head (inclusive on both
  axes).
- **Mouse drag** — `onMouseDown` on a cell sets `anchor=head=cell`;
  `onMouseEnter` while primary-button-held updates `head`; `mouseup`
  on `document` ends the drag.
- **Keyboard extension** — `Shift+Arrow` extends `head` only;
  `Shift+Click` sets `head` to the clicked cell, anchor unchanged.
- **Range overlay** — single absolutely-positioned `<div>` over the
  table body, sized to the bounding box of the rectangle. Provides one
  contiguous outline (not per-cell borders), per the wishlist note.
  Inner cells get a transparent-blue background.
- **Auto-scroll while drag-extending** — when the cursor is within
  ~30 px of the viewport edge during drag, scroll the container at
  ~10 px / frame.
- **Left gutter column** — sticky, ~32 px wide, rendered outside the
  TanStack column model so it doesn't participate in reorder/resize/
  filter. Shows the visible row index (1, 2, 3, …). On click → set
  range to `(rowIdx, 0) → (rowIdx, lastCol)` (full row).
- **Column-header click → full-column select** — dedicated narrow
  affordance at the *top* of each header cell (above the label). Sets
  range to `(0, colIdx) → (lastRow, colIdx)`. The label area still
  handles sort and filter affordances per Phase 1.
- **Shift extension on row gutter / column header** — extends to a
  contiguous block of rows or columns from the existing range's anchor.
- **⌘C as TSV** — `document.addEventListener('copy', ...)` when range
  is active and not editing:
  - Build the rectangle from `rowModel` (post-sort/filter).
  - For each cell in the rectangle, render its display value as a
    string (numbers via `toLocaleString`, single-select via option
    name once Phase 4 lands, null as empty).
  - Join cells with `\t`, rows with `\n`, no trailing newline.
  - `e.clipboardData.setData('text/plain', tsv)` plus
    `text/html` with a `<table>` so paste into rich targets keeps
    structure.
  - `e.preventDefault()`.
- **⌘A** — selects the entire visible (filtered) data set.

**Deferred from #2 to a follow-up** (called out in 1c notes):

- ⌘+click for non-contiguous multi-row / multi-column selection. The
  selection model becomes `{ ranges: Range[] }` instead of a single
  rectangle. ~80% of the workflow is contiguous; defer to keep Phase 2
  scoped.

### 5.4 Backend dependencies

**None.**

### 5.5 Browser demo

1. Drag from row 3 / column `density_kg_m3` to row 12 / column
   `conductivity_w_mk`. See a single rounded outline around the 10×3
   block.
2. Press `Shift+ArrowDown` twice. Outline extends two more rows.
3. Press `⌘C`. Switch to Excel / Numbers, paste. See a 12-row × 3-col
   block with the cell values, properly aligned in columns.
4. Click the row 50 gutter button. Whole row 50 highlighted. Shift+click
   the row 60 gutter button. Rows 50–60 highlighted. ⌘C, paste —
   complete row block in Excel.
5. Click the `category` column header (top affordance). Whole `category`
   column highlighted, header included. ⌘C, paste — single column of
   category values.
6. Drag from inside one group out into another (Phase 5 tests this).
   For Phase 2 demo: drag past the bottom of the visible viewport. The
   container auto-scrolls; the range extends correctly.

### 5.6 Test plan

- **Manual** — the six demo steps, plus:
  - Drag → release outside the table → drag terminates cleanly.
  - Drag → click an in-cell input (Phase 1 edit) → does not start a
    new range while editing.
  - Range that spans virtualized-recycled rows → ⌘C copies all rows,
    not just the visible ones.
- **Automated** — Vitest specs for the range geometry (anchor/head →
  cell list), the TSV builder, and the keyboard `Shift+Arrow` /
  `Shift+Click` extension.
- **Cross-app round-trip** — manually paste copied ranges into:
  Excel (macOS), Numbers, Google Sheets, AirTable. All four must
  preserve row × column structure. Document any formatting quirks in
  this file's "Findings" addendum.

### 5.7 Risks

- **Excel TSV quoting.** Excel is picky about quoting cells that contain
  tabs or newlines (uncommon in Materials but possible in `comments`).
  Implement standard CSV-style quoting: wrap in `"`, double internal `"`.
- **Range overlay alignment under sticky header / frozen column.** The
  overlay is positioned in document coordinates; sticky elements scroll
  differently. Either render the overlay inside the scrolling region
  (preferred), or compute the offset at render time.
- **Column-header click affordance.** Three things compete for header
  clicks: sort, filter, full-column-select. Tier them by visual area —
  small "select" zone at the top, large central "sort/filter" zone.
  Document the layout in code comments.
- **Performance with 10 000 selected cells.** TSV serialization of
  10 k cells is < 50 ms; not a concern at POC scale. Flag for the
  real-impl scale check.

### 5.8 Effort estimate

~10–14 evening hours.

### 5.9 Deferred to later phases

- Bulk paste (Phase 3) — selection feeds into paste, but is independent.
- Fill handle (Phase 3) — handle sits at bottom-right of the range
  overlay; lands when the write path lands.
- ⌘+click non-contiguous selection (post-gate, follow-up).
- Range selection across grouped accordion sections (Phase 5 — clamp
  within a single group).

### 5.10 Findings addendum — 2026-05-07

- **Browser demo passed.** Ed verified the full Phase 2 smoke path in a
  real browser: drag-range select, `Shift` extension, full-row select
  from gutter, full-column select from header strip, drag auto-scroll,
  and structured paste into external grid targets.
- **The POC did NOT use one absolute selection overlay.** The shipped
  implementation draws the contiguous perimeter via cell-edge styling
  plus tinted interior cells. That was the lower-risk fit for a grid
  with sticky gutter chrome, a frozen first column, and virtualized
  rows. For the real build, treat a true overlay as optional polish, not
  a prerequisite for the selection model.
- **Structured copy must be treated as a matrix serializer.** The
  working path writes both TSV (`text/plain`) and HTML (`text/html`),
  excludes gutter numbers, and includes header labels only for
  full-column select. Preserve that behavior when copy and later paste
  are centralized.
- **Document-level drag tracking worked better than cell-local hover.**
  The stable method was `document` `mousemove` / `mouseup` plus
  `elementFromPoint()` and a `requestAnimationFrame` auto-scroll loop.
  This held up while TanStack Virtual recycled rows during drag.
- **Focus and selection need separate visual channels.** Selection edges
  use inset box-shadows; the active cell uses `outline`. Attempting to
  draw both with box-shadow caused the focused selected cell to lose its
  focus ring.

---

## 6. Phase 3 — Bulk write gestures with undo safety net

### 6.1 Goal

Make the dangerous write gestures (clipboard paste, fill-handle drag)
both *available* and *safe*. Bounded undo wraps every write so users
can experiment freely.

### 6.2 Wishlist items addressed

- #1b — Excel-style paste with auto-add-rows prompt.
- #1g — Excel-style fill handle.
- #1h — Bounded undo.

These are bundled into one phase because the destructive bulk-write
gestures are not safely usable without undo (per the #1h "tier-1 parity"
note); shipping #1b and #1g without #1h would be a half-finished phase
in the §2.5 sense.

### 6.3 What's built

**Cell-write primitive** (the foundation that all three features share):

```
type CellWrite = { rowId, colId, before, after }
function writeCells(writes: CellWrite[]): void
```

- Single function that applies a list of cell writes to row state, with
  per-column type coercion (numeric / text / single-select / computed-
  read-only / etc.).
- Returns a `WriteReport` summarizing successful, skipped (read-only),
  and skipped (type mismatch) writes.
- Every write path (single inline edit from Phase 1, paste from #1b,
  fill from #1g) goes through this primitive. One choke point makes
  undo trivially correct.

**Undo / redo (#1h):**

- `EditHistory` store with `undo: EditOp[]` and `redo: EditOp[]`, capped
  at 8 entries. Op kinds: `cell`, `paste`, `fill`, `rowInsert`,
  `rowDelete`. Each op has `apply(op)` and `revert(op)`.
- `⌘Z` / `⌘⇧Z` keybindings registered at the table container level,
  active only when no cell is editing (so input fields' native undo
  isn't shadowed).
- Toast on undo/redo: *"Reverted: paste to 200 cells"*.
- Undo stack cleared on (a) page reload (in-memory only per §2.3) and
  (b) — when versioning lands — new-version creation.

**Paste (#1b):**

- `onPaste` listener at the table container; ignored when editing a cell.
- Parse `text/plain` clipboard as TSV (split on `\n`, then `\t`); trim
  one trailing `\n`.
- Compute paste rectangle from anchor + clipboard dims. Three cases:
  - Single-cell clipboard, multi-cell selection → fill selection with
    value (Excel "paste value across" behavior).
  - Single-cell selection, multi-cell clipboard → paste rectangle.
  - Same-shape selection and clipboard → cell-by-cell paste.
- **Overflow detection:** if paste would extend past the last row, raise
  modal *"Clipboard has N more rows than the table. Add N empty
  records and paste?"* — Confirm appends N rows to local state with
  `tmp-{n}` ids; Cancel drops the overflow.
- Column overflow (paste wider than columns to right of anchor): drop
  silently with a toast note.
- Per-column type coercion via `writeCells`.
- Push as one `paste` op onto the undo stack (one ⌘Z reverts the whole
  paste).
- Disabled while grouped (per the wishlist note); banner *"Ungroup to
  paste"* appears if the user attempts it. (Phase 5 brings grouping
  back online; this rule is wired now so we don't forget.)

**Fill handle (#1g):**

- 6×6 px square at the bottom-right of the range overlay; visible only
  when range is active and not editing.
- `mousedown` → start fill drag. `mousemove` extends a *target rectangle*
  (rendered as dashed outline) from the source range. Constrained to
  one axis (vertical or horizontal — whichever the user has dragged
  further).
- On `mouseup`:
  - Determine source values (from `rowModel` post-sort/filter for
    rows, or post-reorder for columns).
  - Map values onto target cells: cyclic-repeat if shapes mismatch.
    **Pattern detection (1, 2, 3 …) explicitly deferred** per the
    wishlist note.
  - Apply via `writeCells`. Push as one `fill` op onto undo.
- Auto-scroll while dragging near viewport edge (same code as Phase 2).
- `⌘D` (fill down) and `⌘R` (fill right) keyboard equivalents — same
  write path, no drag needed.

### 6.4 Backend dependencies

**None.** All edits in-memory per §2.3. Row insertion creates
`tmp-{n}` ids in local state. The eventual `POST /records` endpoint is
called out in §11.2 (post-gate persistence).

### 6.5 Browser demo

1. **Paste — happy path.** Copy a 5-row × 2-col block from Excel. Click
   into cell `(50, density_kg_m3)`. ⌘V → paste fills `(50–54, density_kg_m3)`
   and `(50–54, specific_heat_capacity_J_kg_K)`. Toast: *"5 cells
   written, 0 skipped"*.
2. **Paste — auto-add rows.** Copy a 50-row block from Excel. Click
   into cell `(390, name)` (15 rows from end). ⌘V → modal *"Clipboard
   has 35 more rows than the table. Add 35 empty records and paste?"*.
   Confirm → 35 new rows appear at the end, all 50 paste targets are
   filled.
3. **Paste — type mismatch.** Copy a column of strings from Excel into
   a numeric column. Toast: *"45 cells written, 5 skipped (type
   mismatch)"*.
4. **Fill handle.** Click into cell `(10, source)` ("BASF"). Drag the
   bottom-right handle down to row 30. Release. Rows 10–30 of `source`
   = "BASF". Toast: *"21 cells written"*.
5. **Fill handle — multi-row source.** Select cells `(10–12, source)` =
   `["BASF", "Knauf", "Owens"]`. Drag fill handle to row 30. Cyclic
   fill: rows 10–12 unchanged, 13–30 cycle through the three values.
6. **⌘D / ⌘R.** Select range `(50, density) → (60, conductivity)`. ⌘D →
   each column filled with row 50's value across rows 51–60.
7. **Undo, redo.** Press ⌘Z four times → each step reverted with a
   toast. Press ⌘⇧Z four times → each step replayed.
8. **Undo cap.** Perform 9 distinct edits. Press ⌘Z 9 times. The 9th
   has no effect (oldest fell off the cap of 8); UI shows undo button
   disabled or no toast.

### 6.6 Test plan

- **Manual** — eight demo steps above.
- **Automated**
  - `writeCells` unit tests for each column type's coercion path.
  - TSV parser unit tests (trailing newline, internal newlines in
    quoted cells, Windows `\r\n`).
  - Paste-rectangle dimension calculator.
  - Fill-rectangle constraint (axis lock, shape mapping).
  - Undo stack invariants: cap, push clears redo, op revert is
    inverse of op apply.
- **Round-trip with Excel** — copy from sandbox → paste into Excel →
  copy from Excel → paste back into sandbox. Values survive intact.

### 6.7 Risks

- **Backend boundary surprise.** §2.3 promises "no backend through
  Phase 5" but real-world catalog use eventually requires `POST
  /records` and `PATCH /records/<id>`. Make sure the in-memory write
  path's API shape matches what the eventual backend will accept, so
  swapping is mechanical. Helpers: name them `apiClient.cellWrite(...)`,
  point at a no-op stub now; wire to fetch in §11.2.
- **Fill handle in a grouped table.** Wishlist says fill across group
  boundaries is undefined. Disable fill while grouped for Phase 3 (banner
  *"Ungroup to use fill"* — same pattern as paste). Re-enable with
  within-group constraint in Phase 5 if there's time.
- **Undo of an option-creating paste before Phase 4 lands.** Phase 4
  introduces #1c's auto-create-on-paste. Phase 3 doesn't yet have
  single_select fields, so this is moot for Phase 3 — but the undo op
  type already needs an `optionsAdded` slot per #1h. Provision the
  field now.
- **Memory-only undo on page reload.** Acceptable per §2.3 but call out
  in the demo banner: *"Undo history clears on reload (in-memory POC
  scope)"*.

### 6.8 Effort estimate

~14–20 evening hours.

### 6.9 Deferred to later phases

- Pattern detection for fill (`1, 2, 3 …`, `Mon, Tue …`) — post-gate.
- Concurrent-edit conflict UX for undo — real-impl, not POC.
- AND/OR logical combinators in paste rules — N/A.

---

## 7. Phase 4 — Single-select field type with paste-aware option creation

### 7.1 Goal

The `single_select` field type, complete: pills with palette colors,
edit popover with search + inline-create, sort/filter/group on the
option set, and the killer feature — **paste a column of strings,
auto-create new options for unrecognized values**.

### 7.2 Wishlist items addressed

- #1c — Single-Select field type — pills, color, inline option
  management, paste-aware.

### 7.3 What's built

**Field-def model in browser state:**

```
type FieldDef = {
  field_key: string;
  field_type: 'text' | 'number' | 'single_select' | 'computed' | ...;
  config?: { options?: { id, name, color }[] };
  ...
}
```

- Stored as a top-level component state alongside `rows`. (Backend
  field-def CRUD lands in §11.2; for Phase 4 the seed loader's YAML
  schema, hand-edited or migrated from CSV, populates this state at
  page load.)
- Fixed 14-color palette (mirror AirTable's set, hex values inline).
  New options cycle through.

**Cell renderer:**

- `<span class="pill">` with background = option color, text color
  = readable contrast (YIQ luminance check).
- Null state = empty cell (consistent with Phase 1).

**Edit popover:**

- Open on Enter or double-click on a single-select cell.
- Header: search input. Body: scrollable list of options as pills,
  each clickable. Active option highlighted.
- Footer: *"+ Add new option"* — inline mini-form (name input + color
  preview), Confirm appends to the option list.
- Keyboard: typing filters; ↑/↓ moves the highlight; Enter selects;
  Esc closes.

**Field-def edit modal** (a smaller subset of #1f, scoped to
single-select option management only):

- Reached via a small caret in the column header → "Edit options".
- Lists options with: drag-to-reorder, click swatch to change color,
  rename inline, delete with confirm.
- Saves to local state (post-gate: PATCH the field def via §11.2 API).

**Paste integration with #1b:**

- The `writeCells` per-column coercion path gains a `single_select`
  case:
  1. Lowercase-trim incoming string.
  2. Match against `config.options[].name` lowercase.
  3. If hit → assign option id.
  4. If miss → append new option (palette-cycled color), assign.
  5. Track new options in `pasteReport.newOptions[fieldKey]`.
  6. Persist field-def update once at the end of the paste.
- Paste report toast: *"5 cells written. 3 new options created in
  'category': Mineral Wool, Aerogel, EPS Graphite"*.

**Sort / filter / group on single_select:**

- Sort by option position (index in `config.options`), not by name —
  matches AirTable.
- Filter UI is the faceted multi-checkbox popover (Phase 5; for
  Phase 4 the existing native `<select>` keeps working as a
  placeholder).
- Group-by single_select renders the group header with the option
  pill (Phase 5 wires this into the structured group popover).

**Migration of `category`:**

- The seed loader (to be written, plan §3.4) loads `category` as
  `single_select` and auto-builds the 12 options from distinct CSV
  values. For Phase 4 we hand-build this in browser state at first
  load, then move to the seed loader as a follow-up. **Same code path
  as paste** (lowercase-trim + match-or-create), which is the proof
  point: if the seed loader can populate options this way, paste
  works too.

### 7.4 Backend dependencies

**None for in-memory Phase 4** per §2.3. The field-def edit modal
writes to component state. Seed loader (when written) reads CSV and
emits the initial state shape.

Post-gate (§11.2) introduces `PATCH /fields/<id>` for option-add and
option-edit.

### 7.5 Browser demo

1. Load page. Notice the `category` column is now rendered as colored
   pills (12 distinct colors for 12 categories).
2. Sort / filter the table by category. Pills sort by option order
   (not alphabetical). Group by category — group headers show the
   pill.
3. Click into a `category` cell. Press Enter → popover opens with
   12 options as pills, search input focused.
4. Type "ins" → list filters to "Insulation" only. Press Enter →
   cell now shows the "Insulation" pill, popover closes.
5. Click into another `category` cell. Press Enter → popover.
   Click "+ Add new option". Form appears — type "Aerogel", confirm.
   Option appears with the next palette color, automatically assigned
   to the cell. Popover closes.
6. **Paste demo.** Copy from Excel a 20-row column with values:
   `Insulation`, `INSULATION` (case mismatch — expect lowercase match),
   `Mineral Wool` (new), `Concrete` (existing), `Aerogel` (just-added),
   etc. Click into cell `(100, category)`. ⌘V. Toast: *"20 cells
   written. 1 new option created in 'category': Mineral Wool"*. Verify
   pills updated correctly throughout the 20 rows.
7. Open the field-def modal on `category` (caret in header → "Edit
   options"). Reorder two options by dragging. Change one option's
   color. Verify the table re-renders pills with the new color and
   sort changes accordingly.
8. ⌘Z several times → reverts the paste, then the new option add,
   then the previous edits in order.

### 7.6 Test plan

- **Manual** — eight demo steps.
- **Automated**
  - Pill render: contrast helper picks black/white text correctly
    across the 14-color palette.
  - Match-or-create pipeline: lowercase-trim, exact match, case
    mismatch, new option creation, palette cycling.
  - Undo of a paste-with-option-creation rolls back both the cell
    writes *and* the option additions.
  - Sort by option position, not name.
- **Visual** — side-by-side screenshot comparison of the sandbox vs.
  AirTable on the same `category` data. Acceptable variance:
  exact colors may differ (we have our own palette) but the pill
  shape, height, padding, and density should match.

### 7.7 Risks

- **Color palette taste.** AirTable's palette is well-tuned. Our
  14-color palette must be readable across light backgrounds and
  distinguishable from each other. Iterate live in the browser; budget
  an hour or two for color-tuning specifically.
- **Option deletion when rows reference it.** Confirm modal must show
  the impacted row count and offer "reassign to …" before allowing
  delete. Or simpler: forbid delete-while-in-use, force the user to
  reassign first.
- **Multi-select reuse.** PRD §5.3 calls for `multi_select`. Architect
  the cell renderer + popover to accept a `Set<optionId>` instead of
  a single `optionId` from day one, even though Phase 4 only delivers
  single-select. Reuses ~80% of the code when multi-select lands.
- **Field-def state shape vs. eventual backend shape.** Same as
  Phase 3's risk. Define the in-memory shape now to match the
  eventual REST payload.

### 7.8 Effort estimate

~10–14 evening hours.

### 7.9 Deferred to later phases

- Multi-select renderer (chip row) — separate post-Phase 4 work.
- Long-text modal edit, attachment field, date picker, link field —
  PRD §5.3 list; not required for the gate.
- Backend field-def CRUD — §11.2.

---

## 8. Phase 5 — Stacked sort / filter / group + toolbar tinting

### 8.1 Goal

Replace the spike's ad-hoc sort/filter/group UI with the structured
AirTable toolbar: stacked conditions in popovers, color-tinted toolbar
buttons, column-tint cascade into headers and cells.

### 8.2 Wishlist items addressed

- #1d — Stacked group-by with accordion UI.
- #1e — Stacked filter / sort with toolbar-tinted state.

### 8.3 What's built

**Toolbar component:**

- Five buttons: **Hide fields**, **Filter**, **Group**, **Sort**, **Color**.
  (Hide-fields and Color are minimal placeholders; this phase focuses on
  Filter / Group / Sort.)
- Each button reads as a sentence fragment when active: *"Filtered by
  MANUFACTURER"*, *"Grouped by 1 field"*, *"Sorted by 1 field"*.
- Each active button has a pale background tint: filter-green
  (`#dcf5e3`), group-purple (`#e8e0f5`), sort-peach (`#fde4cf`).
  Inactive = gray. Exact hex values to be picked from the AirTable
  screenshot during impl.

**Filter popover:**

- Stacked rows: column picker + operator picker + value editor + drag-
  handle + delete button.
- Operators per column type: text (contains / does not contain / is /
  is not / is empty / is not empty), number (= / != / > / < / between /
  is empty), single_select (is any of / is none of / is empty), date
  (when added, post-gate).
- Top-of-popover toggle: AND (default) / OR. **POC: AND only**; OR
  flagged for follow-up if the demo doesn't need it.
- "+ Add condition" appends a new row.
- TanStack `columnFilters` state holds structured filter values; each
  column's `filterFn` is rewritten to interpret the structured value
  per its type.

**Sort popover:**

- Stacked rows: column picker + asc/desc toggle + drag-handle + delete.
- Order matters — first row is primary, subsequent rows are tiebreakers.
- Reuses TanStack's `SortingState` directly.
- Shift+click on a column header adds it to the sort stack
  (`enableMultiSort: true`, custom `isMultiSortEvent`).

**Group popover:**

- Stacked rows: column picker + asc/desc + drag-handle + delete.
- Up to 3 levels; warn if user adds a 4th.
- Sets TanStack `grouping: ColumnId[]` in order. `sorting` is updated
  in lockstep so the asc/desc toggle on a grouped column actually
  affects group order.

**Aggregation per column:**

- Small caret in each column header → "Show summary: count / sum /
  mean / min / max / none".
- Adds an `aggregationFn` to that column's TanStack column def.
- Group header rows render aggregated values at the right.
- Single_select / text default = count. Numeric default = none (user
  picks). Stored in the same view-state blob as filter/sort/group.

**Group accordion rendering:**

- Replace the spike's flat group rendering with nested rows via
  `getGroupedRowModel` + `getExpandedRowModel`. Indent group headers
  by `8 * row.depth` px.
- Group header content:
  - Expand/collapse chevron (▼ open / ▶ closed).
  - Group key (rendered as a single-select pill if grouped on a
    single-select column — reuses Phase 4 renderer).
  - Row count `(N)`.
  - Aggregation values for each column with a configured
    `aggregationFn`, rendered at the column's x-position.
- Toolbar quick actions: "Collapse all" / "Expand all".

**Toolbar-tint cascade (the novel rendering piece):**

- Per-column derived state `columnTintRoles[colId] = Set<'filter' |
  'sort' | 'group'>`. Derived on every render from `columnFilters`,
  `sorting`, `grouping`.
- Header cell + body cells in that column read the set and apply a
  layered background.
- For the POC: pre-mix the seven 2³−1 active combinations into a
  lookup table of hex values. (Same hue per role, just slightly
  desaturated when stacking.)
- Header cell uses a slightly darker variant of the tint than body
  cells. Reinforces the "this column is special" signal.
- Single-select chips in tinted columns: keep the chip's option color,
  but the cell background gets the tint. Verify visually that the
  combination doesn't look busy.

**Persistence (in-memory, per §2.3):**

- View state blob: `{ filter, sort, group, aggregations, columnOrder,
  columnWidths, hiddenColumns, expandedGroups }`. Stored in a single
  React state, keyed by table slug. localStorage save deferred to
  §11.2 (post-gate).

### 8.4 Backend dependencies

**None.**

### 8.5 Browser demo

1. Click **Filter** → popover. Add: `category is any of [Insulation,
   Concrete]`. Apply. Filter button now shows tint = green, label
   = *"Filtered by 1 field"*. The `category` column header and cells
   now have a green wash.
2. Add a second filter: `density_kg_m3 > 100`. Apply. Filter button
   now reads *"Filtered by 2 fields"*. Both columns are tinted green.
3. Click **Sort** → popover. Add: `conductivity_w_mk asc`. Apply.
   Sort button shows tint = peach, the `conductivity_w_mk` column
   gains a peach wash *layered* with whatever other tints it has.
4. Click **Group** → popover. Add: `category asc`. Apply. Table
   renders accordion groups. Group button shows tint = purple. The
   `category` column header now has green + purple combined.
5. Add a second group level: `source asc`. Apply. Two-level accordion
   renders. `source` column gains purple tint.
6. Click the caret on `conductivity_w_mk` header → "Show summary: mean".
   Group headers now show the mean conductivity per group / subgroup.
7. Collapse all → only top-level group headers visible. Expand all →
   all back. Collapse one specific group via its chevron — others
   unaffected.
8. Stack: shift+click on `density_kg_m3` header → adds as secondary
   sort. Sort popover now shows two rows. Both columns have peach tint.
9. Visual side-by-side with AirTable on the same data: toolbar feel,
   tints, group accordion, all comparable.

### 8.6 Test plan

- **Manual** — nine demo steps + visual side-by-side.
- **Automated**
  - Per-type filter operator unit tests (text-contains, between,
    is-any-of for single-select, etc.).
  - Tint-role derivation: given filter/sort/group state, expected
    `columnTintRoles[colId]`.
  - Aggregation correctness: known input → expected mean/sum/count.
  - Group accordion expand/collapse persistence within session.
- **Visual diff** — screenshot the sandbox under three configurations
  (no toolbar state / filter+sort / filter+sort+group) and inspect
  side-by-side against AirTable.

### 8.7 Risks

- **OR mode complexity.** TanStack's filter pipeline is implicitly AND.
  OR mode requires rewriting filtering outside TanStack's model. POC
  ships AND only; if the gate evaluation flags OR as essential, it
  becomes a one-week follow-up.
- **Tint-color palette tuning.** Pale-but-distinguishable across three
  colors plus their seven combinations — eight hex values to hand-
  tune. Budget specifically for this; iterate with John on whether the
  tints feel right at-a-glance.
- **Aggregation × grouping × filtering.** TanStack handles this
  correctly out of the box — verify with a small scenario before trusting
  it (filter to category=Insulation, group by source, aggregate mean
  conductivity → mean is over filtered rows, not all rows).
- **Performance with 405 rows × 3 group levels × 5 aggregated columns.**
  Trivial. Flag for the real-impl scale check at 10 k+.
- **Visual budget.** Phase 5 is the longest. The pure-functional
  popovers + state plumbing is straightforward; the *look* (toolbar
  buttons, popovers, tints, group accordion) is where time gets spent.
  Allow at least ⅓ of the phase's hours for visual polish.

### 8.8 Effort estimate

~16–24 evening hours.

### 8.9 Deferred to later phases

- OR / nested AND-OR filter groups — post-gate follow-up.
- Per-user view-state persistence in the DB — §11.2.
- "Color" rule UI — separate wishlist entry if Ed wants it.
- The **Hide fields** popover (column show/hide UI) — small follow-up;
  mention here only because it's in the AirTable toolbar screenshot.

---

## 9. Phase 6 (gated) — Inline schema editor

### 9.1 Goal

Add / rename / delete columns in-place; change a column's type with a
preview of the data conversion. Only built if the §11 gate evaluation
says it must be in scope.

### 9.2 Wishlist items addressed

- #1f — In-table field (column) schema editor.

### 9.3 Why this phase is gated

PRD §13.2 / plan §12 explicitly mark "Schema editor UI" as out of scope
for the POC, on the reasoning that schema additions can be done via the
seed loader's YAML. The wishlist (1f) flags this as a parity feature
Ed cares about. The right place to decide is at the §11 gate — once
Phases 1–5 are demoable, evaluate whether the schema editor is the
deciding factor in "is this as good as AirTable for our use?"

If the answer is *yes, build it* → execute this phase.
If the answer is *not gating, build later* → leave it for the
post-gate persistence work and ship the gate decision.

### 9.4 What's built (if executed)

- **+ Add field button** at the right of the column header row → modal
  with field-name, field-type radio, type-specific config (precision,
  options, computed expression).
- **Header double-click → edit field modal** pre-filled with current
  values. Rename, change type with preview, edit type-specific config,
  delete with confirm.
- **Type-change conversion engine** —
  `backend/features/catalog/field_conversions.py`. Each conversion is a
  pure function `(rows, oldDef, newDef) → (newRows, conversionReport)`.
  Same pipeline drives the in-modal preview and the actual save.
- **Conversion preview API** — `POST /fields/<id>/preview-convert` →
  returns counts + example rows without persisting. Frontend modal
  shows: *"143 of 405 cells will convert successfully. 200 are empty.
  62 will become null (text → number). Continue?"*
- **Field-def CRUD API** — `POST /tables/<slug>/fields`,
  `PATCH /fields/<id>`, `DELETE /fields/<id>`. Audit-logged.
- **Schema versioning** (open question per the wishlist) — every
  field-def write bumps `catalog_table.schema_version`. Defer the full
  design (how do old record-versions render under new schemas?) to
  whoever picks this up; out of scope for the parity gate.

### 9.5 Backend dependencies

**Substantial.** Unlike Phases 1–5 (no backend), Phase 6 is mostly
backend: conversion engine, preview API, field-def CRUD, audit log.
This is the §2.2 reason it's gated — building it speculatively before
the gate is wasted work if the gate says "skip 1f for now."

### 9.6 Browser demo (if executed)

1. Click "+" at the end of the header row → modal. Enter name "test
   field", type "single_select", add 3 options. Confirm. New column
   appears at the right with empty cells.
2. Double-click the `category` column header → modal pre-filled with
   single_select + 12 options. Rename to "Category Tag". Confirm.
   Header updates; data unchanged.
3. Double-click the `source` column header. Change type from `text`
   to `single_select`. Modal shows preview: *"403 rows have a value;
   12 distinct values will become options. 2 rows are empty."*
   Confirm. Column re-renders as pills with 12 auto-created options.
4. Double-click an attachment column. Change type to text. Preview:
   *"This is a destructive change. 6 attachments will be unlinked
   from rows; the files remain in storage."* Cancel.
5. Delete a column. Confirm modal warns *"403 rows have a value in
   this column. Continue? Data is preserved in versioning."* Cancel.

### 9.7 Effort estimate (if executed)

~14–20 evening hours, dominated by backend.

### 9.8 Deferred (even if executed)

- Computed-field expression editor UI — post-POC.
- Linked-record / relation field types — post-POC.
- Schema versioning lifecycle (how old versions render under a new
  schema) — post-POC, full design needed.

---

## 10. Cross-cutting risks

Risks that span multiple phases, recorded once.

- **In-memory edit state vs. eventual persistence.** §2.3 says all edits
  are local. The risk is that the in-memory state shape diverges from
  what the eventual backend wants. Mitigation: define a single
  `apiClient.ts` with the eventual REST shape (function signatures
  matching `POST /records`, `PATCH /records/<id>`, `PATCH /fields/<id>`)
  and stub each function to return a resolved promise that mutates
  local state. §11.2 swaps the stubs for real fetches.
- **Sandbox vs. real `<DataTable>` divergence.** The §2.4 rule says
  evolve the sandbox in place. By Phase 5 the sandbox file will be ~2
  000 LOC. The §11.1 refactor extracts a real `<DataTable>` component;
  expect that refactor to be ~1 evening of mechanical splitting (props
  audit, component boundary cuts) plus a careful re-test.
- **Browser-clipboard quirks.** ⌘C / ⌘V / TSV format / HTML clipboard
  — Safari and Chrome differ in subtle ways. Test in both browsers at
  every clipboard touchpoint (Phase 2, 3).
- **No `dnd-kit` yet.** Phase 5's stacked-condition popovers want
  drag-to-reorder rows. Phase 1 doesn't strictly need `dnd-kit` (the
  spike's HTML5 drag works for column reorder), but adding it during
  Phase 5 means a small dependency add and a learning curve. Decide:
  bring `@dnd-kit/sortable` in at Phase 5, or use HTML5 drag
  consistently.
- **Visual taste.** A lot of "is it as good as AirTable?" comes down to
  spacing, color, hover states, and the small motions (animation
  durations, easing curves). Plan time for visual iteration in every
  phase, not just at the end.
- **Time budget.** §13.

## 11. Evaluation gate (after Phase 5 lands)

### 11.1 Gate review session

- Ed + John, 90 minutes, against the live sandbox.
- Walk every wishlist entry (1, 1b, 1c, 1d, 1e, 1g, 1h, 2). For each:
  *clear yes / clear no / qualified yes (with what would have to
  change)*. Record in `poc-evaluation.md` per `catalog-poc-plan.md` §9.2.
- Compare the sandbox side-by-side with the live AirTable Materials
  view in two browser windows. Time how long each common task takes
  in each.
- Output: one of the three decisions in `catalog-poc-plan.md` §9.3
  (Proceed / Iterate / Stop), plus an explicit decision on Phase 6
  (1f schema editor): in-scope or follow-up.

### 11.2 If Proceed: post-gate work

In rough order, no longer gated by parity questions:

1. **Extract `<DataTable>` component** from the sandbox. ~1 evening.
2. **Promote to real persistence** — wire the `apiClient` stubs to
   actual fetches; build the `POST /records`, `PATCH /records/<id>`,
   `PATCH /fields/<id>` endpoints. Migrate edits to optimistic-PATCH
   with rollback (PRD §6.2).
3. **Versioning UX** — `catalog-poc-plan.md` §7.
4. **Attachments + R2 + content-hash dedup** — `catalog-poc-plan.md`
   §8 (Frames is the data set per §2.4 of that plan).
5. **Second-table validation against Frames** — `catalog-poc-plan.md`
   §9.1.
6. **Phase 6 (schema editor) if gated-in.**
7. **Persistence of view state** (filters/sorts/groups/widths/order
   per user) in the DB.

### 11.3 If Iterate: which gaps trigger another phase

Most likely candidates for an "Iterate" decision and what they imply:

- *"Pasting feels wrong"* → revisit Phase 3 paste pipeline; possibly
  add pattern detection from the wishlist 1g defer.
- *"Filtering OR is essential"* → unlock OR / nested groups in
  Phase 5's filter popover.
- *"The tints are confusing / busy"* → tune the palette; possibly
  drop cell tint and rely on header tint only.
- *"Single-select doesn't go far enough — I need multi-select"* →
  build out multi-select on top of Phase 4's renderer.
- *"Adding columns via YAML is awful"* → execute Phase 6.

### 11.4 If Stop: kill criteria

Per `catalog-poc-plan.md` §11 / PRD §13.5. Most likely shape: *"the
TanStack-powered `<DataTable>` cannot match AirTable's keyboard / paste
/ undo feel without significant additional work, and the additional
work is greater than the cost of staying on AirTable."* Document
specifically and move on; the spike code stays on the branch as a
reference.

## 12. Explicit deferrals (the "we are deliberately not building" list)

In addition to per-phase deferrals already called out, restate here so
the cuts are visible in one place:

- **⌘+click non-contiguous selection** (#2 wishlist note).
- **Fill-handle pattern detection** (#1g wishlist note).
- **OR / nested AND-OR filter groups** (#1e wishlist note).
- **Comment threads, @mentions, presence cursors** (PRD §2 non-goal).
- **Public Grasshopper API** (PRD §2 non-goal).
- **Linked-record / relation field types** (PRD §2 non-goal).
- **Per-user / per-row permissions** (PRD §3).
- **Mobile / phone optimization** (PRD §2 non-goal).
- **Long-text modal edit, attachment, date picker, link, boolean field
  renderers** beyond what Phase 1 provides — sufficient for the gate;
  build them as needed post-gate.
- **Dark mode.**
- **Multi-select pill row** — Phase 4's single-select renderer is
  designed to extend, but multi-select as a feature is a follow-up.
- **Computed-field expression editor UI** (PRD §13.2).
- **Migration tooling vs. real AirTable** (`catalog-poc-plan.md` §12).
- **Audit log surfacing in UI** (PRD §13.2).
- **Backups / restore drills / monitoring** (PRD §13.2).

## 13. Time-budget reality

`catalog-poc-plan.md` §11 budgets six engineer-weeks for the whole POC,
including weeks 1–2 (now this plan's Phases 1–5) plus weeks 3–6
(versioning, attachments, second-table validation).

Honest re-estimate from the per-phase numbers:

| Phase | Low | High |
|-------|-----|------|
| 1 | 6 | 10 |
| 2 | 10 | 14 |
| 3 | 14 | 20 |
| 4 | 10 | 14 |
| 5 | 16 | 24 |
| **Phase 1–5 total** | **56** | **82** |
| 6 (gated) | 14 | 20 |

At ~10 evening hours / week, Phases 1–5 are 6–8 weeks of focused work.
The original plan budgeted ~2 weeks for the same scope. We're 3–4×
over.

Two paths:

- **(a) Accept the recalibration.** The POC takes 8–10 weeks total
  (1–5 + the post-gate Phases 6–9 of `catalog-poc-plan.md`). Plan §11
  explicitly invites this: *"Recalibrate honestly at week 2 if pacing
  is off."*
- **(b) Trim wishlist scope.** Most plausible cuts, in order of
  smallest-feel-impact-first:
  1. **Drop the column-tint cascade** in Phase 5 (keep functional
     stacked sort/filter/group; lose the visual tint cascade). Saves
     ~6–8 hours. Cost: the at-a-glance "why is this row missing /
     reordered?" answer goes away.
  2. **Drop fill handle (#1g).** Paste covers most bulk-write cases.
     Saves ~6–8 hours. Cost: a frequent gesture becomes 4 keystrokes
     instead of 1 drag.
  3. **Drop fields-vs-popover for single-select** in Phase 4. Keep
     pills, sort/group; drop the inline-create popover. Saves ~3–5
     hours. Cost: paste-to-create still works (the killer feature),
     but in-cell-edit doesn't have a polished popover.
  4. **Drop multi-column sort UI** (keep single sort with shift-click
     adding). Saves ~2–3 hours. Cost: minor.

Recommended path: **(a)**. The wishlist is what Ed identified as the
parity bar; cutting any of (1) – (3) above starts to undermine the
gate's question itself. Recalibrate the timeline rather than the
content. If pacing on Phase 1 is unusually slow, revisit at the
Phase 1 → Phase 2 demo handoff.

## 14. What changes elsewhere

When this plan is approved, update:

- `catalog-poc-plan.md` §4 (week 1) and §5 (week 2) — replace with a
  pointer to this file and the new phase numbering.
- `catalog-poc-plan.md` §13 next-actions — replace "Materials seed
  loader" with "Phase 1 — active cell + single-cell copy" as the
  next concrete action.
- `weekly-notes.md` — add an entry for 2026-05-07 noting the spike
  decision (TanStack), the wishlist authoring, and this phase plan.

## 15. Status tracking

| Phase | Started | Demo passed | Notes |
|-------|---------|-------------|-------|
| 1 | 2026-05-07 | 2026-05-07 ✓ | Demo passed. Two bugs caught + fixed in browser pass (frozen column position-style override, row-index namespace conflict with TanStack `row.index`). Lessons consolidated in `poc-lessons-for-real-build.md` (L1.1, L2.1, L3.1, L4.1, L5.1, L5.2). |
| 2 | 2026-05-07 | 2026-05-07 ✓ | Demo passed. Ed verified real-browser smoke test for drag range, gutter/header full select, auto-scroll, and structured external paste. Lessons consolidated in `poc-lessons-for-real-build.md` (L2.2, L3.2, L4.2, L5.3). |
| 3 | — | — | — |
| 4 | 2026-05-07 | 2026-05-07 ✓ | Tracker slice `NIM-4` demo passed for pills + inline picker/create + paste-aware option auto-create + `Materials.category` proving case. Browser pass caught and fixed the explicit-sort runtime failure plus two layout bugs (popover stacking, frozen-body-cell sticky override). Header-level option-management modal from §7.3 intentionally deferred. Lessons consolidated in `poc-lessons-for-real-build.md` (L2.3, L2.4, L3.3, L6.5). |
| 5 | 2026-05-07 | 2026-05-07 ✓ | Tracker slice `NIM-5`. Stacked filter/sort/group toolbar popovers wired against the structured-condition state (canonical user-intent lists, derived TanStack shapes). Per-column aggregation picker, group-direction-as-pre-sort, and 14-entry pre-mixed tint palette landed. Per-header inline filter input removed (single mutation channel). 16 new helper tests pass; build green. Lessons consolidated in `poc-lessons-for-real-build.md` (L8.1–L8.4, L9.1–L9.3, L10.1–L10.2). |
| Gate review | 2026-05-07 | 2026-05-07 ✓ | Decided **Proceed** with Phase 6 deferred. Live walkthrough waived; Ed ratified pre-verdicts in `poc-evaluation.md` §7. Tracked at NIM-6 (done). Post-gate work continues under NIM-7. |
| 6 (gated) | — | — | **Out of post-gate scope** per §7.2 ratification (2026-05-07). Revisit only if a future iteration finds the YAML seed-loader path prohibitive. |
