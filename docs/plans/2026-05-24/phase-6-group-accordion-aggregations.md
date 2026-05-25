---
DATE: 2026-05-24
TIME: planning
STATUS: Walked with Ed 2026-05-24; all fourteen §12 open questions
        resolved inline (see §12). Material deltas from the original
        drafts' defaults:
        - **Cap is 4 group levels**, not 3 (§4.2).
        - **Direction labels are `First → Last` / `Last → First`**,
          not `A → Z` / `Z → A`. This is AirTable's literal phrasing
          on the group popover (and on the screenshots Ed walked) —
          it reads as "order the groups so the first one shown comes
          first in the sort" regardless of field type. Phase 4's
          Sort popover keeps its existing `A → Z` / `Z → A` labels
          (they match AirTable's Sort popover, also walked at the
          same session); the two popovers stay literally true to
          AirTable's own per-axis phrasing.
        - **Collapse all / Expand all live in the Group popover
          header**, top-right, NOT in the toolbar `⋯` overflow.
          Per the walked AirTable screenshot. The toolbar `⋯` keeps
          its existing `Reset view` item plus (Phase 6 still owns)
          the broader Reset scope per §4.4.
        - **Group popover heading is `Group by`** (not "Group
          records by") and the add-rule footer is **`+ Add
          subgroup`** (not "+ Add group field"). Verbatim from
          AirTable.
        - **Group-axis tint = lavender**, sampled from the
          AirTable active-state group button + the per-column cell
          tint visible in the walked screenshots. The seven-subset
          palette in §4.3.3 updates to match (the `g` token shifts
          from the OKLCH-295 purple placeholder to a lighter
          lavender ≈ OKLCH 96% 0.03 290).
        - Phase 6 only changes Phase 5's `ColumnHeaderMenu`
          trigger-visibility rule (single_select → any aggregatable
          field). Phase 5 already ships an `extraItems?(fieldDef)`
          slot on `ColumnHeaderMenu` for precisely this expansion
          (Phase 5 §4.2), so the integration seam is pre-paved.
        Ready to begin Step 1.
SCOPE: Phase 6 of the `<DataTable>` AirTable-parity plan. Three
       deliverables, all library-only:
       (1) **Stacked group accordion** — toolbar `Group ▾` popover with
           up to 4 group levels (field + `First → Last` / `Last →
           First` + drag handle + delete), wired through a single
           `onViewChange` call (L8.2). Popover header carries
           `Collapse all` / `Expand all` actions (matches AirTable).
           Group rules drive a pre-sort (L8.3) prepended to
           `view.sort`; rendered body interleaves group-header `<tr>`s
           between data rows with `8 * depth` px indent, chevron
           expand/collapse, group-key pill, `(N)` count, and right-
           aligned aggregated values. `expandedGroups` tracks per-path
           collapse state.
       (2) **Per-column aggregation picker** — appended to the Phase 5
           `ColumnHeaderMenu`'s `extraItems` slot for every field type
           whose aggregation catalogue is non-empty. Kinds:
           `none / count / sum / mean / min / max`. Each field type
           declares its kinds + a pure `formatAggregation(kind, values,
           fieldDef)` helper in `fields/aggregations.ts` (L9.1). The
           generalization also fixes a Phase 5 limitation: the `⋯`
           menu trigger renders for any field that has ≥1 menu item
           (today only single_select); after Phase 6 it renders for
           every aggregatable field too.
       (3) **14-entry pre-mixed tint cascade** — replaces Phase 4's
           filter-wins-on-overlap rule. New token file
           `tokens/data-table-tints.ts` exports `ROLE_BACKGROUNDS.body`
           and `ROLE_BACKGROUNDS.header` keyed by the 7 non-empty
           subsets of `{filter, sort, group}` (7 × 2 = 14). The cell
           `data-axis-tint` attribute widens from `"filter" | "sort"`
           to one of `"f" | "s" | "g" | "fs" | "fg" | "sg" | "fsg"`;
           CSS attribute selectors paint each cell. Layer order stays
           tint → selection → focus (L9.3, identical to Phase 4).
       Driven against Rooms (US-EQ-2). No consumer touches: zero
       changes to `RoomsTable.tsx`, `EquipmentTab.tsx`, or anything
       under `features/`. Closes parent-plan §12 (Phase 6) and
       wishlist item #1e's deferred "tint cascade" half.
PARENT-PLAN: docs/plans/2026-05-23/datatable-airtable-parity.md
PRECEDING-PHASE: docs/plans/2026-05-24/phase-5-single-select-option-manager.md
RELATED:
  - context/technical-requirements/data-table.md
    (§Interaction Requirements: "group accordion with per-column
    aggregations", "tinting for filtered, sorted, and grouped
    columns"; §View State: "Group direction requires a pre-sort
    derived from group rules"; §Field Definition Registry — drive
    render / edit / coerce / sort / filter / aggregate from one
    typed FieldDef)
  - context/user-stories/30-tables-equipment.md
    (US-Builder-Tables criterion 2 — stacked toolbar; criterion 3 —
    session-only view state + reset; criterion 13 — group accordion
    and per-column aggregations)
  - docs/plans/2026-05-23/phase-4-stacked-filter-sort.md
    (`ViewState`-as-source rule, `data-axis-tint` carrier on `<th>` /
    `<td>`, `@dnd-kit/sortable` precedent, `useSortableRules` hook,
    overflow-menu surface in `ViewMenuOverflow`, filter-wins
    precedence rule that Phase 6 generalizes)
  - docs/plans/2026-05-24/phase-5-single-select-option-manager.md
    (`ColumnHeaderMenu` component + `extraItems?` slot — the seam
    Phase 6 plugs the aggregation picker into; menu-then-modal
    pattern; trigger hover-reveal CSS)
  - research/poc-plans/poc-lessons-for-real-build.md
    (L2.3 typed FieldDef registry, L8.1 view-state as user-intent,
    L8.2 one mutation channel per axis, L8.3 group requires pre-sort,
    L8.4 dormant rows pass, L9.1 per-type aggregationFn +
    aggregatedCell, L9.2 pre-mixed tint palette as tokens,
    L9.3 layer order tint → selection → focus, L10.2 native controls
    for popover MVPs)
---

# Phase 6 — Stacked group accordion + per-column aggregations + tint cascade

## 1. Why this phase exists

After Phases 0–5, every cell-level and row-level write gesture
AirTable ships runs through `<DataTable>`'s write reducer, every
view-state mutation (filter / sort / single-select option list)
flows through `onViewChange` or `dispatchWrite`, and the toolbar
owns sort + filter as a single mutation channel. What is still
missing is the **grouping axis** and the visual layer that lets a
user read at-a-glance which columns participate in any combination
of `{filter, sort, group}`.

Five concrete gaps Phase 6 closes:

1. **No way to ask for grouped rows.** `view.group` exists on
   `ViewState` (`types.ts:95`), `isGrouped = view.group.length > 0`
   is read in `DataTable.tsx:124`, and `Ungroup to paste` /
   `Ungrouped` is wired into the toolbar status chip
   (`GridToolbar.tsx:52`) — but **no UI populates `view.group`**.
   Consumers cannot ask for "rows grouped by `floor_level`, then
   by `building_zone`," which is the whole point of US-Builder-
   Tables criterion 13. AirTable's solution is a `Group ▾`
   toolbar button (right of `Sort ▾`) opening a stacked popover
   with the same UX as Filter / Sort.
2. **No group accordion in the body.** Even if a consumer set
   `view.group` programmatically today, `GridBody` would render
   rows as a flat list — there's no group-header `<tr>`, no
   collapse chevron, no `(N)` count, and `expandedGroups` is dead
   state. The body rendering pipeline (`filteredRows → tanstack
   row model → flat tbody`) has no notion of sections.
3. **No per-column aggregations.** `view.aggregations` exists as
   `Record<string, AggregationKind>` (`types.ts:96`) but the
   registry has no `formatAggregation`, no UI to set it, and no
   place to render the result. Once group accordion lands, group
   headers have a natural right-aligned slot for per-column
   aggregated values (mean iCFA per floor, count of rooms per
   zone, max num_people per building zone).
4. **Single-axis tint is the wrong final shape.** Phase 4 §4.10
   ships filter-wins-on-overlap as an interim rule, with a
   documented `13 §parent §12 (L9.2)` follow-up to generalize
   into a 7-subset palette covering every overlap of
   `{filter, sort, group}`. A grouped column today would have no
   tint at all — there is no `group` axis in the tint enum. Phase
   6 ships the final palette and removes filter-wins as a special
   case.
5. **The `⋯` column menu is single_select-only.** Phase 5 wires a
   library-owned column-overflow menu for option editing — but
   gates its trigger visibility on `fieldDef.field_type ===
   "single_select"`. The per-column aggregation picker needs that
   same trigger on every aggregatable field (number, computed-
   number, single_select for count, text for count). Phase 6
   generalizes the visibility rule from "single_select only" to
   "any field with ≥1 menu item." The Phase 5 `extraItems?` slot
   on `ColumnHeaderMenu` is the seam.

After Phase 6, the toolbar carries three stacked-rule popovers
(`Filter ▾ / Sort ▾ / Group ▾`) wired to user-intent lists in
`ViewState`, every body cell + column header tints from a
deterministic 14-entry palette of role subsets, every aggregatable
field exposes a per-column aggregation picker through the same
menu Phase 5 ships, group headers render as collapsible accordion
sections with per-column aggregated values, and `Reset view` in
the overflow menu clears all three axes' rule lists plus
aggregations and expanded-groups state in one click.

The user-story phasing rule from US-Builder-Tables criterion 13 is
satisfied (group accordion + per-column aggregations on Rooms).
Phase 7 (fill handle + ⌘D / ⌘R) follows; the catalog-page
migration (parent §14) starts after that against a primitive that
has no AirTable-class behaviour left to add.

## 2. Binding constraints

1. **Library-only.** All changes land in
   `frontend/src/shared/ui/data-table/` plus `frontend/src/App.css`
   for the tint tokens, group-header chrome, and Group-button
   styles. **Zero touches** to `RoomsTable.tsx`,
   `EquipmentTab.tsx`, or anything under `features/`. If a
   consumer file changes during this phase, pause and re-evaluate
   (mirrors Phase 4's binding constraint #1).
2. **`onViewChange` is the only mutation channel for grouping**
   (L8.2). Every gesture — Add Rule, popover row edit, drag
   reorder, delete, Collapse-all / Expand-all, Reset — calls
   `onViewChange(nextView)` exactly once with a fully-shaped
   `ViewState`. No header-driven group entry exists. No per-axis
   callback added; the `onViewChange` path Phase 4 already opens
   carries `view.group`, `view.aggregations`, and
   `view.expandedGroups` updates.
3. **Group rules force a pre-sort** (L8.3, data-table.md §View
   State). The library derives
   `effectiveSorting = [...groupSort, ...view.sort]` per memo and
   passes that to the existing `sortRows` helper. The user's
   `view.sort` is **not mutated** — it stays the user-intent list;
   only the derived order is prepended.
   - If a field appears in both `view.group` and `view.sort`, the
     duplicate from `view.sort` is **dropped from the effective
     order** (the group's direction wins). The user-intent list
     stays as the user wrote it; only the derived sort
     deduplicates. This avoids "you set `floor_level asc` as a
     group, then `floor_level desc` as a sort — what happens?"
     ambiguity by deferring to the group direction.
4. **View-state changes do NOT enter the write reducer's history**
   (Phase 0 contract, Phase 4 §7). Adding / removing / reordering
   a group rule is **not** undoable via ⌘Z. The user reverses
   group changes through the Group popover or Reset. (AirTable
   matches this — Cmd-Z does not roll back the group stack.)
5. **Aggregation kinds live in the typed registry** (L2.3, L9.1).
   `fields/aggregations.ts` exports per-field-type catalogues
   (`text`, `number`, `single_select`, `computed`) and one
   `formatAggregation(kind, values, fieldDef)` evaluator. The
   library never branches on `field_type` outside the registry
   (matches Phase 4's filter-operator rule).
6. **14-entry tint palette as design tokens** (L9.2). A new file
   `tokens/data-table-tints.ts` exports `ROLE_BACKGROUNDS.body`
   and `ROLE_BACKGROUNDS.header` keyed by the 7 non-empty subsets
   of `{filter, sort, group}`. The tokens are CSS custom
   properties consumed by attribute selectors on `<th>` and `<td>`
   — **no runtime HSL blending** (data-table.md §Layout, Styling,
   And Accessibility: "Tint palette is an explicit token set, not
   runtime HSL blending").
7. **Layer order is tint → selection → focus** (L9.3). Identical
   to Phase 4 §4.10 — Phase 6 only changes the *base* tint values
   and their attribute keys; the selection box-shadow lane and
   the focus outline lane stay where they are. The Phase 3 +
   Phase 4 visuals compose unchanged.
8. **Paste / fill while grouped stays disabled** (already wired:
   `DataTable.tsx:384` for paste; Phase 7 will wire fill). Phase
   6 keeps the disable and refines the banner copy to
   `Ungroup to paste` (matches AirTable). No new fill or paste
   logic added.
9. **Read-only stays interactive for group + aggregation.** A
   Viewer or locked-version reader can still build a group stack
   and pick aggregation kinds against rows they can read — same
   rule Phase 4 applied to sort + filter (data-table.md §
   Interaction Requirements: "read-only mode where local
   sort/filter/group and copy still work"). Only mutations
   (inline edit, paste, delete-N, option edit) stay blocked.
10. **No new top-level npm dependencies.** `@dnd-kit/sortable`
    (Phase 4) and `@radix-ui/react-popover` (Phase 4) and
    `@radix-ui/react-dialog` (Phase 5) cover every UI primitive
    Phase 6 needs. The `useSortableRules` hook from Phase 4 is
    reused verbatim for the Group popover's drag handle.
11. **Tests live with the primitive.** New coverage lands in
    `__tests__/groupRows.test.ts`, `__tests__/aggregations.test.ts`,
    `__tests__/GroupPopover.test.tsx`,
    `__tests__/AggregationMenuItem.test.tsx`, plus extensions in
    `DataTable.test.tsx`, `GridBody.test.tsx`, and
    `GridToolbar.test.tsx`. Consumer integration tests
    (`EquipmentTab.test.tsx`) get no behaviour changes.
12. **Selection model is data-row-flat.** Group-header rows are
    not selectable, do not appear in `rowIds`, do not have a
    `data-row-id` attribute, and do not participate in the
    keyboard cell-index math. The active cell can land only on a
    data row. Collapsing a group whose member contains the active
    cell clears the active cell to `{rowIndex: 0, columnIndex:
    activeCell.columnIndex}` (or to the next-visible row if 0 is
    also collapsed — see §4.6). This keeps the Phase 0–5
    selection contract intact (`useGridSelection` treats `rowIds`
    as the authoritative ordered list of selectable rows).

## 3. Acceptance criteria

"Phase 6 demo passed" means all eighteen are true on a real
browser walk against Rooms.

1. **`Group ▾` button renders right of `Sort ▾`.** Toolbar order
   left-to-right: status chips · `Filter ▾` · `Sort ▾` · `Group ▾`
   · `⋯` overflow. The button label is `Group` when
   `view.group.length === 0`, `Grouped by <display_name>` for one
   rule, `Grouped by N fields` for multi-rule.
2. **Group popover opens, stacked rules add via `+ Add subgroup`.**
   Layout matches the AirTable group popover walked 2026-05-24
   (heading `Group by`, rule rows `Field ▾ · First → Last /
   Last → First · 🗑 · ⋮⋮`, popover-header right-side
   `Collapse all` / `Expand all` text actions). Up to 4 rules;
   the `+ Add subgroup` button disables when 4 are present. The
   field picker excludes `attachment` / `argb_color` and any
   field already in `view.group` (matches Phase 4 sort's "no
   duplicates" §12 Q1 rule).
3. **Group rule add triggers re-render with accordion sections.**
   On Rooms: add `floor_level asc` → body re-renders with one
   `<tr>` group-header per distinct floor value, each followed by
   its member room rows. Group header shows: chevron (▼ expanded
   / ▶ collapsed), the floor-level option pill at the group's
   color (single_select group keys render as pills), `(N rooms)`
   count, right-aligned aggregated values per column (empty
   strings until §6 fires).
4. **Two-level grouping nests with `8 * depth` px indent.** Add
   `building_zone asc` as the second rule. Body re-renders with
   floor-level headers at depth 0 (no indent), building-zone
   headers at depth 1 (8 px left indent), data rows at depth 2
   (16 px left indent). The `Grouped by 2 fields` label updates
   on the toolbar button.
5. **Drag-to-reorder group rules.** In the popover, drag
   `building_zone` above `floor_level`. The body re-renders with
   building-zone as the outer group and floor-level as the inner
   group. (Reuses the Phase 4 `useSortableRules` hook.)
6. **Chevron toggles per-group collapse.** Click the `floor_level
   = 1st` group's chevron → that group's nested zones and rooms
   collapse; chevron flips to ▶. Click again → re-expand. State
   is recorded under `view.expandedGroups[<groupPath>]` and
   round-trips through `onViewChange`.
7. **Collapse-all / Expand-all in the Group popover header.**
   The Group popover renders `Collapse all` / `Expand all` text
   actions in its header's right-side strip (matches AirTable;
   per §12 Q15). Clicking either calls `onViewChange` once with
   `expandedGroups` mass-toggled. The toolbar `⋯` overflow does
   NOT carry these actions (they sit with the rule editor where
   they're discoverable while grouping).
8. **Per-column `⋯` menu shows on number / computed / text /
   single_select.** With Phase 5 in place, the `⋯` trigger appears
   on every column whose aggregation catalogue is non-empty (in
   Rooms: every column except `erv_unit_ids` which is a
   read-only text concatenation — and even that one shows count
   per §12 Q5 default). The single_select columns also still show
   `Edit options…` (Phase 5 item unchanged).
9. **Aggregation picker — none / count / sum / mean / min / max
   per number field.** Open the `⋯` menu on `icfa_factor` → an
   inline `Aggregation: <current> ▾` submenu shows the kinds the
   number registry exposes (`none`, `count`, `sum`, `mean`,
   `min`, `max`). Picking `mean` calls `onViewChange` with
   `view.aggregations.icfa_factor = "mean"`.
10. **Aggregated values render in group headers.** With the
    `icfa_factor mean` aggregation set and the two-level group
    active, each `floor_level` header shows the mean iCFA across
    all rooms in that floor; each `building_zone` header (depth 1)
    shows the mean within that zone. Numbers format via the
    field's existing display formatter (number → 2 decimals).
11. **Per-axis full tint cascade (7-subset palette).** Apply:
    - `view.filter = [{num_people > 1 contributing}]`,
    - `view.sort = [{number asc}]`,
    - `view.group = [{floor_level asc}]`.
    Verify each column's `data-axis-tint` attribute resolves to
    the correct subset code:
    - `num_people` → `"f"` (filter only)
    - `number` → `"s"` (sort only)
    - `floor_level` → `"g"` (group only)
    - other columns → no attribute / no tint
    Now add `view.filter = [{num_people > 1}, {floor_level is
    any of [Ground]}]` → `floor_level` tints `"fg"` (filter +
    group), `num_people` stays `"f"`. Add a second sort on
    `floor_level` → after dedup against the group rule, the sort
    list still carries the rule (user-intent stays), but the
    *effective* sort drops it; the tint moves to `"fsg"` (all
    three subsets present in the user-intent lists). The
    `floor_level` column header background and body cells render
    the `"fsg"` tint token visibly.
12. **Toolbar buttons tint to their own axis.** `Filter ▾` →
    green when any filter rule exists. `Sort ▾` → peach when any
    sort rule exists. `Group ▾` → lavender when any group rule
    exists. The buttons do **not** stack tints — each one shows
    only its own axis token. (The 7-subset palette applies to
    column headers + body cells, not to toolbar buttons.)
13. **Dormant filter rules don't tint columns even with grouping
    active.** Add a third filter rule on `name contains` with
    empty value → that rule passes everything (L8.4), is
    excluded from the contributing set, and its column does not
    flip to a filter-bearing subset. (`isFilterContributing`
    from Phase 4 §4.10 keeps doing its job.)
14. **Reset view clears all three axes + aggregations +
    expandedGroups.** Click `⋯` overflow → `Reset view`. After:
    `view.filter = []`, `view.sort = []`, `view.group = []`,
    `view.aggregations = {}`, `view.expandedGroups = {}`. Column
    order / hidden columns / column widths unchanged. The
    toolbar status chips revert to neutral; all column tints
    clear; group accordion is gone; group headers in the body
    are gone. (Phase 4 §4.7's narrow scope is widened — see
    §4.4.)
15. **Paste while grouped is blocked with the banner.** With a
    group rule active, ⌘V on the focused cell shows a `Ungroup
    to paste` toast (or in-toolbar banner). The existing
    `handlePasteEvent` short-circuit (`DataTable.tsx:384`) is
    preserved.
16. **Read-only mode keeps group + aggregation interactive.**
    Sign in as Viewer (or open a locked version). The Filter /
    Sort / Group buttons all open; their popovers all edit;
    `⋯` column menus still show the aggregation submenu but the
    Phase 5 `Edit options…` item is gone for single_select
    columns (already gated by Phase 5 constraint 11). Inline
    edit / paste / delete-N stay blocked.
17. **No Phase 0 / 1 / 2 / 3 / 4 / 5 regressions.** All
    Phase-5-post tests pass. Inline edit, paste, row insert /
    delete, mouse-drag selection, ⌘C copy with full TSV / HTML,
    perimeter outline, autoscroll, Phase 4 filter / sort
    popovers, Phase 5 option editor + delete-with-cascade all
    work unchanged. Selection inside a grouped + filtered +
    sorted column composites correctly: tint base + selection
    overlay + focus outline visually distinct.
18. **`make typecheck && make lint && make test && make format`**
    and **`pnpm run build`** all clean. `pnpm run dev` walks
    §10 end-to-end in Chrome and Safari without console errors.

## 4. Target architecture

### 4.1 File layout (after)

```
frontend/src/shared/ui/data-table/
  DataTable.tsx              composes the Group popover wiring; replaces
                             `axisTintByFieldKey` (filter|sort) with
                             `axisRolesByFieldKey` (subset of
                             {f, s, g}); derives `effectiveSort` from
                             `view.group` + `view.sort`; builds the
                             body render plan
                             (`groupedBodyPlan`) and threads it to
                             GridBody. Stays under ~320 LOC (Phase 5
                             leaves it around 260–280).
  components/
    GridHeader.tsx           extended — `axisTintByFieldKey` widens
                             from `Map<string, "filter"|"sort">` to
                             `Map<string, AxisRoleSubset>` where
                             AxisRoleSubset is the 7-subset string
                             code (`"f"|"s"|"g"|"fs"|"fg"|"sg"|"fsg"`).
                             No structural change otherwise.
    GridBody.tsx             extended — accepts a `bodyPlan` prop in
                             place of `tableRows`, walks it, and emits
                             either a data `<tr>` (existing path) or
                             a group-header `<tr>` (new path). Cell
                             `data-axis-tint` attribute widens
                             alongside GridHeader's.
    GridGutter.tsx           UNCHANGED
    GridToolbar.tsx          extended — adds the `Group ▾` button
                             between Sort and the overflow `⋯`, with
                             its own `data-axis="group"` tint hook.
                             Status chips on the left lose the
                             `Ungrouped` / `Ungroup to paste` chip
                             (the group button label now carries the
                             info; the banner moves to the body when
                             a paste is attempted).
    FilterPopover.tsx        UNCHANGED
    SortPopover.tsx          UNCHANGED
    GroupPopover.tsx         NEW — `<Popover>` shell, `Group by`
                             heading with right-aligned
                             `Collapse all` / `Expand all` text
                             actions, stacked rule rows (field +
                             `First → Last` / `Last → First` + per-
                             rule `⋯` placeholder + 🗑 + ⋮⋮),
                             `+ Add subgroup` footer disabled at 4
                             rules, empty-state copy. Reuses
                             `useSortableRules` from Phase 4 (already
                             generic over `{fieldKey; direction}`).
    GroupHeaderRow.tsx       NEW — pure presentational `<tr>` for one
                             group-header row. Receives depth, group
                             key value, group's fieldDef, count,
                             aggregated values per column, expanded
                             flag, onToggle callback. Renders chevron
                             + indent + pill-or-text key + count +
                             per-column aggregated values right-
                             aligned across `<td>`s that match the
                             body's column structure.
    ColumnHeaderMenu.tsx     extended — Phase 5 ships this with an
                             `extraItems?` slot. Phase 6:
                             (a) generalizes the trigger visibility:
                             the menu renders whenever it has ≥1 item
                             to show (single_select fields still show
                             `Edit options…`; aggregatable fields now
                             show `Aggregation: ▾`). (b) Adds an
                             `AggregationMenuItem` rendered inline
                             above any `extraItems?` output. (c) Adds
                             a divider between library items when both
                             groups are present.
    AggregationMenuItem.tsx  NEW — renders the `Aggregation:
                             <current> ▾` submenu for a column.
                             Lists the kinds the field's catalogue
                             exposes. Clicking a kind dispatches
                             `onViewChange({...view, aggregations:
                             {...view.aggregations, [fieldKey]:
                             kind}})`.
    ViewMenuOverflow.tsx     extended — Reset's scope widens (§4.4)
                             to clear group + aggregations +
                             expandedGroups in addition to filter +
                             sort. No new menu items added —
                             Collapse-all / Expand-all live in the
                             Group popover header (§4.2), NOT in
                             the toolbar overflow (per §12 Q15
                             resolution: AirTable surfaces these in
                             the popover).
    InlineCellEditor.tsx     UNCHANGED
    SingleSelectPopover.tsx  UNCHANGED
    ConfirmRowDeleteDialog.tsx
                             UNCHANGED
    OptionManagerDialog.tsx  UNCHANGED (Phase 5)
    ConfirmDeleteOptionDialog.tsx
                             UNCHANGED (Phase 5)
  hooks/
    useGridSelection.ts      extended — `rowIds` semantics unchanged
                             (data rows only). One small addition:
                             when the active cell's rowId disappears
                             from `rowIds` between renders (e.g. user
                             collapsed the active group),
                             `useGridSelection` already clamps the
                             active cell to a valid one via the
                             existing `useEffect` in
                             `useGridSelection.ts`. Verified — no
                             change needed; documented as a tested
                             edge case (§4.11).
    useGridRowSelection.ts   UNCHANGED — operates on data rowIds only;
                             group headers don't carry checkboxes
                             (matches AirTable; multi-select-a-group's
                             rows can be done by Shift+Click the
                             first and last data row in the group).
    useGridPointerDrag.ts    extended — when the pointer crosses a
                             group-header row during a drag,
                             `elementFromPoint` returns the group-
                             header `<tr>` which has no
                             `data-row-id` / `data-field-key`. The
                             existing nullish-skip path already
                             handles this; verified, no change.
    useGridKeyboard.ts       UNCHANGED — Cell arrow navigation
                             continues to walk `rowIds`. The visual
                             gap created by a group header is
                             invisible to the keyboard model. Phase
                             6 adds one detail: when the focused
                             group header's chevron is keyboard-
                             targetable, the cell-arrow keys
                             continue to focus data cells; the
                             chevron is reachable by Tab off the
                             grid + Tab back (rolePoint A11y rule).
                             See §4.7.
    useGridEdit.ts           UNCHANGED
    useGridHistory.ts        UNCHANGED — view-state changes don't
                             enter history (constraint 4).
    useGridWriteReducer.ts   UNCHANGED
    useGridClipboard.ts      extended — copy across a range that
                             includes a collapsed-group span emits
                             only the visible data rows (matches
                             AirTable: a collapsed group is "not
                             there" for copy). Group-header rows
                             never appear in the copied TSV / HTML.
                             Verified: today's `useGridClipboard`
                             walks the same `filteredRows` array
                             `GridBody` renders; Phase 6 passes
                             `visibleDataRows` (the post-collapse
                             flat list) instead.
    useSortableRules.ts      UNCHANGED — reused for Group popover's
                             drag handle. The hook's `{fieldKey;
                             direction}` shape matches `GroupRule`
                             exactly (`types.ts:87`).
  fields/
    registry.ts              extended — adds
                             `getAggregationKinds(fieldDef)` and
                             `formatAggregation(kind, values,
                             fieldDef)` exports.
    types.ts                 extended — adds `AggregationKind`
                             (alias of `ViewState`'s map value) and
                             the catalogue / formatter types.
    filterOperators.ts       UNCHANGED
    aggregations.ts          NEW — per-field-type catalogues + the
                             pure `formatAggregation` evaluator.
                             Pattern matches `filterOperators.ts`
                             one-to-one.
  lib.ts                     extended — adds:
                             - `effectiveSortFromView(view)` →
                               returns the sort-rule array used to
                               actually order rows (group rules
                               prefixed, sort rules appended with
                               dedup against group rules).
                             - `buildBodyPlan(rows, columns,
                               fieldDefs, view)` → returns
                               `BodyPlanItem[]` (interleaved
                               group-header + data rows) honoring
                               `view.expandedGroups`.
                             - `aggregateColumn(values, fieldDef,
                               kind)` → thin pass-through to the
                               registry's `formatAggregation`, kept
                               in `lib.ts` so `buildBodyPlan` can
                               compute aggregated values without
                               importing from `fields/`.
                             - `groupPathKey(values)` → builds the
                               stable string key used for
                               `expandedGroups` lookups.
  tokens/
    data-table-tints.ts      NEW — exports
                             `AXIS_ROLE_SUBSETS: readonly
                             AxisRoleSubset[]` (the 7 codes) and a
                             documentation comment describing the
                             CSS variable contract. No runtime
                             values; the tokens themselves live as
                             CSS custom properties in App.css
                             keyed off the subset code.
  types.ts                   `AxisRoleSubset =
                             "f" | "s" | "g" | "fs" | "fg" | "sg" |
                             "fsg"` exported. `data-axis-tint`
                             attribute now carries an AxisRoleSubset
                             (or is absent for untinted columns).
                             `BodyPlanItem` discriminated union
                             added (see §4.6).
  index.ts                   exports the new `AxisRoleSubset` and
                             `AggregationKind` types; the new
                             helpers stay internal.
  __tests__/                 existing tests preserved; new tests
                             added (see §4.11).
```

`App.css` adds (a) 14 CSS variables for the 7-subset palette ×
{body, header}, (b) attribute selectors painting `<th>` and `<td>`
by `data-axis-tint`, (c) group-header `<tr>` styling (chevron,
indent, pill / text, count, aggregation cell alignment), (d) the
Group button styling matching the Phase 4 Filter / Sort buttons.
The Phase 4 two-token rules (`--data-table-tint-filter` etc.) are
**deleted** — their callers move to the new 7-subset tokens.

### 4.2 Group popover surface

Layout, copy, and column order match AirTable's group popover as
walked 2026-05-24 (screenshots saved under
`research/airtable-screenshots/group-popover-2026-05-24/`). The
shell is a `@radix-ui/react-popover` Content (same surface class
as Phase 4's `data-table-view-popover`):

```
┌──────────────────────────────────────────────────────────────────┐
│ Group by  ⓘ                          Collapse all   Expand all   │ ← header row
│ ────────────────────────────────────────────────────────────     │
│                                                                  │
│   [⊙ Field ▾]   [First → Last ▾]   ⋯   🗑                       │ ← rule 1 (depth 0)
│   [⊙ Field ▾]   [First → Last ▾]   ⋯   🗑                       │ ← rule 2 (depth 1)
│   [⊙ Field ▾]   [First → Last ▾]   ⋯   🗑                       │ ← rule 3 (depth 2)
│   [⊙ Field ▾]   [First → Last ▾]   ⋯   🗑                       │ ← rule 4 (depth 3)
│                                                                  │
│ + Add subgroup                                                   │ ← disabled at 4
└──────────────────────────────────────────────────────────────────┘
```

- **Header row** — title `Group by` on the left (plus a small
  `ⓘ` help affordance Phase 6 ships as a no-op slot for future
  documentation; visually present, click-through inert). Right-
  aligned: `Collapse all` / `Expand all` as text-button actions.
  Both call `onViewChange` with a mass-toggled `expandedGroups`
  map (`Collapse all` walks every distinct `pathKey` in the
  current `bodyPlan` and sets each to `false`; `Expand all`
  sets `view.expandedGroups = {}` so every path falls back to
  the default-expanded sentinel — see §4.6 `?? true` fallback).
  Disabled visually when `view.group.length === 0` (no groups
  to collapse).
- **Field picker** — native `<select>` (L10.2). Excludes
  `attachment` / `argb_color`. Excludes fields already in
  `view.group` (mirrors Phase 4 sort §12 Q1). A field can be in
  `view.sort` AND `view.group` simultaneously — the dedup happens
  in the *derived* effective-sort list, not in the user-intent
  pickers.
- **Direction picker** — `First → Last` (asc) / `Last → First`
  (desc). AirTable's literal phrasing on the group popover (vs.
  the `A → Z` / `Z → A` of the Sort popover). The internal
  `GroupRule.direction` union stays `"asc" | "desc"`; only the
  display label differs from the Sort popover. Rationale:
  AirTable distinguishes by axis to communicate intent — sort
  thinks in alphabetical order, group thinks in "which group
  appears first." The plan preserves both phrasings to stay
  faithful to AirTable.
- **Per-rule overflow (⋯)** — placeholder forward-compat slot
  matching the AirTable screenshot. Phase 6 renders the glyph
  but its menu is empty (clicking is a no-op; the disabled
  visual is the on-hover cursor changing to a default arrow,
  not a pointer). A future phase will use this slot for
  per-rule options the parent plan doesn't enumerate (e.g.
  "Hide blank groups", "Use raw values"). The visual reserves
  the horizontal space so adding the menu later doesn't reflow
  the row.
