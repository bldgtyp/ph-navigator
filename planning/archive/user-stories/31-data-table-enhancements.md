---
DATE: 2026-05-24
STATUS: Draft. AirTable-parity enhancements to the shared
        <DataTable> primitive. All stories extend US-Builder-Tables
        (context/user-stories/30-tables-equipment.md).
AUTHOR: Ed May (with Claude)
SCOPE: Eight scoped enhancements / polish items for the shared
       DataTable used by every project table. Authoring source for
       implementation plans that will follow.
RELATED: context/user-stories/30-tables-equipment.md (US-Builder-Tables),
         context/technical-requirements/data-table.md,
         context/UI_UX.md §1.7
---

# PH-Navigator V2 — User Stories: DataTable Enhancements

These stories are scoped enhancements to the shared `<DataTable>`
primitive defined in **US-Builder-Tables**
(`30-tables-equipment.md`). Default UX is AirTable parity unless
otherwise specified. Each story is independently shippable but most
share `ViewState` plumbing (US-TBL-VIEW-1 is therefore the natural
backbone slice).

| Story | Title | Status |
|---|---|---|
| US-TBL-FILL-1 | Fill propagation in all four directions | Draft |
| US-TBL-EDIT-1 | Inline editor preserves column layout | Draft |
| US-TBL-EDIT-2 | Type-to-edit on selected cell | Draft |
| US-TBL-VIEW-1 | Persist table view state across sessions | Implemented |
| US-TBL-SELECT-1 | Single-select chevron + dropdown picker | Draft |
| US-TBL-FIELDS-1 | Hide / Show fields panel | Draft |
| US-TBL-COLREORDER-1 | Drag-to-reorder columns | Draft |
| US-TBL-ICONS-1 | AirTable icon set for toolbar | Draft |
| US-TBL-AGG-1 | AirTable-style summary bar (per-column aggregates) | Draft |
| US-TBL-COLWIDTH-1 | User-resizable, persisted column widths | Implemented |

---

## US-TBL-FILL-1 — Fill propagation in all four directions

**Status:** Draft · **Priority:** MVP polish
**Inherits:** US-Builder-Tables criterion 5 (multi-cell select) and
the existing fill-handle implementation (`useGridFill`,
`FillHandle.tsx`).

### Story
> As an editor, I want to drag the fill handle (or use ⌘D / ⌘R /
> ⌘⇧D / ⌘⇧R) to propagate values in **any** direction — right,
> down, **left, and up** — so I can fill columns/rows from a source
> cell regardless of where it sits in my selection, exactly like
> Excel and AirTable.

### Acceptance criteria
1. **Fill-right (existing)** — drag handle right, or ⌘R, fills the
   source cell(s) across the columns to the right of the anchor.
2. **Fill-down (existing)** — drag handle down, or ⌘D, fills across
   the rows below the anchor.
3. **Fill-left (new)** — drag handle left, or ⌘⇧R (confirm —
   see Q-FILL-1), fills across the columns to the left of the
   anchor. Source cells are the rightmost column of the source
   selection.
4. **Fill-up (new)** — drag handle up, or ⌘⇧D, fills across the
   rows above the anchor. Source cells are the bottom row of the
   source selection.
5. **Direction detection** — when the user drags the fill handle,
   the direction is inferred from the drag vector. Diagonal drags
   resolve to the dominant axis (no diagonal fill — matches
   AirTable/Excel).
6. **Type-aware propagation** — re-uses the existing `useGridFill`
   planner; field-type coercion, single-select option resolution,
   and validation preflight (US-Builder-Tables paste pipeline) work
   identically in all four directions.
7. **Single ⌘Z undo** — a fill is one semantic write op regardless
   of direction (matches existing right/down behavior).
8. **Read-only mode** — fill is hidden in locked-version and
   Viewer mode (existing behavior, all four directions).

### Open questions
- **Q-FILL-1: Keyboard shortcut for fill-left / fill-up.** Excel's
  mapping is not universal. Recommend: ⌘D = down, ⌘R = right
  (existing), ⌘⇧D = up, ⌘⇧R = left. Confirm before implementation.

---

## US-TBL-EDIT-1 — Inline editor preserves column layout

