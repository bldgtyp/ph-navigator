---
DATE: 2026-05-24
TIME: planning
STATUS: Draft. Sixth in the 9-plan AirTable-parity polish series.
        Sequenced 6/9.
SCOPE: Add an AirTable-style summary bar at the bottom of every
       table — pinned, one cell per column, with a per-column
       aggregation picker (Sum / Avg / Min / Max / Count / etc.)
       that aggregates over the post-filter visible row set.
       Retires the per-column-header aggregation menu — the summary
       bar becomes the single place to choose aggregates.
       Library-only.
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
             (US-TBL-AGG-1; Q-AGG-1 resolved to B 2026-05-24)
RELATED:
  - frontend/src/shared/ui/data-table/components/AggregationMenuItem.tsx
    (the existing aggregation primitive — kept; reused by the
    summary bar picker)
  - frontend/src/shared/ui/data-table/components/ColumnHeaderMenu.tsx
    (the current home of the per-column aggregation menu — the
    aggregation menu item is removed in Step 3)
  - frontend/src/shared/ui/data-table/components/GridBody.tsx
    (renders rows + group-header aggregate rows — extends to render
    the pinned summary bar)
  - frontend/src/shared/ui/data-table/fields/aggregations.ts
    (the aggregation registry — already type-aware per column type)
  - frontend/src/shared/ui/data-table/types.ts
    (`ViewState.aggregations` already exists; this plan keeps the
    shape and extends the meaning)
---

# Plan 06 — AirTable-style summary bar

## 1. Why this plan exists

Today, per-column aggregations live in the column header's `⋯`
menu, and the aggregated value renders only on per-group header
rows (so an ungrouped table shows no aggregates). For ungrouped
tables — which is most of the time — totals are invisible. Ed's
2026-05-24 review flagged this: the user wants a way to see "total
iCFA across all rooms" or "total fan wattage" without grouping
first.

AirTable's solution is a **summary bar**: a pinned single-row strip
at the bottom of the table, one cell per column, each cell rendering
either a user-picked aggregate (Sum, Avg, Min, Max, Count, etc.) or
nothing. Click the cell → menu of available aggregations for that
column's type → pick one → cell shows the aggregated value live,
recomputing as the user filters / edits.

The decision (Q-AGG-1) resolved to B (summary bar) on 2026-05-24.

The existing `aggregations.ts` registry, `AggregationMenuItem.tsx`,
and per-group header rendering all continue to work; the summary
bar reuses the registry and adds a parallel render surface. The
per-column-header aggregation menu is retired so there's one place
to pick aggregates.

## 2. Binding constraints

1. **Library-only.** Changes in `GridBody.tsx`, a new
   `SummaryBar.tsx` component, `types.ts` (extend `ViewState`),
   `ColumnHeaderMenu.tsx` (retire the aggregation menu item),
   `DataTable.tsx` (wiring), and CSS. Zero consumer touches.
2. **`ViewState.aggregations` shape preserved.** Today it's already
   `{ [columnKey]: AggregationType }` (per-column aggregate
   picks). The summary bar reads from the same field; the per-
   group renderer continues to read from the same field. Plan 09
   persists it across sessions; this plan doesn't change the shape.
3. **Aggregations compute over the post-filter visible row set.**
   When the user filters to "rooms with iCFA > 0.5," the Sum
   aggregate sums only those rooms. When grouping is active, the
   summary bar still aggregates over the *full visible set*
   (ignoring grouping) — per-group totals continue to live in the
   per-group header rows.
4. **First column is `Count: N`.** AirTable parity. Always shows
   the total row count (post-filter); not user-configurable.
5. **Read-only mode (viewer / locked version)** — summary bar
   renders the values but the picker is disabled (cells are
   read-only displays).
6. **Hidden columns (plan 07)** — hide the column AND its summary
   cell. (Plan 07 isn't landed yet; for this plan, all columns are
   visible.)
7. **Reuse `aggregations.ts` registry** — no new aggregation types
   here. The registry already handles per-column-type selection
   (e.g., Sum is offered for number columns only).
8. **The summary bar is always present** — never hidden by config.
   If the user has no aggregations picked, every column cell
   (except first) is empty.
9. **One commit per step.**

## 3. Acceptance criteria

1. **Summary bar renders at table bottom.** Below the last data
   row, above the table's outer border. Pinned: scrolling the body
   does not move it (same position behavior as the toolbar header).
2. **First column shows `Count: N`.** N = number of post-filter
   visible data rows. Unfiltered Rooms with 12 rows → `Count: 12`.