- **Delete (🗑)** — splices the rule from `view.group`. If the
  delete leaves `view.group.length === 0`, the toolbar Group
  button label flips back to `Group`, body re-flattens, all
  group-related `data-axis-tint` codes drop the `g` bit.
- **Drag handle** — reuses `useSortableRules` from Phase 4
  (it's already generic on `{fieldKey; direction}`). Hover-
  visible glyph in the leftmost ~16 px of the row, identical
  presentation to the Sort popover. AirTable's screenshot does
  not show a handle glyph — the entire rule row is the drag
  target. Phase 6 follows the Sort-popover precedent (a small
  hover-visible glyph) for discoverability, since
  `useSortableRules` already wires it that way and the gain in
  affordance clarity is worth the small visual cost.
- **`+ Add subgroup`** — appends a rule whose field is the
  first available (non-attachment / non-argb_color / not already
  grouped). Direction default `asc`. Disabled (button visually
  faded) when `view.group.length === 4` per §12 Q1 resolution
  (Ed: "hard-cap at 4 levels is fine"). The disabled state is
  visual only — no toast / no banner; the cap stays quiet.

### 4.3 Tint cascade — 14-entry palette

#### 4.3.1 Subset codes

The seven non-empty subsets of `{filter, sort, group}` are encoded
as lowercase concatenations of the present axes' first letters,
in fixed order `f < s < g`:

```ts
// types.ts
export type AxisRoleSubset =
  | "f"    // filter only
  | "s"    // sort only
  | "g"    // group only
  | "fs"   // filter + sort
  | "fg"   // filter + group
  | "sg"   // sort + group
  | "fsg"; // filter + sort + group
```

The string-code shape is chosen over a bit field or a
`Set<Axis>` because:
- it serializes directly into the `data-axis-tint` HTML attribute,
  so CSS attribute selectors paint each cell with **zero JS work
  on the render path** (matches Phase 4 §4.10);
- the lexical ordering is deterministic (no `Set` iteration
  ambiguity);
- the seven codes are short enough to compose 14 CSS variable
  names directly (`--data-table-tint-f-body`, etc.).

#### 4.3.2 Per-column subset computation

```ts
// DataTable.tsx — diff
const axisRolesByFieldKey = useMemo<Map<string, AxisRoleSubset>>(() => {
  const map = new Map<string, AxisRoleSubset>();
  const filterContributing = new Set(
    view.filter
      .filter((rule) => isFilterContributing(rule))
      .map((rule) => rule.fieldKey),
  );
  const sortFieldKeys = new Set(view.sort.map((rule) => rule.fieldKey));
  const groupFieldKeys = new Set(view.group.map((rule) => rule.fieldKey));
  for (const fieldDef of fieldDefs) {
    const fk = fieldDef.field_key;
    let code = "";
    if (filterContributing.has(fk)) code += "f";
    if (sortFieldKeys.has(fk)) code += "s";
    if (groupFieldKeys.has(fk)) code += "g";
    if (code) map.set(fk, code as AxisRoleSubset);
  }
  return map;
}, [fieldDefs, view.filter, view.sort, view.group]);
```

The Phase 4 `axisTintByFieldKey` map is **replaced** (not
extended). Callers — `GridHeader.tsx` and `GridBody.tsx` — pass
the subset code straight through to `data-axis-tint`. Their type
parameter widens from `"filter" | "sort"` to `AxisRoleSubset`.

#### 4.3.3 Token names + CSS

```css
/* App.css — 14 tokens.
 *
 * Each subset has a `-body` and `-header` variant. The `-header`
 * variants are ~3% deeper saturation than their body siblings
 * (matches the Phase 4 convention).
 *
 * §12 Q4 resolution: match AirTable. Step 2 samples the actual
 * AirTable swatches for the seven overlap states and updates
 * these values before commit. Single-axis values come from the
 * AirTable filter / sort / group active-state button + active-
 * column tint (the lavender on the group cell column in the
 * 2026-05-24 screenshots is sampled directly into `g-body`).
 * The 2-axis and 3-axis blends are taken from AirTable's own
 * muted-blend chips where visible; the `-fsg` neutral grey is
 * picked to read as "all three axes" without competing with
 * cell content.
 */
:root {
  /* single axes — single-axis tokens carried from Phase 4
   * (filter green, sort peach) plus the Phase 6 group lavender
   * sampled from AirTable's `Grouped by 1 field` active button
   * + the per-column cell tint visible in the walked screenshots
   * (TYPE column cells under the active Group popover). */
  --data-table-tint-f-body:   oklch(96% 0.04 145);    /* green */
  --data-table-tint-f-header: oklch(93% 0.06 145);
  --data-table-tint-s-body:   oklch(95% 0.05 50);     /* peach */
  --data-table-tint-s-header: oklch(91% 0.08 50);
  --data-table-tint-g-body:   oklch(96% 0.03 290);    /* lavender */
  --data-table-tint-g-header: oklch(92% 0.05 290);

  /* two-axis blends */
  --data-table-tint-fs-body:   oklch(94% 0.04 95);    /* green + peach → olive */
  --data-table-tint-fs-header: oklch(90% 0.06 95);
  --data-table-tint-fg-body:   oklch(94% 0.04 220);   /* green + purple → teal */
  --data-table-tint-fg-header: oklch(90% 0.06 220);
  --data-table-tint-sg-body:   oklch(94% 0.04 350);   /* peach + purple → magenta */
  --data-table-tint-sg-header: oklch(90% 0.06 350);

  /* three-axis blend */
  --data-table-tint-fsg-body:   oklch(93% 0.03 280);  /* desaturated cool grey */
  --data-table-tint-fsg-header: oklch(89% 0.05 280);
}

.data-table th[data-axis-tint="f"]   { background: var(--data-table-tint-f-header); }
.data-table th[data-axis-tint="s"]   { background: var(--data-table-tint-s-header); }
.data-table th[data-axis-tint="g"]   { background: var(--data-table-tint-g-header); }
.data-table th[data-axis-tint="fs"]  { background: var(--data-table-tint-fs-header); }
.data-table th[data-axis-tint="fg"]  { background: var(--data-table-tint-fg-header); }
.data-table th[data-axis-tint="sg"]  { background: var(--data-table-tint-sg-header); }
.data-table th[data-axis-tint="fsg"] { background: var(--data-table-tint-fsg-header); }

.data-table td[data-axis-tint="f"]   { background: var(--data-table-tint-f-body); }
.data-table td[data-axis-tint="s"]   { background: var(--data-table-tint-s-body); }
.data-table td[data-axis-tint="g"]   { background: var(--data-table-tint-g-body); }
.data-table td[data-axis-tint="fs"]  { background: var(--data-table-tint-fs-body); }
.data-table td[data-axis-tint="fg"]  { background: var(--data-table-tint-fg-body); }
.data-table td[data-axis-tint="sg"]  { background: var(--data-table-tint-sg-body); }
.data-table td[data-axis-tint="fsg"] { background: var(--data-table-tint-fsg-body); }
```

The Phase 4 `--data-table-tint-filter` / `--data-table-tint-sort`
tokens are removed from `App.css`. The selectors `td[data-axis-
tint="filter"]` and `td[data-axis-tint="sort"]` are removed —
their attribute values no longer occur (Phase 6 emits subset
codes only).

#### 4.3.4 Toolbar button tints

Toolbar buttons keep their **own** axis token only — they do not
participate in the 7-subset palette. Three buttons, three tokens:

```css
.data-table-toolbar-button[data-axis="filter"][data-axis-active="true"] {
  background: var(--data-table-tint-f-body);
}
.data-table-toolbar-button[data-axis="sort"][data-axis-active="true"] {
  background: var(--data-table-tint-s-body);
}
.data-table-toolbar-button[data-axis="group"][data-axis-active="true"] {
  background: var(--data-table-tint-g-body);
}
```

The Phase 4 CSS already covers `filter` / `sort`; only the
`group` selector is new. Token names switched from `-filter` /
`-sort` to `-f-body` / `-s-body` per the rename above — Phase 4's
two rules update inline.

### 4.4 Reset view widening

Phase 4 §4.7 limited Reset to `filter: []` and `sort: []`. Phase
6 widens it to clear every view-state key the toolbar can mutate:

```ts
// DataTable.tsx — diff
const handleResetView = useCallback(() => {
  onViewChange({
    ...view,
    filter: [],
    sort: [],
    group: [],
    aggregations: {},
    expandedGroups: {},
  });
}, [onViewChange, view]);
```

`columnOrder`, `columnWidths`, and `hiddenColumns` are still
**not** cleared by Reset — those are owned by a future column-
config phase and the contract from Phase 4 §4.7 (Reset clears
only what the toolbar exposes) carries through.

### 4.5 Effective sort derivation

```ts
// lib.ts — new
export function effectiveSortFromView(
  view: Pick<ViewState, "group" | "sort">,
): SortRule[] {
  if (view.group.length === 0) return view.sort;
  const groupSort: SortRule[] = view.group.map((rule) => ({
    fieldKey: rule.fieldKey,
    direction: rule.direction,
  }));
  const groupKeys = new Set(groupSort.map((rule) => rule.fieldKey));
  // User-intent `view.sort` is preserved; only the derived list
  // dedups against group rules so a field doesn't appear twice in
  // the effective comparator (L8.3).
  const userSort = view.sort.filter((rule) => !groupKeys.has(rule.fieldKey));
  return [...groupSort, ...userSort];
}
```

In `DataTable.tsx`, the existing `filteredRows` memo swaps
`view.sort` for the derived list:

```ts
const effectiveSort = useMemo(() => effectiveSortFromView(view), [view.group, view.sort]);
const filteredRows = useMemo(
  () => sortRows(
    applyFilters(rows, visibleColumnDefs, fieldDefs, view.filter),
    visibleColumnDefs,
    fieldDefs,
    effectiveSort,
  ),
  [rows, visibleColumnDefs, fieldDefs, view.filter, effectiveSort],
);
```

`sortRows` itself is unchanged — it already walks the rule array
in order and returns the first non-zero comparator result.

### 4.6 Body render plan

The body iterates a flat array of `BodyPlanItem`s rather than the
raw `filteredRows` TRow array. A `BodyPlanItem` is either a
`group` (rendered as a `<GroupHeaderRow>`) or a `data` (rendered
as a normal `<tr>` with cells):

```ts
// types.ts — new
export type BodyPlanItem<TRow> =
  | {
      kind: "group";
      depth: number;          // 0 .. view.group.length - 1
      pathKey: string;        // stable key for expandedGroups lookups
      fieldDef: FieldDef;     // the group's field
      groupValue: unknown;    // the cell value driving this group
      count: number;          // number of data rows under this group
                              // (including descendants in nested groups)
      expanded: boolean;
      aggregatedValues: Map<string, string>;  // fieldKey → formatted display
    }
  | {
      kind: "data";
      row: TRow;
      rowId: string;
      // Resolved depth = view.group.length (one more than the deepest
      // group header). Used for left-indent. Absent when ungrouped.
      depth: number;
    };
```

Build helper:

```ts
// lib.ts — new
export function buildBodyPlan<TRow>(
  rows: TRow[],
  columns: DataTableColumnDef<TRow>[],
  fieldDefs: FieldDef[],
  getRowId: (row: TRow) => string,
  view: ViewState,
): BodyPlanItem<TRow>[] {
  if (view.group.length === 0) {
    return rows.map((row) => ({
      kind: "data",
      row,
      rowId: getRowId(row),
      depth: 0,
    }));
  }
  // `rows` is already pre-sorted via `effectiveSortFromView` so we
  // can scan in one pass and emit group headers whenever the path
  // changes at any level.
  const plan: BodyPlanItem<TRow>[] = [];
  const groupFieldDefs = view.group.map((rule) =>
    fieldDefs.find((f) => f.field_key === rule.fieldKey)!,
  );
  const groupAccessors = view.group.map((rule) =>
    columns.find((c) => c.fieldKey === rule.fieldKey)!.accessor,
  );

  // Precompute aggregated values per group path.
  const aggregatesByPath = computeAggregatesByPath(rows, columns, fieldDefs, view, groupAccessors);

  let prevPath: unknown[] = [];
  for (const row of rows) {
    const path = groupAccessors.map((accessor) => accessor(row));
    // Find the index where the path diverges from the previous row.
    const divergeAt = firstDivergeIndex(prevPath, path);
    if (divergeAt < view.group.length) {
      // Emit group headers for every level from `divergeAt` down to
      // `view.group.length - 1`.
      for (let depth = divergeAt; depth < view.group.length; depth += 1) {
        const subPath = path.slice(0, depth + 1);
        const pathKey = groupPathKey(subPath);
        const expanded = view.expandedGroups[pathKey] ?? true;  // default expanded
        plan.push({
          kind: "group",
          depth,
          pathKey,
          fieldDef: groupFieldDefs[depth],
          groupValue: path[depth],
          count: aggregatesByPath.get(pathKey)?.count ?? 0,
          expanded,
          aggregatedValues: aggregatesByPath.get(pathKey)?.values ?? new Map(),
        });
        if (!expanded) {
          // Skip emission of data rows AND child group headers under
          // this collapsed parent. The outer loop continues at the
          // next row; the collapse-skip is handled by tracking
          // `collapsedAtDepth`.
        }
      }
    }
    if (!isPathFullyExpanded(view.expandedGroups, path)) {
      prevPath = path;
      continue;
    }
    plan.push({
      kind: "data",
      row,
      rowId: getRowId(row),
      depth: view.group.length,
    });
    prevPath = path;
  }
  return plan;
}
```

(The sketch above elides the collapse-skip detail; the actual
implementation tracks the deepest collapsed depth and short-
circuits both data-row emission AND further group-header emission
under that depth.)

`groupPathKey(values)` returns a stable string of the form
`"<JSON.stringify(values[0])>::<JSON.stringify(values[1])>::..."`.
Using JSON-stringified values keeps the key stable across
re-renders without requiring a row-id; the keys ride only in
client state (`view.expandedGroups`) and never reach the backend.

`computeAggregatesByPath` walks `rows` once, accumulating per-path
- row count,
- per-column raw values list (for fields with `view.aggregations`
  set to a non-`none` kind).
At the end, formats each per-column value list via
`formatAggregation` from the registry.

#### 4.6.1 Selection model under grouping

- `rowIds`, the array `useGridSelection` reads, is built from
  **`visibleDataRows`** — the data-row subset of `bodyPlan` —
  not from `filteredRows` directly. A row inside a collapsed
  group is not in `rowIds`, so it cannot host the active cell,
  cannot be checkbox-selected, and cannot be visited by arrow
  keys.
- Collapsing a group whose row hosts the active cell: the
  existing `useGridSelection` clamp (the `useEffect` that
  ensures `activeCell.rowIndex < rowIds.length`) snaps the
  active cell to the nearest valid row. Verified in the existing
  tests (`useGridSelection.test.ts`); add one new test for the
  collapse case.
- Re-expanding a group does not restore the prior active cell —
  the user re-clicks. Acceptable per parent §16 (no auto-
  restore semantics).

#### 4.6.2 Empty groups

If a filter rule narrows a group to zero rows, the group simply
does not appear (its data rows are gone, so the path-divergence
emission never fires). No "empty group" placeholder header.
Matches AirTable.

### 4.7 Group-header row rendering

```tsx
// GroupHeaderRow.tsx — sketch
export type GroupHeaderRowProps<TRow> = {
  depth: number;
  pathKey: string;
  fieldDef: FieldDef;
  groupValue: unknown;
  count: number;
  aggregatedValues: Map<string, string>;
  expanded: boolean;
  visibleColumnDefs: DataTableColumnDef<TRow>[];
  onToggle: (pathKey: string) => void;
};

export function GroupHeaderRow<TRow>({
  depth, pathKey, fieldDef, groupValue, count,
  aggregatedValues, expanded, visibleColumnDefs, onToggle,
}: GroupHeaderRowProps<TRow>) {
  return (
    <tr role="row" className="data-table-group-row" aria-expanded={expanded}>
      <td className="data-table-gutter" aria-hidden />
      <td
        className="data-table-group-header"
        colSpan={1}
        style={{ paddingLeft: `${depth * 8 + 8}px` }}
      >
        <button
          type="button"
          className="data-table-group-chevron"
          aria-label={`${expanded ? "Collapse" : "Expand"} group ${fieldDef.display_name}`}
          onClick={() => onToggle(pathKey)}
        >
          {expanded ? "▼" : "▶"}
        </button>
        <span className="data-table-group-key">
          {renderGroupKey(groupValue, fieldDef)}
        </span>
        <span className="data-table-group-count">
          ({count} {count === 1 ? "row" : "rows"})
        </span>
      </td>
      {visibleColumnDefs.slice(1).map((column) => (
        <td
          key={column.id}
          className="data-table-group-aggregation"
          data-field-key={column.fieldKey}
        >
          {aggregatedValues.get(column.fieldKey) ?? ""}
        </td>
      ))}
    </tr>
  );
}

function renderGroupKey(value: unknown, fieldDef: FieldDef): ReactNode {
  if (fieldDef.field_type === "single_select" && typeof value === "string") {
    const option = fieldDef.options?.find((o) => o.id === value);
    if (option) {
      return (
        <span
          className="single-select-pill"
          style={{ "--option-color": option.color } as CSSProperties}
        >
          {option.label}
        </span>
      );
    }
  }
  if (value === null || value === undefined || value === "") {
    return <span className="muted-cell">Unassigned</span>;
  }
  return formatDisplayCellValue(value, fieldDef);
}
```

The first data column gets the chevron + key + count; every
remaining column gets its own `<td>` aligned with the body cells
so aggregated values sit directly below their column. The
`colSpan={1}` keeps the chevron / key / count contained in the
first column; aggregations fan out across the rest.

(Alternative considered: span the first N columns under the
chevron and only render aggregation `<td>`s for the right edge.
Rejected — AirTable aligns aggregations under their own column,
and the alignment makes "mean iCFA per floor" a one-eye read.)

#### 4.7.1 Keyboard reachability of the chevron

The grid wrapper continues to own the cell-arrow-key dispatch; the
chevron `<button>` is not a grid cell. The chevron is reachable
via Tab off the wrapper into the body (Tab order is document
order; the chevron sits between the toolbar and the first data
row). Pressing Enter / Space on a focused chevron calls
`onToggle`. ARIA: `<tr aria-expanded="true|false">` on the group
header row; the chevron carries `aria-label="Expand group <name>"`
/ `Collapse`. The grid's `aria-live` region (Phase 0 `announce`)
emits `Group <name> collapsed (5 rows hidden)` /
`Group <name> expanded` on toggle.

### 4.8 Aggregation registry

```ts
// fields/aggregations.ts — new
import type { FieldDef } from "../types";

export type AggregationKind = "none" | "count" | "sum" | "mean" | "min" | "max";

export type AggregationDef = {
  kind: AggregationKind;
  label: string;          // submenu display
};

// Pure formatter. Receives the column's raw cell values across the
// group's member rows (already filtered down — no nulls coerced
// to 0). Returns a display string; the caller drops it directly
// into the group header's `<td>`. Empty values arrays yield "" for
// count-style operators and "—" for stat operators.
export type AggregationFormatter = (
  kind: AggregationKind,
  values: readonly unknown[],
  fieldDef: FieldDef,
) => string;

// Per-field-type catalogues. `none` is always implicit (the absence
// of `view.aggregations[fieldKey]` IS `none`); the catalogue lists
// the kinds the user can pick.
export const TEXT_AGGREGATIONS:          readonly AggregationDef[] = [
  { kind: "count", label: "Count" },
] as const;

export const NUMBER_AGGREGATIONS:        readonly AggregationDef[] = [
  { kind: "count", label: "Count" },
  { kind: "sum",   label: "Sum"   },
  { kind: "mean",  label: "Mean"  },
  { kind: "min",   label: "Min"   },
  { kind: "max",   label: "Max"   },
] as const;

export const SINGLE_SELECT_AGGREGATIONS: readonly AggregationDef[] = [
  { kind: "count", label: "Count" },
] as const;

// `computed` with computed_type === "number" reuses NUMBER_AGGREGATIONS;
// otherwise reuses TEXT_AGGREGATIONS (matches the Phase 4 filter pattern).
// `attachment` and `argb_color` return [] (no menu item appears).
export function getAggregationKinds(fieldDef: FieldDef): readonly AggregationDef[] {
  switch (fieldDef.field_type) {
    case "text":          return TEXT_AGGREGATIONS;
    case "number":        return NUMBER_AGGREGATIONS;
    case "single_select": return SINGLE_SELECT_AGGREGATIONS;
    case "computed":
      return fieldDef.computed_type === "number"
        ? NUMBER_AGGREGATIONS
        : TEXT_AGGREGATIONS;
    case "attachment":
    case "argb_color":
      return [];
  }
}

export const formatAggregation: AggregationFormatter = (kind, values, fieldDef) => {
  if (kind === "none") return "";
  if (kind === "count") {
    const n = values.filter((v) => v !== null && v !== undefined && v !== "").length;
    return `${n}`;
  }
  // sum / mean / min / max only apply to numeric fields.
  const nums: number[] = [];
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) nums.push(value);
    else if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) nums.push(parsed);
    }
  }
  if (nums.length === 0) return "—";
  switch (kind) {
    case "sum":  return formatNumber(nums.reduce((a, b) => a + b, 0), fieldDef);
    case "mean": return formatNumber(nums.reduce((a, b) => a + b, 0) / nums.length, fieldDef);
    case "min":  return formatNumber(Math.min(...nums), fieldDef);
    case "max":  return formatNumber(Math.max(...nums), fieldDef);
  }
  return "";
};

function formatNumber(n: number, fieldDef: FieldDef): string {
  // For now, two decimals everywhere — matches RoomsTable's
  // existing `room.icfa_factor.toFixed(2)` display. Future phases
  // can extend FieldDef with a `numberFormat` slot; Phase 6 keeps
  // it minimal.
  return n.toFixed(2);
}
```

The catalogues match the Phase 4 `filterOperators.ts` shape one-
to-one (catalogue tables `as const`, single dispatcher function),
so the registry's three layers — render, edit, filter, aggregate
— now all live in `fields/`.

### 4.9 Aggregation menu item

Phase 5 ships `ColumnHeaderMenu` with this composition (Phase 5
§4.2 sketch):

```tsx
<Popover.Content className="data-table-column-menu" ...>
  {fieldDef.field_type === "single_select" ? (
    <button ...>Edit options…</button>
  ) : null}
  {extraItems?.(fieldDef)}
</Popover.Content>
```

Phase 6 replaces this with:

```tsx
<Popover.Content className="data-table-column-menu" ...>
  {fieldDef.field_type === "single_select" ? (
    <>
      <button ...>Edit options…</button>
      <hr className="data-table-column-menu-divider" />
    </>
  ) : null}
  <AggregationMenuItem
    fieldDef={fieldDef}
    current={view.aggregations[fieldDef.field_key] ?? "none"}
    onPick={(kind) =>
      onViewChange({
        ...view,
        aggregations: { ...view.aggregations, [fieldDef.field_key]: kind },
      })
    }
  />
  {extraItems?.(fieldDef)}
</Popover.Content>
```

`AggregationMenuItem` renders nothing when
`getAggregationKinds(fieldDef).length === 0`. The trigger
visibility rule on the header `<th>` widens to:

```ts
// GridHeader.tsx — diff
const hasOptionEdit = fieldDef.field_type === "single_select" && !readOnly && hasWriteHandler;
const hasAggregation = getAggregationKinds(fieldDef).length > 0;
const showMenu = hasOptionEdit || hasAggregation;
```

Read-only mode: `hasOptionEdit` already gates on `!readOnly` (Phase
5 constraint 11). Aggregation picking, however, is a view-state
change and stays available in read-only mode (constraint 9). So
the menu still renders for readers — just without the Phase 5
item.

#### 4.9.1 AggregationMenuItem layout

```
┌─────────────────────────────┐
│ Aggregation:  Mean      ▾   │  ← clickable; opens sub-popover
└─────────────────────────────┘
       ↓ on click
┌─────────────────────────────┐
│ ◯ None                      │
│ ◯ Count                     │
│ ● Mean                      │
│ ◯ Sum                       │
│ ◯ Min                       │
│ ◯ Max                       │
└─────────────────────────────┘
```

The sub-popover is a small Radix Popover (Phase 5 already imports
`@radix-ui/react-popover` and uses it for the swatch picker —
identical pattern). Clicking a kind closes the sub-popover and
the parent `ColumnHeaderMenu`, and dispatches the new
`view.aggregations`.

`None` clears the entry from `view.aggregations` (delete the key
rather than set to `"none"`, so the view-state map stays tight).

### 4.10 Toolbar `Group ▾` button

Mirrors the Phase 4 Filter / Sort buttons:

```tsx
<GroupPopover
  open={groupOpen}
  onOpenChange={setGroupOpen}
  rules={view.group}
  onGroupChange={(next) =>
    onViewChange({ ...view, group: next, expandedGroups: pruneExpandedGroups(view.expandedGroups, next) })
  }
  groupableFieldDefs={groupableFieldDefs}
  trigger={
    <button
      type="button"
      className="data-table-toolbar-button"
      data-axis="group"
      data-axis-active={view.group.length > 0 ? "true" : undefined}
      aria-label={groupLabel}
    >
      <span className="data-table-toolbar-button-icon" aria-hidden>⊞</span>
      <span>{groupLabel}</span>
    </button>
  }
/>
```

`groupableFieldDefs` is computed in `DataTable.tsx` and matches
the Phase 4 `sortableFieldDefs` rule (exclude `attachment` and
`argb_color`).

`pruneExpandedGroups(map, nextGroup)` removes any
`expandedGroups[pathKey]` whose path length exceeds the new group
depth, since changing the group rule invalidates deeper path
keys. Pure helper in `lib.ts`.

### 4.11 Test plan

Existing tests pass unchanged (Phase 5 baseline). New tests:

- **`__tests__/aggregations.test.ts` (NEW)** — pure evaluator:
  - `formatAggregation("count", values, fieldDef)` counts
    non-empty (null / undefined / `""` are skipped; `0` counts).
  - `sum / mean / min / max` over a mixed `[number, string]`
    values array parse strings; ignore NaN.
  - Empty-values arrays → `"—"` for stat kinds, `"0"` for count.
  - `getAggregationKinds(textField).length === 1` (count only).
  - `getAggregationKinds(computedNumberField).length === 5`.
  - `getAggregationKinds(attachmentField).length === 0`.
- **`__tests__/groupRows.test.ts` (NEW)** — `buildBodyPlan`
  pure coverage:
  - Ungrouped view → plan is a flat data-row sequence with
    `depth: 0`.
  - One group rule with five distinct values → six items
    (one group header + five data rows? no — header per group,
    so `[group, ...rows, group, ...rows, ...]`); verify
    structure.
  - Two-level groups (`floor_level`, `building_zone`) → headers
    interleave correctly; depth 0 at floor changes, depth 1 at
    zone changes.
  - Collapsed parent → no children emitted (data or group
    headers); aggregated values on the collapsed parent still
    reflect its full descendant count.
  - `groupPathKey` returns stable strings for identical paths;
    different across slightly-different paths
    (`[1, "a"]` vs `[1, "b"]`).
  - `effectiveSortFromView` dedups against group rules; group
    rules come first; user-intent `view.sort` survives in the
    user-intent list (verified by reading back).
- **`__tests__/GroupPopover.test.tsx` (NEW)** — component:
  - Renders one row per `view.group` rule.
  - Add Rule appends to `view.group` (asc, first unused field).
  - Drag-reorder (fired via `DndContext.onDragEnd` synthetic
    event — same Phase 4 pattern) updates the rule order.
  - Field picker excludes already-used fields and attachment /
    argb_color.
  - `+ Add subgroup` button disabled at 4 rules.
  - `Collapse all` / `Expand all` header actions dispatch the
    correct `view.expandedGroups` map.
  - Delete `🗑` removes the rule.
- **`__tests__/AggregationMenuItem.test.tsx` (NEW)**:
  - Renders when `getAggregationKinds(fieldDef).length > 0`,
    null otherwise.
  - Lists the kinds in catalogue order.
  - Clicking a kind dispatches `view.aggregations`.
  - "None" deletes the key from `view.aggregations` (not
    `"none"`).
- **`__tests__/DataTable.test.tsx` extensions**:
  - `data-axis-tint` widens from `"filter" | "sort"` to subset
    codes. Replace the Phase 4 single-axis assertions with
    subset-code assertions covering each of the 7 subsets.
  - With a 2-level group active, the body renders interleaved
    group headers (assert by `<tr className="data-table-group-
    row">` count).
  - Toggling a group header's chevron dispatches
    `view.expandedGroups[<pathKey>]`.
  - Reset clears all five toolbar-owned keys (filter, sort,
    group, aggregations, expandedGroups).
  - Paste while grouped surfaces the banner (existing block
    preserved; banner text test).
- **`__tests__/GridBody.test.tsx` extensions**:
  - With a group rule active, group-header rows render with
    chevron, indent, key (pill for single_select), count, and
    per-column aggregation cells.
  - Aggregation cells show the formatted value for fields with
    `view.aggregations[fieldKey]` set; empty otherwise.
- **`__tests__/GridToolbar.test.tsx` extensions**:
  - `Group ▾` button renders with rule count label.
  - Active state: `data-axis-active="true"` when
    `view.group.length > 0`.
  - Overflow `⋯` keeps only `Reset view`; Reset clears the
    widened key set (filter / sort / group / aggregations /
    expandedGroups). Collapse-all / Expand-all are NOT in the
    overflow (they live in the Group popover header per §4.2).

Existing Phase 4 `applyFilters` / `filterOperators` tests stay
green. The Phase 4 `axisTintByFieldKey` → `axisRolesByFieldKey`
rename is a mechanical update in `DataTable.test.tsx`'s axis-
tint assertions; the operator + dormant-rule tests are
unaffected.

### 4.12 Backward-compatibility notes

- `ViewState.group`, `aggregations`, `expandedGroups` already
  exist (`types.ts:95–100`), so the field-shape is non-breaking.
- The `data-axis-tint` attribute's value type changes from
  `"filter" | "sort" | undefined` to `AxisRoleSubset | undefined`.
  External callers that read this attribute (none in-repo;
  verified by `grep -rn "data-axis-tint" frontend/src/`) would
  break, but there are no such callers.
- The Phase 4 `axisTintByFieldKey` prop on `GridHeader` /
  `GridBody` becomes `axisRolesByFieldKey` with a widened value
  type. Pure internal rename.
- `ColumnHeaderMenu`'s trigger visibility rule changes from
  "single_select only" to "≥1 menu item." Phase 5 already
  documents the `extraItems?` slot as forward-compat for this
  expansion (§5 §10 Q10 resolution), so no Phase-5 contract is
  broken.

## 5. Execution order

Six steps. Each leaves the tree green (`make test`, `make
typecheck`, `make lint`). Commit per step.

### Step 1 — Aggregation registry + group-derivation lib

- Create `fields/aggregations.ts` per §4.8: catalogues +
  `getAggregationKinds` + `formatAggregation`.
- Re-export from `fields/registry.ts` (matches the Phase 4
  filter-operator pattern).
- Add `effectiveSortFromView`, `buildBodyPlan`, `groupPathKey`,
  `pruneExpandedGroups`, and `computeAggregatesByPath` to
  `lib.ts` per §4.5–§4.6.
- Add `BodyPlanItem<TRow>` and `AxisRoleSubset` to `types.ts`.
- Test: `__tests__/aggregations.test.ts`,
  `__tests__/groupRows.test.ts`.
- At this step, no UI changes are visible. The library can
  derive group plans + aggregations against a hand-built
  `ViewState`.

### Step 2 — Tint cascade tokens + axis-roles plumbing

- Create `tokens/data-table-tints.ts` with the
  `AXIS_ROLE_SUBSETS` const and the contract doc.
- Replace `axisTintByFieldKey` with `axisRolesByFieldKey` in
  `DataTable.tsx`, threading subset codes (§4.3.2). Widen the
  attribute value at the `<th>` and `<td>` emission sites
  (`GridHeader.tsx` and `GridBody.tsx`).
- Delete the Phase 4 `--data-table-tint-filter` /
  `--data-table-tint-sort` tokens from `App.css`; add the 14
  new tokens per §4.3.3.
- Sample AirTable's seven overlap swatches via DevTools (mirrors
  Phase 4 §12 Q10 resolution) and update the OKLCH literals
  before commit. The 3-axis blend (`-fsg`) lacks a direct
  AirTable equivalent — pick a desaturated cool grey that reads
  as "this column carries everything" without competing with
  the cell's content.
