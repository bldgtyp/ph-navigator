---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. Seventh in the 9-plan AirTable-parity polish series.
        Sequenced 7/9.
SCOPE: Add a "Hide fields" toolbar button + popover panel that lets
       the user toggle column visibility and reorder columns from
       one place. The panel includes a search input, per-field
       toggles, drag handles for reorder, and Hide all / Show all
       bulk actions. Adds `columnVisibility` + `columnOrder` to
       `ViewState`. Library-only.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-FIELDS-1)
RELATED:
  - frontend/src/shared/ui/data-table/components/GridToolbar.tsx
    (the toolbar — adds a fourth button)
  - frontend/src/shared/ui/data-table/components/GridHeader.tsx,
    GridBody.tsx, GridGutter.tsx
    (column-rendering surfaces — all consult the same visible-
    columns list this plan establishes)
  - frontend/src/shared/ui/data-table/types.ts
    (`ViewState` extends with `columnVisibility`, `columnOrder`)
  - docs/plans/2026-05-24/plan-01-tbl-icons-airtable-icons.md
    (the toolbar icon set this plan adds `EyeOff` to)
  - docs/plans/2026-05-24/plan-08-tbl-column-reorder.md
    (header drag uses the same `columnOrder` field this plan
    establishes)
---

# Plan 07 — Hide / Show fields panel

## 1. Why this plan exists

PH-Navigator's data tables have a lot of columns (Rooms has 8 by
default; ERVs has 7; future Thermal Bridges will have ~10). Users
working on a specific task only want a subset visible — e.g.,
"during this design call, show only number / name / floor_level /
iCFA factor." Today there's no way to hide a column. Users either
scroll horizontally past columns they don't care about or build
their mental model around the full set.

AirTable's "Hide fields" panel (image #3 from Ed's 2026-05-24
review) is the answer. One toolbar button opens a panel listing
every column with a visibility toggle, a drag handle for reorder,
a search input to find a field by name, and bulk Hide all / Show
all buttons.

This plan also establishes the `columnVisibility` and `columnOrder`
fields on `ViewState`. Plan 08 (drag-to-reorder column headers) and
plan 09 (persistence) build on the same data.

## 2. Binding constraints

1. **Library-only.** Changes in `GridToolbar.tsx`, a new
   `HideFieldsPanel.tsx`, `types.ts`, `DataTable.tsx`,
   `GridHeader.tsx` / `GridBody.tsx` / `GridGutter.tsx` (to consult
   the visible-columns list), and CSS. Zero consumer touches.
2. **`ViewState` extends** with two new fields:
   ```ts
   columnVisibility: Record<string, boolean>; // default true
   columnOrder: string[];                     // field_key list; missing keys append in declaration order
   ```
   Both default to "no override" (every column visible, order =
   declaration order).
3. **First column is non-hideable.** The primary/frozen column
   (US-Builder-Tables criterion 4) cannot be hidden. Its toggle
   in the panel is disabled with a tooltip explaining why.
4. **Visibility + order are session state.** Cross-session
   persistence is plan 09. This plan keeps them in the existing
   in-memory `ViewState` Zustand store keyed by `(project_id,
   table_key)`.
5. **Drag-reorder primitive choice: `@dnd-kit/sortable`** (already
   installed for Phase 4 stacked rules). Reuse — no new deps.
6. **Live toggle.** Flipping a toggle hides/shows the column
   immediately (no "Apply" button). Drag-reorder commits on drop.
7. **Read-only mode (viewer / locked-version) — panel still
   available.** It changes the local user's view, not project
   data. Documented and tested.
8. **Plan 06 summary bar + plan 08 column drag** all read from
   the same visible-columns list — no special-case code.

## 3. Acceptance criteria

1. **Toolbar button.** "Hide fields" renders in the toolbar next
   to Filter / Sort / Group, using the `EyeOff` Lucide icon from
   plan 01. Label is "Hide fields" idle; "Hide fields (3)" when 3
   are hidden (count idiom matches existing Sort / Filter / Group
   active-state).
2. **Click opens the panel.** Panel anchors below the button as a
   popover. Width ~280 px.
