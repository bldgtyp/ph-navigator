---
DATE: 2026-05-23
TIME: planning
STATUS: Draft phase plan — agreed in chat with Ed 2026-05-23. Phases 0–7.
SCOPE: Bring the shared `<DataTable>` primitive
       (`frontend/src/shared/ui/data-table/`) to AirTable parity, driving
       all development against the Rooms table (US-EQ-2) which already
       consumes it. The primitive is intended to back many surfaces across
       PH-Navigator (Rooms, Thermal Bridges, ERVs, Pumps, Fans, the three
       catalog pages, future grid surfaces) — so this plan is a **library
       hardening exercise**, not a Rooms feature. Catalog page migration
       is OUT of scope here and tracked separately.
RELATED:
  - context/technical-requirements/data-table.md (canonical contract)
  - context/user-stories/30-tables-equipment.md (US-Builder-Tables §16–17)
  - research/poc-plans/airtable-parity-phases.md (the PoC plan this descends from)
  - research/poc-plans/poc-lessons-for-real-build.md (25 design rules, cited as L*.*)
  - research/poc-plans/airtable-wishlist.md (the parity-bar feature list)
---

# `<DataTable>` AirTable Parity — Phase Plan

## 1. Purpose

The PoC (`research/poc-plans/`) shipped Phases 1–5 of an AirTable-parity
spike against a sandbox component. Most of those lessons are already
encoded in `frontend/src/shared/ui/data-table/` (active cell, keyboard
nav, Shift+Arrow range, ⌘C copy, ⌘V paste with coercion, single-select
sort-by-option-order, paste match-or-create, `WriteOp` union).

This plan turns the remaining wishlist into a vertical-slice execution
sequence against the real `<DataTable>` — driven by Rooms, but explicitly
shaped to serve every consumer that follows.

## 2. The shared-primitive imperative

`<DataTable>` is intended to back **every grid surface in PH-Navigator**:

| Consumer | Story | Notes |
|---|---|---|
| Rooms (US-EQ-2) | already on `<DataTable>` | The driver surface for this plan. |
| Thermal Bridges (US-EQ-3) | placeholder in v1, full in v1.1+ | Will adopt without re-implementation. |
| ERVs / Pumps / Fans (US-EQ-4..6) | MVP scaffolding | Same pattern, different columns. |
| Materials / Frame-Types / Glazing catalog pages | currently plain `<table>` | Separate migration plan, post-parity. |
| Future project-data tables | TBD | Whatever grid surfaces follow. |
| Bookshelf pickers | read/select-only mode | `readOnly` prop already supports. |

Hard constraint: **a fix to `<DataTable>` must fix the behavior for every
consumer with zero per-page work.** Consumers pass column definitions,
field defs, view state, and an `onWrite` callback. They do **not** copy
toolbars, popovers, keyboard handling, selection logic, history, or any
other interaction code.

Architectural rules that flow from this:

1. **Component API exposes user intent, not TanStack internals**
   (data-table.md §"Component Shape"). Already the case; preserve.
2. **All interaction code lives in `shared/ui/data-table/`.** Toolbars,
   popovers, modals (option manager, paste-review, delete-confirm), and
   the side-panel scaffold (when added) all live here. Consumers receive
   slots, not components-to-render.
3. **Field behavior lives in the typed `FieldDef` registry** (L2.3). New
   field types add a capability bundle (render, edit, coerce, sort,
   filter, aggregate) once; every consumer table gets the new field type
   for free.
4. **No per-consumer escape hatches** beyond what the props expose. If a
   real need surfaces (e.g. a special row-detail surface a particular
   consumer wants), it lands as a generic slot in the primitive's API,
   not as a hack in the consumer.
5. **Tests live with the primitive.** Consumer pages get thin integration
   tests; the meat of the test coverage stays in
   `frontend/src/shared/ui/data-table/__tests__/` so that adding a new
   consumer doesn't re-derive the test matrix.

This plan is therefore a **library-hardening exercise** driven by Rooms.
Other consumers will adopt the result wholesale, not piecemeal.

## 3. Sequencing rules (binding)

1. **Vertical slice every phase.** Each phase ends with a click-by-click
   browser demo Ed can perform against Rooms.
2. **Drive every behavior through Rooms.** Rooms is the only consumer
   touched in this plan. Catalog page migration is a separate body of
   work tracked outside this file (see §13).