- Test: `__tests__/DataTable.test.tsx` extensions for the
  subset-code assertions; visually verify each subset's CSS
  paint via Playwright MCP screenshot snippets.
- At this step, the tint palette is final. Any externally-set
  `view.group` produces the correct subset code on each column,
  but the user has no UI to set group yet. Verify by hand-
  setting view state in a Playwright session.

### Step 3 — Group popover + toolbar button

- Create `components/GroupPopover.tsx` per §4.2 (reuses
  `useSortableRules` from Phase 4).
- Add the `Group ▾` button to `GridToolbar.tsx` per §4.10.
  Remove the now-redundant `Ungrouped` status chip from the
  toolbar's left side.
- Wire `view.group`, `onViewChange`, and `groupableFieldDefs`
  through `DataTable.tsx`.
- Test: `__tests__/GroupPopover.test.tsx`,
  `__tests__/GridToolbar.test.tsx` extensions for the Group
  button.
- At this step, the user can build a group stack via the
  popover; the row order changes (via effective-sort pre-sort)
  but the body still renders as a flat list (no headers yet).
  Verify §10 steps 1–2, 5 work; step 3 (accordion) is still
  pending.

### Step 4 — Group accordion body rendering

- Create `components/GroupHeaderRow.tsx` per §4.7.
- Extend `GridBody.tsx` to accept `bodyPlan` instead of
  `tableRows`, walk the plan, and render the right `<tr>` per
  item. The TanStack `table.getRowModel()` calls remain for the
  underlying cell content (`flexRender(cell.column.columnDef.cell, ...)`)
  but the iteration target switches to `bodyPlan`.
