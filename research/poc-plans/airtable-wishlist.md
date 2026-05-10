---
DATE: 2026-05-07
STATUS: Living document — Ed describes AirTable behaviors he wants; Claude records them here.
RELATED: catalog-poc-plan.md §4, grid-spike-results.md, PRD §13.4 Q1,
         airtable-parity-phases.md (the phase plan that turns these
         wishlist entries into a vertical-slice execution sequence)
---

# AirTable UI/UX Wish-List

The features and behaviors of AirTable that Ed wants the native catalog
`<DataTable>` to replicate. Source of truth for the parity-gate evaluation
(plan §2 binding success criterion).

Each entry is described in Ed's own terms, then annotated with implementation
notes for TanStack Table v8.

## How to use this file

- Ed describes a feature he likes.
- Claude appends a new numbered entry below with: **Description** (Ed's words,
  lightly cleaned), **Why it matters** (the underlying need), **TanStack notes**
  (how we'd build it), **Status** (`wishlist` / `in-progress` / `landed` /
  `descoped`).
- When a feature lands in the sandbox, flip Status and link the commit.

## Entries

<!-- new entries go below, newest at the bottom. Ed: describe one at a time. -->

### 1. Excel-style cell range selection + copy

**Description.** Click in one cell, drag horizontally or vertically (or both)
and the selection expands to cover the rectangle of cells under the drag.
The selected range shows a single contiguous highlight (not per-cell). Once
selected, ⌘C copies the range to the clipboard as TSV — pasteable into
Excel/Numbers/Sheets with rows and columns preserved. Shift+arrow extends
the range from the keyboard. Shift+click extends to the clicked cell.

**Why it matters.** This is the single most-used AirTable behavior for our
team — pulling a column of conductivities out to paste into PHPP, copying
a block of frame data into a comparison spreadsheet, etc. Without it the
table is a viewer, not a working surface.

**TanStack notes.** Not built in. We own this entirely. Approach:

- Track selection as `{ anchor: {r,c}, head: {r,c} }` in component state.
  The visible range is the rectangle from anchor → head.
- Mouse: `onMouseDown` on a cell sets anchor=head. `onMouseEnter` while
  primary button held updates head. `onMouseUp` (or pointer release on
  document) ends the drag.
- Keyboard: arrow keys move both anchor and head together (collapsed
  selection). Shift+arrow moves only head. Shift+click sets head to the
  clicked cell, anchor unchanged.
- Render: each cell checks whether `(r,c)` is inside the rectangle and
  applies a highlight class. Border treatment is the tricky part — to get
  a single contiguous outline (not per-cell borders), draw an absolutely-
  positioned overlay rectangle on top of the table body sized to the
  rectangle's bounding box. AirTable does this; it's the cleanest visual.
- Copy: `document.addEventListener('copy', ...)` when a range is active,
  build a TSV string from `rows[r][colId]` for each cell in the rectangle,
  call `e.clipboardData.setData('text/plain', tsv)` and `e.preventDefault()`.
  Also set `text/html` with a `<table>` so paste into rich targets keeps
  structure.
- Interaction with row virtualization: range can extend off-screen.
  Highlight state is just data; the overlay rectangle is positioned in
  document coordinates relative to the (virtualized) table body, so it
  works without seeing the off-screen rows. Copy iterates `rows` directly
  (not the virtualized row model), so off-screen cells copy correctly.
- Interaction with grouping: when grouping is active, AirTable disables
  range selection across group boundaries. Mirror that — clamp the range
  to within a single group, or disable range selection in grouped mode
  for the POC and revisit.
- Edge cases to handle: drag past viewport edge auto-scrolls; clicking
  inside an editing cell does not start a new range; ⌘A selects the
  entire visible (filtered) data set.

**Status.** `wishlist`.

### 1b. Excel-style paste, with prompt to auto-add rows on overflow

**Description.** With one or more cells selected, ⌘V parses the clipboard
as TSV (tab-delimited rows, newline-delimited records) and writes the
values into the table starting at the top-left of the selection, expanding
right and down. If the clipboard rectangle is larger than the available
table rows below the anchor (i.e. the paste would run off the bottom of
the data set), AirTable prompts: *"Add N new records to fit the paste?"*
with Confirm / Cancel. On confirm, N new empty records are appended and
the paste fills them. Same behavior for columns: if the paste is wider
than the columns to the right of the anchor, the overflow is dropped (or
prompted — verify against AirTable).

A single-cell paste of a multiline clipboard expands into a rectangle.
A multi-cell selection paste of a single value fills the selection with
that value (Excel "paste value across selection" behavior).

**Why it matters.** This is the bulk-import-by-clipboard workflow. We
constantly move data between PHPP, manufacturer spec PDFs (copied via
text extraction), and the catalog. The "auto-add rows" prompt is what
turns AirTable from a viewer into the place we *enter* data, not just
the place we read it.

