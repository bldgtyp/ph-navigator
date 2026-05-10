---
DATE: 2026-05-10
TIME: 18:00 EDT
STATUS: DRAFT — consolidated reference for the PHN-V2 Table-View
        (`<DataTable>`) component. Synthesizes the catalog POC plans,
        spike results, and lessons-for-real-build from
        `research/poc-plans/`. This is the single source of truth
        for the table interaction model going forward.
AUTHOR: Ed May (with Claude)
SCOPE: The shared `<DataTable>` React component used by the catalog
       manager, the project Specifications sub-tab, and any other
       grid-style surface in PHN-V2. Covers library decision, validated
       capabilities, component contract, view-state model, write/undo
       pipeline, field-definition registry, lessons-for-build, parity
       feature matrix, open questions.
RELATED:
  - docs/plans/architecture-prd.md (architecture PRD; §11.3 anchors here)
  - docs/plans/tech-stack.md (stack pin)
  - docs/plans/ui-ux.md (§1 DataTable interaction model)
  - docs/plans/user-stories.md
  - research/poc-plans/grid-spike-results.md (TanStack vs AG Grid)
  - research/poc-plans/airtable-wishlist.md (parity wishlist)
  - research/poc-plans/airtable-parity-phases.md (vertical-slice phases)
  - research/poc-plans/catalog-poc-plan.md (POC scaffold)
  - research/poc-plans/poc-evaluation.md (gate decision 2026-05-07)
  - research/poc-plans/poc-lessons-for-real-build.md (the 25 design rules)
SUPERSEDES: nothing — first consolidated draft.
---

# PH-Navigator V2 — Table View (`<DataTable>`)

## 0. Why this doc exists

The catalog POC (week 0–gate, finished 2026-05-07) answered three
binding product questions:

1. **Is there an MIT-licensed React table library that can match
   AirTable's grid interaction model?** Yes — TanStack Table v8.
2. **Can we ship the parity gate's eight wishlist items on top of it?**
   Yes — Phases 1–5 all landed. (`grid-spike-results.md`,
   `airtable-parity-phases.md`, `poc-evaluation.md`.)
3. **What architectural shape does the real component need to inherit
   from the spike?** ~25 hard-won design rules in
   `poc-lessons-for-real-build.md`.

The POC produced a ~2.3 k-LOC sandbox (now preserved under
`research/poc-sandbox/` — see §13) and a stack of seven planning
docs (now under `research/poc-plans/`).
The follow-on work — extracting the sandbox into a real
`<DataTable>` component, wiring real persistence, attachments,
versioning — needs the lessons surfaced as **prescriptions, not
running notes**. That's this doc.

This doc replaces the POC's loose plan stack as the load-bearing
reference for the table component. The POC plans stay in-tree as
historical record; new work cites this doc.

---

## 1. Library decision — TanStack Table v8

### 1.1 The decision

**Pick:** TanStack Table v8 (MIT, headless), composed with
`@tanstack/react-virtual` for row virtualization, rendered through
shadcn-table primitives.

This was decided in `grid-spike-results.md` after a side-by-side spike
of AG Grid Community vs TanStack against six binding behaviors:
render, inline edit, filter, sort, resize/reorder, and **row
grouping**.

### 1.2 Why AG Grid Community was rejected

> Pick: TanStack Table v8. AG Grid Community fails the binding
> success criterion in plan §2: row grouping is Enterprise-only, and
> the POC requires group-by-category.
> — `grid-spike-results.md`

Three additional Enterprise-only blockers compounded the failure:

- **Set filter** (AirTable-style multi-select facet UI) — Enterprise
  only; Community ships text/number filters only.
- **Cell/range selection** — Enterprise; Community offers row
  selection only.
- **Per-developer licensing** — incompatible with a small team's
  iteration cadence.

### 1.3 Why TanStack won

- Every required behavior is achievable from the MIT-licensed core,
  with no feature wall or licensing.
- ~50–80 KB minified (`@tanstack/react-table` + `react-virtual`)
  vs ~1.0–1.3 MB for AG Grid — **15–25× smaller bundle**.
- Headless design matches our needs anyway: schema-driven cell
  rendering for computed fields, attachment cells, version-aware
  read-only indicators, AirTable-parity row coloring.

### 1.4 Tradeoffs accepted

> The cost is real and accepted: TanStack is headless, so we own the
> markup, styling, and a11y. That cost is consistent with the catalog
> work anyway — the schema-driven `<DataTable>` needs full control of
> cell rendering for computed fields, attachment cells, version-aware
> read-only indicators, and AirTable-parity row coloring.
> — `grid-spike-results.md`

Concretely:

1. **More code in `<DataTable>` than an AG Grid wrapper would have
   needed.** The TanStack POC sandbox is ~2.3× the LOC of the AG Grid
   spike. Real `<DataTable>` will grow further once it carries the
   write-pipeline, validation surfaces, accessibility, and persistence.
2. **A11y is on us.** AG Grid ships ARIA roles; TanStack does not.
   Budgeted in §10 below.
3. **Styling is on us.** No theme system. Acceptable because we wanted
   AirTable-parity look anyway, which would have meant heavy AG Grid
   theme overrides.
4. **Drag-reorder polish is on us.** HTML5 drag in the POC has no
   insertion indicator and no animation; `@dnd-kit/sortable` is the
   path post-extraction (§4.10).
5. **Bulk-selection markup is on us.** ~30–50 LOC plus a header
   checkbox column.

---

## 2. Validated capabilities (what the POC proved)

All capabilities below were proven in-browser against the Materials
dataset (405 rows, 13 fields, 12 categories) and verified by Ed in a
manual round-trip (drag, paste, fill, undo, sort/filter/group, copy
into Excel/Numbers/Sheets/AirTable). 172/172 unit tests passing at the
gate.

### Phase 1 — Active cell + single-cell copy

- Active-cell state `{ rowId, colId } | null` with visible focus border.
- Keyboard nav: ←/→/↑/↓, Tab/Shift+Tab with wrapping, Enter to edit,
  Esc to cancel, Home/End to move column endpoints.