3. **Other cells empty by default.** Initial state shows no
   aggregates picked.
4. **Click empty summary cell → picker opens.** Menu lists the
   valid aggregations for that column's field type (Sum / Avg /
   Min / Max / Count / Count Unique / Empty / Not Empty — per
   `aggregations.ts` registry). "None" / "Clear" option at the top
   to clear the pick.
5. **Pick "Sum" on iCFA column → summary cell shows total.** Live
   compute. Edit a row's iCFA → summary cell updates.
6. **Filter the table → summary recomputes.** Filter to "iCFA >
   0.5" → Sum shows only those rows' total. Row count in first
   cell updates too.
7. **Per-column type-aware aggregations.** Number column offers
   Sum / Avg / Min / Max / Count / Count Empty / Count Unique /
   etc. Text column offers Count / Count Empty / Count Unique only
   (no Sum on text). Single-select offers Count per option /
   Count / Count Empty. Boolean offers % checked + Count.
8. **Aggregations persist within session.** Picked aggregate
   survives sub-tab navigation. (Cross-session persistence comes
   from plan 09.)
9. **Grouped table — summary bar + per-group rows coexist.** Group
   by `floor_level`. Each group header row still shows per-group
   aggregates (existing behavior). Summary bar at bottom shows
   total-across-groups aggregate.
10. **Column header aggregation menu is removed.** Open any
    column header `⋯` menu — no "Aggregate by…" item. The
    aggregation menu primitive (`AggregationMenuItem.tsx`) is
    retained because the summary bar reuses it.
11. **Read-only mode — picker disabled.** Open summary cell in
    viewer mode → no popover; cell shows existing aggregate
    value (or empty).
12. **Hide column (plan 07 — when landed) hides its summary
    cell.** Until plan 07 lands, this is a forward-compat note;
    the summary cell render is driven by the same visible-columns
    list, so it'll Just Work when plan 07 lands.
13. **No regression** to per-group header aggregate rendering
    (Phase 6 stays green).

## 4. Target architecture

### 4.1 File changes

```
frontend/src/shared/ui/data-table/
  components/
    SummaryBar.tsx           NEW — pinned bottom row, one cell per
                             visible column. Cells render either:
                               (a) row-count for the first column,
                               (b) the chosen aggregate value for
                                   columns with a pick, or
                               (c) empty (clickable to open picker).
                             Each cell wraps `AggregationMenuItem`
                             in a popover trigger.
    AggregationMenuItem.tsx  KEPT — used by SummaryBar's picker.
    ColumnHeaderMenu.tsx     extended: remove the "Aggregate by…"
                             item. Keep all other menu items
                             (sort, filter, group, hide, etc.).
    GridBody.tsx             extended: render `<SummaryBar>` after
                             the data rows, before the table's
                             closing `</table>`. Receives the
                             aggregations state + visible-columns
                             list + post-filter row set.
  hooks/
    useGridAggregations.ts   NEW (small) — pure helper exposing
                             `computeAggregate(columnKey, aggType,
                              rows, fieldDef)` that walks `rows`
                             and applies the type-aware aggregation
                             from `aggregations.ts`. Memoized off
                             `(columnKey, aggType, rows-identity)`.
                             Returns a string / number / empty
                             ready for cell rendering.
  fields/
    aggregations.ts          UNCHANGED — registry already exists.
  types.ts                   `ViewState.aggregations` shape stays:
                             `{ [columnKey]: AggregationType | null }`.
                             Add `null` value (explicit-empty) to
                             distinguish "user picked none" from
                             "never picked" — both render empty,
                             but persistence (plan 09) needs to
                             save a null vs. omit the key.
```

### 4.2 SummaryBar render sketch

```tsx
// SummaryBar.tsx — sketch
type SummaryBarProps = {
  columns: DataTableColumnDef[];
  visibleRows: RowData[];
  aggregations: Record<string, AggregationType | null>;
  fieldDefByKey: Map<string, FieldDef>;
  readOnly: boolean;
  onAggregationChange: (columnKey: string, type: AggregationType | null) => void;
};

export function SummaryBar({ columns, visibleRows, aggregations, fieldDefByKey, readOnly, onAggregationChange }: SummaryBarProps) {
  return (
    <tfoot className="data-table-summary-bar">
      <tr>
        {columns.map((col, idx) => {
          if (idx === 0) {
            return (
              <td key={col.fieldKey} className="data-table-summary-cell data-table-summary-count">
                Count: {visibleRows.length}
              </td>
            );
          }
          const aggType = aggregations[col.fieldKey];
          const fieldDef = fieldDefByKey.get(col.fieldKey);
          const value = aggType && fieldDef
            ? computeAggregate(col.fieldKey, aggType, visibleRows, fieldDef)
            : "";
          return (
            <SummaryCell
              key={col.fieldKey}
              column={col}
              fieldDef={fieldDef}
              value={value}
              aggType={aggType}
              readOnly={readOnly}
              onPick={(next) => onAggregationChange(col.fieldKey, next)}
            />
          );
        })}
      </tr>
    </tfoot>
  );
}
```

