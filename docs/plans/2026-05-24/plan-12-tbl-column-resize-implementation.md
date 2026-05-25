---
DATE: 2026-05-24
TIME: planning (detailed implementation phasing)
STATUS: Draft. Implementation plan for plan-11's guidelines. Six
        phases; each phase is a self-contained PR that leaves
        `make test`, `make typecheck`, and `make lint` green.
PARENT-PLAN: docs/plans/2026-05-24/plan-11-tbl-column-resize-overflow.md
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
              (US-TBL-COLWIDTH-1 — to be appended in Phase 0)
RELATED:
  - frontend/src/shared/ui/data-table/                (primitive)
  - frontend/src/features/equipment/components/RoomsTable.tsx
                                                      (only consumer)
  - frontend/src/features/table_views/useProjectTableViewState.ts
                                                      (persistence —
                                                       round-trips
                                                       `columnWidths`
                                                       already)
  - frontend/src/App.css                              (sticky lanes,
                                                       table layout)
BACKWARDS-COMPAT: none required (pre-deployment)
---

# Plan 12 — Implementation phasing for column resize, persistence, overflow

Six phases, in order. Each is a single PR. The phases are sequenced so
that a halt at any boundary leaves a working app: the primitive may be
mid-feature, but Rooms still renders, persistence still round-trips,
and tests still pass.

| Phase | Title | Visible change | Risk |
|-------|-------|----------------|------|
| 0 | Story + token + scaffold | None | Trivial |
| 1 | Column-def rename + render from `view.columnWidths` | None (widths still default) | Low — touches every consumer (Rooms only) |
| 2 | Layout-model swap (overflow + sticky frozen primary) | Tables stop auto-filling; horizontal scroll appears when needed | Medium — visual regression risk |
| 3 | Resize gesture (drag + Esc cancel) | Headers gain a grab edge; widths persist | Medium — new pointer hook |
| 4 | Fit-to-content double-click | Double-click handle auto-sizes | Low |
| 5 | Tail "+" cell (disabled) + Rooms polish + docs | "+" cell visible on every table | Low |

## Phase 0 — Story, token, file scaffold

**Goal.** Land everything that has zero behavioral risk so the
subsequent PRs only touch behavior.

### Tasks

1. **Promote the user story.** Append US-TBL-COLWIDTH-1 to
   `context/user-stories/31-data-table-enhancements.md`, body and
   acceptance criteria mirroring plan-11 §3 / §9. Add a row to the
   story table at the top of that file.
2. **Add the token.** In the existing token sheet (search for
   `--bg-card`, `--border-subtle` to find the file — likely
   `frontend/src/App.css` near `:root`), add:
   ```css
   --bg-table-outside: color-mix(in oklab, var(--accent) 4%, var(--bg-page));
   ```
   Do not consume it yet.
3. **Add a `--gutter-width` token** in the same place, set to `42px`.
   Phase 2 uses it for the sticky-left primary column; pre-extracting
   removes magic numbers.
4. **Create empty scaffold files** (with a one-line export each, so
   typecheck stays happy):
   - `frontend/src/shared/ui/data-table/hooks/useGridColumnResize.ts`
   - `frontend/src/shared/ui/data-table/components/ColumnResizeHandle.tsx`
   - `frontend/src/shared/ui/data-table/lib/columnWidths.ts`
     (or extend `lib.ts` if that file isn't already huge — it is 1189
     lines, so prefer a new file)
   - `frontend/src/shared/ui/data-table/components/AddFieldTailCell.tsx`
5. **Add an entry to `index.ts`** for the new lib helpers.

### Acceptance

- `make typecheck`, `make test`, `make lint` all green.
- Diff is doc + token + empty files. No behavior change.

---

## Phase 1 — Column-def rename + render widths from `view.columnWidths`

**Goal.** The `<colgroup>` is the single source of truth for column
geometry, and it reads from a deterministic resolver. Nothing else
changes — widths still equal their defaults because nothing writes to
`view.columnWidths` yet.

### Code changes

1. **`types.ts`** — replace `width?: number` on
   `DataTableColumnDef<TRow>` with:
   ```ts
   defaultWidth?: number;
   minWidth?: number;
   maxWidth?: number;
   resizable?: boolean;   // default true
   ```
   No alias for `width`. Pre-deploy, no migration needed.