- Wire `DataTable.tsx` to compute `bodyPlan` via `buildBodyPlan`
  and thread it down.
- Wire the chevron's onToggle to `onViewChange` with
  `expandedGroups` flipped at `pathKey`.
- Update `useGridClipboard` to walk `visibleDataRows` (the
  data-row subset of `bodyPlan`) rather than `filteredRows`,
  so collapsed-group rows aren't copied (§4.1 hook entry).
- Test: `__tests__/GridBody.test.tsx` extensions for group-
  header rendering;
  `__tests__/DataTable.test.tsx` extension for chevron-toggle
  dispatching.
- At this step, the user can group, the accordion renders,
  chevrons toggle, and collapsed groups hide their members.
  Aggregated values are empty strings (Step 5 fills them).
  Verify §10 steps 1–8 in browser.

### Step 5 — Aggregation picker in ColumnHeaderMenu

- Create `components/AggregationMenuItem.tsx` per §4.9.1.
- Extend `ColumnHeaderMenu.tsx` per §4.9: widen the trigger
  visibility rule, add the divider, render
  `AggregationMenuItem` above any `extraItems?` output.
- Wire `DataTable.tsx` to thread `view.aggregations` +
  `onViewChange` into the menu (the menu props grow two new
  fields). `RoomsTable.tsx` is unaffected — the menu lives in
  the library and consumes view state straight from
  `DataTable.tsx`.