3. **No per-consumer code added in this plan.** Every change lands in
   `shared/ui/data-table/` or shared field-def code. The only file that
   should change in `features/equipment/` during these phases is
   `RoomsTable.tsx` if a prop signature changes — and even that is a
   warning sign worth pausing on.
4. **Undo stays in-memory per session.** No compensating writes to the
   backend on undo (per Ed 2026-05-23, matches PoC L6.3).
5. **One write primitive.** Every gesture (inline edit, paste, fill, row
   insert/delete, option mutation) emits a `WriteOp` through `onWrite`.
   Phase 0 codifies this; later phases plug in.
6. **Toolbar is the single mutation channel** for sort/filter/group
   (L8.2). Header-click sort survives Phase 0 but is rewritten in Phase 4
   to call the same `onViewChange` path the toolbar popovers do.

## 4. Phase summary

| # | Phase | One-line demo |
|---|---|---|
| 0 | Foundation refactor | Rooms behaves identically; new architecture (`useGridSelection`, `useGridHistory`, semantic write reducer, stable-id selection model) lands behind the existing API. |
| 1 | Inline edit + single-select cell popover | Click any Rooms cell, type → value updates. Single-select cells open a search-and-create popover; one ⌘Z reverts cell + option creation as one op. |
| 2 | Row insert / delete with semantic undo | Shift+Enter inserts blank row below; gutter checkboxes + Delete remove N rows with confirm; ⌘Z reverts. |
| 3 | Mouse-drag range selection + auto-scroll + full-column select | Click-drag a rectangle past the viewport edge, container auto-scrolls, ⌘C copies into Excel as a shaped block. |
| 4 | Stacked filter + sort toolbar | Toolbar popovers stack 2 filters + 2 sorts wired to user-intent `ViewState`; header-click sort calls the same `onViewChange`. |
| 5 | Single-select header modal (option management) | Reorder / recolor / rename / delete-with-impact-confirm; row pills update without rewriting row data. |
| 6 | Stacked group accordion + per-column aggregations + tint cascade | Group by 2 levels, mean per group, 14-entry pre-mixed tint palette layered tint→selection→focus. |
| 7 | Fill handle + ⌘D / ⌘R | Drag the bottom-right square down 30 rows; cyclic repeat; disabled while grouped. |

## 5. PoC lessons that anchor every phase

| Tag | Rule | Where it shows up |
|---|---|---|
| L1.1 | `activeRow` is a stable `rowId`, never a visual index | Phase 0 promotes the existing `{rowIndex, columnIndex}` model |
| L2.2 | Row-select chrome lives outside the TanStack column model | Phase 2 row-gutter checkbox lane |
| L2.3 | Typed `FieldDef` registry owns render / edit / coerce / sort / filter / aggregate | Phases 1, 4, 6 |
| L2.4 | Per-type comparator with explicit null handling | Already in `lib.ts`; preserved through refactor |
| L3.2 | Outline channel for focus, box-shadow channel for selection | Phase 3 selection overlay |
| L3.3 | Explicit stacking lanes for virtualized editors | Phase 1 single-select popover |
| L4.1 | Native `copy` event (not keydown intercept) | Already in `DataTable.tsx`; preserve |
| L4.2 | Copy writes both TSV and HTML | Already shipping; preserve |
| L4.3 | One paste-rectangle planner, not per-feature branches | Already in `planPaste`; preserve |
| L5.2 | Tab a11y exit story | Phase 0 keyboard hook |
| L5.3 | Document-level pointer tracking for drag | Phase 3 + Phase 7 fill handle |
| L6.1 | One write primitive for every gesture | Phase 0 reducer |
| L6.2 | Undo entries are semantic gestures, not per-cell deltas | Phase 0 history |
| L6.5 | Field-def mutations live in the same op as dependent cell writes | Phase 1 single-select create-on-edit |
| L7.1 | Fill drag reuses the selection controller pattern | Phase 7 |
| L8.1 | View state is user-intent lists; TanStack shapes are derived | Phase 4 |
| L8.2 | One mutation channel per axis | Phase 4 |
| L8.3 | Group direction requires a pre-sort | Phase 6 |
| L8.4 | Dormant filter conditions pass everything | Phase 4 |
| L9.1 | Custom `aggregationFn` + `aggregatedCell` per field type | Phase 6 |
| L9.2 | Pre-mixed tint palette as design tokens | Phase 6 |
| L9.3 | Layer order: tint → selection → focus | Phase 6 |
| L10.2 | Native controls are good enough for popover MVPs | Phases 1, 4, 5 |