**Status:** Draft · **Priority:** MVP polish (UX regression fix)
**Inherits:** US-Builder-Tables criterion 9 (inline edit on
double-click).
**Reference:** AirTable behavior — editor overlays the cell, text
truncates inside the editor, columns do not reflow.

### Story
> As an editor, when I double-click a text or number cell to
> inline-edit it, I want the rest of the table layout to stay
> frozen — the column widths and row positions must not jump — so
> the table feels stable while I'm typing. Truncated text in the
> editor is acceptable; visual reflow of other cells is not.

### Acceptance criteria
1. **No layout reflow on edit start.** When `InlineCellEditor`
   mounts, the editor renders inside the cell's existing bounding
   box. Host column width, row height, and sibling cell positions
   do not change.
2. **Editor overflows the cell visually if needed** — exactly like
   AirTable: the input's text content can truncate with ellipsis
   or scroll horizontally inside the fixed-width input. The cell
   itself does not grow.
3. **Auto-grow only if explicitly designed** — for the rich-text /
   long-text editor variant (if/when introduced), an explicit
   expanded popover may render *above* the cell. The underlying
   cell still does not change size.
4. **Applies to all inline editors** — text, number, and any other
   simple-typed inline editor.
5. **Active-cell highlight** persists during edit; surrounding
   active-cell border does not shift.
6. **Manual verification (Playwright MCP):** start editing a cell
   with long text; confirm no neighbor cell's left/right edge
   moves.

---

## US-TBL-EDIT-2 — Type-to-edit on selected cell

**Status:** Draft · **Priority:** MVP polish
**Inherits:** US-Builder-Tables criterion 9 (inline edit on
double-click).
**Reference:** AirTable behavior — a focused cell accepts
keystrokes that immediately replace the cell value.

### Story
> As an editor, when a cell is selected (active), I want to start
> typing and have my keystrokes replace the cell's value without
> needing to double-click first — and pressing Enter or arrow-keys
> commits/cancels just like the explicit edit path. Double-click
> still works as an explicit way to enter editing without
> overwriting.

### Acceptance criteria
1. **Type-to-replace on active cell.** When a single cell is the
   active cell and the user types a printable character, the cell
   enters edit mode with the typed character as the **new** value
   (the prior value is replaced, not appended). Matches AirTable.
2. **Double-click preserves prior value.** Double-click (existing
   US-Builder-Tables criterion 9) opens the editor with the
   existing cell value pre-filled and cursor positioned at the end
   (AirTable default). This is the explicit "edit, don't replace"
   path.
3. **Enter / F2 opens editor with existing value.** F2 (and Enter
   on most field types) opens the editor pre-filled
   (edit-not-replace). Mirrors Excel/AirTable.
4. **Escape cancels** — restores prior value, no draft write.
5. **Enter commits** — same as existing behavior.
6. **Type-to-edit applies to text, number, and other simple-typed
   inline editors.** It does **not** apply to:
   - Single-select cells (which open the popover on chevron click —
     see US-TBL-SELECT-1).
   - Boolean/checkbox cells (Space toggles; typing does not "edit").
   - Read-only cells (locked version, formula columns, etc.).
7. **Multi-cell selection.** When more than one cell is selected,
   typing does **not** start editing (a multi-cell paste/fill is
   the right primitive there). Single-cell selection is the
   trigger.
8. **No double-write.** The first typed character replaces the
   existing value; subsequent keystrokes append normally. There
   must be no race where the prior value is briefly committed.

---

## US-TBL-VIEW-1 — Persist table view state across sessions