- Click-to-focus + Enter-to-edit (replaced V1's double-click-only).
- Auto-scroll-into-view on focus change (vertical via the virtualizer).
- Frozen first column (sticky-left `name`).
- ⌘C copies the focused cell as plain text.

### Phase 2 — Range selection + structured copy + row/column select

- Selection state `{ anchor: {r,c}, head: {r,c} } | null`.
- Mouse drag extends the rectangle; auto-scroll near viewport edges
  (~10 px/frame); document-level pointer tracking under virtualization
  (see L5.3).
- Shift+arrow extends head; Shift+click sets head; anchor unchanged.
- Sticky 32-px left gutter (outside the TanStack column model — see
  L2.2) — click selects full row, Shift+click extends to a contiguous
  block of rows.
- Header strip affordance — click selects full column from row 0 to
  the last visible row; Shift+click extends to a contiguous block of
  columns.
- ⌘C writes **both** `text/plain` (TSV) **and** `text/html` (`<table>`).
  External paste into Excel, Numbers, Google Sheets, and AirTable all
  preserve the row × column shape.
- ⌘A selects the full visible (filtered) data set.

### Phase 3 — Bulk write gestures + undo

The hinge of the POC. A single write primitive:

```ts
type CellWrite = {
  rowId: string;
  colId: string;
  before: unknown;
  after: unknown;
};

function writeCells(writes: CellWrite[]): void;
```

Every write path — inline edit, paste, fill, row insert/delete —
goes through `writeCells`. Per-column type coercion runs inside it
(L6.1).

**Undo/redo** is a semantic-action stack (L6.2):

- Op kinds: `cell`, `paste`, `fill`, `rowInsert`, `rowDelete`.
- Each op carries its full `CellWrite[]` plus any row-level changes;
  `apply(op)` and `revert(op)` are pure.
- Stack capped at 8 entries (POC bound; revisit for production —
  see L6.3 and §11.2).
- ⌘Z / ⌘⇧Z bind at the table-container level, gated when a cell is
  editing. Toast on undo (`"Reverted: paste to 200 cells"`).

**Paste** (the killer parity feature):

- TSV parser handles trailing `\n`, quoted cells with internal
  newlines, Windows `\r\n`.
- Single rectangle-planner module decides target shape from three
  cases (L4.3):
  - single-cell clipboard into multi-cell selection → fill selection,
  - single-cell anchor + multi-cell clipboard → paste block,
  - same shape → cell-by-cell.
- Row overflow → modal *"Clipboard has N more rows. Add N empty
  records and paste?"*. Confirm appends N rows with `tmp-{n}` ids;
  Cancel drops overflow. Column overflow drops silently with a toast.
- The whole paste — appended rows + cell writes — is a single op
  on the undo stack (L6.4).
- Paste is disabled while grouped (banner: *"Ungroup to paste"*).

**Fill handle:**

- 6×6 px square at the bottom-right of the range overlay; visible only
  when a range is active and not editing.
- Drag extends a dashed target rectangle, axis-locked to the dominant
  direction. Auto-scroll near the viewport edge.
- Source values come from the **post-sort/filter** row model and map
  cyclically when shapes mismatch.
- ⌘D fills down; ⌘R fills right.
- **Pattern detection (1, 2, 3 → 4, 5…) is explicitly out of scope.**
  Cyclic-repeat covers the daily workflow.

### Phase 4 — Single-select field type

- Field-definition model (see §5):

  ```ts
  type FieldDef = {
    field_key: string;
    field_type: 'text' | 'number' | 'single_select' | 'computed' | ...;
    config?: { options?: { id: string; name: string; color: string }[] };
    // ...
  };
  ```

- Cell renderer: a `<span class="pill">` with `background = option.color`,
  text color via YIQ-luminance contrast pick. Null state = empty cell.
- Edit popover: search input, scrollable option pills, inline
  `+ Add new option` mini-form. Keyboard: type to filter, ↑/↓ to
  navigate, Enter to select, Esc to close.
- Field-def edit modal (column-header caret → "Edit options"):
  drag-reorder, color-swatch click to change, rename inline,
  delete with confirm.
- **Paste integration is the killer feature** (L6.5):
  1. Lowercase-trim the incoming string.
  2. Match against `config.options[].name` lowercase.
  3. On hit → assign the option id.
  4. On miss → append a new option with a palette-cycled color, then
     assign.
  5. Track new options in `pasteReport.newOptions[fieldKey]`.
  6. Persist the field-def update once at the end of the paste, **inside
     the same undo op as the cell writes** so a single ⌘Z reverts both.
  - Toast: *"5 cells written. 3 new options created in 'category':
    Mineral Wool, Aerogel, EPS Graphite"*.
- Sort by option **position**, not name (matches AirTable; see L2.4).
- Group-by single-select renders the group header with the option pill.

The seed loader uses the same match-or-create pipeline to promote
`category` from a raw CSV string column into a single-select with 12
options on import — proving the architecture before paste hits it.

### Phase 5 — Stacked sort/filter/group + toolbar tinting

Toolbar layout: five buttons — Hide fields, Filter, Group, Sort, Color
(Color is a placeholder in v1). Active buttons read as sentence
fragments (*"Filtered by MANUFACTURER"*, *"Grouped by 1 field"*,
*"Sorted by 1 field"*) and tint pale: filter-green (`#dcf5e3`),
group-purple (`#e8e0f5`), sort-peach (`#fde4cf`), inactive gray.

**Filter popover:**
- Stacked rows: column + operator + value + drag-handle + delete.
- Operators per type:
  - text: contains, does not contain, is, is not, is empty, is not empty
  - number: =, !=, >, <, between, is empty
  - single_select: is any of, is none of, is empty
- Top toggle: AND (default) / OR — **POC ships AND only**; OR is
  flagged as a follow-up if the live demo proves it essential.
- Drag-reorder conditions; "+ Add condition".
- Custom `filterFn` per column type interprets the structured filter
  value (L8.1).
- Empty/dormant conditions are **skipped**, not treated as "matches
  empty string" (L8.4).

**Sort popover:**
- Stacked rows: column + asc/desc + drag-handle + delete.
- Order matters; first row is primary, the rest are tiebreakers.
- Shift+click on a header adds to the sort stack (TanStack
  `enableMultiSort` + custom `isMultiSortEvent`).

**Group popover:**
- Stacked rows: column + asc/desc + drag-handle + delete.
- Up to 3 levels; warn on the 4th.
- Asc/desc toggles bucket order via a synthetic pre-sort prepended to
  the `sorting` plan (L8.3 — TanStack's `grouping` array buckets but
  doesn't order).

**Aggregation per column:**
- Small caret in the column header → "Show summary: count / sum /
  mean / min / max / none".
- Custom `aggregationFn` returning a pre-formatted string, paired
  with `aggregatedCell`. **Don't use TanStack's string-keyed
  shorthands** (`'mean'`, `'sum'` etc.) past prototypes (L9.1).

**Group accordion:**
- Replace the flat `getRowModel()` with `getGroupedRowModel()` +
  `getExpandedRowModel()`.
- Indent group headers `8 * row.depth` px.
- Group-header content: chevron (▼/▶), group key (as a pill if the
  group column is `single_select`), row count `(N)`, aggregated
  values per column.
- Toolbar quick actions: Collapse all / Expand all.

**Toolbar-tint cascade:**
- Per-column derived state `columnTintRoles[colId] = Set<'filter' |
  'sort' | 'group'>`.
- Header + body cells read the set and apply a layered background.
- **Tint palette is pre-mixed** as 14 hex entries (7 non-empty
  combinations × header/body variants). Don't compute at runtime —
  HSL blending produced muddy results (L9.2).
- Layer order: tint = base background, selection above, focus on top
  (`outline` channel) (L9.3).

### View-state object (in-memory in POC; persists post-gate)

```ts
type ViewState = {
  filter: FilterCondition[];
  sort: SortRule[];
  group: GroupRule[];
  aggregations: Record<string /*colId*/, AggregationKind>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
  expandedGroups: Record<string, boolean>;
};
```

This is **plain user-intent data**. TanStack's `columnFilters`,
`grouping`, `sorting` shapes are derived from it via `useMemo`
(L8.1). The persistence layer serializes `ViewState`, never the
TanStack shapes.

---

## 3. Lessons learned (the 25 design rules)

These are extracted from `poc-lessons-for-real-build.md` and grouped
by concern. Each is a prescription for the real build, not a war
story. The IDs (L1.1, L2.3, …) match the source doc for traceability.

### 3.1 Indexing & identity

**L1.1 — Single source of truth for "which row".** Commit to **stable
row id**, not visual position or data index. Equal only when
unsorted/unfiltered. Public API: `activeRow: rowId | null`. Internal:
`rowModel.find(r => r.id === activeRow)` whenever a visual position is
needed.

> Phase 1 click-to-focus jumped to random rows because the click
> handler stored TanStack's `row.index` (data index) while
> `moveActive` and auto-scroll treated it as visual position.

### 3.2 Component architecture

**L2.1 — Cell UI state lives at the `<td>` wrapper, not the column
def.** Column defs are display-only: `{ accessor, header, type,
render, format }`. `<DataTable>` owns focus / selection / editing /
error state and decides when to render an input overlay vs the
display renderer.

> Editing input inside a column renderer forced the columns memo to
> take `editing` / `commitEdit` as deps, invalidating on every focus
> change.

**L2.2 — Row-selection gutter is table chrome, not schema data.**
Row numbers, row-select checkboxes, drag handles live outside the
TanStack column model in explicit leading/trailing chrome slots. They
don't participate in reorder, resize, sort, filter, or copy payload
shape. The backend schema defines only real data fields.

**L2.3 — One typed field-definition registry drives all per-column
behavior.** Renderer, editor, coercion, sort, filter, aggregation
all hang off one typed `FieldDef`, not scattered conditionals (§5).

**L2.4 — Per-type sort behavior is explicit, not inferred.** Each
field type owns its comparator, with explicit null handling.
Product-critical rules (single-select sort-by-option-order, not
alphabetic) are encoded as field semantics.

### 3.3 Styling

**L3.1 — One positioning authority per element.** Don't mix inline
`style={{position: ...}}` with className-set position. Inline always
wins; className silently loses. Pick CSS modules or a single inline
style-builder; don't mix.

> The frozen-column header pinned but body cells scrolled because
> inline `position: 'relative'` overrode `dt-frozen` className's
> `position: sticky`.

**L3.2 — Focus and selection use separate style channels.** `outline`
is reserved for the active-cell focus ring; `border` / `box-shadow` is
reserved for selection geometry. Don't share a property between them
or the focus ring vanishes inside the selected range.

**L3.3 — Virtualized editors need explicit stacking lanes.** Editor
popovers under sticky headers + frozen columns + recycled rows need a
table-layer token set: base cell, frozen cell, selected, focused,
editing-row, editing-cell, floating editor/popover. Treat layering as
part of the component contract.

### 3.4 Clipboard

**L4.1 — Use the native `copy` event, not a keydown match.** Bind on
the table region's `copy` event handler, not a `keydown` that tries to
write through the async Clipboard API. Async clipboard is gated by
user-activation rules and flaky cross-browser; native `copy` fires
synchronously with a real `ClipboardEvent`. Guard: if
`window.getSelection().toString().length > 0`, defer to the browser
(the user is doing a text-selection copy).

**L4.2 — Multi-cell copy writes both TSV and HTML.** `text/plain` for
TSV-aware targets, `text/html` for richer ones. Both formats come from
one serializer over the same cell matrix. Decide once where headers
get prepended (full-column select only).

**L4.3 — Paste plans the rectangle first, then writes.** A pure module
takes `(selection, clipboardMatrix, visibleColumns, visibleRows)` and
returns `{ targetRect, overflowRows, clippedColumns }`. UI decides
modals/toasts; the write path stays agnostic.

**L4.4 — Native browser clipboard is enough.** Don't add a clipboard
package. Native `copy` / `paste` events plus a tested TSV
parser/serializer (promote to dedicated utilities with tests) are the
baseline; revisit only if browser failures, richer MIME, or
collaborative paste appear.

### 3.5 Keyboard & focus

**L5.1 — `tabIndex={0}` container with bubbled `onKeyDown` beats a
global listener.** Container-bound handlers fire only when the table
has focus; if a cell input is editing, its handlers run. No
`document.addEventListener('keydown', …)` filtering against every
input on the page.

**L5.2 — Tab capture has an a11y exit story.** When Tab would advance
past the last visible cell of the last visible row, let it bubble;
`preventDefault` only when there's somewhere to go inside the table.
Roving-tabindex pattern at the row level.

**L5.3 — Drag selection in a virtualized grid uses document-level
pointer tracking + `elementFromPoint()`.** Cell-local
`onMouseEnter` misses updates as rows recycle during auto-scroll. Use
`document` `mousemove`/`mouseup`, a `requestAnimationFrame`
auto-scroll loop, and `data-row-id` / `data-col-id` markers on cells.
Selection-controller hook with two modes: `select` and `fill`
(L7.1).

### 3.6 Write pipeline & undo

**L6.1 — One write primitive is the hinge.** Every user write path
collapses into `CellWrite[] -> apply` recording `before`/`after` per
cell. Without this, every gesture (inline, paste, fill, …) needs its
own inverse. Persistence is a transport swap, not a model rewrite.

**L6.2 — Undo entries are semantic user actions, not per-cell deltas.**
One stack entry per gesture (paste, fill, single edit, row-add, row-
delete), not one per changed cell. Matches user expectation; keeps the
history small and predictable.

**L6.3 — Bounded in-memory history is POC-only; production needs
explicit conflict rules.** Decide before shipping: what invalidates
local history; what happens on 409 / websocket invalidation; whether
undo replays local optimistic-only or issues compensating writes.

**L6.4 — Auto-added overflow rows belong inside the paste op.** Row
append + cell writes are one transaction. A single ⌘Z removes the
appended rows and reverts the cells together. Splitting surprises
users and is fragile to bookkeeping.

**L6.5 — Field-definition mutations belong in the same op as the cell
writes that depend on them.** Paste-aware single-select option
creation stays coherent because undo/redo tracks option records +
cell assignments together. Treating creation as a side effect orphans
options after undo.

### 3.7 Interaction architecture

**L7.1 — Fill-handle drag reuses the selection controller.** Document-
level pointer tracking + `elementFromPoint` + RAF auto-scroll, two
modes: `select` and `fill`. Don't reach for a new overlay or geometry
package.

**L7.2 — `window.confirm` is acceptable in POC, not in production.**
Replace with an app modal that explains where rows land, whether
creation is allowed under the current filter/group/view, and how the
action is recorded. Keep the decision semantics; replace the
mechanism.

### 3.8 View state

**L8.1 — Canonical state is plain user-intent lists; TanStack shapes
are derived.** Filter/sort/group/aggregation live as
`FilterCondition[]`, `SortRule[]`, `GroupRule[]`, `aggregations`.
TanStack's `columnFilters`, `grouping`, `sorting` come from `useMemo`
over those. Persistence layer serializes user-intent, not TanStack
internals — survives library upgrades and rendering-engine swaps.

**L8.2 — One mutation channel per axis.** When sort/filter/group are
owned by the toolbar, disable per-header inline mutations of the same
state. `<DataTable>` API: `onFilterChange` / `onSortChange` /
`onGroupChange` callbacks; UI mutates through them, not by calling
TanStack directly. Otherwise: silent clobbers when the next derive
runs.

**L8.3 — Group-level direction needs a pre-sort.** Setting
`grouping` buckets rows but doesn't order them. To honor a
group-asc/desc toggle, prepend a synthetic sort entry for the group
column to `sorting`:
`effectiveSorting = [...groupRulesAsSort, ...explicitSorting]`.

**L8.4 — Skip dormant filter conditions.** A condition whose value is
blank "passes everything"; it does **not** match the empty string.
Without this, the moment the user clicks `+ Add condition` the table
goes blank (everything `does not contain ''`).

### 3.9 Aggregation & color

**L9.1 — Custom `aggregationFn` + `aggregatedCell`, not built-in
string keys.** When the aggregation kind is user-controllable, define
a function returning a pre-formatted string and use `aggregatedCell`
to wrap it. The typed field registry exposes `formatAggregation(kind,
values)` per type; the table plugs it into both the aggregation
pipeline and the group-header rendering.

**L9.2 — Pre-mix the tint palette.** 7 non-empty role combinations × 2
surfaces (body, header, with header darker) = 14 entries. HSL-blend
approaches at runtime produce muddy results. Designers tune by
hex-editing a token set; `<DataTable>` accepts a `tintTheme` prop with
the same shape.

**L9.3 — Layer order: tint base, selection above, focus on top.** Tint
is the cell's default background. Selection / fill-preview /
aggregated overlays paint on top. Focus uses a separate channel
(`outline`). Document the tokens (base / tint / selection /
fill-preview / aggregated / focus); designers pick explicit colors,
not implicit blends.

### 3.10 Architecture & extraction

**L10.1 — "Evolve the sandbox in place" was right through the gate;
budget real time for the extraction.** The original "1 evening for
§11.1 extraction" estimate is wrong. Sandbox is ~2.3 k LOC of mixed
concerns. Mechanical extraction takes ~1 evening; **API design**
(props vs hooks, controlled vs uncontrolled, callback shapes, tint
theme) takes another 1–2 evenings. **Budget 2–3 evenings**. Run
extraction *before* persistence wiring so the persistence contract
shapes against the real component API, not sandbox state.

**L10.2 — Native HTML controls were good enough for the parity gate;
package upgrades are post-extraction.** After extraction, revisit:
(a) `@dnd-kit/sortable` for drag-reorder in popovers; (b) a chip-style
multi-select for `is_any_of`; (c) `floating-ui` for popover positioning
under sticky chrome. None are gate-critical.

---

## 4. `<DataTable>` component contract

The component the catalog manager and project Specifications sub-tab
both consume. Goals:
- One component, many tables. Per-table column declarations live in
  TS at the call site (PRD §11.1: "schema flexibility lives in code,
  not runtime").
- Public API ≈ user intent. Internal TanStack shapes are an
  implementation detail.
- Backend-agnostic write model so persistence is a transport swap,
  not a model rewrite.

### 4.1 Public API (sketch — finalized during extraction)

```ts
type DataTableProps<TRow> = {
  // Data
  rows: TRow[];                              // stable identity by `getRowId`
  getRowId: (row: TRow) => string;
  fieldDefs: FieldDef[];                     // §5 — drives render/edit/sort/filter/coerce
  columnDefs: ColumnDef<TRow>[];             // display-only (L2.1); references fieldDefs

  // View state — controlled (parent owns persistence)
  view: ViewState;
  onViewChange: (next: ViewState) => void;

  // Writes — single primitive (L6.1)
  onWrite: (op: WriteOp) => void | Promise<void>;
  // Op kinds: 'cell' | 'paste' | 'fill' | 'rowInsert' | 'rowDelete'
  // | 'fieldDefMutation' (e.g. new single_select option, L6.5)

  // Locked mode — read-only (locked version, view link, public viewer)
  readOnly?: boolean;

  // Theming / chrome
  tintTheme?: TintTheme;                     // 14-entry palette (L9.2)
  rowChrome?: { leading?: ChromeSlot[]; trailing?: ChromeSlot[] };  // L2.2
  density?: 'compact' | 'comfortable';

  // Optional integrations
  unitContext?: UnitContext;                 // PRD §11.5 (display units)
  attachmentRenderer?: AttachmentRenderer;   // pdf.js etc. — week 5 work
};
```

Notes:
- `view`/`onViewChange` is controlled. Uncontrolled mode (`defaultView`)
  is a post-extraction add if needed.
- `onWrite` is a single channel. Inline edits, paste, fill, undo, row
  ops all funnel here. The parent translates to PATCH/POST.
- Selection/focus/range state is **internal** to `<DataTable>` and
  not in the public API in v1. (Surface it later if multiple consumers
  need to read it.)

### 4.2 Internal architecture

```
<DataTable>
├── ViewStateController       — derives TanStack shapes from view (§7, L8.1)
├── SelectionController       — anchor/head + fill drag (L5.3, L7.1)
├── WritePipeline             — single CellWrite[] sink (§8, L6.1)
├── HistoryStack              — semantic ops, ⌘Z/⌘⇧Z (§8, L6.2/L6.3)
├── ClipboardSerializer       — TSV+HTML on copy; rectangle-planner on paste (L4.x)
├── FieldRegistry             — render/edit/coerce/sort/filter/aggregate per type (§5)
├── TanStack table instance   — wired with derived shapes
├── Virtualizer               — @tanstack/react-virtual
├── Renderer
│   ├── ChromeColumns         — gutter, row-select checkbox, etc. (L2.2)
│   ├── HeaderRow             — sort/filter/group caret affordances
│   ├── BodyCells             — focus/selection/editing layered (L3.3, L9.3)
│   └── GroupHeaders          — chevron + pill + count + aggregations
└── Toolbar                   — Hide/Filter/Group/Sort/Color buttons (§7)
```

### 4.3 Cell rendering pipeline

Per cell, layers paint bottom-up:
1. **Base background** — column tint from `columnTintRoles` (§7, L9.2).
2. **Selection** — box-shadow inset on selected-rect edges (L3.2).
3. **Fill preview** — dashed outline during fill drag.
4. **Aggregated overlay** — for group-header aggregated cells.
5. **Focus** — `outline` (separate channel; L3.2).

Inline edit overlays the display renderer; the field registry decides
which editor (text input, number input, single-select picker, etc.).

### 4.4 Density & frozen columns

- 32 px row height (matches AirTable).
- 1 px dividers; hover highlight on rows.
- Frozen first column (sticky-left) by default for any table where
  the first column is a name/identifier. Pre-empts range-selection
  edge cases (L3.1).

---

## 5. Field-definition registry (`FieldDef`)

The single source of truth for per-column behavior (L2.3). One
`FieldDef` drives renderer, editor, paste coercion, sort comparator,
filter operators, and aggregation formatter. Backend field schema
hydrates the registry; frontend never invents field types.

### 5.1 Shape

```ts
type FieldDef = {
  field_key: string;                       // matches row key
  field_type: FieldType;                   // see §5.2
  display_name: string;
  config?: FieldConfig;                    // per-type extras (e.g. options[])
  read_only?: boolean;                     // computed fields, locked versions
  required?: boolean;
  description?: string;
};

type FieldCapabilities<T> = {
  render: (value: T | null, row: AnyRow) => ReactNode;
  edit?: EditorComponent<T>;               // omit for read-only
  coerceFromClipboard: (raw: string) => T | null;
  compare: (a: T | null, b: T | null) => number;     // L2.4 — explicit null handling
  filterOperators: FilterOperator[];
  filterFn: (value: T | null, condition: FilterCondition) => boolean;
  formatAggregation?: (kind: AggregationKind, values: T[]) => string;
};
```

### 5.2 Field types in v1

| Type | Notes |
|---|---|
| `text` | Plain text. Operators: contains, does not contain, is, is not, is empty, is not empty. |
| `number` | Plain number. Operators: =, !=, >, <, between, is empty. SI in document; display via `unitContext` (PRD §11.5). |
| `single_select` | Pill cell + popover editor. Match-or-create on paste (L6.5). Sort by option position, not name (L2.4). |
| `computed` | Read-only; renderer returns formatted value. No editor. Computed in backend (CLAUDE.md: calculations live in backend). |
| `attachment` | R2-backed; renderer is a pluggable preview (`attachmentRenderer` prop). Schema-driven; full UX defined in week-5 work. |
| `argb_color` | POC ships as `text` (`"255,128,64,0"`). Typed `argb_color` is a post-v1 follow-up. |

**Post-v1 candidates** (not gating launch):
- `multi_select` — ~80% code reuse from `single_select`.
- `date` / `datetime`.
- `link` / `url`.
- `linked_record` — out of v2 scope per PRD §3.

### 5.3 Adding a new field type

1. Add the discriminator to `FieldType`.
2. Implement `FieldCapabilities` (render, edit, coerce, compare,
   filter, aggregate) in one module.
3. Register it in the field-type map. No conditionals scattered
   across `<DataTable>` — see L2.3.

---

## 6. Write pipeline & undo

The architectural hinge of the table (L6.1, L6.2).

### 6.1 The write op

```ts
type WriteOp =
  | { kind: 'cell'; writes: CellWrite[]; }
  | { kind: 'paste'; writes: CellWrite[]; rowsInserted: TRow[];
      newOptions: Record<string /*colId*/, FieldOption[]>; }
  | { kind: 'fill'; writes: CellWrite[]; }
  | { kind: 'rowInsert'; rows: TRow[]; }
  | { kind: 'rowDelete'; rows: TRow[]; }
  | { kind: 'fieldDefMutation'; before: FieldDef; after: FieldDef; };
```

Every gesture builds a `WriteOp`, applies it locally (optimistic),
records its inverse on the history stack, and emits it through the
parent's `onWrite` for persistence. The parent translates to backend
calls (PATCH on cells, POST on rows, PATCH on field-defs).

### 6.2 History stack

- One entry per semantic gesture (L6.2).
- `apply(op)` and `revert(op)` are pure functions over `(rows,
  fieldDefs)`.
- ⌘Z / ⌘⇧Z bind on the table container; gated when a cell is editing.
- POC bound: 8 entries, in-memory, cleared on reload. **For
  production**, conflict semantics must be specified before shipping
  (L6.3 — see §11.2 below).

### 6.3 Optimistic write + 409 conflict

Open design item (L6.3, PRD §6.2 / §8.5):
- On 409, the local op is rolled back and a toast surfaces the
  conflict with a "Reload" affordance. Concrete UX TBD.
- Undo of a previously-applied op fires a new PATCH with the `before`
  values. If a remote edit moved the cell since, a 409 returns and
  the undo is cancelled with toast: *"Cell changed since you last
  edited; undo cancelled."*

---

## 7. View state — sort / filter / group / aggregation

The canonical view state is plain user-intent (L8.1):

```ts
type ViewState = {
  filter: FilterCondition[];
  sort: SortRule[];
  group: GroupRule[];
  aggregations: Record<string /*colId*/, AggregationKind>;
  columnOrder: string[];
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
  expandedGroups: Record<string, boolean>;
};

type FilterCondition = {
  id: string;
  colId: string;
  operator: FilterOperator;
  value: unknown;          // shape depends on operator/type
  enabled?: boolean;       // user can disable without deleting
};

type SortRule  = { id: string; colId: string; direction: 'asc' | 'desc' };
type GroupRule = { id: string; colId: string; direction: 'asc' | 'desc' };
type AggregationKind = 'count' | 'sum' | 'mean' | 'min' | 'max' | 'none';
```

### 7.1 Derive TanStack shapes (don't store them)

```ts
const columnFilters = useMemo(() => deriveColumnFilters(view.filter), [view.filter]);
const grouping     = useMemo(() => view.group.map(g => g.colId),       [view.group]);
const sorting      = useMemo(
  () => [
    ...groupRulesAsSort(view.group),     // L8.3 — pre-sort for group direction
    ...view.sort.map(s => ({ id: s.colId, desc: s.direction === 'desc' })),
  ],
  [view.group, view.sort],
);
```

### 7.2 Mutation channel rule (L8.2)

- **Toolbar owns** sort, filter, group, aggregation, hide.
- **Per-header carets** propose mutations through the same callbacks
  (`onViewChange({ ...view, sort: [...]})`), never by calling
  TanStack directly.

### 7.3 Toolbar + tints

Toolbar buttons read as sentence fragments and tint pale when active.
The 14-entry tint palette (L9.2) is exposed as a `tintTheme` prop so
designers iterate without code changes.

### 7.4 Persistence

`ViewState` per (user, table) is persisted post-gate. Open question:
project-scoped or global per user? Lean: **global per user, per
table**, matching AirTable's "personal view" default. Decide during
the persistence work block.

---

## 8. Catalog manager — table-specific notes

The catalog manager is the first consumer (`/catalog/{slug}` —
PRD §11.1, ui-ux §2.3). v1 ships three catalogs: Materials,
Window-Frame Elements, Window-Glazing.

### 8.1 Reference dataset — Materials

- 405 rows, 13 fields, 12 categories.
- Numeric-heavy; attachment-light (6/405 = ~1.5% have datasheets).
- Schema challenges proven during the POC:
  - ~46% missing `density_kg_m3` and `specific_heat_capacity_J_kg_K` —
    schema-driven renderer must handle nulls cleanly.
  - `conductivity_w_mk`, `conductivity_btu_hr_ft_F`,
    `resistivity_hr_ft2_F_Btu_in` are mutually derivable — proof
    point for `computed` field type (week 3 work).
  - `ARGB_COLOR` ships as `"255,128,64,0"` text in v1 (typed
    `argb_color` is a post-v1 follow-up; §5.2).
  - `DATASHEET` is on 6 rows — Materials is **not** the attachment
    stress-test; Frames is.

### 8.2 Reference dataset — Window-Frame Elements

- 189 rows, 20 fields, ~84% attachment-heavy.
- Structurally most-different from Materials → strongest reusability
  test for `<DataTable>`. POC §9.1 confirmed Frames worked with
  **zero changes** to `<DataTable>` (validates the schema-driven
  contract).
- Drives the attachment + R2 + dedup work in week 5.

### 8.3 Reference dataset — Window-Glazing

- 40 rows, 10 fields. Reserve dataset; not exercised during POC
  unless time permits.

### 8.4 Single-select on `materials.category`

The killer-feature proving case for the field registry:
- Seed loader promotes the raw CSV string column to `single_select`
  on import, building 12 options from distinct values via the
  match-or-create pipeline.
- Paste a column of category strings → match-or-create with new
  options auto-assigned palette colors, one toast lists the new
  options, undo rolls back both the cell writes and the option
  records (L6.5).

### 8.5 Catalog-specific UI elements (catalog manager only)

- **Version chrome** — read-only banner + version dropdown (PRD
  §7.2). Not a `<DataTable>` concern; rendered by the catalog
  manager page outside the table.
- **Refresh-into-projects** — out of `<DataTable>`'s scope; runs at
  the per-project drift surface (PRD §7.4, US-ENV-11).
- **Bookshelf/picker mode** — the catalog manager renders the table;
  the bookshelf picker reuses the same `<DataTable>` with a
  `selectionMode='single'` prop and a different `rowChrome` (radio
  button, no row-add affordance).

---

## 9. Airtable-parity feature matrix

Status as of gate 2026-05-07 (`poc-evaluation.md` §7).

### 9.1 P0 — must-have (all landed in POC)

| ID | Description | Phase | Status |
|---|---|---|---|
| #1 | Excel-style cell range selection + ⌘C | 2 | ✅ Landed |
| #1b | Excel-style paste with auto-add-rows | 3 | ✅ Landed |
| #1c | Single-select field (pill, popover, paste-aware) | 4 | ✅ Landed |
| #1d | Stacked group-by with accordion | 5 | ✅ Landed |
| #1e | Stacked filter + sort with toolbar tinting | 5 | ✅ Landed |
| #1g | Fill handle (cyclic-repeat; pattern detection deferred) | 3 | ✅ Landed |
| #1h | Bounded undo (8-entry semantic stack) | 3 | ✅ Landed |
| #2 | Full-row + full-column select via gutter/header | 2 | ✅ Landed |

### 9.2 P1 — should-have (eligible for post-gate iteration)

| Item | Notes |
|---|---|
| #1f Inline schema editor (add/edit/change-type/delete column) | Out of post-gate immediate scope per gate decision 7.2. Mostly backend (conversion engine, preview API, field-def CRUD). Field-def state shape already in POC. Workaround for adding columns: seed-loader YAML schema. |
| OR mode in filter | Explicitly deferred per wishlist 1e note. AND covers all gate scenarios. Becomes a one-week follow-up if the live demo proves it essential. |
| Fill-handle pattern detection (1, 2, 3 → 4, 5…) | Explicitly deferred per wishlist 1g note. Cyclic-repeat covers the daily workflow. |
| ⌘+click non-contiguous selection | Explicitly deferred per wishlist #2. Contiguous case covers ~90% of workflow. State model would change from `{anchor, head}` to `{ranges: Range[]}`. |

### 9.3 P2 — nice-to-have

- `multi_select` field type (~80% code reuse from `single_select`).
- Keyboard a11y hardening (Tab escape, full roving-tabindex audit;
  L5.2).
- `@dnd-kit/sortable` for popover drag-reorder (currently native).
- `floating-ui` for popover positioning under sticky chrome.
- Drag-reorder column with insertion indicator + animation.
- Hide-fields popover.
- Color-rule UI (configurable row coloring).

### 9.4 Explicit non-goals

Per `airtable-parity-phases.md` §12 + PRD §3:

- Comment threads, @mentions, presence cursors.
- Public Grasshopper API.
- Linked-record / relation field types.
- Per-user / per-row permissions.
- Mobile / phone optimization. Dark mode.
- Computed-field expression editor UI.
- Migration tooling vs real AirTable.
- Audit log surfacing in the table UI.

---

## 10. Accessibility baseline

The POC explicitly deferred a11y polish past the parity gate, but the
component contract has to make the right primitives available so
hardening is bolt-on, not rewrite.

Baseline for the v1 extracted component:
- `tabIndex={0}` container with `onKeyDown` (L5.1).
- ARIA roles on table / row / cell (`role="grid"`, `role="row"`,
  `role="gridcell"`).
- `aria-rowindex` / `aria-colindex` set on the *visual* row/column
  (post-sort/filter), not the data position.
- `aria-rowcount` / `aria-colcount` reflect filtered totals.
- `aria-selected` on cells inside the selection rectangle.
- Tab escape from the table when no further nav available (L5.2).
- Focus ring on `outline` channel only (L3.2).
- Live-region announcement of filter/sort/group changes
  (`aria-live="polite"`).

Hardening lane (post-extraction):
- Roving-tabindex audit (one tabbable cell per row vs container-only).
- Screen-reader pass against NVDA + VoiceOver.
- High-contrast theme variant of `tintTheme`.

---

## 11. Open questions / risks

### 11.1 Resolved at gate (2026-05-07)

✅ **Phase 6 inline schema editor in scope?** No — out of post-gate
immediate scope. Workaround: YAML schema + seed-loader. Revisit when
field churn during real use justifies it.

✅ **OR mode in filter essential?** No. AND-only for v1; OR is a
follow-up if needed.

✅ **Proceed / Iterate / Stop?** Proceed. All parity items at clear-yes
or qualified-yes; no qualification reads as "doesn't work".

### 11.2 Open for post-gate work

- **Production undo conflict semantics (L6.3).** What invalidates
  local history (refetch, websocket invalidation, version switch)?
  Does undo replay locally, or fire compensating PATCHes? UX of
  undo-after-conflict.
- **Optimistic write + 409 UX.** Full design — toast vs banner vs
  modal; auto-reload vs explicit-reload.
- **Horizontal auto-scroll on focus change.** Vertical works via
  `rowVirtualizer.scrollToIndex`; horizontal needs frozen-column
  width offset math.
- **Number formatting under display-unit context.** PHN already has
  display-unit infrastructure (PRD §11.5); wire it into the field
  registry's `render` function for `number` cells.
- **View-state persistence shape.** Per user × per table; project-
  scoped vs global. Lean global per user, decide during persistence
  work.
- **Concurrent-user paste / fill semantics.** What happens when two
  users paste into overlapping ranges? PRD §6.2 / §8.5 has the
  concurrency model; the table needs explicit UX rules on top.
- **Attachment renderer contract.** `pdf.js` for PDF preview;
  contract finalized during week-5 attachment work.

### 11.3 Risks flagged

- **Extraction effort underestimated.** Original "1 evening for
  §11.1 extraction" is wrong (L10.1). Budget **2–3 evenings + API
  design**.
- **Bundle size from `<DataTable>` features.** TanStack core is small,
  but the write-pipeline + clipboard + fill + tint code adds up.
  Watch the bundle on each phase merge.

---

## 12. Extraction plan (post-gate)

Order of operations (from `poc-evaluation.md` §7.3):

1. **Extract `<DataTable>` from the sandbox** (L10.1) — 2–3 evenings
   + API design pass. Lock the public API in this doc before wiring
   anything else.
2. **Wire real persistence.** `apiClient` stubs → real fetch.
   PATCH/POST endpoints for cell writes, row insert/delete, field-def
   mutations. Optimistic write + rollback on 409.
3. **Versioning UX.** Read-only banner on locked versions; version
   dropdown lives outside the table (catalog manager + project
   header chrome).
4. **Attachments + R2.** Frames table is the stress-test (159/189
   rows). pdf.js inline preview.
5. **Frames second-table validation.** Confirm `<DataTable>` works
   on Frames with **zero component changes** (POC §9.1 expectation).
6. **Optional: Phase 6 inline schema editor** — if real-use churn
   justifies it.
7. **View-state persistence in DB.** `user_table_views` row per
   (user, table); ViewState as JSONB.

Hardening lanes that run in parallel:
- A11y pass (§10).
- `@dnd-kit/sortable` for popover drag-reorder.
- `floating-ui` for popover positioning under sticky chrome.
- OR mode in filter (if live demo flags it).

---

## 13. Reference — POC artifact pointers

(For traceability; once the real component lands these become
historical references.)

All POC artifacts have been copied into `research/` for the V2
repo (precedent / examples; not on the V2 import path). Original
V1 paths are listed in parentheses for archeological lookup.

| Artifact | V2 path | V1 origin |
|---|---|---|
| POC sandbox (TanStack) | `research/poc-sandbox/SandboxTanStack.tsx` | `ph-navigator/frontend/src/features/catalog/_components/SandboxTanStack.tsx` |
| POC sandbox (AG Grid spike) | `research/poc-sandbox/SandboxAgGrid.tsx` | same path under `_components/` |
| Phase-3 helpers (TSV parse, paste planner, history) | `research/poc-sandbox/sandboxPhase3.ts` | same path under `_components/` |
| Phase-4 helpers (option match, palette, contrast, comparator) | `research/poc-sandbox/sandboxPhase4.ts` | same path under `_components/` |
| Phase-5 helpers (sort/filter/group/aggregation) | `research/poc-sandbox/sandboxPhase5.ts` | same path under `_components/` |
| POC placeholder route component | `research/poc-sandbox/CatalogPocPlaceholder.tsx` | same path under `_components/` |
| Tests (172/172 passing at gate) | `research/poc-tests/sandboxPhase{3,4,5}.test.ts` | `_components/__tests__/sandboxPhase*.test.ts` |
| Spike route (read-only seed data) | `research/poc-backend/spike_routes.py` | `ph-navigator/backend/features/catalog/spike_routes.py` (`GET /api/catalog-poc/_spike/materials`) |
| POC seed CSVs | (not copied — gitignored) | `ph-navigator/backend/features/catalog/poc_seeds/airtable_export/` |
| Library decision doc | `research/poc-plans/grid-spike-results.md` | `ph-navigator/docs/plans/2026-05-06/grid-spike-results.md` |
| Wishlist | `research/poc-plans/airtable-wishlist.md` | same path under `2026-05-06/` |
| Vertical-slice plan | `research/poc-plans/airtable-parity-phases.md` | same path under `2026-05-06/` |
| Catalog POC plan | `research/poc-plans/catalog-poc-plan.md` | same path under `2026-05-06/` |
| Lessons-for-real-build | `research/poc-plans/poc-lessons-for-real-build.md` | same path under `2026-05-06/` |
| Gate evaluation | `research/poc-plans/poc-evaluation.md` | same path under `2026-05-06/` |
| Native-catalog-manager PRD (superseded by architecture PRD) | `research/poc-plans/2026-05-06-native-catalog-manager.md` | same path under `2026-05-06/` |
| Weekly notes | `research/poc-plans/weekly-notes.md` | same path under `2026-05-06/` |

---

## 14. Summary — what the real build inherits

1. **TanStack Table v8 is the foundation.** No feature wall, headless
   matches our schema-driven needs, ~50–80 KB total.
2. **Three architectural pillars:**
   - One write primitive (`CellWrite[]` → `WriteOp`) for inline /
     paste / fill / undo coherence (L6.1).
   - One typed field-definition registry unifying render / edit /
     coerce / sort / filter / aggregate (L2.3).
   - Plain user-intent `ViewState`; TanStack shapes derived, not
     stored (L8.1).
3. **25 hard-won lessons** (§3) tested in-browser against Materials.
4. **Parity gate is passed.** All P0 items at clear-yes; deferrals
   pre-flagged in the wishlist itself.
5. **Post-gate sequence (§12)** runs extraction *first*, persistence
   second — so the persistence contract shapes against the real
   component API.