## 6. Phase 0 — Foundation refactor

### Goal

Rework `DataTable.tsx` (currently 523 LOC, mixed concerns) so later phases
plug into clean seams. Zero new user-visible features. Establish the
internal shape future consumers will inherit.

### What's built

- Promote selection state to **stable row-id / field-key** keys per L1.1.
  `{ anchorRowId, focusRowId, anchorFieldKey, focusFieldKey }`. Internal
  translation to visual indices only at render/keyboard boundaries.
- Extract hooks:
  - `useGridSelection` — owns range geometry, anchor/focus, keyboard
    extension. Phase 3 adds mouse drag; Phase 7 adds fill drag.
  - `useGridKeyboard` — owns arrow / Tab / Home / End / ⌘A / ⌘C / ⌘V /
    Enter / Esc / Shift+Enter dispatch.
  - `useGridEdit` — owns inline edit lifecycle (start / draft / commit /
    cancel) and the active-editor identity.
  - `useGridHistory` — in-memory 8-deep undo stack. Each entry is a
    semantic `WriteOp`; `revert()` is the inverse op. Cleared on
    `rows`-identity change (PoC L6.3 in-memory rule).
- Introduce a thin **write reducer** in the component: every gesture calls
  `dispatchWrite(op)`, which (1) pushes to history, (2) calls
  `onWrite(op)`. Parent still owns optimistic state — the reducer is just
  the choke point.
- Split file layout:
  ```
  frontend/src/shared/ui/data-table/
    DataTable.tsx           (shell + composition only)
    useGridSelection.ts
    useGridKeyboard.ts
    useGridEdit.ts
    useGridHistory.ts
    lib.ts                  (existing pure helpers)
    types.ts
    __tests__/
  ```

### Backend dependencies

None.

### Demo

Rooms (US-EQ-2) behaves byte-identically. All existing tests in
`DataTable.test.tsx` and `lib.test.ts` pass without modification (or with
mechanical updates for the row-id selection shape). New tests cover the
reducer (write → history → onWrite ordering) and the
history-clear-on-row-identity-change rule.

### Risks

- Selection state migration from `{rowIndex, columnIndex}` to row-id
  touches every test in `DataTable.test.tsx`. Plan a one-pass test
  rewrite to assert against the new shape before adding behaviors.

### Effort estimate

~6–10 evening hours.

## 7. Phase 1 — Inline edit (click-cell, type) + single-select cell popover

### Goal

Replace double-click-to-edit with AirTable click semantics. Single-select
cells get a real popover editor.

### Wishlist items

#1c (single-select) + the implicit "edit feels like AirTable" gate.

### What's built

- **Click semantics.**
  - Single click → focus cell.
  - Typing any printable character → enter edit mode, replace draft.
  - `Enter` from focus → enter edit mode at end-of-value.
  - `Esc` cancels edit; second `Esc` clears focus.
  - `Tab` / `Shift-Tab` → commit and move horizontally; wrap at row end
    until "next visible cell" reaches the table boundary, then bubble
    (L5.2 a11y exit).
  - `Enter` from edit → commit, stay on cell.
- **Field-type-aware editor selection** (L2.3):
  - `text` / `number` → borderless `<input>` overlay (existing
    `InlineCellEditor`, slightly generalized).
  - `single_select` → popover bound to the cell with explicit z-lane
    (L3.3). Search input on top, options as colored pills, ↑/↓ navigate,
    Enter picks. Footer: `Create "<x>"` when the typed string matches no
    existing option. Creating an option emits a single semantic op
    containing both the `fieldDefMutation` (new option appended) and the
    `cell` write that references it (L6.5).
  - `computed` / read-only → no editor, key-press is a no-op.
- **Attachment / multi-line** fields stay read-only in the grid for now,
  surfaced as "Click to expand" target. The side-panel that handles them
  for real lives outside this plan (catalog migration scope).

### Backend dependencies

None for Rooms (single-select options live in the project document body
per US-Builder-Tables §16).

### Demo on Rooms

1. Click a `name` cell, type "Library", Tab → cell commits, focus on
   `floor_level`.