- Test: `__tests__/AggregationMenuItem.test.tsx`,
  `__tests__/ColumnHeaderMenu.test.tsx` extensions for the
  widened visibility rule.
- At this step, every Phase 6 acceptance criterion is met.
  Verify §10 steps 9–14 in browser. Run the full Phase 0–5
  regression walk.

### Step 6 — Demo walk + post-walk fixes

- Run `make typecheck && make lint && make test && make
  format`. Run `pnpm run build`.
- `pnpm run dev`, walk §10 end-to-end in Chrome and Safari.
  Record pass/fail in §11.
- Commit any post-walk fixes as a final commit. Recent phases
  have needed 0–3 fixes; budget 1–2 here. Likely candidates:
  the 3-axis blend hue (the placeholder in §4.3.3 is a guess —
  visual sampling against the demo walk will refine it), and
  the chevron's tab-order vs. the column-select strip's hit
  zone.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `buildBodyPlan`'s one-pass scan misses an edge case (e.g. the very first row's group emission, or two consecutive identical paths with a row whose path differs only at depth N>0). | Unit-test exhaustively (`__tests__/groupRows.test.ts`). The `firstDivergeIndex` helper is the linchpin; cover (a) all paths identical, (b) divergence at depth 0, (c) divergence at last depth, (d) re-converging path after divergence. |