2. **`lib/columnWidths.ts`** — new module:
   - `FIELD_TYPE_DEFAULT_WIDTH: Record<FieldType, number>` (text 200,
     number 120, single_select 160, computed 140, attachment 120,
     argb_color 100).
   - `GLOBAL_MIN_WIDTH = 60`, `GLOBAL_MAX_WIDTH = 800`.
   - `resolveColumnWidth(columnDef, fieldDef, view): number` —
     returns `clamp(view.columnWidths[id] ?? columnDef.defaultWidth ??
     FIELD_TYPE_DEFAULT_WIDTH[fieldDef.field_type] ?? text-default,
     min, max)` where min/max are the column overrides falling back
     to the globals.
   - `resolveColumnMin(columnDef)`, `resolveColumnMax(columnDef)` —
     same precedence; exported separately because the resize hook
     needs to clamp during drag without recomputing the seed.
   - `sumColumnWidths(visibleColumns, fieldDefByKey, view, gutterPx):
     number` — used in Phase 2 only, but defined here for proximity.

3. **`DataTable.tsx`** — replace the `<colgroup>` block. Today:
   ```tsx
   {visibleColumnDefs.map((column) => (
     <col key={column.id}
          style={column.width ? { width: `${column.width}px` } : undefined} />
   ))}
   ```
   becomes:
   ```tsx
   {visibleColumnDefs.map((column) => {
     const fieldDef = fieldDefByKey.get(column.fieldKey);
     const width = resolveColumnWidth(column, fieldDef, view);
     return <col key={column.id} style={{ width: `${width}px` }} />;
   })}
   ```
   Always emits a width. `<col>` for the gutter stays as-is (CSS owns
   its 42 px).

4. **`RoomsTable.tsx`** — rename `width: 120` → `defaultWidth: 120`
   on the `number` column. No other consumer changes needed.

5. **Sanitizer (`lib.ts`)** — already drops widths for unknown column
   ids. Verify the existing test (`sanitizeViewState.test.ts:100`)
   still passes; add a test covering the resolver's precedence
   chain in `__tests__/columnWidths.test.ts`.

### Tests

- `__tests__/columnWidths.test.ts` — new. Covers: explicit
  `view.columnWidths` wins; falls through `defaultWidth`; falls
  through field-type default; clamps to per-column min/max; clamps
  to globals; absent fieldDef falls back to text default.
- Existing `DataTable.test.tsx` — should still pass unchanged. Add
  one assertion that the rendered `<col>` for every visible column
  has an inline `width: <px>` style.

### Acceptance

- Visual: identical to today on the Rooms table.
- `view.columnWidths = { number: 240 }` (set via a test) renders the
  number column at 240 px, all other columns at their defaults.
- Persistence: a saved view-state row that already has a
  `columnWidths` map on disk now takes visible effect on load.
  (Nothing today writes one, so this is forward-compat only.)

---

## Phase 2 — Layout-model swap

**Goal.** Tables stop auto-filling. The wrapper becomes a true window:
horizontal scroll on overflow, grey area on underflow, sticky lanes
work in both axes.

### Code changes — all in `frontend/src/App.css`

1. **`.data-table`** —
   ```css
   width: max-content;
   table-layout: fixed;
   /* remove: width: 100%; min-width: 760px; */
   ```

2. **`.data-table-wrap`** —
   ```css
   overflow: auto;            /* both axes */
   max-height: 100%;          /* respect parent's height */
   background: var(--bg-table-outside);
   /* keep: focus-visible rules, :has() overrides */
   ```

3. **`.data-table-footer-row`** — remove `min-width: 760px`. Width
   becomes `max-content` to match the table.

4. **Sticky-left for the frozen primary column.** Add a new rule:
   ```css
   .data-table th.data-table-frozen,
   .data-table td.data-table-frozen {
     position: sticky;
     left: var(--gutter-width);
     z-index: 2;
     background: var(--bg-card);
   }
   .data-table th.data-table-frozen { z-index: 4; }  /* over body */
   ```
   The existing `.data-table-frozen` class (currently only
   `border-right: ...`) is the join point. The frozen header z-index
   must exceed the regular header z-index (3) so it covers a non-
   frozen cell when both scroll behind it. The summary bar's frozen
   cell already has its own rule at line 3419 — verify it lifts
   above the body too.