2. Press any letter → `floor_level` popover opens, filter narrows.
3. Type a brand-new label → "Create 'Mezzanine'" footer → Enter →
   option appears with the next palette color, cell pill renders.
4. ⌘Z → cell reverts to previous option, AND `Mezzanine` is removed
   from the option list (one semantic op per L6.5).
5. Re-do with ⌘⇧Z → option re-created, cell re-assigned.

### Tests

- `useGridEdit.test.ts` — type-to-edit replaces draft; Enter commits;
  Esc cancels; Tab commits-and-moves; Tab past last cell bubbles.
- `single-select.popover.test.tsx` — keyboard nav, create-flow, ⌘Z
  reverts both halves of the op.

### Effort estimate

~10–14 evening hours.

### Deferred

- Multi-select (PRD §5.3 lists it; renderer designed extensibly per PoC
  Phase 4 §7.7 but feature is post-parity).
- Long-text / attachment inline editing.

## 8. Phase 2 — Row insert / delete with semantic undo

### Goal

Row-level write gestures alongside the cell-level ones.

### Wishlist items

Implicit (every Airtable-class grid does this).

### What's built

- **Shift+Enter from focus** → insert blank row below the active row.
  - New row's field values come from per-field `default` (extend
    `FieldDef` with a `default?: unknown` slot if not present).
  - Active cell moves to first editable column of the new row, enters
    edit mode.
  - Emits `WriteOp.kind = "rowInsert"` with the synthesized row.
  - The reducer adopts a `tmp-{ULID}` row id; parent's `onWrite` is
    responsible for swapping it once the backend assigns a real id.
- **Row-gutter checkbox chrome lane** (L2.2). Outside the TanStack
  column model.
  - Click selects single row, Shift+Click extends a contiguous block,
    ⌘-click toggles individual rows (allowed for row-select even though
    cell ⌘-click is deferred — different model).
  - "Delete (N)" button surfaces in a toolbar slot when any row is
    selected.
- **Delete confirmation dialog** (shadcn `AlertDialog`, simple
  Cancel/Delete). Per US-Builder-Tables criterion 10 — no name retyping.
  Emits `WriteOp.kind = "rowDelete"` with the array of deleted rows
  (including all field values, so revert is lossless).
- **Undo coverage**. ⌘Z after a rowInsert removes the row and any cell
  writes that happened against it. ⌘Z after a rowDelete restores the
  rows in their original positions. Both are single semantic entries
  (L6.2).

### Backend dependencies

For Rooms: existing draft-buffer JSON-Patch flow already handles
add/remove on `tables.rooms`. Verify no surprises.

### Demo on Rooms

1. Click into row 5, Shift+Enter → blank row 6 inserted, focus on
   `number`, edit mode active.
2. Type "102", Tab through fields, populate; ⌘Z once → entire row
   removed including all field values, in one undo.
3. Check 3 rows in the gutter, Delete → confirm → all 3 gone.
4. ⌘Z → all 3 restored at original positions.

### Tests

- `row-insert.test.ts` — Shift+Enter wires through reducer; tmp-id
  generated; default values populate.
- `row-delete.test.ts` — multi-row delete is one semantic op; revert
  preserves order.

### Effort estimate

~8–12 evening hours.

## 9. Phase 3 — Mouse-drag range selection + auto-scroll + full-column select

### Goal

Drag a rectangle, see one contiguous outline, ⌘C copies as a shaped
block. Close the gap to today's Shift+Arrow-only selection.

### Wishlist items

#1 (range select + copy), #2 (full-row / full-column select).

### What's built

- **Document-level pointer tracking** in `useGridSelection` (L5.3):
  - `mousedown` on a cell sets anchor=focus.
  - `mousemove` on `document` with primary button held resolves the
    current cell via `elementFromPoint()` against `data-row-id` /
    `data-field-key` attributes and updates focus.
  - `mouseup` ends the drag.
- **Auto-scroll** during drag via `requestAnimationFrame` loop when the
  cursor is within ~30 px of the viewport edge. Container scrollTop /
  scrollLeft increments by ~10 px/frame.
- **Full-column select** via a thin top affordance in the column header
  (separate visual zone from the sort/filter click targets).
  Shift+Click on another column extends to a contiguous block.
