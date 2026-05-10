---
DATE-STARTED: 2026-05-07
STATUS: Living document — append as phases complete. Source of truth for
        catalog `<DataTable>` design decisions when the post-gate refactor
        in airtable-parity-phases.md §11.1 happens.
RELATED: airtable-parity-phases.md, weekly-notes.md (chronological log;
         this file is the curated distillation)
---

# POC Lessons → Real Build

What the POC has taught us that should shape the real `<DataTable>` and
the catalog backend. Every lesson cites the incident or decision that
produced it, so future-Ed (or a future contractor) can re-verify the
context.

## How to use this file

- Each phase distills its weekly-notes findings into 1–5 entries here,
  filtered to those that change the *real* implementation. Cosmetic
  fixes and pure POC artifacts (the seed loader, the spike route, etc.)
  stay in `weekly-notes.md` and don't propagate here.
- Group by topic. Newest entries appended within each topic.
- Each entry: a one-line rule, a **Why:** line citing the POC incident,
  and a **How to apply in the real build:** line.

---

## Indexing & identity

### L1.1 — A single source of truth for "which row"

**Rule.** State that references "the active row" must commit to one
indexing scheme — visual position, data index, or stable row-id — and
translate to the others only at well-defined read/write boundaries.

**Why.** Phase 1 click-to-focus jumped to random rows because the click
handler stored TanStack's `row.index` (data index) in `activeCell` while
`moveActive` and the auto-scroll effect treated the same field as a
visual position. The two are equal only when the table is unsorted and
unfiltered. The default sort by `conductivity_w_mk asc` made the bug
visible immediately.

**How to apply in the real build.** Once persistence is in, use **stable
row-id** as the canonical reference (it survives sort, filter, AND a
backend refetch — visual position survives only the first two). The
`<DataTable>` API should expose `activeRow: rowId | null` (not an
index). Internal translation: `rowModel.find(r => r.id === activeRow)`
when the visual position is needed for keyboard nav or scrolling.

---

## Component architecture

### L2.1 — Don't put cell-level UI state into TanStack column defs

**Rule.** Column definitions stay *display-only*. Cell-level UI state
(focus, selection, edit mode, error overlays) renders at the `<td>`
wrapper level, not inside the column's `cell` renderer.

**Why.** The first Phase 1 implementation put the editing `<input>`
inside the column `cell` renderer, which forced the columns memo to
take `editing` and `commitEdit` as dependencies — meaning every focus
or edit change rebuilt all column defs. It also forced the column def
to use `info.row.index` (data index) for matching, which collided with
L1.1. Hoisting the editing input up to the `<td>` resolved both at
once.

**How to apply in the real build.** Column defs accept `{ accessor,
header, type, render, format }` only. The `<DataTable>` component owns
focus / selection / editing state and decides when to render an input
overlay vs. the column's display renderer. This also makes columns
defined in JSON-from-the-backend possible (PRD §6 schema-driven
rendering) — column defs become pure data, not React closures.

### L2.2 — Row-selection gutter is table chrome, not schema data

**Rule.** Row numbers / row-select affordances live outside the TanStack
column model. Treat them as table chrome, not as a backend-defined
column.

**Why.** Phase 2 added full-row selection from a sticky left gutter.
Keeping the gutter outside the column model meant it did not
participate in reorder, resize, sort, filter, or copy payload shape.
That made row-selection semantics much simpler and avoided polluting the
backend field schema with a fake "row number" column.

**How to apply in the real build.** `<DataTable>` should have explicit
leading/trailing chrome slots (row numbers, checkbox-select, drag
handle, etc.) separate from schema columns. The backend only defines
real data fields; the table shell defines operational chrome.

### L2.3 — Typed field behavior belongs in one field-definition registry

**Rule.** Renderer, editor, coercion, sort, and filter behavior for a
column should all derive from one typed field-definition object, not
from scattered column-specific conditionals.

**Why.** Phase 4 worked cleanly once `category` became a
`single_select` field in `fieldDefs` and that same definition drove the
pill renderer, inline option picker/create, paste match-or-create, and
option-order sort. The proving-case slice stayed local even though it
cut across display, edit, clipboard, and history behavior.

**How to apply in the real build.** The backend field schema should
hydrate a single registry the table consumes. Each field type should
provide a small capability surface such as `render`, `edit`,
`coerceFromClipboard`, `sort`, and `filterValue`, so adding a new field
type does not require hand-patching unrelated table code paths.