**TanStack notes.** Owned entirely by us; built on top of the #1
selection model. Approach:

- `document.addEventListener('paste', ...)` when the table has focus and
  a selection is active. Read `e.clipboardData.getData('text/plain')`,
  split on `\n` for rows, `\t` for cells. Trim a single trailing `\n` (Excel
  always appends one).
- Determine the paste anchor: top-left cell of the active range. Compute
  the paste rectangle `{ rows: pasteRows, cols: pasteCols }`.
- If paste is a single cell and selection is multi-cell: fill selection
  with the value (Excel's "paste value to range" behavior). Easy case.
- If selection is single-cell or sized to the paste: paste cell-by-cell
  starting at anchor, mapping `clipboard[r][c]` → `cell(anchor.r + r, anchor.c + c)`.
- Coerce values per column type: numeric columns parse with `Number()`,
  reject `NaN` (skip cell + log to a paste report at end). Computed/
  read-only columns are skipped silently. Select columns: match against
  allowed values, skip non-matching with a report entry.
- Overflow detection: if `anchor.r + pasteRows > rowModel.length`, raise
  a confirm modal: *"Clipboard has N more rows than the table. Add N
  empty records and paste?"* — Confirm appends N records via the same
  endpoint that powers the "Add row" button (POC: append to local state;
  real impl: POST to `/records`). Cancel: paste only fits the existing
  rows, drop the overflow with a report.
- Column overflow: in AirTable this silently truncates. Match that —
  drop overflow columns, mention in the paste report toast.
- Paste report: a small toast at the end summarizing `M cells written,
  K skipped (read-only), J skipped (type mismatch), N rows added`. Lets
  the user notice when a column got dropped.
- Undo: out of scope for the POC; flag as a follow-up. Without undo,
  pastes that go wrong require manual cleanup — acceptable for now since
  versioning (plan §7) will eventually backstop this.
- Interaction with grouping: AirTable disables paste while grouped.
  Mirror that for the POC.
- Interaction with #1 selection: pasting collapses the active range to
  the new pasted rectangle (so a follow-up ⌘C round-trips).

**Status.** `wishlist`.

### 1c. Single-Select field type — pills, color, inline option management, paste-aware

**Description.** A first-class `single_select` field type. Cell renders
the value as a colored "pill" (rounded rectangle with background color
and contrasting text). Each option has a name and a color; colors are
auto-assigned from a palette on creation but user-editable. Editing a
cell opens a popover listing all options as pills, with a search box at
the top — typing filters, click-to-select, Enter selects the highlighted
option. The popover has an inline "+ Add new option" affordance that
creates a new option without leaving the cell.

Field-type configuration (the schema editor for *this* column) is a
small modal: list of options, drag-to-reorder, click an option's color
swatch to change it, rename inline, delete with confirm (warns if rows
currently use that option).

**Paste behavior is the killer feature.** When pasting TSV into a
single-select column (via #1b), each pasted value is matched against
existing option names case-insensitively:

- **Exact match** → assign that option to the cell.
- **No match** → auto-create a new option with that name (color picked
  from the next palette slot) and assign it. The paste report toast
  lists *"K new options created in column 'category': Foo, Bar, Baz"*
  so the user notices.

This turns "paste a column of category names from PHPP" from a manual
20-click ordeal into a single ⌘V.

**Why it matters.** Categories are how we navigate the materials catalog
(Insulation / Air-Gap / Concrete / etc.). Color-coded pills make a long
table visually navigable — you can spot "all the air-gap rows" at a
glance. The paste-aware option creation is the bridge between
spreadsheets-of-strings (how data arrives from manufacturers, PHPP, and
old projects) and a structured taxonomy (what we want the catalog to
become). Manually building the option set up front is the single
biggest friction point in any other tool.

**TanStack notes.** This is several things stacked:

- **Schema.** `catalog_field_def.field_type = 'single_select'` with a
  `config: { options: [{id, name, color}] }` JSONB. Plan §5.3 already
  has `select` on the field-type list — confirm this maps, and that the
  options live in the field def, not a separate table (PRD §4 implies
  fielddef-embedded; verify when we get to §5).
- **Cell renderer.** Look up the option by id from the row's value,
  render `<span class="pill" style={background, color}>{name}</span>`.
  Null state: empty cell, no pill. Color contrast: compute readable
  text color from background luminance (standard YIQ formula) so
  user-picked colors don't produce unreadable pills.
- **Edit popover.** Reuse the standard popover primitive (we'll need
  one anyway for filter UI per the parity checklist tier 1). Fuzzy-match
  search via `Array.filter` on lowercase-includes; no library needed
  for option counts up to ~50.
- **Inline option create.** Popover footer button → open a tiny inline
  form (name input, color preview); on save, PATCH the field def's
  `config.options` and re-render. Optimistic. Conflict on concurrent
  field-def edit is a real but rare case — POC can ignore, real impl
  needs a 409 path.
- **Color palette.** A fixed palette of ~14 colors (mirror AirTable's
  set) cycled by index of the new option. Store as hex on the option.
- **Paste integration with #1b.** The paste pipeline already classifies
  cells by column type. For `single_select`:
  1. Lowercase-trim the clipboard text.
  2. Look up in the column's `config.options` by lowercase name match.
  3. If found, assign the option id.
  4. If not found, append a new option to `config.options` with a
     palette-cycled color, then assign.
  5. Track new options in a `pasteReport.newOptions[fieldKey]` list for
     the toast.
  6. Persist the field-def update *once* at the end of the paste, not
     per cell — both for performance and so the user sees one
     consolidated "5 new options created" message.
- **Sort / filter / group.** Sort by option position (the order in
  `config.options`), not by name — matches AirTable. Filter UI is the
  same popover with checkboxes (already on the parity checklist as the
  faceted filter). Group-by-single-select renders the group header
  with the option pill.
- **Backwards-compat with current Materials data.** The CSV has
  `category` as a free-text column with 12 distinct values. On import
  (the §3.4 seed loader), promote `category` to `single_select` and
  auto-build the 12 options from the distinct values — exactly the same
  pipeline as the paste-import case. This is also the proof point for
  the paste behavior: if the seed loader can build the option set from
  the CSV via this mechanism, the paste-from-clipboard case is the same
  code path.
- **Multi-select** (PRD §5.3 `multi_select`) is the same renderer with
  an array value and chip-row layout. Build single-select first; multi-
  select reuses ~80% of the code.

**Status.** `wishlist`.

### 1d. Stacked group-by with accordion UI

**Description.** A "Group" toolbar button opens a popover where the user
adds one or more group-by conditions. Each condition is a row: column
picker + ascending/descending toggle + drag-handle for reorder + delete
button. Conditions stack — the first defines top-level groups, the
second defines subgroups inside each top-level group, etc. Up to ~3
levels in practice.

The table renders nested accordion sections. Each group header shows
the group key (as a pill if grouped on a single-select column),
the row count, and an expand/collapse chevron. Click anywhere on the
header to toggle. Headers indent slightly per nesting level. Group
state (which are open/closed) survives sort/filter changes within the
session; "collapse all" / "expand all" are one click in the toolbar.

Aggregations (count, sum, mean, min, max) appear at the right of the
group header, configured per-column via a small picker on the column
header itself ("show summary: mean / sum / …"). For single-select and
text columns the only useful aggregation is count.

**Why it matters.** The way we *think* about the materials catalog is
hierarchical — by category, then by source, then by name. Stacked
grouping lets the table mirror that mental model directly. "Show me
all insulation materials grouped by source, with the count per source"
is a five-second action in AirTable; in any flat table it's an export-
to-Excel pivot table operation.

**TanStack notes.** Stacked grouping is first-class in TanStack —
`grouping: ColumnId[]` is already an array, multi-level works without
extra code. The current spike toggles `['category']` on/off; extending
to multi-level is mostly UI:

- **Group-condition popover.** New component. State is a list of
  `{ columnId, desc }`. Adds/removes/reorders entries. On change,
  call `setGrouping(conditions.map(c => c.columnId))` *and* update
  `sorting` to include each grouped column with its desc flag (TanStack
  sorts grouped columns by their sort order, so to sort groups
  descending you sort the column descending while it's grouped).
- **Group header rendering.** TanStack already gives us nested rows
  via `getGroupedRowModel` + `getExpandedRowModel`. The current spike
  renders only a single level — extend to render at every level by
  reading `row.depth`. Indent the group header `8 * depth` px.
  Single-select group keys render as pills using the same renderer
  as 1c.
- **Aggregation picker.** Per-column header dropdown adds an
  `aggregationFn` to the column's TanStack column def. POC: count for
  text/select, mean for numeric, none default. UI for picking is a
  small menu in the header context menu (need a column header context
  menu anyway for show/hide/freeze).
- **Persistence.** Group state (conditions + which groups are
  collapsed) goes to `localStorage` keyed by table slug. Real impl:
  per-user preferences row in DB. POC: localStorage is fine.
- **Interaction with #1 selection.** Range selection clamps within a
  group (per the note in #1). Range across collapsed groups is
  ambiguous — disable selection across collapsed-group boundaries, or
  only allow selection within a single visible run.
- **Interaction with #1b paste.** Paste disabled while grouped (per
  AirTable, per the #1b note). The "ungroup to edit" affordance should
  be obvious — a banner at the top of the table when grouped + paste
  attempted: *"Ungroup to paste"*.
- **Performance.** With 405 Materials rows × 3 group levels the row
  model rebuilds are negligible. At 10k+ rows we'd want to memoize
  more carefully — out of POC scope, real impl concern.
- **Empty groups.** If a row has `null` for a grouped column, AirTable
  buckets them into an "Empty" group at the bottom. TanStack does
  this for free if the value is `null` — verify in the spike.
- **Drill-in?** AirTable does *not* let you click a group to filter
  to it (a different feature called "views"). We don't need that for
  the POC; flag as out of scope so we don't mission-creep.

**Status.** `wishlist`.

### 1e. Stacked filter / sort with toolbar-tinted state

**Description.** Toolbar along the top of the table has discrete buttons:
**Hide fields**, **Filtered by …**, **Grouped by …**, **Sorted by …**,
**Color**. Each button:

- Reads as a sentence fragment when active (*"Filtered by MANUFACTURER"*,
  *"Grouped by 1 field"*, *"Sorted by 1 field"*).
- Has a **background tint** when active. The tint is a pale wash:
  green-ish for filter, purple-ish for group, peach-ish for sort, gray
  for inactive. (See attached AirTable screenshot.)
- The same tint cascades into the **column header and cell background**
  of every column currently driving that toolbar item. So the user can
  see at a glance: "the green column is the one I'm filtering on, the
  purple column is the one I'm grouped by, the peach column is the one
  I'm sorted by." When a column drives more than one (e.g. you sort the
  same column you're grouping by), the tints layer / blend.

Clicking each toolbar button opens a popover with stacked conditions:

- **Filter popover.** Each row is `column + operator + value` (operator
  depends on column type: `is`, `is not`, `contains`, `does not contain`,
  `is empty`, `is not empty`, `>`, `<`, `between` for numeric, etc.).
  Multiple rows combine with **AND** by default; a top-of-popover toggle
  switches the whole stack to **OR**. (AirTable also supports nested
  AND/OR groups via "+ Add condition group" — out of scope for POC; flag
  as follow-up.) Reorder via drag-handle. Delete per row. "+ Add
  condition" at the bottom.
- **Sort popover.** Each row is `column + asc/desc`. Order matters —
  first row is the primary sort key, subsequent rows are tiebreakers.
  Drag-reorder, delete, "+ Add another sort".
- **Group popover.** As described in 1d. Same UI pattern.

**Why it matters.** Two things, both load-bearing for our workflow:

1. **Stacking is how real questions are asked.** "Show me all insulation
   sourced from BASF, sorted by conductivity ascending." That's two
   filter conditions + a sort, expressed in three clicks. Anything that
   forces the user to think about the order of operations or to apply
   conditions one-at-a-time loses badly.
2. **The color tinting is the answer to "why am I not seeing what I
   expect?"** The single most common confusion in any data table is
   "where did that row go?" or "why is this in this order?" — the
   tinted column makes the answer instantly obvious without opening
   the popover. This is the interaction that makes AirTable feel
   *trustworthy* in a way other tools don't.

**TanStack notes.** Both popovers are pure UI; the underlying TanStack
state is already there. The novel piece is the tint-driven visual
language.

- **Filter popover.**
  - State: `ColumnFiltersState` is already a list of `{id, value}` —
    the value can encode operator + operand (`{op: 'gt', operand: 50}`)
    so we drive arbitrary operators. Existing `filterFn` (string,
    `inNumberRange`, etc.) is replaced with a custom `filterFn` per
    column type that interprets the structured value.
  - AND vs OR: TanStack's filter model is implicit-AND. For OR we
    swap the filter execution path: use `globalFilter` with a
    custom `filterFn` that ORs the per-column predicates manually.
    Or implement filtering outside TanStack for OR mode and feed
    pre-filtered rows in. POC: implement AND only; flag OR as
    follow-up if tier-1 demo doesn't need it.
  - Operator set per type: text (`contains` / `does not contain` /
    `is` / `is not` / `is empty` / `is not empty`), number (`=` /
    `!=` / `>` / `<` / `between` / `is empty`), single-select
    (`is any of` / `is none of` / `is empty`), date (`is` / `before` /
    `after` / `between` / `is within` last N days / `is empty`).
  - UI: popover, reorder via `@dnd-kit/sortable`, delete via × button.
- **Sort popover.**
  - State: TanStack's `SortingState` is already an ordered array of
    `{id, desc}`. Drag-reorder rewrites the array. The current spike
    sets a single sort; we just expose the existing multi-sort to UI.
  - Shift+click on a column header adds it to the sort stack
    (TanStack does this automatically when `enableMultiSort: true` and
    `isMultiSortEvent` returns true on shift). Wire that and the
    popover stays consistent with header-click sorting.
- **Group popover.** Already covered in 1d; this entry just integrates
  it into the toolbar pattern.
- **Toolbar-button tint logic.** A small helper on each toolbar button:
  inactive → gray bg, active → tint color from a palette `{filter:
  '#dcf5e3', group: '#e8e0f5', sort: '#fde4cf'}`. Label updates
  accordingly: *"Filter"* → *"Filtered by MANUFACTURER"* /
  *"Filtered by 3 fields"*.
- **Column-tint cascade.** This is the novel rendering piece. A
  per-column derived state `columnTintRoles[colId] = Set<'filter' |
  'sort' | 'group'>`. Computed from `columnFilters`, `sorting`, and
  `grouping`. Header cell and body cells in that column read the set
  and apply a layered background (CSS variable per role, additive via
  `background-blend-mode: multiply` on a wrapping pseudo-element, or
  pre-mixed colors looked up from a 7-entry table for the 2³−1 active
  combinations). Pre-mixed table is simpler for the POC.
- **Visual specifics from the screenshot.**
  - Toolbar button has **rounded rectangle background, small icon,
    label, no border** (or a subtle 1px border in the tint's darker
    variant — the "Filtered by MANUFACTURER" pill in the image has a
    blue selection border because it's currently focused).
  - Cell tint is *very* pale — well under 10% saturation. Reading text
    over the tint must remain easy; black text on `#dcf5e3` passes
    AAA. Pull the exact hex from the screenshot when we build it.
  - Column header gets a slightly darker variant of the same hue than
    the cells. Two-tone reinforces the "this column is special"
    signal.
- **Persistence.** Filter/sort/group state goes to `localStorage` per
  table slug for the POC; per-user DB row in the real impl. Same key
  as the group state in 1d — one persisted "view state" blob.
- **Interaction with #1c single-select chips.** When a single-select
  column is filtered or grouped, the chip itself is unchanged (color
  is its own option color). The cell *background* gets the toolbar
  tint, so chip + tint coexist. Verify visually — if it looks busy in
  practice we may want to drop the cell tint on chip columns and rely
  on the header tint alone.
- **No "Color" rules in scope yet.** The screenshot's "Color" toolbar
  button is AirTable's row-coloring rule UI — that's a separate
  wishlist entry if/when Ed wants it. The hard-coded conductivity
  coloring in the spike is the POC stand-in.

**Status.** `wishlist`.

### 1f. In-table field (column) schema editor — add / edit / change type via modal

**Description.** A "+" button at the right end of the column header row
opens a small modal: **Add field**. The modal asks:

- Field name.
- Field type (radio list with icons + one-line descriptions: text,
  long text, number, single select, multi select, date, attachment,
  computed, link, boolean).
- Type-specific config (numeric: precision + units; single-select: the
  options list with colors per 1c; computed: the expression).

Confirm → the column appears at the right of the table immediately.

**Editing an existing column** is a double-click on its header (or a
caret menu on the header). Same modal pre-filled with current values.
You can:

- Rename the field.
- Change the type. Type changes show an inline preview of "what will
  happen to the existing N rows of data" — e.g. text → number shows how
  many cells will parse as numbers vs. become null; single-select →
  text shows that pills become their option name as a string. The user
  confirms or cancels with full visibility of the data conversion cost.
- Edit type-specific config in place (add/remove single-select options,
  change number precision, etc.).
- Delete the field, with confirm and a row count warning.

**Why it matters.** This is the ergonomic difference between "AirTable
is a tool I think *with*" and "AirTable is a tool I file tickets against."
Adding a column to track a new manufacturer attribute that just came up
in a spec review needs to be a 30-second action, not a 30-minute git +
SQL migration round trip. **The schema editor is the feature that lets
the catalog grow with how we work, instead of locking us into whatever
fields we thought of on day one.**

The type-change preview matters because in practice we *do* get column
types wrong on first pass — `category` lands as text and we want it as
single-select; `density` lands as text and we want it as number; an
attachment column starts as a URL string and we want it as a real
attachment field. Being able to convert in place, with confidence about
what happens to existing data, is what unlocks "just enter the data and
fix the schema later" — which is how we actually work.

**TanStack notes.** This is largely a backend-and-modal problem; TanStack
itself only needs to react to the changed field-def list.

- **PRD / plan tension — flag explicitly.** PRD §13.2 and plan §12 both
  mark "Schema editor UI" as **out of scope** for the POC. The reasoning
  was "adding a column via SQL is annoying but feasible; building a
  schema editor is a significant feature in its own right; defer." This
  wishlist entry is in direct conflict with that decision. Two paths:
  1. **Stay out of scope for the POC.** Validate parity on the data
     surface (1a–1e plus the rest) without a schema editor. Add columns
     via the §3.4 seed loader or by editing the YAML schema file.
     Promote this feature to a post-POC follow-up.
  2. **Bring it back in scope.** This wishlist entry is strong enough
     that Ed considers it a parity-gate item — without it, "as good as
     AirTable" fails. If so, plan §4–5 needs an extra week for the
     modal + type-change conversion logic.
  Recommendation: **finish 1a–1e first**, then revisit. If the answer
  to "is this as good as AirTable?" at that point is "almost, but I
  miss the inline schema editing" → bring it in. If the answer is
  "yes" → leave it out. The wishlist captures it either way.
- **Schema state.** Already lives in `catalog_field_def` rows per PRD
  §4. POC backend exposes `GET /tables/<slug>/fields`; we'd add
  `POST /tables/<slug>/fields`, `PATCH /fields/<id>`, `DELETE /fields/<id>`.
- **Add field flow.** Modal posts a new `catalog_field_def`. Backend
  generates the canonical key (snake_case from name) and returns the
  full row. Frontend appends to its column list — TanStack rebuilds
  columns from the schema, so the new column shows up on the next
  render.
- **Type-change conversion.** The hard part. Each conversion is its own
  function in `backend/features/catalog/field_conversions.py`:
  - **Same family** (text↔long_text, number↔number variants): trivial.
  - **Text → number**: try `Number.parseFloat`; null on NaN. Preview
    counts the would-succeed rows.
  - **Text → single_select**: lowercase-trim + match-or-create against
    options (the same pipeline as 1c paste). Preview shows new options
    that would be created.
  - **Single_select → text**: write the option name as a string. Lossy:
    color is dropped. Preview warns.
  - **Number → text**: stringify with current precision. Lossy in the
    sense that the column loses sortability-as-number.
  - **Anything → date**: try a list of common formats; null otherwise.
  - **Attachment → anything else**: forbidden (or convert to text URL).
  - **Computed ↔ anything**: forbidden in either direction; computed is
    its own thing.
  Preview is implemented as a `POST /fields/<id>/preview-convert` that
  takes the new type+config and returns counts and example rows
  without persisting.
- **Persistence model.** Field-def changes write a new row in an audit
  log (PRD §4 mentions `catalog_audit_log`). Type changes specifically
  should be logged with both old and new schema for forensic recovery.
- **Modal UI.** Form-driven. The single-select option list inside this
  modal is the same component used by 1c — single source of truth for
  "edit a single-select's options," whether reached from the column
  modal or from a cell's edit popover.
- **Storage shape.** Per PRD §4 fields are stored in a JSONB `fields`
  blob on each version row. Adding a column does not require an
  Alembic migration; removing a column leaves the data in JSONB
  (orphaned, ignorable, recoverable). Type changes rewrite the JSONB
  values in place across all rows — needs to be transactional and, for
  large tables, batched. POC scale (405 rows) is trivial.
- **Versioning interaction (PRD §7).** Open question: does changing a
  field's type create a new schema version? PRD §4 has `catalog_table.
  schema_version` but the lifecycle isn't specified. Suggestion: every
  field-def write bumps `schema_version`; record-version rows reference
  the schema_version they were written under. Old versions render
  using their original schema (read-only), current versions render
  using the current schema. Defer the full design to plan §7 if and
  when this entry comes back into scope.

**Status.** `wishlist` — **flagged as conflicting with PRD §13.2 / plan
§12 out-of-scope rule. Decide in/out after 1a–1e land.**

### 1g. Excel-style fill handle ("drag to array")

**Description.** When a cell or range is selected, a small square handle
appears at the bottom-right corner of the selection rectangle (the "fill
handle"). Click and drag the handle:

- **Drag down**: extends the selection downward; on release, the value
  from the source cell is written into every cell the drag covered.
- **Drag right**: same horizontally.
- **Drag from a multi-row source**: Excel/AirTable behavior — if the
  source contains a recognizable pattern (`1, 2, 3` or `Mon, Tue, Wed`
  or `Jan, Feb`), extrapolate. If not, repeat the source values cyclically.

While dragging, a dashed outline shows the target rectangle. Release to
commit; Esc to cancel.

**Why it matters.** This is the everyday gesture for "fill 200 rows with
the same value" — set the `source` field on every row in a block to the
same manufacturer, set the `category` chip on every row in a block to
"Insulation", or arrange a numeric sequence. Without it, the only way to
do bulk-set is select-cell → ⌘C → select-range → ⌘V (the workflow from
#1b). The fill handle collapses that to a single drag.

**Why it's distinct from #1b paste.** #1b consumes the OS clipboard;
the fill handle works *without* the clipboard, on values already in
the table. They share the underlying write path (apply a value to a
range of cells) but the gesture, source, and feedback are different.

**TanStack notes.** Fully owned by us. Builds on the #1 selection model
+ the cell-write path from #1b.

- **Render the handle.** When a range is active and not currently
  editing a cell, render a 6×6 px filled square at the bottom-right of
  the range overlay (the absolutely-positioned outline rectangle from
  #1). `cursor: crosshair` on hover.
- **Drag interaction.** `onMouseDown` on the handle sets a `filling`
  flag; `onMouseMove` over cells extends the *fill target* (visualized
  as a dashed outline) without touching the original selection.
  `onMouseUp` commits.
- **Constraint.** Fill is one-dimensional per drag — either purely
  vertical (extends below or above the source) or purely horizontal
  (extends right or left), whichever direction the user has dragged
  further. AirTable enforces this; matches Excel. Diagonal drag picks
  the dominant axis.
- **Value mapping.**
  - Source is one cell, target is N cells: write the source value to
    every target cell.
  - Source is one column × M rows, target is one column × K rows:
    repeat the M source values cyclically across the K target rows.
    POC can stop here.
  - Source is a recognizable pattern (`1, 2, 3` or arithmetic
    sequence): extrapolate by step. **Defer to follow-up — explicitly
    out of POC scope.** The cyclic-repeat case covers the workflow;
    pattern detection is a long tail of edge cases (dates, weekdays,
    quarters, Roman numerals, …) that's not worth chasing for the gate.
- **Type coercion.** Per-cell, same logic as #1b. Numeric source into
  a single-select target → run the 1c match-or-create pipeline.
  Computed / read-only target → skip with a paste-report toast.
- **Interaction with grouping.** Disable fill across group boundaries
  (per #1, #1b conventions). Or constrain the fill target to within a
  single group's visible run.
- **Interaction with sorting.** Subtle issue: if the user is sorted on
  a column, "fill down" should fill in the *current visible order*, not
  the underlying record order. Operate on `rowModel` (TanStack's post-
  sort/filter row model), not `rows`. Same rule as #2.
- **Interaction with virtualization.** Fill target can extend past the
  viewport. Auto-scroll while dragging near a viewport edge (typical
  ~10 px/frame). Commit iterates the actual `rowModel`, not the
  virtualized rows, so off-screen rows fill correctly.
- **Undo.** Same as #1b — out of POC scope, backstopped by versioning.
  Real impl needs Cmd-Z for both fill and paste.
- **Keyboard equivalent.** Excel's ⌘D (fill down) and ⌘R (fill right)
  fill the active selection from its first row / first column. Cheap
  to add — same write path. Add at the same time.

**Status.** `wishlist`.

### 1h. Bounded undo (⌘Z) for cell / row edits

**Description.** ⌘Z reverts the last edit. ⇧⌘Z (or ⌘Y) redoes. Edits
covered by undo:

- Single-cell value changes (inline edit).
- Multi-cell writes from #1b paste (one undo reverts the whole paste,
  not one cell at a time).
- Multi-cell writes from #1g fill-handle drag (same — one drag is one
  undo step).
- Row inserts (the "auto-add rows" prompt from #1b, manual "+ Add
  row").
- Row deletes.
- Single-select option creation that happened as a side effect of a
  paste (1c) — undoing the paste also rolls back the new options.

**Bounded depth: 4–8 steps.** Once the buffer is full, the oldest step
drops off. Resetting on page reload is acceptable for the POC.

Edits *not* covered by undo (out of scope, deliberately):

- Schema changes (1f) — column add/rename/delete/type-change. Too risky
  to allow undo across, and they're rare.
- Filter / sort / group / column-order / column-width / show-hide
  changes. These are view state, reversible by direct re-action.

**Why it matters.** Ed's correction supersedes my earlier "out of POC
scope, backstopped by versioning" notes in #1b and #1g. The reasoning
was that a wrong paste could be recovered from the version history —
true, but the *cost* is high: open the version timeline, eyeball the
diff, manually copy values back. ⌘Z is the right interaction for
"oops, I dragged the fill handle one row too far." Versioning is the
right interaction for "this material's spec changed in 2024-06; show
me what it was before." Different jobs.

Without undo, users defensively avoid the powerful gestures (paste,
fill-handle, multi-cell edit) — exactly the gestures we're building.

**TanStack notes.** TanStack has no undo; we own this entirely.

- **Architecture.** A single `EditHistory` store outside TanStack:
  ```
  type EditOp =
    | { kind: 'cell', rowId, colId, before, after }
    | { kind: 'paste', cells: {rowId, colId, before, after}[],
                       optionsAdded: {colId, optionId}[],
                       rowsAdded: rowId[] }
    | { kind: 'fill',  cells: {rowId, colId, before, after}[] }
    | { kind: 'rowInsert', rowId, position }
    | { kind: 'rowDelete', row: MaterialRow, position }
  ```
  Two stacks: `undo: EditOp[]` and `redo: EditOp[]`. Cap depth at 8.
  Every write path pushes onto `undo` and clears `redo`.
- **Apply / revert.** Each `EditOp.kind` has a paired `apply(op)` and
  `revert(op)` function. Revert goes to `redo`; redo goes back to
  `undo`. The cell-write code path is the same primitive used by
  inline edit, paste, and fill — so revert is just "write `before`
  back into the cell."
- **Granularity.** A paste of 200 cells is **one** undo step, not 200.
  Same for a fill drag. This matches AirTable and Excel; it also
  matches the user's mental model of "I just did a thing; undo my
  thing."
- **Single-select option side effects.** Pastes that auto-create new
  options (1c) need to roll those back too. The paste op records
  `optionsAdded`; revert removes the option from the field def *if*
  no other row references it. If another row was edited to use the
  new option in the meantime (rare), keep the option but warn in a
  toast. POC can ignore the warning case.
- **Optimistic + server.** Each cell write fires a server PATCH (per
  PRD §6.2). Undo fires a *new* PATCH that writes `before` back. The
  history is purely client-side — the server doesn't know it's an
  "undo," it just sees a write. Server-side audit log (PRD §4) records
  both the original write and the undo as separate audit entries,
  which is the correct forensic record.
- **Concurrent-edit interaction.** If another user (real impl) edited
  the same cell between our write and our undo, the undo's PATCH gets
  a 409 from optimistic locking. UX: undo fails with a toast *"That
  cell changed since you last edited; undo cancelled."* — the redo
  stack stays untouched. POC has one user; this is a real-impl
  concern but worth noting.
- **Keyboard binding.** ⌘Z when the table has focus — *only* when no
  cell is in edit mode. (When editing a cell, ⌘Z is the input field's
  native undo of the in-progress text.) Hook listens at the table
  container level.
- **Visual confirmation.** A subtle toast on undo *"Reverted: paste
  to 200 cells"* / *"Reverted: cell edit"*. Quiet, dismissible, two-
  second auto-fade. Without it the user can't tell whether ⌘Z reached
  the table or got swallowed.
- **Memory.** 8 ops × ~200 cells × ~few bytes per cell value = trivial.
  No concern.
- **Versioning interaction (PRD §7).** Undo operates on the *current
  version* of a record. It does **not** unwind a "create new version"
  action. If the user creates a new version, the undo stack should be
  cleared (or the new-version op pushed as an undoable, with revert =
  delete the new version row + repoint `current_version_id`). POC:
  clear the undo stack on new-version creation; safer.
- **Update earlier entries.** This entry **supersedes** the "Undo: out
  of POC scope" notes in 1b and 1g. When 1b/1g land, they push
  `paste` and `fill` ops onto this history.

**Status.** `wishlist`. Treat as a tier-1 parity item — the powerful
write gestures (1b paste, 1g fill) lose their value without it.

### 2. Full-row and full-column select via gutter / header click

**Description.** A narrow gutter on the left of every row holds a small
button (in AirTable, the row number / expand handle). Clicking it selects
the entire row — all cells across all columns. Clicking a column header
selects the entire column — all cells from row 0 to the end of the
filtered data set. Shift+click extends; ⌘+click toggles individual rows
or columns into a multi-row / multi-column selection. The selection is
the same selection model as #1 — once selected, ⌘C copies as TSV.

**Why it matters.** Two-click "grab this whole column of conductivities"
or "grab this whole material row" is the everyday move when prepping
data for PHPP, comparison spreadsheets, or just inspecting outliers.
Faster than dragging across 405 rows.

**TanStack notes.** Builds on the selection model from #1 — a row select
is just `anchor=(r, 0), head=(r, lastCol)`; a column select is
`anchor=(0, c), head=(lastRow, c)`. Implementation:

- Add a left gutter column (sticky, ~32 px wide) that is not in
  `columnOrder` — render it outside the TanStack column model so it
  never participates in reorder/resize/filter. On click, set the range
  to the full row.
- Header `onClick` (when not on the sort/filter/resize affordances) sets
  the range to the full column. Need to be careful with hit-testing —
  the header already handles click-to-sort, drag-to-reorder, and the
  resize handle. Plan: dedicate a small explicit "select column" affordance
  (a tiny chevron or just the empty space above the column name) rather
  than overloading the whole header click.
- Shift+click on a row gutter button extends the row selection from the
  current anchor row to the clicked row (rectangular block). ⌘+click
  toggles non-contiguous rows — this breaks the single-rectangle model,
  so we need a richer selection state: `{ ranges: Range[] }` instead of
  one rectangle. Defer ⌘+click to a follow-up if it complicates #1; the
  contiguous case covers 90% of the workflow.
- Copy semantics for "full column" need to respect filtering and sorting
  — copy the visible filtered/sorted rows, not the underlying data
  order. This means iterating `rowModel` (the TanStack post-filter,
  post-sort row model), not `rows`.
- Visual: row select highlights the entire row including the gutter;
  column select highlights the header and every cell in the column.
  Same overlay-rectangle technique as #1 generalizes.
- Interaction with grouping: in AirTable, full-column select still works
  while grouped (selects all leaf cells, skips group header rows). Full-
  row select on a group header row collapses/expands the group instead —
  decide POC behavior; simplest is to disable row gutter on group rows.

**Status.** `wishlist`.