5. **Gutter** — confirm `.data-table-gutter` (line 1885) is still
   `left: 0` with a z-index higher than the frozen primary's. Bump
   it to `z-index: 5` if needed so the gutter covers the primary at
   the scroll origin.

6. **Toolbar** — already sticky vertically because it sits outside
   `.data-table-wrap`. Confirm by reading the parent shell — no
   change expected. Note for review: if `EquipmentTab` puts the
   toolbar *inside* a flex column with the wrap as `flex: 1`, the
   toolbar stays visible automatically.

### Tests

- Existing `DataTable.test.tsx` and `GridBody.test.tsx` should still
  pass.
- Add a Playwright MCP manual verification step: open Rooms, confirm
  (a) no horizontal scrollbar with default widths (b) shrink the
  viewport until columns overflow → horizontal scrollbar appears
  inside the wrapper, toolbar stays put, header stays put, primary
  column stays pinned left of the gutter (c) hide most columns →
  grey area appears to the right of the last visible column.

### Risks / mitigations

- **Risk:** parent containers (`EquipmentTab`, `RoomsPage`) may rely
  on the table filling their width. Mitigation: read those files
  during the PR; if they use `min-width` on a parent that previously
  inherited from the table, adjust. Likely scope: 1–2 CSS lines.
- **Risk:** `table-layout: fixed` truncates content that was
  previously auto-fitting. This is desired (matches AirTable) but
  may surface columns that need a higher `defaultWidth`. Mitigation:
  walk through Rooms once and bump any defaults that look cramped.

### Acceptance

- Tables no longer stretch to fill the wrap.
- Horizontal and vertical scroll work inside the wrap.
- Toolbar, header, gutter, frozen primary column, and summary bar
  all stay put while the body scrolls.
- Grey background (`--bg-table-outside`) visible on the right when
  columns underflow.

---

## Phase 3 — Resize gesture

**Goal.** Drag the right edge of any header to change column width.
Esc cancels mid-drag. Widths persist via the existing
`useProjectTableViewState` adapter — one PUT per drag.

### Code changes

1. **`hooks/useGridColumnResize.ts`** — new pointer hook.
   - Inputs: `view`, `onViewChange`, `visibleColumnDefs`,
     `fieldDefByKey`, `wrapperRef` (for setting `cursor` on the body
     during drag).
   - State: `{ activeColumnId: string | null; startWidth: number;
     startClientX: number; previewWidth: number }`.
   - Public API: `onHandlePointerDown(columnId, event)`, used by
     `<ColumnResizeHandle>` below.
   - Pointer lifecycle:
     - `pointerdown` captures the pointer on the handle element and
       seeds the state from `resolveColumnWidth(...)`.
     - `pointermove` computes `nextWidth = clamp(startWidth +
       (clientX - startClientX), min, max)`, and on each animation
       frame emits `onViewChange({ ...view, columnWidths: {
       ...view.columnWidths, [columnId]: nextWidth } })`.
       Throttling lives inside the hook (a `requestAnimationFrame`
       latch); the consumer's 500 ms debounce in
       `useProjectTableViewState` collapses the burst into one PUT.
     - `pointerup` releases the capture, ends the gesture.
     - `keydown` Escape during an active drag rolls
       `view.columnWidths[columnId]` back to `startWidth` and ends
       the gesture.
   - The hook does **not** care about pen vs touch vs mouse — Pointer
     Events handle that. Verify on a trackpad and a touch device
     (Playwright MCP can simulate touch via `browser_evaluate`).

2. **`components/ColumnResizeHandle.tsx`** — new component.
   - Renders an absolutely-positioned 4 px wide bar inside the `<th>`
     (parent must be `position: relative`, which the existing `<th>`
     style already provides via `.data-table td { position: relative }`
     — check `<th>` too; add `position: relative` to `.data-table th`
     if absent).
   - Right-aligned: `right: -2px; top: 0; bottom: 0; width: 4px;
     cursor: col-resize`. Sits half outside the cell so the grab zone
     spans the cell border, AirTable-style.
   - On hover: shows a thin highlight (`background: var(--accent)`
     at low alpha). On active drag: shows a vertical guide line that
     extends the full height of the wrapper (`position: fixed`,
     follows pointer X; rendered through a portal anchored to
     `wrapperRef.current`).
   - Skipped when `columnDef.resizable === false`.