### L2.4 — Per-type sort behavior should be explicit, not inferred

**Rule.** Each field type owns its comparator. Don't rely on table-level
sort inference when values can be null, computed, or option-backed.

**Why.** Phase 4 hit a React concurrent-render recovery failure because
the sorted row model did not behave safely under mixed/null
`single_select` data until explicit comparators were wired for number,
text, and option-backed fields.

**How to apply in the real build.** The typed field registry should
export comparator functions with explicit null handling. Sorting rules
that matter to the product, such as single-select sort-by-option-order
instead of alphabetic label sort, should be encoded as field semantics,
not discovered indirectly at runtime.

---

## Styling

### L3.1 — Pick one positioning authority per element

**Rule.** Don't mix inline `style={{position: ...}}` with a className
that sets `position: ...`. Inline always wins; the className silently
loses.

**Why.** Phase 1's frozen `name` column header pinned correctly but
body cells scrolled. The `dt-frozen` className set `position: sticky`,
but `styles.td` set `position: 'relative'` inline — and inline won.

**How to apply in the real build.** Settle on one styling approach for
the `<DataTable>`. Options that don't have this trap: a single CSS
module / styled-component per cell type, OR a single inline-style
builder that knows about all positioning concerns (frozen, focused,
editing, aggregated, …) and emits one merged style object.

### L3.2 — Focus ring and range outline need separate style channels

**Rule.** Don't use the same CSS property to draw both active-cell focus
and range-selection edges.

**Why.** Phase 2 initially used `box-shadow` for the range perimeter and
the existing focused-cell ring also used `box-shadow`. The selected
focused cell then lost its focus ring because the inline selection style
overrode the class-based focus style. Switching focus to `outline` fixed
it immediately.

**How to apply in the real build.** Reserve `outline` for keyboard focus
/ active-cell state and reserve border or box-shadow for selection
geometry. This keeps focus visible inside a selected range and avoids
style-precedence bugs.

### L3.3 — Virtualized editors need explicit stacking lanes

**Rule.** In a virtualized table with sticky headers and frozen columns,
editor popovers need an explicit z-index/overflow plan at the row, cell,
and overlay layers.

**Why.** Phase 4's single-select picker initially rendered behind the
next row. The fix was not a new package; it was giving the active row a
higher stacking level, the editing cell `overflow: visible`, and the
popover its own local z-index.

**How to apply in the real build.** Define table-layer tokens up front:
base cell, frozen cell, selected cell, focused cell, editing row/cell,
and floating editor/popover. Treat the layering model as part of the
component contract, not one-off CSS repair work.

---

## Clipboard

### L4.1 — Use the native `copy` event for ⌘C, not a keydown match

**Rule.** ⌘C / clipboard-write operations bind to the document's
`copy` event. Don't intercept ⌘C in a keydown handler and reach for
the async Clipboard API.

**Why.** Phase 1.7 implementation. The async Clipboard API is gated by
user-activation rules and writes-from-keydown can be flaky across
browsers. The native `copy` event fires synchronously, hands you a
real `ClipboardEvent` with `clipboardData`, and is what every spreadsheet
in the wild uses.

**How to apply in the real build.** `<DataTable>` registers a `copy`
listener at the table-region level (not document-wide — scopes
correctly when multiple tables are mounted). It must guard against
hijacking the user's text-selection copy intent: if
`window.getSelection().toString().length > 0`, defer to the browser.

### L4.2 — Structured copy should write BOTH TSV and HTML

**Rule.** Multi-cell copy emits `text/plain` as TSV and `text/html` as a
minimal `<table>`.

**Why.** Phase 2's browser smoke test pasted correctly into Excel,
Numbers, Google Sheets, and AirTable only after the copy payload was
treated as a first-class structured export, not as a plain joined
string. TSV handled spreadsheet-native text paste; HTML preserved table
shape in richer paste targets. Quoting tabs/newlines inside cell values
was necessary to keep the rectangle intact.

**How to apply in the real build.** Build a single clipboard serializer
for `<DataTable>` that returns both formats from the same cell matrix.
Preserve the rule that row gutters stay out of the payload, and decide
explicitly when header labels are prepended (for example full-column
select).

### L4.3 — Paste needs one rectangle planner, not feature-specific branches

**Rule.** Clipboard paste should first resolve to a single explicit
target rectangle and only then generate writes. Keep the shape logic in
one pure helper, not spread across UI handlers.