- **Selection outline** via box-shadow lanes (L3.2):
  - inset box-shadow on cells at the perimeter of the normalized
    rectangle draws a single contiguous border;
  - inner cells get a tinted background;
  - focus stays on `outline` so it remains visible inside a selection.
- **Editing-mode hand-off** — a `mousedown` on a cell that's currently
  in edit mode does not start a new range (PoC Phase 2 risk note).

### Backend dependencies

None.

### Demo

1. Drag from `(row 3, density)` to `(row 12, conductivity)` past the
   viewport edge; container auto-scrolls; outline stays contiguous.
2. ⌘C, paste into Excel — properly-shaped 10×N block.
3. Click `floor_level` column-header select strip → full column
   highlighted; ⌘C → single column in Excel including pill labels (not
   option ids).
4. Begin an inline edit on a single-select cell; click another cell
   → edit is committed (or canceled if invalid), focus moves; no
   spurious range starts.

### Tests

- `useGridSelection.drag.test.ts` — anchor/focus updates, range
  normalization, auto-scroll RAF mock.
- Add manual cross-browser test note (Chrome + Safari) — clipboard
  quirks rule (PoC §10).

### Effort estimate

~10–14 evening hours.

## 10. Phase 4 — Stacked filter + sort toolbar

### Goal

Replace today's single-rule header-click sort and inline text filter
with structured toolbar popovers, wired to user-intent lists per L8.1.

### Wishlist items

#1e (stacked filter / sort with toolbar-tinted state) — minus the tint
cascade, which lands in Phase 6.

### What's built

- **`ViewState` is the canonical source** (L8.1). The component already
  carries it; Phase 4 enforces that TanStack `sorting` / `columnFilters`
  are *derived via `useMemo`* and never written to directly.
- **Filter popover** (shadcn `Popover`):
  - Stacked rows: field picker + operator picker + value editor + drag
    handle + delete.
  - Operator set per `FieldType` (L2.3 registry):
    - `text`: contains / does not contain / is / is not / is empty / is
      not empty
    - `number`: = / != / > / < / between / is empty
    - `single_select`: is any of / is none of / is empty
    - `computed`: same as the underlying numeric/text type
  - AND only. OR explicitly deferred (PoC §12).
  - Dormant rows (value blank) pass everything (L8.4).
- **Sort popover**:
  - Stacked rows: field picker + asc/desc + drag handle + delete.
  - Header-click sort still works but routes through `onViewChange`
    (replaces current direct toggle), so the two channels stay
    consistent (L8.2).
  - Shift+Click on a header appends to the stack rather than replacing.
- **Drag-to-reorder** rows in either popover via `@dnd-kit/sortable`
  (acceptable add per L10.2).
- **Toolbar status text** stays factual until Phase 6 adds tints:
  *"Filtered by 2 fields · Sorted by 1 field"*.
- **Reset** action in toolbar overflow clears all rules (per
  US-Builder-Tables criterion 3).

### Backend dependencies

None (view state is in-memory session-only per US-Builder-Tables
criterion 3).

### Demo on Rooms

1. Open Filter → add `floor_level is any of [Ground, 1st]` → table
   filters.
2. Add second filter `num_people > 2` → AND'd, 2-rule status text.
3. Drag the second filter above the first — order persists, table
   still filters identically.
4. Open Sort → add `number asc`, then Shift+Click `name` header → sort
   becomes `[number asc, name asc]`.
5. Reset → both popovers empty; table back to default sort.

### Tests

- `view-state.derive.test.ts` — user-intent → TanStack shapes.
- Per-operator unit tests for each field type.
- Dormant condition (`{operator: "contains", value: ""}`) passes
  everything.

### Effort estimate

~12–18 evening hours.

### Deferred

- OR mode / nested AND-OR — PoC §12.
- Per-user persisted view state — US-Builder-Tables NEW-TBL-1.

## 11. Phase 5 — Single-select header modal (option management)

### Goal

User-driven management of project-defined single-select option lists:
reorder, recolor, rename, delete with row-impact handling. Per
US-Builder-Tables criterion 17.

### What's built

- **Trigger.** Column header `⋯` menu → "Edit options…" (only present
  when `field_type === "single_select"`).
- **Modal** (shadcn `Dialog`):
  - Vertical list of options; each row: drag handle, color swatch
    (palette popover on click), label `<input>`, delete ×.
  - Add option at bottom (same UX as the cell-popover create flow).
  - Save / Cancel; Save commits one semantic
    `WriteOp.kind = "fieldDefMutation"`.