3. **`components/GridHeader.tsx`** — slot the handle inside every
   `<th>` after the existing content:
   ```tsx
   {column.resizable !== false ? (
     <ColumnResizeHandle
       columnId={column.id}
       onPointerDown={(e) => columnResize.onHandlePointerDown(column.id, e)}
       onDoubleClick={(e) => columnResize.onHandleDoubleClick(column.id, e)}  /* Phase 4 */
     />
   ) : null}
   ```
   For Phase 3, the `onDoubleClick` prop is wired but `columnResize.
   onHandleDoubleClick` is a no-op until Phase 4.

4. **`DataTable.tsx`** — instantiate the hook, pass into header:
   ```tsx
   const columnResize = useGridColumnResize({
     view, onViewChange, visibleColumnDefs, fieldDefByKey, wrapperRef,
   });
   ```

5. **CSS** — add minimal rules for the handle and the body-cursor
   override during drag (`.data-table-wrap[data-column-resizing]
   { cursor: col-resize; user-select: none; }`). The hook toggles
   that attribute on/off.

### Tests

- `__tests__/useGridColumnResize.test.ts` — new. Simulate
  pointerdown/move/up via `@testing-library/user-event` (or direct
  event dispatch); assert intermediate `onViewChange` widths follow
  the pointer; assert Esc cancels and restores; assert clamp at min
  and max; assert `resizable: false` columns are not affected.
- `__tests__/ColumnResizeHandle.test.tsx` — new. Renders the handle
  inside a `<th>`; hover shows highlight; missing `resizable` (i.e.
  undefined) treats as `true`.
- `__tests__/DataTable.test.tsx` — extend with one end-to-end test
  that drags a handle and asserts the body and header cells both
  reflow to the new width (proves `<colgroup>` propagation).

### Playwright MCP verification

- Open Rooms. Grab the `Name` column edge, drag right by 100 px,
  release. Confirm width persists after reload. Confirm sort,
  filter, group, hide, reorder leave widths unchanged.

### Acceptance

- Mouse / touch / pen drag resizes columns.
- Esc mid-drag cancels.
- After release, exactly one PUT to `/api/projects/{id}/table-views/
  {table_key}` is made (verify with `browser_network_requests`).
- All Phase 0–2 acceptance still holds.

---

## Phase 4 — Fit-to-content double-click

**Goal.** Double-click the resize handle to auto-size the column to
its widest visible content.

### Code changes

1. **`lib/columnWidths.ts`** — add `measureColumnFitWidth(args):
   number`. Strategy:
   - Build a list of strings: the header label plus every visible
     cell's display string (the same string the renderer outputs).
     For `render(row)` columns this is harder because the output is
     a `ReactNode`; for v1, measure the accessor's string form
     (`String(accessor(row))`) — good enough for text, number, and
     single-select. The few render-override columns (Rooms `iCFA`,
     `ERVs`, single-select pills) can opt in later by exposing a
     `measureText?: (row) => string` callback on the column def.
     **Pragmatic v1:** add the optional `measureText` slot now; fall
     back to `String(accessor(row))` when absent.
   - Measure each string via a memoised `CanvasRenderingContext2D`
     (read computed font from a representative cell on first call).
     This is O(rows × cols) but only on demand (double-click only)
     and only over the post-filter, post-group visible row set.
   - Return `clamp(maxStringWidth + padding, min, max)`, where
     `padding` matches the cell's left+right padding (10 px each per
     `.data-table td`) plus 8 px slack so text never appears clipped
     immediately after fit.

2. **`useGridColumnResize.ts`** — add
   `onHandleDoubleClick(columnId, event)`:
   - Compute `nextWidth = measureColumnFitWidth(...)`.
   - Emit one `onViewChange` with `{ ...view, columnWidths: {
     ...view.columnWidths, [columnId]: nextWidth } }`.

3. **`DataTableColumnDef<TRow>`** — add `measureText?: (row: TRow)
   => string`. Optional. Defaults to `String(accessor(row))`.