**Why.** Phase 3 worked cleanly once the POC separated three concerns:
(1) parse TSV, (2) decide the target rectangle (`single-cell clipboard →
fill selection`, `single-cell selection → paste block`, `same-shape →
cell-by-cell`), and (3) generate writes through the shared write
primitive. Before that split, the paste logic wanted to leak row-count,
selection-shape, and type-coercion concerns into the event handler.

**How to apply in the real build.** Keep a pure paste planner module
that takes `{selection, clipboardMatrix, visibleColumns, visibleRows}`
and returns `{targetRect, overflowRows, clippedColumns}`. The table UI
can then decide whether to show a modal / toast, while the backend-aware
write path stays agnostic to paste shape.

### L4.4 — Native browser clipboard is enough for parity-scale paste

**Rule.** Don't add a clipboard package by default. Native
`copy` / `paste` events plus a tested TSV parser are enough for the
spreadsheet parity slice.

**Why.** Phase 3 added Excel-style paste without bringing in a third-
party clipboard abstraction. The working pieces were plain
`ClipboardEvent`, `text/plain` TSV, and a small parser that handles
quoted cells plus trailing newline cleanup. That was sufficient for
copy/paste round-tripping at POC scale.

**How to apply in the real build.** Start with the native clipboard path
and promote the TSV parser + serializer into dedicated table utilities
with tests. Only revisit a package if later requirements add browser-
specific failures, richer MIME needs, or collaboration with non-table
editors.

---

## Write pipeline & undo

### L6.1 — One write primitive is the hinge for inline edit, paste, fill, and undo

**Rule.** Every user write path should collapse into one
`CellWrite[] -> apply` primitive that records `before` and `after`
values per cell.

**Why.** Phase 3 stayed manageable only after inline edit, paste, and
fill were routed through the same write path. That made undo trivial:
each semantic action stores a list of cell writes, and undo simply
replays the `before` values. Without that choke point, each gesture
would need its own inverse logic.

**How to apply in the real build.** The real `<DataTable>` should keep a
backend-agnostic write plan shape, likely
`{ rowId, fieldKey, before, after }[]`, even if persistence later
batches writes into PATCH / POST requests. The in-memory POC proved the
shape; the production build should swap only the apply transport, not
the op model.

### L6.2 — Undo entries should be semantic user actions, not per-cell deltas

**Rule.** The undo stack stores one entry per gesture (`paste`, `fill`,
single edit, row add from overflow accept), not one entry per changed
cell.

**Why.** In Phase 3, one paste or fill operation could touch dozens of
cells and sometimes append rows. Treating the whole gesture as a single
operation made ⌘Z match user expectation and kept history small and
predictable. It also let row-appends ride inside the same op as the
paste that required them.

**How to apply in the real build.** Keep the history model semantic.
Even once writes become persistent, the optimistic UI layer should still
group changes by user action and revert them as one action when
possible.

### L6.3 — Bounded in-memory history is fine for parity, but the real system needs explicit server-conflict rules

**Rule.** A small in-memory undo/redo stack is the right POC choice; do
not confuse that with a production history model.

**Why.** The Phase 3 POC used an 8-entry in-memory stack and cleared it
on reload. That was exactly right for fast parity testing, but it says
nothing about how undo should behave after a backend refetch,
multi-user edits, or persisted row creation.

**How to apply in the real build.** Preserve the semantic-op model, but
define additional rules before shipping: what invalidates local history,
what happens after a 409 or websocket invalidation, and whether undo
replays local optimistic state only or issues explicit compensating
writes to the backend.

### L6.4 — Auto-added overflow rows belong inside the paste transaction

**Rule.** When paste needs extra rows, the row-append and cell writes
should be one logical operation.

**Why.** Phase 3 used one paste op containing both the appended blank
rows and the pasted cell writes. That let a single undo remove the new
rows and revert the cells together. Splitting them would have produced a
surprising two-step undo and more fragile bookkeeping.

**How to apply in the real build.** The eventual persistence layer
should still treat overflow-accept as one transaction boundary:
`create rows + patch values + audit log entry`. The UI already proved
the expected user semantics.

### L6.5 — Field-definition mutations must be undoable alongside cell writes

**Rule.** If a cell edit can also mutate schema-like state (for example,
creating a new single-select option), that mutation belongs inside the
same semantic operation as the dependent cell writes.