**Status:** Implemented (Plan 09, 2026-05-24) · **Priority:** MVP enhancement
**Supersedes:** US-Builder-Tables criterion 3 (session-only
Zustand). Resolves the deferred half of **Q-TBL-1** ("per-user
persisted view state") with a scope smaller than the full
Interfaces analog. Wired for the Rooms slice in `EquipmentTab` via
`useProjectTableViewState`; storage lives in `user_table_views`.
**Cross-ref:** NEW-TBL-1 (shareable named views) remains
post-parity — this story only persists *the current user's
last-used view per table*.

### Story
> As an editor, I want my filter/sort/group choices on each table
> to be remembered across sign-out and sign-in (and across page
> reloads and devices), so I don't have to re-apply the same filter
> every time I open a project I review weekly.

### Acceptance criteria
1. **Scope: single-view-per-table-per-user, per-project.** The
   persisted unit is the `ViewState` (sort + filter + group +
   column-visibility + column-order + column-aggregates) keyed by
   `(user_id, project_id, table_key)`. No named views in this
   story — that stays NEW-TBL-1.
2. **Storage: backend, not localStorage.** Saving to localStorage
   was rejected because (a) it doesn't survive a new device or
   browser, (b) it's not portable across sign-in. Persist in a new
   backend table — proposal: `user_table_views (user_id,
   project_id, table_key, view_state JSONB, updated_at)` with a
   composite primary key — written through a small repository
   module per `CODING_STANDARDS.md`.
3. **Save trigger: debounced auto-save on view change.** Every
   mutation to sort/filter/group/column-visibility/column-order/
   column-aggregates saves the new `ViewState` after a 500 ms
   debounce. No explicit "save view" button.
4. **Load trigger: on table mount.** When the user navigates to a
   table sub-tab, the API call resolves the stored `ViewState` and
   applies it before the first render (or applies defaults if none
   exists). Race with first paint should not flash defaults.
5. **Reset to default** in the toolbar overflow clears the
   persisted record (DELETE row), then rebuilds in-memory state to
   defaults.
6. **Locked-version view** — locked snapshots share the same
   view-state record with the head version. Switching versions
   does **not** reset the user's view.
7. **Viewer (public read-only) mode** — does not write view state
   (no user identity). Reads default `ViewState` only.
8. **API surface** — `GET /api/projects/{id}/table-views/{table_key}`
   and `PUT` (idempotent upsert). A batch read,
   `GET /api/projects/{id}/table-views?keys=…` →
   `{ views: { table_key: TableViewResponse } }` (one entry per requested
   key, defaults for absent rows, editor-only, ≤64 keys), collapses a
   multi-table page's per-table read fan-out into one request; the
   single-key routes are unchanged. MCP equivalents follow the existing
   per-table pattern (US-Builder-Tables "Cross-cutting hooks for
   LLM-friendliness").
9. **Backward-compatible.** If the stored `ViewState` references a
   column or single-select option that no longer exists in the
   schema, the missing reference is silently dropped and the view
   continues to load.

### Open questions
- **Q-VIEW-1: Does this also persist active-cell / selection /
  scroll position?** Recommend **no** — those are ephemeral. Only
  declarative view config persists.
- **Q-VIEW-2: Anonymous users on the public read-only Viewer.**
  Recommend **no persistence** (criterion 7). Confirm.

---

## US-TBL-SELECT-1 — Single-select chevron + dropdown picker

**Status:** Draft · **Priority:** MVP polish
**Inherits:** US-Builder-Tables criteria 16–17 (single-select
column type + header modal).
**Reference:** AirTable behavior — selected single-select cell
shows a chevron; clicking the chevron opens a searchable list of
options.

### Story
> As an editor, I want a single-select cell that's currently active
> to show a small chevron-down indicator, and clicking that chevron
> (or pressing Enter / Space) opens the options list as a popover —
> searchable, with one option highlighted ready for keyboard
> selection — so the affordance is consistent with AirTable.

### Acceptance criteria
1. **Chevron indicator on active single-select cell.** When the
   active cell is a `single_select` column, render a small
   chevron-down icon at the right edge of the cell. Inactive cells
   show no chevron.
2. **Click chevron → open popover.** Clicking the chevron opens the
   existing `SingleSelectPopover` anchored to the cell.
3. **Keyboard activation.** Pressing Enter, Space, F2, or any
   printable character on an active single-select cell also opens
   the popover. A printable character pre-fills the search input
   (AirTable parity).
4. **Popover content** (existing component, confirm parity):
   - Search input at top with placeholder *"Find an option"*.
   - Pill-styled option list using the option's palette color.
   - First option focused on open; ↑/↓ navigate; Enter selects.
   - "Create '<x>'" affordance below the list when no exact match
     exists and the user has create permission (US-Builder-Tables
     16 inline-create).
5. **Click outside / Escape closes** without writing.
6. **Click outside the chevron (in the cell body)** keeps current
   behavior: cell becomes active but popover does not open.
   (Double-click also opens the popover for parity with other
   inline editors — US-Builder-Tables criterion 9.)
7. **Read-only mode** — chevron hidden in locked version / Viewer /
   required-read-only cells.
8. **Multi-cell paste** continues through the existing
   match-or-create pipeline (US-Builder-Tables 16); this story only
   addresses the per-cell open affordance.

### Open questions
- **Q-SELECT-1: Multi-select column type.** Out of scope for V2 v1
  (US-Builder-Tables only specifies single-select). Mention only —
  defer.

---

## US-TBL-FIELDS-1 — Hide / Show fields panel

**Status:** Draft · **Priority:** MVP enhancement
**Reference:** AirTable behavior — "Hide fields" toolbar button
opens a panel listing every field with a per-field toggle, drag
handles for reorder, search, and Hide all / Show all bulk actions.

### Story
> As an editor, I want a "Hide fields" toolbar button that opens a
> panel listing every column in the table with a toggle to
> hide/show it, drag handles to reorder columns, a search input to
> find a field by name, and bulk Hide-all / Show-all buttons — so I
> can curate which columns I'm looking at without leaving the
> table.

### Acceptance criteria
1. **Toolbar button.** "Hide fields" lives in the existing
   `GridToolbar` next to Filter / Sort / Group. Uses the AirTable
   eye-off icon (see US-TBL-ICONS-1). Label shows a count of
   currently-hidden fields, e.g. *"Hide fields (3)"*, when any
   fields are hidden — same idiom as Sort / Filter / Group
   active-state.
2. **Panel content** (popover or `Popover`/`Sheet` — match existing
   toolbar popovers stylistically):
   - "Find a field" search input at top.
   - Vertical list of every column in the table's `columnDefs`, in
     current display order.
   - Each row: drag handle (left), field-type icon, field name,
     visibility toggle (right). Matches AirTable layout.
   - Toggling the switch immediately hides/shows the column in the
     table (live, no apply button).
   - "Hide all" and "Show all" buttons at the bottom.
3. **Drag-reorder integration.** Dragging the handle reorders the
   column in the table immediately — same primitive used by
   US-TBL-COLREORDER-1 (drag column header). Order changes route
   through the same `ViewState.columnOrder` mutation.
4. **First column is non-hideable.** Primary/frozen first column
   (US-Builder-Tables criterion 4) cannot be hidden — its toggle
   is disabled with a tooltip explaining why.
5. **Persistence.** Visibility and order are part of `ViewState`
   and persist per US-TBL-VIEW-1.
6. **Empty filter state** — when the search input has no matches,
   panel shows *"No fields match '{query}'"*.
7. **Read-only mode** (locked version / Viewer) — the panel is
   still **available** (it changes the local user's view, not
   project data); it does not write project state.
8. **Keyboard.** Esc closes the panel. Focus traps inside the
   panel while open.

### Open questions
- **Q-FIELDS-1: View-share-link banner.** AirTable shows *"This
  view is being used in a view share link…"* — that's an
  Interfaces feature and is out of scope (NEW-TBL-1). Omit banner.

---

## US-TBL-COLREORDER-1 — Drag-to-reorder columns

**Status:** Draft · **Priority:** MVP enhancement
**Reference:** AirTable behavior — column headers can be dragged
horizontally to reorder; the same order is reflected in the
Hide-fields panel.

### Story
> As an editor, I want to click and drag a column header to
> reorder columns in the table, and I want that order to also be
> controllable from the Hide-fields panel — so I can put related
> columns next to each other for review, exactly like AirTable.

### Acceptance criteria
1. **Drag handle on column header.** Hovering a column header
   reveals a drag affordance (the whole header is draggable,
   AirTable-style); a "grabbable" cursor confirms it.
2. **Drag-to-reorder behavior.** During drag:
   - A drop-indicator (vertical line) renders between target
     columns.
   - The active column header gets a translucent overlay.
   - Dropping commits the new order; ⌘Z reverts (one semantic op).
3. **Frozen first column not reorderable.** The first column
   (primary key / frozen column, US-Builder-Tables criterion 4)
   cannot be dragged and is not a valid drop target on either side
   of itself — it stays first.
4. **Group-by columns reorder live.** If a column is part of an
   active grouping, drag still works; the group header re-renders
   against the new order.
5. **Hide-fields panel drag handle** uses the same
   `ViewState.columnOrder` mutation (US-TBL-FIELDS-1 criterion 3).
6. **Persistence.** Order is part of `ViewState` and persists per
   US-TBL-VIEW-1.
7. **Keyboard accessibility.** Provide a keyboard-driven reorder
   path — focus a column header, press Space to "pick up," arrow
   keys to move, Space to drop, Esc to cancel. WCAG-compliant
   alternative to mouse-drag.
8. **Read-only mode.** Drag is disabled in locked-version /
   Viewer — but only because view state in Viewer isn't persisted
   (US-TBL-VIEW-1 criterion 7). Authenticated users in locked mode
   CAN reorder (view is per-user).

### Open questions
- **Q-COLREORDER-1: Library choice.** Recommend reusing whatever
  drag library the Hide-fields panel uses (likely
  `react-aria-components` `DropZone` or `dnd-kit`) for consistency.
  Confirm during implementation planning.

---

## US-TBL-ICONS-1 — AirTable icon set for toolbar

**Status:** Draft · **Priority:** MVP polish
**Reference:** AirTable toolbar — Hide fields, Filter, Group, Sort
each have a distinct, recognizable icon.

### Story
> As an editor, I want the data-table toolbar buttons (Group, Sort,
> Hide fields, Filter) to use icons visually matching AirTable's so
> the affordance is instantly recognizable to anyone coming from
> AirTable.

### Acceptance criteria
1. **Icon mapping** (use Lucide / Radix equivalents where they
   exist; otherwise inline SVG):
   - **Hide fields** — eye-off (Lucide `EyeOff` or equivalent).
   - **Filter** — funnel (Lucide `Filter` / `FilterIcon`).
   - **Group** — three horizontal lines stacked with grouping
     bracket (Lucide `Group` or `Rows3`; confirm visual match).
   - **Sort** — arrow up + arrow down (Lucide `ArrowUpDown` or
     `ArrowDownUp`).
2. **Consistent sizing and stroke weight** with the rest of the
   toolbar (existing icon scale in `GridToolbar.tsx`).
3. **Active-state indicator.** When the user has 1+ active rule
   (sort, filter, group) or hidden fields, the icon's pill shows a
   count badge (existing pattern; this story only changes the
   icon, not the badge logic).
4. **Tooltips** on hover give the button's label (parity with
   AirTable).
5. **Color.** Icons stay neutral foreground; active rules use the
   existing accent color from `tokens/`.

### Open questions
- **Q-ICONS-1: Group icon.** Lucide has no exact "AirTable group"
  icon. Pick the closest match or commission an inline SVG.
  Recommend Lucide `Group` first, fall back to inline.
- **Q-ICONS-2: Should the "Sort" icon flip direction when the
  active sort is descending?** AirTable does not. Recommend **no**
  — keep static.

---

## US-TBL-AGG-1 — AirTable-style summary bar (per-column aggregates)

**Status:** Draft · **Priority:** MVP enhancement
**Decision (2026-05-24, Ed):** Resolve to **option B — AirTable
summary bar.** The per-column aggregation menu in the column header
is replaced by a persistent summary bar at the bottom of every
table (grouped or not). Matches AirTable parity, reuses the
existing aggregation primitive, and is genuinely useful for
ungrouped tables (total iCFA, total fan wattage, etc.).
**Inherits:** existing `AggregationMenuItem.tsx`.

### Story
> As an editor, I want every table to render an AirTable-style
> summary bar at the bottom — pinned, one cell per column — where I
> can pick a per-column aggregation (Sum / Avg / Min / Max / Count
> / Count Unique / etc.) that displays a live aggregate over the
> visible (post-filter) row set, so I get totals without needing to
> group.

### Acceptance criteria
1. **Summary bar at the bottom of the table.** Always rendered
   (grouped or not), pinned (does not scroll with the body),
   visually distinct from the data rows.
2. **Per-column aggregate picker.** Each cell in the summary bar is
   empty by default; clicking opens a small menu of aggregations
   valid for that column type (Sum / Avg / Min / Max / Count /
   Count Unique / etc. — same set already implemented in
   `AggregationMenuItem.tsx`).
3. **Selection persists** as part of `ViewState` (US-TBL-VIEW-1) —
   `view.columnAggregates: { [columnKey]: aggregationType }`.
4. **Grouped tables** continue to show per-group aggregate rows
   AND the summary bar. The summary bar aggregates over the
   **entire visible row set** (post-filter, ignoring grouping).
5. **Hide-fields panel** hides the column AND its summary cell.
6. **Frozen first column** in summary bar shows a "Count: N" of
   total rows (AirTable parity).
7. **Read-only mode** — summary bar is visible; the picker is
   disabled.
8. **Column-header aggregation menu retired.** The previous
   per-column-header aggregation menu (visible in the header `⋯`
   menu) is removed — the summary bar is the single way to pick a
   column aggregate. Reduces UX surface area.

### Open questions
- **Q-AGG-1: Resolved 2026-05-24** — option B (summary bar).
- **Q-AGG-2:** Default aggregations for known numeric columns (e.g.
  iCFA, airflow_cfm)? Recommend **none** — user opts in
  per-column.

---

## US-TBL-COLWIDTH-1 — User-resizable, persisted column widths

**Status:** Implemented (Plans 11 + 12, 2026-05-24) · **Priority:** MVP enhancement
**Reference:** AirTable column-resize behavior (see attached
screenshot, 2026-05-24).
**Related plans:**
`planning/archive/dated/2026-05-24/plan-11-tbl-column-resize-overflow.md`
(guidelines) and
`planning/archive/dated/2026-05-24/plan-12-tbl-column-resize-implementation.md`
(phasing).

### Story
> As an editor, I want every column in any data table to have a
> width I can set by dragging the right edge of its header, and I
> want that width to persist exactly like my sort / filter / group
> / hide / reorder choices already do — so that opening a table
> after sign-out, on another device, or after I navigate away and
> come back shows the table the way I shaped it.

### Acceptance criteria
1. **Resize.** Hover the right edge of any column header — a 4 px
   wide grab zone shows a column-resize cursor. Press and drag
   horizontally to resize. Release commits. Drag below the column's
   minimum snaps to minimum; drag above the maximum snaps to maximum.
2. **Persisted across navigation.** Navigating away from the page
   and back, reloading, signing out and back in, or opening the
   same project on another device restores every column to the last
   width the user chose.
3. **Independent of order / sort / filter / group / hide.**
   Reordering columns, sorting, filtering, grouping, hiding columns
   and re-showing them: none of these reset, shift, or touch
   widths. Widths key on column `id`, not display index.
4. **Underflow.** If the sum of visible column widths is less than
   the wrapper width, the data ends where the last column ends. To
   the right of the last column is a neutral "outside" area painted
   with the `--bg-table-outside` token. The table does **not**
   stretch to fill.
5. **Tail "+" affordance.** A 42 px "+" cell sits at the right edge
   of the header strip and as a tail cell on every data row, ready
   for the future "add field" behavior. In v1 it is disabled
   (`aria-disabled`).
6. **Overflow.** If the sum of visible column widths exceeds the
   wrapper width, the wrapper scrolls horizontally. The frozen
   first data column and the row-number gutter stay pinned to the
   left edge of the wrapper. The header strip stays pinned to the
   top edge of the wrapper while the body scrolls vertically. The
   summary bar stays pinned to the bottom edge of the wrapper.
7. **Read-only mode.** Locked-version and authenticated Viewer
   modes still allow resize; widths are per-user view state, not
   project data. (Anonymous Viewer mode reads defaults only.)
8. **Double-click on resize handle: fit-to-content.** Sets the
   column width to the widest currently visible (post-filter,
   post-group) non-truncated content, including the header label,
   clamped to `[minWidth, maxWidth]`.
9. **No reflow during inline edit.** Editing a cell never changes
   any column width — see US-TBL-EDIT-1.
10. **Persistence is one PUT per gesture.** A drag emits many
    `onViewChange` updates but the existing 500 ms debounce in
    `useProjectTableViewState` collapses them into one PUT.

### Open questions
- None outstanding — see Plan 11 §8 for resolutions to
  Q-RESIZE-1…Q-RESIZE-7.

---