3. **Panel content matches AirTable layout** (image #3):
   - Search input at top: placeholder "Find a field".
   - Vertical list of all columns in current display order.
   - Each row: drag handle (left), field-type icon, field name,
     visibility toggle (right).
   - "Hide all" + "Show all" buttons at bottom.
4. **Live toggle.** Click toggle on `floor_level` → column
   disappears from the table immediately. Click again → reappears.
5. **First column toggle disabled.** Primary column's toggle is
   disabled with tooltip "This column cannot be hidden."
6. **Drag-reorder.** Drag a list row to a new position → column
   reorders in the table immediately. Reflected in panel order
   too.
7. **Search filters the list.** Type "iCFA" → only matching
   columns show. Clear search → all columns return.
8. **Hide all / Show all.** "Hide all" hides every column except
   the primary. "Show all" shows every column.
9. **Active count in toolbar label updates** as toggles flip.
10. **State persists within session** — switch sub-tabs and
    return, panel state and visible columns preserved (already
    handled by Zustand store).
11. **Read-only mode — panel works.** Open panel in viewer mode →
    can toggle and reorder; only the local view changes.
12. **Empty search state.** "No fields match 'xyz'" when search
    yields nothing.
13. **Esc closes panel.** Focus traps inside panel while open.
14. **No regressions** to existing column rendering, sort /
    filter / group, fill, plan 06 summary bar.

## 4. Target architecture

### 4.1 File changes

```
frontend/src/shared/ui/data-table/
  components/
    GridToolbar.tsx          extended: add the "Hide fields"
                             button + popover trigger. Accepts new
                             props `columnVisibility`,
                             `columnOrder`, `onColumnVisibilityChange`,
                             `onColumnOrderChange`, and the full
                             `columns` list.
    HideFieldsPanel.tsx      NEW (~150 LOC) — the popover content.
                             Search input + sortable list +
                             Hide/Show all buttons. Uses
                             `@dnd-kit/sortable` for drag handles.
    GridHeader.tsx           extended: render only columns in the
                             visible set, in the ordered list.
    GridBody.tsx             extended: same — render visible
                             columns only, in order.
    GridGutter.tsx           UNCHANGED (gutter is column-agnostic).
  hooks/
    useGridColumns.ts        NEW (small) — pure helper that takes
                             `(columns, columnVisibility,
                             columnOrder)` and returns the ordered
                             visible columns array. Memoized.
  types.ts                   extended:
                             ```ts
                             type ViewState = {
                               // ... existing
                               columnVisibility: Record<string, boolean>;
                               columnOrder: string[]; // field_keys
                             };
                             ```
                             Default values: `columnVisibility = {}`
                             (every column visible by default),
                             `columnOrder = []` (use declaration
                             order; missing keys append).
```

### 4.2 `useGridColumns` helper

```ts
// useGridColumns.ts
export function useGridColumns<T>(
  columns: DataTableColumnDef<T>[],
  columnVisibility: Record<string, boolean>,
  columnOrder: string[],
): DataTableColumnDef<T>[] {
  return useMemo(() => {
    // 1. Order: explicit columnOrder first (in order); columns not in
    //    the order list append in declaration order.
    const byKey = new Map(columns.map((c) => [c.fieldKey, c]));
    const orderedKeys: string[] = [];
    for (const key of columnOrder) {
      if (byKey.has(key)) orderedKeys.push(key);
    }
    for (const c of columns) {
      if (!columnOrder.includes(c.fieldKey)) orderedKeys.push(c.fieldKey);
    }
    // 2. Visibility: filter out columns explicitly hidden. The first
    //    column is never hidden (defensive).
    return orderedKeys
      .filter((key, idx) => idx === 0 || columnVisibility[key] !== false)
      .map((key) => byKey.get(key)!)
      .filter(Boolean);
  }, [columns, columnVisibility, columnOrder]);
}
```

### 4.3 HideFieldsPanel sketch

```tsx
// HideFieldsPanel.tsx — sketch
import { DndContext, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";

export function HideFieldsPanel({
  columns,
  columnVisibility,
  columnOrder,
  onChange,
}: HideFieldsPanelProps) {
  const [search, setSearch] = useState("");
  const orderedColumns = applyColumnOrder(columns, columnOrder);
  const filtered = orderedColumns.filter((c) =>
    c.displayName.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="data-table-hide-fields-panel">
      <input
        className="data-table-hide-fields-search"
        placeholder="Find a field"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          const nextOrder = reorder(orderedColumns, event.active.id, event.over?.id);
          onChange({ columnOrder: nextOrder.map((c) => c.fieldKey) });
        }}
      >
        <SortableContext items={filtered.map((c) => c.fieldKey)} strategy={verticalListSortingStrategy}>
          {filtered.map((column) => (
            <SortableFieldRow
              key={column.fieldKey}
              column={column}
              isPrimary={column.fieldKey === orderedColumns[0]!.fieldKey}
              visible={columnVisibility[column.fieldKey] !== false}
              onToggle={(visible) =>
                onChange({
                  columnVisibility: { ...columnVisibility, [column.fieldKey]: visible },
                })
              }
            />
          ))}
        </SortableContext>
      </DndContext>
      {filtered.length === 0 && search.length > 0 && (
        <div className="data-table-hide-fields-empty">
          No fields match '{search}'
        </div>
      )}
      <div className="data-table-hide-fields-actions">
        <button onClick={() => onChange({
          columnVisibility: Object.fromEntries(
            orderedColumns.slice(1).map((c) => [c.fieldKey, false])
          ),
        })}>Hide all</button>
        <button onClick={() => onChange({
          columnVisibility: {},
        })}>Show all</button>
      </div>
    </div>
  );
}
```

`<SortableFieldRow>` is a small private sub-component using
`useSortable` from dnd-kit to expose the drag handle + listeners.

### 4.4 CSS

```css
.data-table-hide-fields-panel {
  width: 280px;
  padding: 8px;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.data-table-hide-fields-search {
  width: 100%;
  padding: 6px 8px;
  margin-bottom: 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
}
.data-table-hide-fields-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
  border-radius: 4px;
}
.data-table-hide-fields-row:hover { background: var(--hover-background); }
.data-table-hide-fields-row-drag {
  cursor: grab;
  color: var(--muted-foreground);
}
.data-table-hide-fields-row-drag[disabled] { cursor: not-allowed; opacity: 0.4; }
.data-table-hide-fields-actions {
  display: flex; justify-content: space-between;
  padding-top: 8px; border-top: 1px solid var(--border);
}
```

### 4.5 Test plan

- **`useGridColumns.test.ts` (NEW):**
  - Empty visibility + order → returns columns in declaration order.
  - Visibility `{a: false}` → drops `a`.
  - Order `["c", "b", "a"]` → returns in that order.
  - Missing keys append.
  - First column never hidden (defensive — visibility `{first:
    false}` is ignored).
- **`HideFieldsPanel.test.tsx` (NEW):**
  - Renders all columns in order.
  - Search filters list.
  - Toggle calls `onChange` with updated visibility.
  - First column toggle is disabled.
  - "Hide all" calls onChange with all-non-primary hidden.
  - "Show all" calls onChange with empty visibility map.
  - Drag-reorder calls onChange with updated columnOrder.
- **`GridToolbar.test.tsx` (extension):**
  - Button renders with `EyeOff` icon.
  - Label shows count when hidden columns exist.
  - Click opens panel.
- **`GridHeader.test.tsx` / `GridBody.test.tsx` (extensions):**
  - Hidden columns don't render.
  - Reordered columns render in order.
- **`DataTable.test.tsx` (extension):**
  - End-to-end: toggle in panel → header/body re-renders without
    column.
  - Reorder in panel → header/body re-renders in new order.

## 5. Execution order

Four steps. Tree green after each.

### Step 1 — ViewState extension + useGridColumns helper

- Extend `types.ts` per §4.1.
- Create `useGridColumns.ts` per §4.2.
- Tests: `useGridColumns.test.ts`.
- Wire `GridHeader.tsx` and `GridBody.tsx` to consult the helper
  instead of iterating `columns` directly. (Backward-compatible —
  default state is "all visible, declaration order.")
- Commit: `feat(data-table): ViewState columnVisibility +
  columnOrder; useGridColumns helper`.

### Step 2 — HideFieldsPanel component (no toolbar wiring)

- Create `HideFieldsPanel.tsx` per §4.3.
- Add CSS per §4.4.
- Tests: `HideFieldsPanel.test.tsx`.
- Not yet rendered (Step 3).
- Commit: `feat(data-table): HideFieldsPanel component`.

### Step 3 — Toolbar wiring + EyeOff icon

- Extend `GridToolbar.tsx`: add "Hide fields" button with `EyeOff`
  icon, popover trigger that mounts `HideFieldsPanel`.
- Pass `onColumnVisibilityChange` / `onColumnOrderChange` callbacks
  from `DataTable.tsx`.
- Tests: `GridToolbar.test.tsx`, `DataTable.test.tsx` extensions.
- `make typecheck && make lint && make test`.
- Commit: `feat(data-table): Hide fields toolbar button + panel`.

### Step 4 — Demo walk

- `make dev`, walk §10.
- Capture any post-walk fixes.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `@dnd-kit/sortable` was added in Phase 4 for stacked rules; this plan's vertical-list sortable usage is new. Need to confirm the API surface. | Phase 4's stacked rules use the same `DndContext` + `SortableContext` pattern with `verticalListSortingStrategy`. The mental model transfers. |
| Hidden columns still have their data in the row objects — the user might forget which columns are hidden and edit a value they can't see. (Not a concern; rare in practice; documented.) | The panel always shows the full list with toggle state, so "what's hidden" is one click away. Toolbar button label shows count of hidden columns. |
| Reordering changes `columnOrder` array — a column added after a reorder doesn't have a place in the order list and appends. | `useGridColumns` per §4.2: missing keys append in declaration order. New columns added by future schema changes Just Work. |
| Sorting / grouping / filtering apply to hidden columns too — a user filters on `iCFA > 0.5` then hides the iCFA column; the filter still applies but is invisible. | Existing AirTable behavior: filters / sorts / groups apply regardless of visibility. The toolbar's Filter / Sort / Group buttons show "Filtered by iCFA factor" so the filter is discoverable even when the column is hidden. |
| Plan 06's summary bar must consult the same visible-columns list. If plan 06 lands first and hardcodes `columns` iteration, plan 07 has to update plan 06. | Plan 06 §4.1's `<SummaryBar>` already receives `columns` as a prop. Plan 07 just passes the visible-columns list (from `useGridColumns`) into that prop. Trivial swap. |
| The drag-handle column-reorder in this panel and plan 08's header-drag must agree on the source of truth (`columnOrder`). | They do: both write to `view.columnOrder` via the same `onColumnOrderChange` callback. The two surfaces are independent UIs over one piece of state. |
| First-column-non-hideable rule: the primary column is identified by being at index 0 of the declaration order, but after reorder the "first column" could be a different column. | Phase 6 / Phase 7 establish that the "frozen first column" is the column at index 0 *after* ordering. So the non-hideable column is whatever the user has reordered to be first. Documented behavior. |

## 7. What this plan explicitly does not do

- Does not persist column visibility / order across sessions —
  plan 09.
- Does not add a "favorites" section in the panel.
- Does not allow column renames from the panel.
- Does not show a view-share-link banner (Q-FIELDS-1: that's an
  Interfaces feature; out of scope).
- Does not freeze additional columns (only the first column is
  frozen, per US-Builder-Tables criterion 4).
- Does not provide column-width adjustment in the panel.
- Does not support multi-select toggling (Shift-click to toggle a
  range). One-at-a-time toggles only.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — ViewState + useGridColumns       | 1.0 | 1.5 |
| 2 — HideFieldsPanel component        | 2.0 | 3.0 |
| 3 — Toolbar wiring + icon            | 1.0 | 1.5 |
| 4 — demo walk                        | 0.5 | 1.0 |
| **Total**                            | **4.5** | **7.0** |

About one workday.

## 9. Commit plan

1. `feat(data-table): ViewState columnVisibility + columnOrder;
   useGridColumns helper`
2. `feat(data-table): HideFieldsPanel component`
3. `feat(data-table): Hide fields toolbar button + panel`

## 10. Demo script

1. `make dev`, open Rooms.
2. Toolbar shows fourth button "Hide fields" with `EyeOff` icon.
3. Click button → panel opens. All columns listed in display
   order, each with a toggle (all on) and a drag handle.
4. Toggle `floor_level` off → column disappears from the table.
   Toolbar label becomes "Hide fields (1)".
5. Toggle back on → column reappears.
6. Type "iCFA" in search → list filters to matching column(s).
   Clear search → full list returns.
7. Drag `iCFA factor` row to top of list → column moves to second
   position in the table (first stays primary).
8. Try to toggle the primary column's visibility → toggle is
   disabled; tooltip explains.
9. "Hide all" → all columns except primary disappear.
10. "Show all" → all columns return.
11. Esc → panel closes.
12. Switch sub-tab and return → visibility + order preserved
    (in-memory).
13. Reload page → visibility + order reset to defaults (no cross-
    session persistence yet — plan 09).
14. Viewer mode → panel still works; only local view changes.
15. Apply a filter on `iCFA > 0.5`, then hide the iCFA column →
    filter still applies (rows still filtered); toolbar shows
    "Filtered by iCFA factor" so filter is discoverable.
16. Chrome + Safari — repeat 4, 7, 9 in both.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — ViewState + useGridColumns       | | | |
| 2 — HideFieldsPanel component        | | | |
| 3 — Toolbar wiring + icon            | | | |
| 4 — demo walk                        | | | |
| Plan 07 overall                      | | | |