**Why.** Phase 4 paste-aware option creation and inline option-create
only stayed coherent because undo/redo tracked both the new option
records and the cell assignments that referenced them. Treating option
creation as a side effect would have left orphan option state after
undo.

**How to apply in the real build.** Keep the write-op envelope broad
enough to carry both row-value writes and field-definition/config
writes. Even if they eventually persist through different endpoints, the
optimistic UI and undo layer should treat them as one user action.

---

## Interaction architecture

### L7.1 — Fill-handle drag can reuse the Phase 2 selection controller pattern

**Rule.** Fill-handle drag should piggyback on the same document-level
pointer tracking and DOM target resolution used by range selection.

**Why.** Phase 3 did not need a new drag package or a separate geometry
engine. Reusing the Phase 2 pattern (`document` move/up listeners,
`elementFromPoint()`, viewport-edge auto-scroll) was enough to preview
and commit the fill target.

**How to apply in the real build.** Extract selection/fill drag into a
shared controller hook with two modes: `select` and `fill`. The
underlying pointer plumbing should be shared; only the meaning of the
target rectangle differs.

### L7.2 — `window.confirm` is acceptable for the POC overflow prompt, not for the real app

**Rule.** Native blocking dialogs are fine for parity spikes when they
answer a UX question quickly; they should not survive into the real
catalog manager.

**Why.** Phase 3 used `window.confirm` for overflow row acceptance
because it let us verify the decision point immediately with no modal
framework work. That was the right POC trade. It is also visually blunt,
browser-specific, and impossible to style or enrich with schema
language.

**How to apply in the real build.** Replace it with an app modal that
can explain where the new rows will land, whether creation is allowed
under the current filter/group/view, and how the action will be
recorded. Keep the decision semantics; replace the delivery mechanism.

---

## Keyboard & focus

### L5.1 — `tabIndex={0}` container with bubbled keydown beats a global listener

**Rule.** Keyboard navigation lives on the table container's
`onKeyDown`, not a `document.addEventListener('keydown', …)`.

**Why.** Document-wide listeners need to filter by `e.target` against
every input on every page where the table appears. The container-bound
handler fires only when the table region has focus; if an internal
input is editing, its own keydown handlers run and we don't have to
care.

**How to apply in the real build.** `<DataTable>`'s container is
`tabIndex={0}` and owns `onKeyDown`. Mouse-down on any cell focuses
the container so subsequent keys land in the right place. The same
container-scoped pattern carries forward to range-selection mouse
events in Phase 2.

### L5.2 — Tab capture has an a11y exit story

**Rule.** A table that captures Tab to navigate cells must let the
user escape it without resorting to mouse.

**Why.** Phase 1 currently captures Tab inside the table — pressing
Tab past the last cell of the last row stays inside (wrap rules), so
the user must press Esc-then-Tab to leave the table. Acceptable for
a POC sandbox, would be an a11y bug in the real app.

**How to apply in the real build.** When Tab would advance past the
last visible cell of the last visible row, `preventDefault` only when
there's somewhere to go inside the table; otherwise let Tab bubble
to leave the table naturally.

### L5.3 — Virtualized drag selection needs document-level pointer tracking

**Rule.** Range drag in a virtualized grid should track pointer movement
at the document level and resolve the current target from the DOM; don't
rely only on cell-local hover events.

**Why.** Phase 2 needed selection to keep extending while the cursor sat
near the viewport edge and the table auto-scrolled under it. A
cell-local `onMouseEnter` model would miss updates once rows recycled
under a stationary cursor. The working POC approach was
document-level `mousemove` / `mouseup`, a `requestAnimationFrame`
auto-scroll loop, and `elementFromPoint()` against `data-*` markers on
cells / gutters / header strips.

**How to apply in the real build.** Keep the selection model as
`anchor/head` state, but move the event plumbing behind a dedicated
selection controller hook. Start with pointer events if touch/pen is in
scope; otherwise the Phase 2 DOM-targeting pattern is a solid desktop
baseline.

---

## View state — sort / filter / group / aggregation

### L8.1 — Keep view state as plain user-intent lists; derive TanStack shapes

**Rule.** The canonical state for filter / sort / group / aggregation
should be a small list of user-intent records (e.g. `FilterCondition[]`,
`SortRule[]`, `GroupRule[]`). Derive TanStack's `columnFilters`,
`grouping`, and `sorting` from these lists with `useMemo`. Don't store
the TanStack shapes directly.