### Tests

- `__tests__/columnWidths.test.ts` — extend. Mock canvas measurement
  by stubbing `CanvasRenderingContext2D.measureText`. Assert fit
  width respects padding, header label, min/max clamp, and uses
  `measureText` when provided.
- `__tests__/useGridColumnResize.test.ts` — extend with a
  double-click test that asserts `onViewChange` fires once with the
  computed width.

### Acceptance

- Double-click handle on the `Name` column with one long room name
  resizes the column to fit that name.
- Double-click on an empty column resizes to the header label's
  width, never below `minWidth`.

---

## Phase 5 — Tail "+" cell, Rooms polish, docs

**Goal.** Visible "+" affordance ready for the future "add field"
feature, plus any Rooms-specific cleanup that surfaced in earlier
phases.

### Code changes

1. **`components/AddFieldTailCell.tsx`** — small component:
   - `<th>` variant for the header (renders a `+` glyph centered in
     a 42 px wide cell, `aria-disabled="true"`, `aria-label="Add
     field — coming soon"`, no click handler).
   - `<td>` variant for body and summary rows (empty 42 px cell, no
     border-right, matches the grey underflow background so it
     visually blends into the outside area).
   - Hover state on the header variant only: a faint tint so the
     button reads as "press me" without being functional yet.

2. **`DataTable.tsx` colgroup** — append a final `<col
   className="data-table-tail-col" />` after the data columns. CSS
   sets `.data-table-tail-col { width: 42px }`.

3. **`GridHeader.tsx`** — render `<AddFieldTailCell variant="th" />`
   after the last data `<th>`.

4. **`GridBody.tsx`** — render `<AddFieldTailCell variant="td" />`
   as the last cell on every data and group-header row.

5. **`SummaryBar.tsx`** — render a matching tail cell so summary-bar
   geometry stays aligned with the header.

6. **Rooms `defaultWidth` audit.** Walk each Rooms column with the
   new layout model in place; bump `defaultWidth` where the column
   feels cramped (likely candidates: `name` → 240, `erv_unit_ids`
   → 200). Confirm with Playwright MCP.

7. **Docs.** Append a "Column widths" subsection to
   `context/technical-requirements/data-table.md` documenting the
   resolver, the persistence path, the resize gesture, and the tail
   "+" placeholder. Update `context/UI_UX.md` §1.7 with one
   sentence: "Every column has a user-resizable, persisted width
   (defaults per field type, drag the right edge of any header)."

8. **Story status.** Flip US-TBL-COLWIDTH-1 in
   `context/user-stories/31-data-table-enhancements.md` to
   **Implemented**.

### Tests

- `__tests__/AddFieldTailCell.test.tsx` — new. Renders both
  variants. Confirms `aria-disabled` and that no click handler is
  attached.
- Existing test suites — extend any assertion that counted columns
  to account for the tail cell.

### Acceptance

- Every table renders a `+` cell at the right edge of the header,
  with matching empty cells on every row.
- The button has no behavior (clicks do nothing) but is keyboard-
  focusable as `aria-disabled` so future enablement is one prop.
- Rooms feels polished — no cramped default widths after the layout
  swap.
- Docs reflect the new behavior.

---

## Cross-phase rules

- **Branching.** One branch per phase, merged via PR before starting
  the next phase. Phase 0 may share a PR with Phase 1 if the
  reviewer prefers; later phases stay separate.
- **`make smoke`** before opening each PR.
- **No commit skips hooks.** Pre-commit hooks include `prettier`,
  `eslint`, and `pyright`; let them run.
- **No new feature flags.** Per CLAUDE.md, flags belong in
  `Settings` only when there's a real fallback path. Resize is
  unconditional.
- **MCP / API surface.** No new endpoints. Plan 09's `PUT /api/
  projects/{id}/table-views/{table_key}` already accepts the full
  `ViewState`; adding `columnWidths` to that JSONB blob is invisible
  to the backend.

## Out of scope (still)

Same exclusions as plan-11 §7: row height resize, per-cell wrap,
named/shareable views, catalog-manager view-state persistence, "auto-
distribute remaining width" toolbar action, and the actual "add
field" behavior behind the tail "+" cell.