| `view.expandedGroups` accumulates stale keys when the user changes the group stack (e.g. groups by `floor_level`, expands a few, then ungroups and re-groups by `building_zone`). The stale keys live in state forever. | `pruneExpandedGroups(map, nextGroup)` runs on every `onGroupChange` and drops keys whose path length exceeds the new group depth. Acceptable to leave keys whose depth still fits but whose value is stale (e.g. group changes from `floor_level` to `building_zone` at depth 0 — old `"opt_first"` key persists until next reset). Acceptable per §16. |
| The 7-subset CSS palette balloons App.css with 14 tokens whose hues require visual sampling. | Step 2 samples once during commit; the placeholders in §4.3.3 are documented as such. Future phases can adjust without contract changes. The cross-subset readability rule is "every overlap should be visibly distinct AND keep cell content readable" — sampled against a low-saturation baseline keeps both invariants. |
| `data-axis-tint` widening from 2-value to 7-value union breaks an external consumer's CSS. | No external consumers; `grep -rn 'data-axis-tint' frontend/src/` returns only the library's own selectors. Phase 4's two-value union is a strict subset of Phase 6's seven-value union if you map `"filter" → "f"` and `"sort" → "s"`; CSS authors who somehow targeted the old values can update mechanically. |
| `axisRolesByFieldKey` is recomputed on every render of `view.filter` / `view.sort` / `view.group` change. | Already memoized via the dependency array (§4.3.2). Identity of the returned `Map` changes only when the inputs change. |
| Selection across collapsed groups misbehaves — user Shift+Clicks a row at the top of a long table, then collapses a group between top and bottom, then Shift+Clicks a row at the bottom. The selection range now includes rows that are visually hidden but indexed. | Selection is driven by `rowIds` which comes from `visibleDataRows`; collapsed-group rows are excluded from `rowIds`. The user's Shift+Click extends only across visible data rows. Matches AirTable. |
| Group + filter compose ambiguously — does a filter narrow the rows within a group, or hide entire groups whose rows are all filtered out? | Filter runs first (`applyFilters` → `sortRows` → `buildBodyPlan`). A group whose member rows all fail the filter simply doesn't appear in `bodyPlan` (no rows of that path → no path divergence → no header emission). Matches AirTable. |
| Aggregation across a single-select column doesn't have a sensible numeric meaning — what does `sum(floor_level)` mean? | `getAggregationKinds(single_select)` returns `[count]` only. Other kinds aren't selectable. Tested. |
| User picks `sum` on a number column whose values include NaN or empty strings — naively summing yields NaN. | `formatAggregation` filters to finite numbers (and tries `Number()` on strings); empty result → `"—"`. Tested. |
| Group direction `desc` with the existing `sortRows` comparator over a single_select field — `sortRows` already maps to option-order ascending; does negating it for desc work? | Existing `sortRows` already handles the `direction === "desc"` case for all field types (`result !== 0 ? rule.direction === "asc" ? result : -result`). The single_select option-order path inherits this. Tested in Phase 0 / 4 already; spot-check in Step 4. |
| `formatAggregation` reads `fieldDef.options` for single_select aggregations but `count` doesn't actually need it. | Acceptable — the formatter accepts the fieldDef for forward-compat (a future "most common" aggregation could read it). Today's `count` ignores it. |
| `useGridClipboard` reads `filteredRows` instead of `visibleDataRows` — a copy across a range that spans a collapsed group includes the hidden rows. | Step 4 swaps the clipboard's input to `visibleDataRows`. Tested by an explicit "copy spans collapsed group" assertion in `useGridClipboard.test.ts`. |
| Group-header `<tr>` triggers `useGridPointerDrag.onCellMouseDown` and breaks the column-select gesture. | Group headers omit `onMouseDown` and have no `data-row-id` / `data-field-key`. `elementFromPoint` returns the `<tr>` which the drag hook already null-skips. Verified. |
| Active cell lands on a row that's about to be collapsed; `useGridSelection`'s clamp may move it to an unexpected location. | The existing clamp moves the active cell to `{rowIndex: min(activeCell.rowIndex, rowIds.length - 1), columnIndex: activeCell.columnIndex}`. On a collapse that removes the only visible rows, `rowIds.length === 0` and the active cell becomes `{0, c}`; consumers handle "no active row" gracefully (the cell's `data-row-id` is undefined, so no row gets the active highlight). Tested. |
| Tint visual hierarchy collapses — the 3-axis blend (`-fsg`) reads as the same neutral grey as the unfiltered row hover. | The 3-axis blend uses an explicit OKLCH literal distinct from the hover token (`--bg-hover` ≈ 96% lightness, neutral hue). Sample step in Step 2 validates against the live grid. |
| `ColumnHeaderMenu` trigger visibility rule generalization conflicts with Phase 5's tests that assert the trigger is single_select-only. | Phase 5's `ColumnHeaderMenu.test.tsx` (per its §4.11) asserts the trigger renders for single_select and NOT for other field types. Phase 6 changes the rule, so the existing test reverses its assertion: trigger renders whenever the field has ≥1 menu item, which includes every aggregatable field. Update the test in Step 5. |
| `view.group` changes invalidate aggregated-value memoization too aggressively (rebuild every aggregation on every chevron toggle). | `computeAggregatesByPath` depends only on `rows`, `columns`, `fieldDefs`, `view.group`, and `view.aggregations` — NOT on `view.expandedGroups`. Memoize separately from `buildBodyPlan`'s expanded-state walk so chevron toggles only re-run the cheap interleaving pass. |
| The `Ungrouped` chip removal leaves the toolbar status row visually thin. | The `Editable / Read-only` chip stays; the visual balance with three right-aligned buttons + overflow stays the same. Verified visually in Step 3. |
| `useSortableRules<GroupRule>` requires a generic type instance the hook doesn't expose. | The hook is already generic over `{fieldKey; direction}`-shaped rules (Phase 4's filter rules don't use it; sort rules do). `GroupRule` matches the shape; one-line callsite. |
| Cap of 4 group levels surprises a user who's used to AirTable's effective-infinite stack. | §12 Q1 records the choice. AirTable in practice rarely goes past 3–4; 4 covers every Rooms / Equipment / Catalog use case Ed has walked. The cap can be relaxed in a future phase without contract changes. The popover surfaces the cap via the disabled `+ Add subgroup` button — not as a silent error. |

## 7. What this phase explicitly does not do

- **No grand-total footer row.** AirTable surfaces per-column
  aggregations both in group headers AND in a fixed bottom
  footer row across the entire visible result set. Phase 6
  ships only the group-header aggregations. A future phase can
  add a `data-table-grand-total` footer `<tr>` reusing the same
  registry; not Phase 6.
- **No OR mode in filters.** Parent §16 defers.
- **No persistence of `view.group` / `view.aggregations` /
  `view.expandedGroups`.** Same in-memory rule as Phase 4 (US-
  Builder-Tables criterion 3).
- **No dark-mode tint palette.** Parent §12 ("Deferred — Dark-
  mode tint palette"). Phase 6 ships light mode only. The
  CSS variables live under `:root` only; dark mode would add a
  `[data-theme="dark"]` selector with 14 alternate values.
- **No fill-handle integration with grouping.** Phase 7 will
  disable fill while grouped, matching the existing paste
  block.
- **No row-drag-to-reorder within or across groups.** AirTable
  allows it (drag a row from one floor group to another to
  change its floor_level). PH-Navigator's data model treats
  group keys as fields like any other; a future phase can wire
  drag-to-reassign without a contract change.
- **No "Hide column" / "Pin column" / "Resize column" items in
  the `⋯` menu.** Future column-config phase owns these. Phase
  6's menu has at most `Edit options…` + `Aggregation:` +
  (Phase 5's empty) `extraItems?` slot.
- **No undo for view-state changes.** ⌘Z does not roll back
  group / aggregation / expand-state mutations. Matches Phase
  4 §7 and AirTable.
- **No "Collapse all under this level" / "Expand to depth N"
  controls.** Two binary actions only: collapse everything,
  expand everything. A future phase can extend.
- **No keyboard shortcut for the chevron.** The chevron is Tab-
  reachable but no global shortcut (e.g. ⌥↑ / ⌥↓) collapses /
  expands. AirTable has no shortcut here either.
- **No virtualization.** Phase 6 renders every visible row
  (collapsed groups hide their members from the DOM via the
  body-plan walk, so a 1000-row table grouped into 10 floors
  with 1 floor expanded shows ~100 data rows + 10 group
  headers — well within unvirtualized React's comfort zone).
  Catalog migration may surface the need for virtualization;
  not Phase 6.
- **No per-group sub-aggregations vs. parent-aggregations
  toggle.** A group's `mean` is computed across all descendant
  data rows, including those under collapsed inner groups. No
  UI to toggle "this level's direct children only" vs. "all
  descendants." AirTable matches.
- **No CSV export of grouped data.** Existing ⌘C copies the
  visible data rows as TSV / HTML (Phase 0 contract). Future
  export work — including a "Copy with group headers" mode —
  belongs in a separate phase.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — aggregation registry + group derivation lib | 2.0 | 3.0 |
| 2 — tint cascade tokens + axis-roles plumbing   | 2.0 | 3.0 |
| 3 — group popover + toolbar button              | 2.5 | 3.5 |
| 4 — group accordion body rendering              | 4.0 | 6.0 |
| 5 — aggregation picker in ColumnHeaderMenu      | 2.0 | 3.0 |
| 6 — demo walk + post-walk fixes                 | 1.5 | 2.0 |
| **Total**                                       | **14.0** | **20.5** |

Parent plan budgeted 14–20; the estimate's high end pushes 0.5
hr past, allowing for:

- The body-plan walker (`buildBodyPlan`) in Step 1 / 4 is the
  trickiest pure helper of the phase. The interleaving logic
  has more edge cases than the Phase 4 filter evaluator (depth-
  N divergence; collapse-skip; aggregated-value precomputation;
  path-key stability). Step 4's 6 hr high reflects this.
- Sampling the seven tint hues in Step 2 against live AirTable
  swatches is mostly a DevTools-and-eyeballs exercise; the
  three blended hues (`-fs`, `-fg`, `-sg`) and the 3-axis blend
  (`-fsg`) lack direct AirTable equivalents and benefit from a
  brief Ed walk-through.
- Step 5's `ColumnHeaderMenu` widening is small but touches
  Phase 5's still-in-flight code — coordinate with whoever's
  finishing Phase 5 so the trigger-visibility rule generalizes
  in one commit rather than two.

The 6 hr high on Step 4 is the largest single allocation; expect
it to absorb any one-off React-key / TanStack-row-model
adjustment when group rows interleave with data rows.

## 9. Commit plan

One commit per step. Subject prefixes match the data-table
convention from Phases 0–5:

1. `feat(data-table): aggregation registry + group derivation helpers`
2. `feat(data-table): 7-subset axis-roles tint cascade`
3. `feat(data-table): stacked group toolbar popover`
4. `feat(data-table): group accordion body rendering`
5. `feat(data-table): per-column aggregation picker`
6. `chore(data-table): Phase 6 demo fixes` (only if post-walk
   polish is needed; otherwise omit and let Step 5 be the closer)

## 10. Demo script

After Step 5 (or Step 6 if polish landed), walk this end-to-end
against Rooms in a fresh browser session. Record pass/fail in
§11. Repeat in Safari.

1. `make dev` → Postgres up. `make backend` + `make frontend`.
2. Sign in as editor, open any project with ≥6 rooms spread
   across ≥2 floor levels and ≥2 building zones. Navigate to
   Equipment → Rooms.
3. **Toolbar layout.** Confirm the toolbar shows
   `Filter ▾ · Sort ▾ · Group ▾ · ⋯`. The `Ungrouped` chip is
   gone; the `Editable` chip remains on the left.
4. **Single-level group.** Click `Group ▾` → `+ Add subgroup`.
   Pick `floor_level`, direction `First → Last`. Body re-
   renders with group-header `<tr>`s; each floor's pill
   appears at the start of its header, followed by `(N rooms)`.
   The `floor_level` column tints lavender (`g` subset). The
   toolbar `Group ▾` button tints lavender.
5. **Two-level group.** Add a second rule:
   `building_zone, First → Last`. Body re-renders with floor-
   level headers at depth 0 and zone headers at depth 1 (8 px
   indent). Data rows are at depth 2 (16 px indent). The
   `building_zone` column tints lavender alongside
   `floor_level`.
   Toolbar label reads `Grouped by 2 fields`.
6. **Reorder via drag.** In the Group popover, drag the
   `building_zone` rule above `floor_level`. Body re-renders
   with `building_zone` as the outer group; the toolbar label
   updates.
7. **Collapse / expand chevrons.** Click the chevron on the
   first group header. Its members collapse; the chevron
   flips to `▶`. Click again → re-expand. Confirm
   `view.expandedGroups[<pathKey>]` round-trips through
   `onViewChange` by reading window.localStorage or a
   visible diff.
8. **Collapse all / Expand all in the Group popover header.**
   Open `Group ▾`. Click `Collapse all` (top-right of the
   popover header). Every group collapses; only group-header
   rows remain visible. Re-open `Group ▾` (or it stays open),
   click `Expand all` → every group expands. The toolbar `⋯`
   overflow does NOT carry these actions (§12 Q15).
9. **Aggregation: mean on iCFA.** Open the `⋯` menu on the
   `iCFA` column header. The menu shows
   `Aggregation: None ▾` (with no `Edit options…` because
   iCFA is a number, not single_select). Click the
   `Aggregation:` row → the sub-popover lists
   `None / Count / Sum / Mean / Min / Max`. Pick `Mean`. Sub-
   popover closes; menu closes; group headers now show the
   mean iCFA per group in the iCFA column's `<td>`. Numbers
   render to two decimals.
10. **Aggregation: count on Name.** Open `⋯` on the Name
    column. The submenu shows only `None / Count` (text field).
    Pick `Count`. Each group header's Name column shows the
    row count for that group.
11. **Single-select aggregation.** Open `⋯` on `floor_level`.
    The submenu shows `Edit options…` then a divider then
    `Aggregation: None ▾` with only `None / Count`. Pick
    `Count`. Group headers' `floor_level` cell shows the row
    count.
12. **Full tint cascade — single axes.** Verify by toggling
    each axis in isolation against a single column:
    - Add filter `num_people > 1` (contributing) → `num_people`
      tints green (`f`).
    - Remove the filter; add sort `number asc` → `number`
      tints peach (`s`).
    - Remove the sort; group is still active from earlier →
      `floor_level` + `building_zone` tint lavender (`g`).
13. **Full tint cascade — overlaps.** Add back all three:
    - filter `num_people > 1`
    - sort `number asc`
    - group `floor_level asc`, `building_zone asc`
    Then add filter `floor_level is any of [Ground]` →
    `floor_level` is now in filter (contributing) + group, so
    its tint flips to the `fg` (teal-blend) token. Add sort
    `floor_level asc` → `floor_level` user-intent sort exists
    but the effective sort dedups; the tint flips to `fsg`
    (cool grey blend) because all three user-intent lists carry
    `floor_level`. Visually confirm the three single-axis cells
    (green / peach / lavender) and the three blend cells (teal /
    olive / magenta / grey) are distinct.
14. **Reset view widening.** Click `⋯` → `Reset view`. All
    rule stacks clear; all tints clear; the accordion is gone;
    `view.aggregations` is `{}`; `view.expandedGroups` is `{}`.
    Column order / hidden columns untouched.
15. **Paste while grouped — banner.** Re-add a group rule.
    Focus a single cell, ⌘V → an `Ungroup to paste` toast /
    banner surfaces (existing block carried through Phase 6;
    the message text is the only refinement).
16. **Read-only mode.** Sign in as Viewer (or open a locked
    version). Group + aggregation popovers all open; their
    edits flow through `onViewChange`. The `⋯` column menu
    shows the Aggregation submenu but not `Edit options…`
    (Phase 5 gating still applies). Inline edit / paste /
    delete-N all blocked from Phase 2.
17. **No Phase 0/1/2/3/4/5 regressions.** Inline edit, paste,
    row insert / delete, mouse-drag selection, ⌘C, ⌘V, Phase 4
    filter / sort popovers, Phase 5 option editor + delete-
    cascade all work unchanged. Selection inside a tinted +
    grouped column composites cleanly: tint base + selection
    overlay + focus outline.
18. **Type-checks / lint / tests / build.** Run `make
    typecheck && make lint && make test && pnpm run build`
    in a separate terminal — everything clean.
19. **Safari walk.** Repeat steps 4, 7, 9, 13, 14, 15 in
    Safari. Pay special attention to the chevron's focus
    behaviour after a collapse (Safari's focus restoration
    has historically been fussier than Chrome's; Phase 2 and
    Phase 5 both folded one fix each).

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — aggregation registry + group derivation lib  | 2026-05-24 | code-only | 9 aggregation + 19 body-plan tests. |
| 2 — tint cascade tokens + axis-roles plumbing    | 2026-05-24 | code-only | 14 CSS tokens; DataTable axis-tint tests rewired to subset codes. |
| 3 — group popover + toolbar button               | 2026-05-24 | code-only | New GroupPopover + Group ▾ button; Reset widens to clear all five toolbar-owned keys. |
| 4 — group accordion body rendering               | 2026-05-24 | code-only | GridBody walks bodyPlan; visibleDataRows drives selection / clipboard / row insert. |
| 5 — aggregation picker in ColumnHeaderMenu       | 2026-05-24 | code-only | `⋯` trigger now appears on every aggregatable column; AggregationMenuItem with submenu. |
| 6 — demo walk + post-walk fixes                  | 2026-05-24 | not run    | Manual browser walk deferred to the human reviewer; verified via 325-test suite + clean lint + clean build + Prettier check. |
| Phase 6 overall                                  | 2026-05-24 | code-only | All five steps merged; tint cascade, group accordion, and per-column aggregations shipped against the data-table library with zero consumer changes. |

## 12. Open questions — resolved 2026-05-24

Ed walked the fourteen open questions on 2026-05-24 (and added
one more on the Collapse / Expand surface, recorded as Q15
inline). Resolutions below; material UX deltas vs. the original
defaults are repeated in the STATUS frontmatter.

1. **Group-level cap.** RESOLVED. **Hard cap at 4 levels.** The
   `+ Add subgroup` button disables when `view.group.length === 4`.
   No banner / no toast — visual state only. §4.2 updated.

2. **Group direction labels.** RESOLVED. **`First → Last` /
   `Last → First`**, verbatim from the AirTable group popover
   walked 2026-05-24. The internal `GroupRule.direction` union
   stays `"asc" | "desc"`; only the user-facing label differs
   from the Sort popover (which keeps `A → Z` / `Z → A` per
   AirTable's own sort phrasing). §4.2 updated.

3. **Default aggregation kind.** RESOLVED. **No auto-populate.**
   `view.aggregations` starts empty; the user picks per column
   from the `⋯` menu. §4.6 unchanged.

4. **Tint palette — sample or compute.** RESOLVED. **Match
   AirTable; sample the real swatches.** §4.3.3's literals are
   placeholders; Step 2 updates them to match the AirTable
   walked screenshots:
   - `g-body` / `g-header` — sample the lavender visible on
     the active `Grouped by 1 field` button + the per-column
     `TYPE` cell tint. §4.3.3 updates: the `g` token shifts
     from a placeholder OKLCH-295 purple to a lighter
     lavender ≈ OKLCH 96% 0.03 290.
   - `f-body` / `f-header` — re-confirm the Phase 4 sampled
     green.
   - `s-body` / `s-header` — re-confirm the Phase 4 sampled
     peach.
   - `fs` / `fg` / `sg` / `fsg` — AirTable's screenshots
     don't carry every overlap; Step 2 picks each blend so
     it (a) reads as the present axes' sum, (b) stays
     distinct from every single-axis token, (c) keeps cell
     content readable. §4.3.3's blend OKLCH values are the
     starting baseline.

5. **Aggregation visibility on read-only text fields.**
   RESOLVED. **Show `count` for every text field, including
   read-only.** `erv_unit_ids` will surface a Count item.
   §4.8 unchanged.

6. **`expandedGroups` default.** RESOLVED. **All expanded by
   default.** §4.6's `?? true` fallback unchanged.

7. **Group header row click target.** RESOLVED. **Chevron
   only.** The rest of the row is non-interactive (aside from
   the aggregation cells, which the user can ⌘C-copy from once
   range selection lands on them). §4.7 unchanged.

8. **Cross-browser verification gating.** RESOLVED. **Chrome
   + Safari only; no Firefox.** Matches Phases 3 / 4 / 5.

9. **Aggregation sub-popover surface.** RESOLVED. **Separate
   Radix Popover anchored to the menu item.** Matches Phase
   5's swatch picker pattern. §4.9.1 unchanged.

10. **`buildBodyPlan` memoization.** RESOLVED. **Split memos.**
    One memo for `aggregatedByPath` (deps: rows, columns,
    fieldDefs, view.group, view.aggregations); a second memo
    for `bodyPlan` (deps: rows, view.group, view.expandedGroups,
    aggregatedByPath). Chevron toggles re-run only the cheap
    interleaving walk. §4.6 updated to reference the split.

11. **Aggregation kinds beyond the parent §12 list.** RESOLVED.
    **Stick to the parent §12 list:** `none / count / sum /
    mean / min / max`. No median / count_unique / stddev /
    range. §4.8 unchanged.

12. **Number aggregation format.** RESOLVED. **Two decimals**
    (`n.toFixed(2)`). Future phase can add a `numberFormat`
    slot on FieldDef. §4.8 unchanged.

13. **`view.sort` deduplication against `view.group`.**
    RESOLVED. **Keep in user-intent; drop only in derived
    effective sort.** A user who removes the group rule
    expects the sort to still apply. §4.5 unchanged.

14. **Group accordion row height.** RESOLVED. **Match the
    data-row height (32 px) for now.** A future phase can
    revisit. §4.7's CSS sketch unchanged.

15. **Collapse all / Expand all surface — toolbar overflow or
    Group popover header?** RESOLVED (walked alongside the
    above). **Group popover header**, top-right text actions,
    matching the walked AirTable screenshot. The toolbar `⋯`
    overflow keeps only its existing `Reset view` item plus
    Phase 6's broadened Reset scope. §4.2 documents the
    popover-header layout; §4.10 documents the toolbar carry-
    over.

Additional surface details captured from the walked
screenshots that don't fit a clean Q/A but are folded into the
plan inline:

- The Group popover header carries a small `ⓘ` help glyph next
  to `Group by`. Phase 6 renders the glyph as a no-op slot —
  the future help content is out of scope.
- Each rule row carries a per-rule `⋯` overflow placeholder
  glyph (see screenshot). Phase 6 renders the glyph but the
  menu is empty / click is inert. Reserves space for a future
  per-rule options menu.
- The AirTable popover footer has a small text strip
  ("Summarize your records further with a pivot table in an
  interface dashboard layout"). Phase 6 omits this entirely —
  it's an AirTable-product cross-link that has no analog in
  PH-Navigator.

## 13. Parent-plan delta

This Phase 6 plan implements parent §12 verbatim with three
expansions worth recording:

- **Parent §12 "14-entry pre-mixed tint palette"** is realized
  as 7 subset codes × 2 variants (body + header) = 14 CSS
  variables. §4.3.3 sketches the literals; Step 2 samples the
  real values against AirTable.

- **Parent §12 "Per-column aggregation picker in column header
  `⋯` menu"** rides on Phase 5's `ColumnHeaderMenu`
  infrastructure. Phase 6 widens that menu's trigger-visibility
  rule from "single_select only" to "any field with ≥1 menu
  item." Phase 5's `extraItems?` slot stays as forward-compat
  for column-config additions further down.

- **Parent §12 "Paste-while-grouped stays disabled (already
  wired); banner *"Ungroup to paste"*"** — Phase 6 promotes the
  toolbar's current `Ungrouped` / `Ungroup to paste` chip into
  a body-level banner that only appears on a paste attempt
  while grouped. The toolbar chip is removed; the `Group ▾`
  button label carries the same information more clearly.

Status table update (post-Step 5 sign-off): the parent plan's
§18 should add a row for Phase 6 with the sign-off date and a
one-line note matching Phases 1–5's style. Suggested entry:

> | 6 | YYYY-MM-DD | ✅ YYYY-MM-DD | All N steps landed; M tests
> passing; Group ▾ popover + 2-level accordion + 14-entry tint
> cascade + per-column aggregation picker shipped against the
> Rooms demo. Phase 4's filter-wins-on-overlap rule is removed
> — tint cascade now covers all 7 subsets of {filter, sort,
> group}. Phase 5's ColumnHeaderMenu visibility widens from
> single_select-only to any-aggregatable-field. Catalog
> migration unblocked; only Phase 7 (fill handle) remains
> before the AirTable parity gate is fully closed. |

After Phase 6 lands, parent plan §3 sequencing rule 6
(toolbar-as-mutation-channel) covers all three axes; rule 5
(one write primitive) is unchanged (view-state mutations stay
out of the write reducer); rule 4 (in-memory undo) still
applies only to data writes, with view-state changes
intentionally non-undoable.