**Why.** Phase 5 needed *stacked* filter conditions per column (multiple
conditions ANDed together on `density_kg_m3`, for example). TanStack's
native `columnFilters` slot is one entry per column, so its model
doesn't natively express stacking. Wrapping the user-intent list as the
filter *value* and then reading it inside a custom `filterFn` was clean,
but only because the canonical state lived in our list and the TanStack
shape was a derived projection. Going the other direction (storing
TanStack shapes and reverse-engineering user intent from them) would
have been painful.

**How to apply in the real build.** The eventual view-state blob
(`{ filter, sort, group, aggregations, columnOrder, columnWidths,
hiddenColumns, expandedGroups }`) should serialize the *user-intent*
lists, not TanStack's internal shapes. That makes the persistence
contract stable across TanStack upgrades and lets us swap the rendering
engine without migrating saved views.

### L8.2 — Pick one mutation channel per axis (toolbar OR per-header), not both

**Rule.** When sort / filter / group state is owned by a toolbar
controller, disable or remove the per-header inline affordances that
would mutate the same state. Don't leave both wired.

**Why.** Phase 5 replaced the per-header `<input>` filter with a
structured filter popover. Because `columnFilters` was now derived from
our condition list, calling `column.setFilterValue()` from a header
input would silently do nothing — the next derive would clobber it.
Same trap exists for `column.toggleGrouping()`. Mixing two write
channels into one derived state is a bug factory: the user clicks
something, nothing happens, and there's no error to surface.

**How to apply in the real build.** Decide per axis whether mutation
flows through the toolbar popover, the column header menu, or both
(with both writing through the same controller, not through TanStack
directly). The `<DataTable>` API should accept `onFilterChange` /
`onSortChange` / `onGroupChange` callbacks; any UI that wants to mutate
goes through them.

### L8.3 — Group-level direction needs a pre-sort, not just a `grouping` array

**Rule.** Setting TanStack's `grouping` is enough to *bucket* rows, but
the *order* between buckets comes from the column's sort entry. To make
asc/desc on a group rule actually flip the buckets, prepend a synthetic
sort entry for that group column to `sorting` (skipping any column the
user has already explicitly sorted on).

**Why.** In Phase 5 the group popover's asc/desc toggle did nothing
until `effectiveSorting = [...groupRulesAsSort, ...explicitSorting]`
fed TanStack. Before that, group order was implicit and stuck on
whatever the previous sort was — confusing for the user, who expected
"Group by category desc" to put `Z…` groups first.

**How to apply in the real build.** Treat group ordering as a first-
class part of the sort plan rather than a side effect of grouping.
Either compose grouping+sorting at the controller layer (as the POC
does) or expose explicit per-group `direction` to the engine. Document
which one you picked.

### L8.4 — Skip dormant filter conditions instead of treating empty values as filter input

**Rule.** A filter condition the user is still typing (operator needs
a value but the value is blank) must short-circuit to "passes everything"
inside the evaluator, not "matches empty string".

**Why.** Without this, the moment the user clicks `+ Add condition` the
table goes blank because every row "doesn't contain ''" in some bizarre
operator-specific way. Phase 5's `isConditionConfigured()` gate was the
fix; tested as `'skips conditions that are not yet configured'`.

**How to apply in the real build.** The filter evaluator must be aware
of the difference between *configured-and-rejecting* and
*not-yet-configured*. The same applies if the real app introduces an
"add filter" empty-state row.

---

## Aggregation rendering

### L9.1 — Custom `aggregationFn` + `aggregatedCell` is cleaner than the built-in string keys

**Rule.** When aggregation kind is user-controllable, define
`aggregationFn` as a function that returns a pre-formatted string (or
the raw value) and use `aggregatedCell` to wrap it with a label. Avoid
the `'mean'` / `'sum'` shorthand keys past prototypes.