`<SummaryCell>` is a private sub-component that wraps the picker
popover. Click opens the menu; selection calls `onPick`.

### 4.3 CSS

```css
.data-table-summary-bar {
  position: sticky;
  bottom: 0;
  background: var(--muted-background, #f9fafb);
  border-top: 2px solid var(--border, #e5e7eb);
  z-index: 1;
}
.data-table-summary-cell {
  padding: 8px;
  font-size: 0.875rem;
  color: var(--muted-foreground, #6b7280);
  cursor: pointer;
}
.data-table-summary-cell:hover {
  background: var(--hover-background, #f3f4f6);
}
.data-table-summary-count {
  font-weight: 500;
}
.data-table-summary-cell[data-readonly="true"] {
  cursor: default;
}
```

### 4.4 Test plan

- **`SummaryBar.test.tsx` (NEW):**
  - First cell shows `Count: N`.
  - Other cells empty when no aggregation picked.
  - Picking Sum on a number column shows the sum.
  - Updating `visibleRows` recomputes the value.
- **`useGridAggregations.test.ts` (NEW):**
  - `computeAggregate("sum", rows, fieldDef)` returns the sum.
  - Empty rows → 0 for Sum, "" for Min/Max.
  - Non-numeric values in a numeric column → skipped (don't break).
- **`ColumnHeaderMenu.test.tsx` (extension):**
  - "Aggregate by…" menu item is no longer rendered.
- **`GridBody.test.tsx` (extension):**
  - `<tfoot>` with the summary bar renders below the data rows.
  - `<tfoot>` does not render in viewer mode if the consumer chose
    to hide it (out of scope here; this plan always renders).
- **`DataTable.test.tsx` (extension):**
  - End-to-end: picking an aggregate in the summary bar updates
    `view.aggregations`.
  - Filter the table → summary recomputes (memo key changes).
  - Grouping active + summary bar: per-group aggregates and
    summary bar both render; numbers match expectation.

## 5. Execution order

Four steps. Tree green after each.

### Step 1 — Aggregation compute helper

- Create `hooks/useGridAggregations.ts` with `computeAggregate`.
  Pure; calls into `aggregations.ts` registry.
- Tests: `useGridAggregations.test.ts`.
- No UI changes at this step.
- Commit: `feat(data-table): useGridAggregations compute helper`.

### Step 2 — SummaryBar component

- Create `SummaryBar.tsx` per §4.2.
- Add CSS to `App.css` per §4.3.
- Tests: `SummaryBar.test.tsx`.
- Not wired into the table yet (Step 3).
- Commit: `feat(data-table): SummaryBar component`.

### Step 3 — Wire into GridBody + retire header menu

- Extend `GridBody.tsx`: render `<SummaryBar>` after data rows.
- Pass aggregations + visible rows + onAggregationChange from
  `DataTable.tsx`.
- Remove the "Aggregate by…" item from `ColumnHeaderMenu.tsx`.
- Update `types.ts` to allow `aggregations[col]` to be `null`
  (explicit empty).
- Tests: `GridBody.test.tsx`, `ColumnHeaderMenu.test.tsx`,
  `DataTable.test.tsx` extensions.
- `make typecheck && make lint && make test`.
- Commit: `feat(data-table): summary bar at table bottom; retire
  column-header aggregation menu`.

### Step 4 — Demo walk

- `make dev`, walk §10.
- Capture any post-walk fixes.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `<tfoot>` with `position: sticky; bottom: 0` doesn't pin reliably inside a scrolling `<table>` in all browsers (Safari has had bugs). | Verified in Phase 6 for the toolbar header (`<thead>` + `position: sticky; top: 0` works). Mirror the pattern. If Safari misbehaves, fall back to a `<div>` outside the `<table>` with mirrored column widths via a synced layout. |
| Computing aggregates on every render of large tables (e.g., 500 rows) becomes a perf hot spot. | `computeAggregate` is memoized off `(columnKey, aggType, rows-reference)` in `useGridAggregations`. Rows reference changes only when the data array itself changes (post-filter set is a stable reference). Worst case is O(N) per column per data change — acceptable for V2 v1 row counts (≤500). |
| Retiring the column-header aggregation menu is a removal — users who learned the old surface lose it. | One-line announcement in the eventual release note; the summary bar is a better discovery surface. No data migration: `view.aggregations` shape is unchanged. |
| Aggregations on a grouped table — the user might expect summary bar to show *per-group* totals (mirroring per-group rows). | Per-group totals already render in group-header rows (Phase 6). Summary bar shows the *grand total* over all visible rows. Documented in §7. |
| Hidden columns (plan 07) — the summary bar render iterates `columns`. If plan 07 lands and the visible-columns list is the same source-of-truth, summary cells auto-hide. If a column-visibility filter happens at a different layer, this plan's render breaks. | This plan reads `visible columns` from the same source `GridBody` uses for body rows — single source of truth. Plan 07 will naturally compose. |
| `ViewState.aggregations` now allows `null` as a value (explicit empty) — existing code reading `aggregations[col]` may assume undefined === missing. | Add a small migration in `DataTable.tsx`'s view-state reader: treat `null` and `undefined` identically for render purposes. Persistence (plan 09) is where `null` matters — to distinguish "user explicitly cleared" from "never set." |
| Single-select column's Count Per Option output may be a multi-line list of pills — hard to fit in a single summary row cell. | Step 2 implementation: for single-select columns, "Count Per Option" pre-aggregates and renders the most-common option's count + `…` link to open a detail popover. Defer to a follow-up if this turns out to be a UX trap; v1 of the summary bar can show only Sum / Avg / Min / Max / Count / Count Unique / Count Empty for now and add per-option aggregations later. |

## 7. What this plan explicitly does not do

- Does not add new aggregation types beyond what's already in
  `aggregations.ts`.
- Does not allow the user to hide the summary bar (always
  rendered).
- Does not provide per-group aggregations in the summary bar
  itself — per-group totals stay in the group-header rows.
- Does not pin individual aggregate cells if columns are pinned
  (no column pinning today other than the first column).
- Does not persist aggregations across sessions — that's plan 09.
- Does not handle aggregations on single-select per-option counts
  in a multi-line layout — single-value aggregates only for v1.
- Does not warn the user when the picked aggregate becomes
  invalid (e.g., changing a column's field type). The summary cell
  renders empty in that case (gracefully degraded).

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — aggregation compute helper       | 1.0 | 1.5 |
| 2 — SummaryBar component             | 2.0 | 3.0 |
| 3 — wire + retire header menu        | 1.5 | 2.5 |
| 4 — demo walk                        | 0.5 | 1.0 |
| **Total**                            | **5.0** | **8.0** |

About one workday.

## 9. Commit plan

1. `feat(data-table): useGridAggregations compute helper`
2. `feat(data-table): SummaryBar component`
3. `feat(data-table): summary bar at table bottom; retire column-
   header aggregation menu`

## 10. Demo script

1. `make dev`, open Rooms with ≥10 rows.
2. Verify summary bar renders at bottom of table; first cell
   shows `Count: 10` (or whatever the row count is).
3. Click empty summary cell on `iCFA factor` → picker opens with
   Sum / Avg / Min / Max / Count / etc.
4. Pick Sum → cell shows the total.
5. Edit a row's iCFA factor → summary cell updates live.
6. Add a filter (e.g., `floor_level = 1st`) → first cell shows
   `Count: 4` (filtered count); iCFA Sum recomputes.
7. Pick Avg on the same column → cell switches to avg value.
8. Pick "Clear" / "None" from the picker → cell becomes empty.
9. Open `name` column's summary cell picker → only Count / Count
   Empty / Count Unique offered (no Sum for text).
10. Open `floor_level` column's summary cell picker → Count /
    Count Per Option / etc.
11. Open any column header `⋯` menu → confirm "Aggregate by…"
    item is gone.
12. Add a Group by `floor_level` → per-group header rows show
    per-group aggregates (existing); summary bar at bottom shows
    grand total. Numbers verify.
13. Switch to viewer mode → summary cells render values; clicking
    them does nothing (picker disabled).
14. Resize the browser narrower → summary bar scrolls
    horizontally with the body (or stays pinned, per the sticky
    behavior).
15. Chrome + Safari — repeat steps 2, 4, 6, 12 in both.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — aggregation compute helper       | | | |
| 2 — SummaryBar component             | | | |
| 3 — wire + retire header menu        | | | |
| 4 — demo walk                        | | | |
| Plan 06 overall                      | | | |