- **Reorder** writes `order` integers; sort follows option order
  (already in `lib.ts`).
- **Recolor** picks from the existing 14-entry palette (Phase 6 tokens;
  for Phase 5 the current palette in `lib.ts` suffices).
- **Rename** is non-destructive — rows store `option_id`, cell render
  pulls the current label.
- **Delete with row-impact confirm.** When the option is referenced by
  ≥1 row:
  - sub-dialog: *"3 rows reference 'Basement'. Choose what to do:"*
  - **(a)** Clear those cells (set `null`), then delete.
  - **(b)** Replace with a different option (dropdown).
  - **(c)** Cancel.
  - Each choice routes through one semantic op (option removal + cell
    writes).
- **Duplicate-label guard** — Save is blocked if any two options share
  a trim+lowercase label (US-Builder-Tables §16).

### Backend dependencies

Rooms: project-document JSON-Patch on
`body.single_select_options["<table>.<column>"]`. Already in the draft
buffer scope.

### Demo on Rooms

1. Floor-level column → `⋯` → Edit options.
2. Drag "Ground" above "Basement"; Save; table re-sorts.
3. Recolor "Roof" to purple; pills update.
4. Rename "1st" → "First Floor"; row pills update; no row data
   rewritten (verify via JSON download).
5. Delete "Roof" with 2 rows referencing → prompt → choose Clear → 2
   rows null; ⌘Z restores option + cell values together.

### Tests

- Option mutation semantics: rename / reorder / recolor produce one
  op; delete-with-rows produces the bundled op.
- Duplicate-label guard.

### Effort estimate

~10–14 evening hours.

## 12. Phase 6 — Stacked group accordion + per-column aggregations + tint cascade

### Goal

Visual phase. Group rows into accordion sections, compute per-column
aggregations per group, tint columns by role (filter / sort / group).

### What's built

- **Group popover** (shadcn `Popover`):
  - Stacked rows: field + asc/desc + drag handle + delete.
  - Up to 3 levels; warn on a 4th.
  - Updates `view.group`; derived `grouping` + `effectiveSorting` per
    L8.3.
- **Per-column aggregation picker** in column header `⋯` menu:
  - `none / count / sum / mean / min / max`.
  - Each `FieldDef` exposes `formatAggregation(kind, values)` (L9.1).
- **Group accordion**:
  - Indent group headers by `8 * depth` px.
  - Chevron, group key (pill if single_select), `(N)` count,
    aggregated values at the right.
  - Collapse all / Expand all in toolbar overflow.
- **14-entry pre-mixed tint palette** as design tokens (L9.2):
  - `tokens/data-table-tints.ts` exports `ROLE_BACKGROUNDS.body` and
    `ROLE_BACKGROUNDS.header` keyed by the 7 non-empty subsets of
    `{filter, sort, group}`.
- **Layer order** body cells: tint (base) → selection (over) → focus
  (outline lane) (L9.3).
- **Paste-while-grouped** stays disabled (already wired); banner
  *"Ungroup to paste"*.

### Backend dependencies

None.

### Demo

1. Group Rooms by `floor_level`, then `building_zone`; accordion
   appears with two indent levels.
2. Set aggregation `mean` on `icfa_factor`; group headers show mean
   per group.
3. Add filter on `num_people > 1` → toolbar Filter button tints
   green; filtered columns tint green; `floor_level` and
   `building_zone` headers show stacked tint (group purple + filter
   green) per the pre-mixed palette.
4. Sort by `number asc` → toolbar Sort button tints peach; that
   column carries triple-stacked tint without becoming muddy.

### Effort estimate

~14–20 evening hours.

### Deferred

- Dark-mode tint palette.
- OR mode in filters.

## 13. Phase 7 — Fill handle + ⌘D / ⌘R

### Goal

Excel-style fill across a range.

### What's built

- **Square handle** at bottom-right of the active range, visible only
  when the range is non-degenerate and not editing.
- **Drag** reuses `useGridSelection` with a `fill` mode (L7.1). Same
  document-level pointer tracking, auto-scroll, and DOM target
  resolution as Phase 3.
- **Cyclic repeat only** — no pattern detection (deferred per PoC).
- **`⌘D` fill down**, **`⌘R` fill right** keyboard equivalents — same
  write path.