**Why.** Phase 5's per-column aggregation picker (`mean / sum / min /
max / count / none`) needed the column def to vary by user state. Using
TanStack's string-keyed aggregations would have needed conditional
column-def construction with five branches per column. A single
function that closes over the current `aggregationKinds[colId]` was
cleaner and let `computeAggregation()` stay a pure helper.

**How to apply in the real build.** The typed field registry (L2.3)
should expose a `formatAggregation(kind, values)` function per field
type. The table component plugs it into both the aggregation pipeline
and the group-header rendering with no per-column conditionals.

---

## Color and visual cues

### L9.2 — Pre-mix the tint palette; do not compute it from base colors at runtime

**Rule.** When tinting columns by role (filter/sort/group) and you need
to handle combinations, pre-mix the seven non-empty role combinations
into a static palette. Don't blend base colors with HSL math at render.

**Why.** Phase 5 needed seven backgrounds per surface (body and header)
for filter, sort, group, and their pairwise/triple combinations. An
HSL-blend approach was tempting but produced muddy results that no
designer would actually pick — and it made it impossible to hand-tune
any single combination without affecting the others. A 14-entry lookup
table (`ROLE_BACKGROUNDS.body[*]`, `ROLE_BACKGROUNDS.header[*]`) is
what shipped, and tuning is just hex-editing a single value.

**How to apply in the real build.** Treat the tint palette as a design
token set, not a computed value. The real `<DataTable>` should accept
a `tintTheme` prop with the same 14-key shape; designers can iterate
on it without code changes.

### L9.3 — Layer order: tint as the *base* background, selection above, focus on top

**Rule.** Column tint is the cell's default background (replaces
`undefined`). Selection, fill-preview, and aggregated overlays paint on
top by overriding the background. Focus uses a different style channel
(outline) — see L3.2.

**Why.** This was the only ordering that produced legible at-a-glance
state. Putting selection underneath the tint hid the selection. Putting
the tint on top of selection hid the selection. Focus on a different
channel kept the focus ring visible inside both selected and tinted
cells.

**How to apply in the real build.** Codify the layering model in the
component contract (extends L3.3). Document tokens for: base / tint /
selection / fill-preview / aggregated / focus. Make designers pick
explicit colors for each layer, not implicit blends.

---

## Sandbox-in-place is starting to bite

### L10.1 — `evolve the sandbox in place` is correct through the gate, but plan a real refactor budget

**Rule.** §2.4's no-extract rule kept iteration fast through Phase 5.
Don't relax it before the gate. But also don't trust the original
"~1 evening for §11.1 extraction" estimate.

**Why.** After Phase 5 the sandbox is ~2.3 k LOC of mixed concerns:
selection controller, write pipeline, single-select editor, toolbar
popovers, virtualized rendering, clipboard handlers, tint cascade. The
mechanical extraction is only the first day — the second day is
deciding the public API of `<DataTable>` (props vs. headless hooks,
callback shape, selection/focus controlled vs. uncontrolled, tint
theme prop, etc.). All of that needs a design pass, not just a cut.

**How to apply in the real build.** Budget §11.1 as **"a 2–3 evening
extraction + API design"**, not one mechanical evening. Run the
extraction *before* persistence wiring (L6.3 / L8.1) so the persistence
contract is shaped against a real component API, not the sandbox's
inline state.

### L10.2 — Native HTML controls are good enough for parity popovers; revisit packages post-gate

**Rule.** Don't reach for `@dnd-kit/sortable`, `react-select`, or
`floating-ui` for the parity gate. Native `<select multiple>`,
`<input type="number">`, plain buttons, and absolute positioning
shipped Phase 5's three popovers in one sitting.

**Why.** The parity gate's question is "does the *behavior* feel right",
not "does the popover have a designer-grade chip selector". Polish
costs hours per popover and would not change the gate's answer.

**How to apply in the real build.** After §11.1 extraction, revisit:
(a) drag-to-reorder for filter/sort/group rows likely wants
`@dnd-kit/sortable`; (b) the `is_any_of` multi-select wants a chip
control rather than `<select multiple>`; (c) popover positioning under
sticky chrome wants `floating-ui`. None of those are gate-critical.

---

## Open questions deferred to later phases

These came up during Phase 1 but won't be answered until later phases
exercise the relevant code paths. Recording so they're not forgotten.

- **Horizontal auto-scroll on focus change** — vertical works via
  `rowVirtualizer.scrollToIndex`; horizontal needs offset math that
  accounts for the frozen column's width. Skip until Phase 2 demands
  it (range selection drag past the right viewport edge will).
- **Edit-conflict semantics with concurrent users** — POC has one
  user; real build needs optimistic-lock 409 handling on PATCH (see
  PRD §6.2). The Phase 3 undo design has a placeholder for this.
- **Number formatting under display-unit context** — PHN already has a
  display-unit context (commit `5d9bea7`); Phase 1 uses
  `toLocaleString()` only. Wire the existing context into the cell
  renderer when the real build extracts `<DataTable>`.