- Disabled while grouped (banner "Ungroup to fill").

### Backend dependencies

None (uses the same `WriteOp.kind = "fill"` path that paste already
exercises in the reducer).

### Demo

1. Select 3 cells `[ERV-A, ERV-B, ERV-C]` in `name`, drag handle down
   30 rows → cyclic fill.
2. ⌘D from a range → values fill from top row down.

### Effort estimate

~6–10 evening hours.

## 14. Out of scope for this plan

These are deliberately deferred to a separate body of work:

- **Catalog page migration** (Materials / Frame-Types / Glazing-Types
  onto `<DataTable>`, retiring the form modals, promoting Materials
  `category` to `single_select`). Will be planned and executed after
  the primitive is hardened by Phases 0–7. Tracking lives outside this
  file when that plan is written.
- **Side-panel for long-text / attachments / version metadata.** Will be
  added as a generic `<DataTable>` slot when a consumer needs it
  (most likely as part of the catalog migration). Not Rooms-driven.
- **Other consumer wiring** (Thermal Bridges, ERVs, Pumps, Fans) — these
  adopt the hardened primitive once the catalog migration validates the
  shared API.

## 15. Cross-cutting dependencies

Tracked here so they don't surface mid-phase:

1. **`FieldDef.default` slot**: extend `types.ts` if not present
   (Phase 2).
2. **`@dnd-kit/sortable` dependency**: added in Phase 4.
3. **shadcn `Popover` + `Dialog` + `AlertDialog`**: confirm primitives
   are wired into the design system before Phase 1.

## 16. Explicit deferrals

Carried forward from PoC §12 + this plan:

- OR-mode filters / nested AND-OR groups.
- Non-contiguous ⌘-click cell selection (multi-row gutter select is
  allowed per Phase 2).
- Fill-handle pattern detection.
- Mobile / phone optimization.
- Linked-record / relation field types.
- Comment threads, @mentions, presence cursors.
- Runtime user-driven schema editor (PoC Phase 6).
- Named / shareable views (NEW-TBL-1).
- Dark-mode tint palette.
- Multi-select field type (post-parity).
- Long-text inline editor inside the grid — deferred to the side-panel
  work (catalog-migration scope).
- Catalog page migration — see §14.

## 17. Honest time read

| Phase | Low | High |
|-------|----:|----:|
| 0 | 6 | 10 |
| 1 | 10 | 14 |
| 2 | 8 | 12 |
| 3 | 10 | 14 |
| 4 | 12 | 18 |
| 5 | 10 | 14 |
| **0–5 subtotal (parity gate)** | **56** | **82** |
| 6 | 14 | 20 |
| 7 | 6 | 10 |
| **0–7 total** | **76** | **112** |

At ~10 evening hours / week, Phases 0–5 is **6–8 weeks**; the full plan
including Phases 6–7 is **8–11 weeks**.

Phase 5 is the natural parity gate against Rooms — after it lands, all
core AirTable behaviors run against the primitive. Phases 6–7 are
visual / ergonomic polish that can slip without blocking the catalog
migration that follows.

## 18. Status tracking

| Phase | Started | Demo passed | Notes |
|-------|---------|-------------|-------|
| 0 | 2026-05-23 | ✅ 2026-05-23 | All 6 steps landed; 100 tests passing; `DataTable.tsx` 231 LOC. Three post-walk fixes folded in (native onPaste, wrapper focus, sort chevron). Frozen-column sticky positioning removed pending Phase 3 re-engineering. Sign-off detail in `phase-0-foundation-refactor.md` §11–§12. |
| 1 | 2026-05-23 | ✅ 2026-05-23 | Merged via PR #1 (`phase-1-inline-edit-popover`); Steps 1–6 landed. |
| 2 | 2026-05-23 | ✅ 2026-05-23 | All 6 steps landed; 155 tests passing. Two Phase-0-inherited fixes folded in (sessionKey-based history-clear; empty-state keeps the grid mounted). `generateRowId` prop added so consumers can satisfy backend id schemas (Q6 revisited because the demo hit it). nextFreeRoomNumber now returns the input verbatim when free, so delete-undo restores original numbers. |
| 3 | — | — | — |
| 4 | — | — | — |
| 5 | — | — | — |
| 6 | — | — | — |
| 7 | — | — | — |
