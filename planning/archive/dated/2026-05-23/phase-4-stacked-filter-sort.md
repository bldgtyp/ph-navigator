---
DATE: 2026-05-23
TIME: planning
STATUS: Walked with Ed 2026-05-23; all ten §12 open questions resolved
        inline. Ready to begin Step 1.
SCOPE: Phase 4 of the `<DataTable>` AirTable-parity plan. Stacked
       filter + sort toolbar popovers wired to user-intent `ViewState`
       (PoC L8.1), modeled visually and behaviorally on AirTable.
       Per-field-type operator sets via the field registry (L2.3),
       one mutation channel per axis (L8.2),
       dormant-row-passes-everything semantics (L8.4), drag-to-reorder
       within each popover, and a Reset action. **Per-axis cell tint**:
       filter active → green button + green column cells; sort active
       → peach button + peach column cells. **Header-click sort is
       removed**: per-column chevrons go away entirely; sort lives
       only in the toolbar popover (matches AirTable). The 7-subset
       palette that handles filter+sort+group overlap is deferred to
       Phase 6; Phase 4 ships single-axis tints with a documented
       precedence rule when both apply. Driven against Rooms
       (US-EQ-2). No other consumers touched. Closes wishlist item
       #1e (stacked filter / sort with toolbar-tinted state).
PARENT-PLAN: planning/archive/dated/2026-05-23/datatable-airtable-parity.md
RELATED:
  - context/technical-requirements/data-table.md (canonical contract,
    §View State + §Behavior + §Field-Type Registry)
  - context/user-stories/30-tables-equipment.md
    (US-Builder-Tables criterion 2 — stacked toolbar; criterion 3 —
    session-only view state + reset)
  - planning/archive/dated/2026-05-23/phase-0-foundation-refactor.md
  - planning/archive/dated/2026-05-23/phase-1-inline-edit-popover.md
  - planning/archive/dated/2026-05-23/phase-2-row-insert-delete.md
  - planning/archive/dated/2026-05-23/phase-3-pointer-drag-selection.md
  - research/poc-plans/poc-lessons-for-real-build.md
    (L2.3, L8.1, L8.2, L8.4, L10.2)
---

# Phase 4 — Stacked filter + sort toolbar

## 1. Why this phase exists

After Phases 0–3, every cell- and row-level write gesture AirTable
offers runs through `<DataTable>`'s write reducer, and every range
selection gesture (Shift+Arrow, drag, full-column, ⌘A) builds the
same `selection.range` that ⌘C / ⌘V / fill (Phase 7) read from.
What is still missing is the **view-state mutation channel**:

1. **Sort is single-rule and header-click-only.** Today `toggleSort`
   in `DataTable.tsx:289` overwrites `view.sort` with one rule, and
   the only entry point is the chevron next to each column header.
   There is no way to ask for "sort by floor_level asc, then by
   number asc" — and no way to remove sort short of clicking the
   same header twice into "desc" then once more to start over. The
   per-column chevron also clutters each header with an
   affordance that 95% of users won't engage with most of the time.
   AirTable solves both problems with a single right-aligned
   `Sort` toolbar button that opens a popover; the per-column
   chevron goes away entirely. Phase 4 follows.
2. **Filter has no UI at all.** `applyTextFilters` in `lib.ts:218`
   already evaluates the `FilterCondition[]` carried on `ViewState`,
   and existing tests pass a hand-crafted filter rule
   (`DataTable.test.tsx:74`), but no toolbar control creates,
   edits, or removes those rules. Consumers cannot ship filtering
   to end-users; the only filtering today is whatever the consumer
   pre-sorts into the rows it passes in.
3. **Filter operators are text-only.** The current
   `FilterCondition` operator union is `"contains" | "is" |
   "is_empty"` and the value field is `string`. Number columns
   filter as strings ("contains 2" matches both `2.0` and `12`),
   single_select columns don't filter by option-id at all (they
   filter by formatted label), and there is no "is not" / "is not
   empty" / "between" / "is any of". The operator set the parent
   plan §10 enumerates is the bar.
4. **Reset is not user-actionable.** A confused user who has
   built a six-rule filter stack and a three-rule sort stack has
   to click each delete × six + three times to get back to the
   default view. US-Builder-Tables criterion 3 explicitly calls
   for "Reset-to-default action in the toolbar overflow."

Phase 4 closes all four gaps with one shared mechanism: every
sort/filter change — popover edit, drag-reorder, reset — flows
through `onViewChange(nextViewState)` (L8.2), and the view state
is *derived* into TanStack shapes via memo (L8.1). Operator
semantics live in the typed `FieldDef` registry so adding a new
field type later adds its operator bundle once and every consumer
table gets the new operators for free (L2.3). The drag handle
inside each popover row uses `@dnd-kit/sortable` — the one new
dependency this phase introduces (parent plan §15).

A separate, equally important closure: **per-axis cell tint**. A
user with a 12-rule view (5 filters, 7 sorts) has no way today to
see *which columns* are participating without opening both
popovers and reading them. AirTable solves this by tinting (a)
the toolbar button when any rule of that axis is active, and (b)
every body cell + column header background in the affected columns
with the same axis-specific colour. Filter is green; sort is peach.
A column that participates in both gets the precedence-rule tint
(filter wins; see §4.11 and §12 question 3). Phase 6 will
generalize this into the full 7-subset palette that handles
filter ∩ sort ∩ group; Phase 4 ships the single-axis-at-a-time
foundation.

After Phase 4, the toolbar is the **single entry point** for sort
and filter on every consumer table, the rule lists in `ViewState`
are the user-intent source of truth, the per-column header
chevron is gone, every filtered/sorted column tints with its
axis colour, and any cell that wants to be filtered or sorted by
a future field type only has to declare its operator bundle in
the registry.

## 2. Binding constraints

1. **Library-only.** All changes land in
   `frontend/src/shared/ui/data-table/` plus `frontend/src/App.css`
   for the new popover surface, toolbar button, and reset menu.
   **Zero touches** to `RoomsTable.tsx`, `EquipmentTab.tsx`, or
   anything under `features/`. If a consumer file changes during
   this phase, pause and re-evaluate.
2. **`onViewChange` is the only mutation channel for sort/filter**
   (L8.2). Every gesture — popover Add Rule, popover row edit,
   popover row reorder, popover row delete, Reset — calls
   `onViewChange(nextView)` exactly once with a fully-shaped
   `ViewState`. No partial-update prop, no per-axis callback. No
   header-driven mutation exists after Phase 4 (see constraint
   8 below).
3. **TanStack `sorting` / `columnFilters` are derived, never
   written to** (L8.1). Phase 4 does not introduce TanStack's
   row-model filtering; the library continues to compute
   `filteredRows` via `applyFilters` + `sortRows` in `lib.ts`.
   This keeps the user-intent → row-data path one function call
   wide and side-step-free.
4. **Operator semantics live in the field registry** (L2.3). Each
   `FieldType` exposes a typed `FilterOperatorDef[]` and an
   `evaluate(condition, cellValue, fieldDef)` function. The
   library never branches on `field_type` outside the registry.
5. **Dormant rows pass everything** (L8.4). A filter row whose
   `value` is blank/empty/unset (or whose `valueList` is empty)
   evaluates `true` for every row. The user can leave a half-typed
   rule open without it suddenly hiding all data.
6. **AND only.** All filter rules combine with logical AND. OR
   mode and nested AND-OR are explicitly deferred (parent plan
   §16). The popover UI does not show an AND/OR toggle.
7. **Session-only view state** (US-Builder-Tables criterion 3).
   Phase 4 does not persist view state to localStorage, to the
   backend, or to any router param. View state lives in the
   consumer's component state (`useState(emptyViewState)`); Phase
   4 does not change that contract.
8. **Header-click sort is removed.** Per AirTable parity (and the
   refinement walked 2026-05-23): the existing chevron indicator
   in `GridHeader.tsx:75`, the `data-table-header-button` element,
   the `onToggleSort` prop, and the `aria-sort` derivation all go
   away. Sort is reachable only through the toolbar popover. The
   parent plan §3 sequencing rule 6 ("header-click sort survives
   Phase 0 but is rewritten in Phase 4 to call the same
   `onViewChange` path the toolbar popovers do") is superseded by
   this constraint; the parent plan needs a one-line note pointing
   here (filed in §13).
9. **One new dependency: `@dnd-kit/sortable`** (parent plan §15.2).
   Same 24-hour `minimumReleaseAge` gate as Phase 1's Popover and
   Phase 2's AlertDialog installs. No shadcn CLI scaffold; we use
   the existing `@radix-ui/react-popover` for the popover surface.
10. **Read-only stays interactive for filter and sort.** A Viewer
    or locked-version reader can still build filter + sort stacks
    against the data they're allowed to read — the contract
    (data-table.md §Interaction Requirements) requires that
    "read-only mode where local sort/filter/group and copy still
    work." The toolbar Filter / Sort buttons render in both modes;
    only mutations (Delete N rows, inline edit, paste) stay
    blocked.
11. **Tests live with the primitive.** The bulk of the new
    coverage lands in `__tests__/applyFilters.test.ts`,
    `__tests__/FilterPopover.test.tsx`, `__tests__/SortPopover.test.tsx`,
    and `__tests__/GridToolbar.test.tsx`. The consumer
    integration tests in `EquipmentTab.test.tsx` stay unchanged.

## 3. Acceptance criteria

"Phase 4 demo passed" means all sixteen are true on a real browser
walk against Rooms.

1. **Filter popover opens from the toolbar.** Toolbar has a
   `Filter ▾` button; clicking opens a Radix popover anchored
   below it. Popover content is keyboard-reachable (Tab from the
   button), Esc closes, click-outside closes.
2. **Add Rule appends a dormant filter row.** Empty popover shows
   a single `+ Add filter rule` affordance. Clicking it appends a
   row whose `fieldKey` defaults to the first non-read-only field,
   whose operator is the first valid operator for that field
   type, and whose value is empty. `filteredRows` is unchanged
   (dormant rule passes everything, L8.4).
3. **Per-field-type operators populate the operator dropdown.**
   Picking `name` (text) → operators: `contains / does not contain
   / is / is not / is empty / is not empty`. Picking `num_people`
   (number) → `= / != / > / < / between / is empty / is not empty`.
   Picking `floor_level` (single_select) → `is any of / is none of
   / is empty / is not empty`. Picking `icfa` (computed-number)
   → same as number. Picking a read-only field is not offered
   (the field picker excludes them).
4. **Value editor matches the operator's value-arity.** Text
   operators that need a value render a single `<input>`. Number
   operators render a single `<input type="number">` (or two
   for `between`). Single-select `is any of` / `is none of`
   render a checkbox list of options. `is empty` / `is not empty`
   render no value editor — the row's `value` is unset and the
   evaluator ignores it.
5. **Stacked filters AND together.** Add
   `floor_level is any of [Ground, 1st]`, then add
   `num_people > 2`. The grid filters to rows that satisfy both
   conditions. Toolbar status reads
   `Filtered by 2 fields · Sorted by 0 fields`.
6. **Drag-to-reorder filter rules.** Each rule has a drag handle
   on the left. Dragging the second rule above the first persists
   the new order (`view.filter[0]` is now the moved rule); the
   filtered row set is unchanged (AND commutes), confirming the
   reorder did not lose state.
7. **Delete a single filter rule.** Each rule has a `×` button;
   clicking removes that row from `view.filter`. The grid
   re-filters immediately.
8. **Sort popover opens from the toolbar.** Toolbar has a
   `Sort ▾` button next to `Filter ▾`; same popover surface, same
   keyboard / focus behaviour.
9. **Stacked sort rules apply in order.** Add `number asc`, then
   add `name asc`. The grid sorts primarily by `number`, breaking
   ties by `name`. Toolbar status reads
   `Filtered by 0 fields · Sorted by 2 fields`.
10. **Drag-to-reorder sort rules.** Same handle / drag UX as the
    filter popover. Reordering changes the sort key precedence.
11. **No header chevrons; no per-column sort UI.** The chevron,
    the `data-table-header-button`, and the `aria-sort` attribute
    are gone from every `<th>`. Clicking a column header is a
    no-op (the column-select strip from Phase 3 still owns the
    top 6 px hit zone for full-column select). Sort is reachable
    only via the toolbar `Sort` button.
12. **Per-axis cell tint.** With any filter rule active and a
    non-empty value (i.e. the rule is contributing to the row
    filter), every body cell in the rule's `fieldKey` column —
    plus that column's header background — tints green
    (`var(--data-table-tint-filter)`). The toolbar `Filter`
    button itself tints green when any rule is active (regardless
    of dormant-status; matches AirTable). The same rule applies
    to sort with the peach token (`var(--data-table-tint-sort)`)
    against the toolbar `Sort` button and every column in
    `view.sort`. A column appearing in both `view.filter` (with a
    non-dormant rule) and `view.sort` tints green (filter wins
    by precedence rule §4.11; see §12 question 3 for the
    overlap-blend alternative).
13. **Reset clears both stacks.** Toolbar `⋯` overflow menu
    contains a `Reset view` item. Clicking it produces
    `view.filter = []` and `view.sort = []` via a single
    `onViewChange` call. The grid returns to the consumer's
    pre-filter / pre-sort order. (Group / aggregation / column
    state are out of scope here; the Reset action clears only
    what Phase 4 owns, plus the existing keys whose default is
    empty per `emptyViewState`. See §4.7.)
14. **Read-only mode preserves popover access.** Sign in as
    Viewer (or open a locked version). The Filter / Sort buttons
    render; both popovers open and edit; the grid filters and
    sorts the read-only rows. Inline edit / paste / delete are
    still blocked from Phase 2.
15. **No Phase 0 / 1 / 2 / 3 regressions.** All 186 existing
    tests pass. Inline edit, paste, row insert/delete, mouse
    drag, full-column select, perimeter outline, autoscroll,
    Esc-cancel, gutter checkbox all work as before. Existing
    `FilterCondition` shape carried in the hand-written test
    (`DataTable.test.tsx:74`) — `{operator: "contains", value:
    "missing"}` — still filters identically (the existing
    operator names survive as part of the expanded text operator
    set; see §4.4).
16. **`make typecheck && make lint && make test && make format`**
    and **`pnpm run build`** all clean. `pnpm run dev` walks
    §10 end-to-end in Chrome and Safari without console errors.

## 4. Target architecture

### 4.1 File layout (after)

```
frontend/src/shared/ui/data-table/
  DataTable.tsx              composes the toolbar popovers; passes
                             view + onViewChange + axis-tint maps
                             down; deletes the `toggleSort` body
                             and the `onToggleSort` prop pass-through
                             to GridHeader (still ≤ ~280 LOC)
  components/
    GridHeader.tsx           SIMPLIFIED — removes the
                             `data-table-header-button`, the
                             chevron sort indicator, the `aria-sort`
                             attribute derivation, and the
                             `onToggleSort` / `sort` props. Adds a
                             plain `<span>` label inside each `<th>`
                             and a `data-axis-tint` attribute used
                             by §4.11 CSS for per-column header
                             tinting. The column-select strip from
                             Phase 3 stays untouched.
    GridBody.tsx             extended — each body `<td>` reads its
                             column's axis-tint slot from the
                             axis-tint map and emits a
                             `data-axis-tint` attribute. No JS color
                             work; the CSS in §4.11 paints the cell
                             via the attribute selector.
    GridGutter.tsx           UNCHANGED
    GridToolbar.tsx          extended — adds Filter / Sort buttons
                             on the **right** of the toolbar (matches
                             AirTable layout), and a ⋯ overflow menu
                             rightmost-of-all. Buttons tint when
                             active (per §4.11 tokens). Existing
                             `actions` slot stays for the Phase 2
                             Delete button; status chips on the left
                             stay (slightly re-worded — see §4.8).
    InlineCellEditor.tsx     UNCHANGED
    SingleSelectPopover.tsx  UNCHANGED
    ConfirmRowDeleteDialog.tsx
                             UNCHANGED
    FilterPopover.tsx        NEW — Radix Popover content with the
                             stacked rule list, Add Rule footer,
                             per-row field/operator/value editors,
                             drag handle, delete button
    SortPopover.tsx          NEW — same shell as FilterPopover but
                             rule rows are field + direction toggle
                             (no operator, no value editor)
    ViewMenuOverflow.tsx     NEW — small Radix-or-native menu that
                             owns the Reset action; rendered from
                             the toolbar's right-hand slot
  hooks/
    useGridSelection.ts      UNCHANGED
    useGridRowSelection.ts   UNCHANGED
    useGridPointerDrag.ts    UNCHANGED
    useGridKeyboard.ts       UNCHANGED
    useGridEdit.ts           UNCHANGED
    useGridHistory.ts        UNCHANGED
    useGridWriteReducer.ts   UNCHANGED
    useGridClipboard.ts      UNCHANGED
  fields/
    registry.ts              extended — adds `getFilterOperators` and
                             `evaluateFilter` exports; the existing
                             `getFieldEditor` switch stays
    types.ts                 extended — adds `FilterOperatorDef`,
                             `FilterValueShape`, and the
                             `FilterEvaluator` callable type
    filterOperators.ts       NEW — typed operator catalogue per
                             field type (text / number / single_select
                             / computed). Pure data + evaluators.
                             Tested in isolation.
  lib.ts                     `applyTextFilters` → `applyFilters`
                             (renamed and generalized); routes each
                             condition through the registry's
                             `evaluateFilter`. `sortRows` is
                             UNCHANGED (multi-rule comparator already
                             walks `sortRules` in order). New helper
                             `defaultOperatorForField(fieldDef)`
                             picks the first operator from the
                             registry catalogue.
  types.ts                   `FilterCondition` widened — see §4.3.
                             The widening is a non-breaking superset:
                             existing `{operator: "contains" |
                             "is" | "is_empty", value?: string}`
                             rules continue to parse and evaluate.
  index.ts                   exports `FilterOperator` (new), keeps
                             the existing FilterCondition export
  __tests__/                 existing tests preserved; new tests
                             added (see §4.11)
```

`App.css` adds rules for the popover surface (matches existing
`SingleSelectPopover` styling), the filter / sort rule rows
(label · select · select · input · drag handle · delete-×),
the Add Rule footer, the drag-handle cursor, and the ⋯ overflow
menu. The existing `.data-table-toolbar` rule is preserved; the
buttons render into the toolbar's status row at left and at right
respectively.

### 4.2 Operator catalogue

The registry exports one catalogue per `FieldType`. Each entry
declares its display name, value-arity, value-shape, and a pure
evaluator. The catalogue is `as const` so TypeScript narrows the
operator union per field type.

```ts
// fields/filterOperators.ts

export type FilterValueShape =
  | { kind: "none" }                           // is_empty / is_not_empty
  | { kind: "string" }                         // text contains / is / etc.
  | { kind: "number" }                         // = / != / > / <
  | { kind: "numberPair" }                     // between
  | { kind: "optionIdList" };                  // single_select is_any_of

export type FilterOperator =
  // text
  | "contains" | "does_not_contain"
  | "is" | "is_not"
  | "is_empty" | "is_not_empty"
  // number (also computed-number)
  | "eq" | "neq" | "gt" | "lt" | "between"
  // single_select
  | "is_any_of" | "is_none_of";

export type FilterOperatorDef = {
  operator: FilterOperator;
  label: string;        // popover display
  shape: FilterValueShape;
};

export type FilterEvaluator = (
  condition: FilterCondition,
  cellValue: unknown,
  fieldDef: FieldDef,
) => boolean;

// §12 Q8 resolution: labels match AirTable verbatim. Text /
// value-taking operators carry an ellipsis ("contains…", "is…");
// valueless operators do not.
export const TEXT_OPERATORS: readonly FilterOperatorDef[] = [
  { operator: "contains",         label: "contains…",         shape: { kind: "string" } },
  { operator: "does_not_contain", label: "does not contain…", shape: { kind: "string" } },
  { operator: "is",               label: "is…",               shape: { kind: "string" } },
  { operator: "is_not",           label: "is not…",           shape: { kind: "string" } },
  { operator: "is_empty",         label: "is empty",          shape: { kind: "none"   } },
  { operator: "is_not_empty",     label: "is not empty",      shape: { kind: "none"   } },
] as const;

export const NUMBER_OPERATORS: readonly FilterOperatorDef[] = [
  { operator: "eq",          label: "=",            shape: { kind: "number"     } },
  { operator: "neq",         label: "≠",            shape: { kind: "number"     } },
  { operator: "gt",          label: ">",            shape: { kind: "number"     } },
  { operator: "lt",          label: "<",            shape: { kind: "number"     } },
  { operator: "between",     label: "between",      shape: { kind: "numberPair" } },
  { operator: "is_empty",    label: "is empty",     shape: { kind: "none"       } },
  { operator: "is_not_empty",label: "is not empty", shape: { kind: "none"       } },
] as const;

export const SINGLE_SELECT_OPERATORS: readonly FilterOperatorDef[] = [
  { operator: "is_any_of",    label: "is any of",    shape: { kind: "optionIdList" } },
  { operator: "is_none_of",   label: "is none of",   shape: { kind: "optionIdList" } },
  { operator: "is_empty",     label: "is empty",     shape: { kind: "none"         } },
  { operator: "is_not_empty", label: "is not empty", shape: { kind: "none"         } },
] as const;
```

Sort direction labels (§12 Q8 resolution) are `A → Z` (asc) and
`Z → A` (desc) regardless of field type. Defined inline in
`SortPopover.tsx` — no catalogue entry needed, the direction
union stays `"asc" | "desc"`.

`computed` field defs declare their underlying type via a new
optional slot on `FieldDef` (see §4.3). The registry maps
`computed` with `computed_type === "number"` to `NUMBER_OPERATORS`;
unspecified computed defs fall back to `TEXT_OPERATORS` so existing
consumers continue to filter as text. `attachment` and `argb_color`
return `[]` — they don't filter through the toolbar.

### 4.3 Type changes

`types.ts` widens `FilterCondition` and adds the `computed_type`
slot to `FieldDef`. Both are non-breaking supersets of the Phase
0–3 shapes.

```ts
// types.ts — diff sketch

export type FieldDef = {
  field_key: string;
  field_type: FieldType;
  display_name: string;
  read_only?: boolean;
  required?: boolean;
  description?: string;
  options?: FieldOption[];
  default?: unknown;
  // Phase 4 §4.2: for `field_type === "computed"`, declare the
  // underlying value type so the registry knows which operator
  // bundle to expose. Defaults to "text" when omitted (current
  // Phase 0–3 behaviour preserved).
  computed_type?: "text" | "number";
};

export type FilterCondition = {
  fieldKey: string;
  operator: FilterOperator;       // widened from the 3-name union
  // String value used by text/number-single operators.
  // - text ops: the raw string the user typed
  // - number ops (eq/neq/gt/lt): the stringified number; the
  //   evaluator parses with Number() and returns true (dormant)
  //   when the parse fails or the input is empty
  value?: string;
  // Number-pair value used by `between`. The evaluator returns
  // true (dormant) when either bound is missing or unparsable.
  valuePair?: [string, string];
  // Option id list used by `is_any_of` / `is_none_of`.
  valueList?: string[];
};
```

The non-string-value slots are optional and only one of `value` /
`valuePair` / `valueList` is consulted per condition (chosen by
the operator's `FilterValueShape`). This matches the discriminated
union pattern the registry uses internally without forcing a
narrowing tax on every consumer that constructs a condition by
hand (the existing `DataTable.test.tsx:74` rule still typechecks).

### 4.4 Evaluator design

`evaluateFilter` is a single function inside `filterOperators.ts`
that switches on `operator` and reads the condition slot named by
that operator's `shape`. The function is pure and re-tested per
operator in `__tests__/applyFilters.test.ts`.

```ts
export function evaluateFilter(
  condition: FilterCondition,
  cellValue: unknown,
  fieldDef: FieldDef,
): boolean {
  switch (condition.operator) {
    case "is_empty":     return isEmpty(cellValue);
    case "is_not_empty": return !isEmpty(cellValue);

    case "contains": {
      const expected = (condition.value ?? "").trim().toLowerCase();
      if (!expected) return true;                   // dormant
      return formatClipboardCellValue(cellValue, fieldDef)
        .toLowerCase().includes(expected);
    }
    case "does_not_contain": {
      const expected = (condition.value ?? "").trim().toLowerCase();
      if (!expected) return true;
      return !formatClipboardCellValue(cellValue, fieldDef)
        .toLowerCase().includes(expected);
    }
    case "is": {
      const expected = (condition.value ?? "").trim().toLowerCase();
      if (!expected) return true;
      return formatClipboardCellValue(cellValue, fieldDef)
        .trim().toLowerCase() === expected;
    }
    case "is_not": {
      const expected = (condition.value ?? "").trim().toLowerCase();
      if (!expected) return true;
      return formatClipboardCellValue(cellValue, fieldDef)
        .trim().toLowerCase() !== expected;
    }

    case "eq":  return numCompare(cellValue, condition.value, (a, b) => a === b);
    case "neq": return numCompare(cellValue, condition.value, (a, b) => a !== b);
    case "gt":  return numCompare(cellValue, condition.value, (a, b) => a >   b);
    case "lt":  return numCompare(cellValue, condition.value, (a, b) => a <   b);
    case "between": {
      const lo = parseNumberOrNull(condition.valuePair?.[0]);
      const hi = parseNumberOrNull(condition.valuePair?.[1]);
      if (lo === null || hi === null) return true;  // dormant
      const cell = parseNumberOrNull(cellValue);
      if (cell === null) return false;
      const [low, high] = lo <= hi ? [lo, hi] : [hi, lo];
      return cell >= low && cell <= high;
    }

    case "is_any_of": {
      const list = condition.valueList ?? [];
      if (list.length === 0) return true;           // dormant
      return typeof cellValue === "string" && list.includes(cellValue);
    }
    case "is_none_of": {
      const list = condition.valueList ?? [];
      if (list.length === 0) return true;
      return !(typeof cellValue === "string" && list.includes(cellValue));
    }
  }
}
```

Helpers (`isEmpty`, `numCompare`, `parseNumberOrNull`) sit
alongside the switch in the same file. They are not exported.

**Dormant-row rule** (L8.4): every operator that takes a value
returns `true` when the value is blank/missing/unparsable. The
user can leave a half-typed rule open without it hiding all
data. The existing `applyTextFilters` already follows this rule
for `contains` / `is`; Phase 4 generalizes it to every operator.

**Backward compat**: the three existing operator names
(`contains`, `is`, `is_empty`) survive verbatim. The existing
unit-test rule
(`{operator: "contains", value: "missing"}` at
`DataTable.test.tsx:74`) evaluates identically post-rename
(`applyTextFilters` → `applyFilters` is a pure rename with the
same external behaviour for these operators).

### 4.5 Filter popover surface

Layout, copy, and column order match AirTable's filter popover
exactly (per the screenshot walked 2026-05-23):

```
┌────────────────────────────────────────────────────────────┐
│ Filter                                                     │
│ ──────────────────────────────────────────────────────     │
│ In this view, show records                                 │
│                                                            │
│ Where  [Field ▾]  [Operator ▾]  [Value ─────]   🗑  ⋮⋮    │ ← rule row 1
│ And    [Field ▾]  [Operator ▾]  [Value ─────]   🗑  ⋮⋮    │ ← rule row 2+
│                                                            │
│ + Add condition                                            │
└────────────────────────────────────────────────────────────┘
```

The leftmost-text-label changes per row: row 1 reads "Where",
rows 2+ read "And" (AND-only — OR is deferred). This labelling
is purely cosmetic; the conjunction is fixed at AND regardless
of label.

- **Conjunction label** — leftmost column of each rule row.
  Row 1: "Where". Rows 2+: "And". Pure text; no control.
- **Field picker** — native `<select>` (L10.2 — native controls
  good enough for popover MVPs). Lists every `FieldDef` whose
  registry catalogue is non-empty (excludes `attachment` and
  `argb_color`). Read-only fields included by default — see
  §12 question 2. Defaults to the first such field on rule
  create.
- **Operator picker** — native `<select>`. Options come from
  `getFilterOperators(fieldDef)`. Switching the field resets
  the operator to the catalogue's first entry and clears the
  value slot (the previous operator's value shape may not
  match).
- **Value editor** — chosen by `FilterValueShape`:
  - `none` → no editor rendered (cell collapses; tab order
    skips past).
  - `string` → borderless `<input type="text">`.
  - `number` → `<input type="number" inputMode="decimal">`. The
    raw string is stored on `value`; parsing happens in the
    evaluator. Non-numeric input keeps the rule dormant.
  - `numberPair` → two `<input type="number">`s with an `and`
    label between them.
  - `optionIdList` → a `<details><summary>` disclosure listing
    the field's options as checkboxes (label + colored pill).
    Multi-select; checked ids accumulate in `valueList`.
- **Delete (🗑)** — splices the rule out of `view.filter`.
  Trash-icon button, AirTable-style, sits in the slot right of
  the value editor.
- **Drag handle (`⋮⋮`)** — `@dnd-kit/sortable` listener. Pointer-
  down + drag reorders the rule within `view.filter`. ARIA grab
  handle, focusable, Space + arrow-keys also reorder for
  keyboard users. Sits in the rightmost slot, after the trash
  button (matches AirTable's column order in the screenshot).
- **+ Add condition** — appends a dormant rule (first field /
  first operator / empty value) so the user can start filling
  it in. Until the value is filled in, the row passes
  everything (L8.4). Footer button, left-aligned.

Markup composition (sketch):

```tsx
<Popover.Root open={open} onOpenChange={setOpen}>
  <Popover.Trigger asChild>
    <button
      className="data-table-toolbar-button"
      data-axis="filter"
      data-axis-active={view.filter.length > 0 ? "true" : undefined}
    >
      <FilterIcon aria-hidden />
      {view.filter.length
        ? `Filtered by ${describeFilterFields(view.filter, fieldDefs)}`
        : "Filter"}
    </button>
  </Popover.Trigger>
  <Popover.Portal>
    <Popover.Content
      className="data-table-view-popover"
      align="start"
      sideOffset={6}
    >
      <DndContext sensors={...} onDragEnd={onFilterReorder}>
        <SortableContext items={ruleIds} strategy={verticalListSortingStrategy}>
          {view.filter.map((rule, index) => (
            <FilterRuleRow
              key={ruleIds[index]}
              ruleId={ruleIds[index]}
              rule={rule}
              fieldDefs={editableFieldDefs}
              onChange={(next) => onRuleChange(index, next)}
              onRemove={() => onRuleRemove(index)}
            />
          ))}
        </SortableContext>
      </DndContext>
      <button
        type="button"
        className="data-table-view-popover-add"
        onClick={onAddRule}
      >
        + Add filter rule
      </button>
    </Popover.Content>
  </Popover.Portal>
</Popover.Root>
```

The `ruleIds` array is a sibling `useRef`-stable array of
generated ids (`filt_<ulid>`) keyed to `view.filter` indices for
the lifetime of the popover. The ids are not persisted to view
state — they exist only as React keys and as `@dnd-kit` ids.

### 4.6 Sort popover surface

Layout, copy, and column order match AirTable's sort popover
exactly (per the screenshot walked 2026-05-23):

```
┌────────────────────────────────────────────────────────────┐
│ Sort by                                                    │
│                                                            │
│   [Field ▾]                 [A → Z ▾]              ×       │ ← rule 1
│   [Field ▾]                 [A → Z ▾]              ×       │ ← rule 2+
│                                                            │
│ + Add another sort                                         │
└────────────────────────────────────────────────────────────┘
```

The popover is narrower than the filter popover (single
`min-width: 300px`). The direction picker uses AirTable's
`A → Z` / `Z → A` labels — these are direction-only and rendered
verbatim regardless of field type (per AirTable; even for
numbers the screenshot shows "A → Z" rather than "1 → 9").

- **Field picker** — native `<select>` listing every `FieldDef`
  whose field_type is not `attachment` or `argb_color`. Read-only
  computed fields *are* sortable. The same field is allowed in
  multiple sort rules only if Ed resolves §12 question 1 that
  way; the default plan excludes already-used fields from the
  picker so the stack cannot trivially duplicate itself.
- **Direction picker** — native `<select>` with two options:
  `A → Z` (asc) and `Z → A` (desc). Driven by `rule.direction`.
- **Delete (×)** — AirTable uses a plain `×` (not a trash icon)
  in the sort popover, distinct from the filter popover's 🗑.
  Splices the rule out of `view.sort`.
- **Drag handle** — `@dnd-kit/sortable` listener on the row's
  entire chrome; no visible handle slot (AirTable's screenshot
  doesn't show one in the sort popover, though hover reveals a
  hit zone on the left). The plan ships a hover-visible
  `⋮⋮` glyph in the leftmost 16 px of the row so the gesture is
  discoverable while idle whitespace stays clean.
- **+ Add another sort** — appends a rule whose field defaults
  to the first sortable field that is *not* already in the
  stack (or, if all are used and §12 Q1 resolves to allow
  duplicates, falls through to the first sortable field).

`sortRows` in `lib.ts` already walks `sortRules` in order and
returns the first non-zero comparator result, so the data path
needs no change.

(AirTable's screenshot also shows a "Automatically sort
records" toggle below the rule list. Skipping it for Phase 4 —
our data path always re-sorts on view-state change because
`sortRows` runs unconditionally in the `filteredRows` useMemo;
adding the toggle would mean introducing manual "apply" state
that defeats the user-intent → row-data path. Recorded as a
deferred polish item in §7.)

### 4.7 Reset action

The toolbar grows a `⋯` overflow button on the right end of the
status row. Clicking it opens a small popover (or native
`<details>` menu — TBD per §12 question 4) with one item today:

```
┌────────────────────┐
│  Reset view        │
└────────────────────┘
```

Activating `Reset view` calls
`onViewChange({...view, filter: [], sort: []})`. **Group, column
order/widths, hidden columns, expanded groups, and
aggregations are not cleared by Phase 4's Reset.** Phase 6 (group
accordion) and a future column-config phase own the rest of
those keys; this Reset clears only what Phase 4 owns.

US-Builder-Tables criterion 3 reads "Reset-to-default action in
the toolbar overflow"; the criterion does not pin which keys
reset clears. We document the Phase 4 scope of the action here so
Phase 6's plan can pick up the rest without surprise.

### 4.8 Toolbar layout (after)

Matches AirTable: buttons are right-aligned, the leftmost slot
keeps the status chips, and a `⋯` overflow menu sits at the
absolute right edge.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Editable · Ungrp · …    [Filtered by name]  [Sort]  ⋯                   │
│                                                          [Delete 3]      │
└──────────────────────────────────────────────────────────────────────────┘
```

- **Filter button** (right-aligned). Label `Filter` when
  `view.filter.length === 0`. When ≥1 rule has a contributing
  (non-dormant) value, the label changes to
  `Filtered by <field_display_name>` for the single-rule case
  (matches AirTable screenshot) or
  `Filtered by N fields` for the multi-rule case. The button
  background tints green via `data-axis-active="true"`
  (§4.11). Leading icon: a small horizontal-lines glyph
  matching AirTable's filter glyph (rendered inline as an
  inline SVG; no icon dependency).
- **Sort button** (right of Filter). Label `Sort` when
  `view.sort.length === 0`; `Sorted by N` when active. Tints
  peach when active. Leading icon: `↑↓` glyph.
- **`⋯` overflow** (rightmost). Owns the Reset view action;
  forward-compat slot for Phase 6 group / future column-config
  actions.
- **Status chips** stay on the left, slightly re-worded:
  `Editable | Read-only` and `Ungrouped` (Phase 6 changes the
  grouping chip). The old `Filtered by N rule` and `Sorted by N
  field` status chips are **removed** — the button labels now
  carry that information (matches AirTable).
- **Phase 2 Delete action** (consumer-supplied `actions` slot)
  renders below the toolbar row when row-selection is
  non-empty. It stays visually separate from the right-aligned
  axis buttons so the user can't accidentally hit Delete while
  reaching for Sort.
- All toolbar controls keep `tabIndex={-1}` semantics consistent
  with Phase 2 (the grid wrapper is the keyboard-focus host;
  toolbar controls are reachable by Tab from the wrapper).

CSS additions for the toolbar layout (§4.11 owns the tint
tokens):

```css
.data-table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.data-table-toolbar-status {
  display: flex;
  gap: 12px;
  margin-right: auto;          /* push buttons to the right */
  color: var(--muted);
  font-size: 12px;
}
.data-table-toolbar-buttons { display: flex; gap: 4px; }
.data-table-toolbar-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 4px;
  background: transparent;
  border: 1px solid transparent;
  font-size: 12px;
  cursor: pointer;
}
.data-table-toolbar-button:hover {
  background: color-mix(in oklab, var(--fg) 6%, transparent);
}
/* Filter axis tint when any rule is active. */
.data-table-toolbar-button[data-axis="filter"][data-axis-active="true"] {
  background: var(--data-table-tint-filter);
}
/* Sort axis tint when any rule is active. */
.data-table-toolbar-button[data-axis="sort"][data-axis-active="true"] {
  background: var(--data-table-tint-sort);
}
.data-table-view-popover {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  min-width: 380px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.12);
}
.data-table-view-popover.is-sort { min-width: 300px; }
.data-table-view-popover-heading {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
}
.data-table-view-popover-subheading {
  font-size: 12px;
  color: var(--muted);
  margin-bottom: 8px;
}
.data-table-view-popover-rule {
  display: grid;
  grid-template-columns: 48px 1fr 1fr 1.5fr 20px 16px;
  gap: 6px;
  align-items: center;
  padding: 4px 0;
}
.data-table-view-popover-rule.is-sort {
  grid-template-columns: 1fr 1fr 20px 16px;  /* no Where/And label, no operator/value */
}
.data-table-view-popover-conjunction {
  font-size: 12px;
  color: var(--muted);
}
.data-table-view-popover-drag {
  cursor: grab;
  color: var(--muted);
  opacity: 0;                  /* hover-visible on sort popover */
  transition: opacity 0.1s ease-out;
}
.data-table-view-popover-rule:hover .data-table-view-popover-drag {
  opacity: 1;
}
.data-table-view-popover-add {
  margin-top: 8px;
  padding: 4px;
  font-size: 12px;
  color: var(--accent);
  background: transparent;
  border: none;
  cursor: pointer;
}
.data-table-view-popover-rule[data-dragging="true"] {
  opacity: 0.6;
  cursor: grabbing;
}
```

### 4.9 Header chevron removal

The Phase 0–3 header layout renders three slots inside each
`<th>`:

1. `data-table-column-select-strip` (Phase 3, top 6 px) —
   **kept**, owns the full-column-select hit zone.
2. `data-table-header-button` — a `<button>` whose `onClick`
   calls `onToggleSort(fieldKey)`; renders the column label and
   a chevron `▲ / ▼` when `view.sort` has a matching rule.
   **Removed entirely.**
3. `renderHeaderActions(field)` slot (consumer-supplied) —
   **kept**, Phase 5 uses it for the per-column `⋯` menu.

After Phase 4, the header column reads:

```tsx
<th
  role="columnheader"
  aria-colindex={columnIndex + 1}
  data-axis-tint={axisTintByFieldKey.get(column.fieldKey)}
>
  <div
    className="data-table-column-select-strip"
    role="button"
    aria-label={`Select column ${column.header}`}
    data-column-select-fieldkey={column.fieldKey}
    tabIndex={-1}
    onMouseDown={(event) => onColumnMouseDown(event, column.fieldKey)}
  />
  <span className="data-table-header-label">{column.header}</span>
  {renderHeaderActions?.(fieldDef)}
</th>
```

The `aria-sort` attribute is removed from `<th>` because the
sort state is no longer a per-column property in the UI — it's a
view-state list reachable only through the toolbar. Multi-rule
sort is announced via the `aria-live` region (Phase 0
`announce` state) when the user opens / changes the Sort
popover; the announcement reads
`Sorted by 2 fields: floor_level ascending, then number ascending`.

`onToggleSort` is removed from `GridHeaderProps`. The
`DataTable.tsx:289` `toggleSort` function is deleted; no
replacement is added (sort goes through `onViewChange` only,
from the popover).

The existing `aria-rowindex` / `role="columnheader"` /
`tabIndex={-1}` / `aria-label` attributes are preserved. The
header label is now a plain `<span>`; it cannot be clicked or
focused.

### 4.10 Per-axis cell tint (visual)

Per-axis tinting is the **headline visual** of Phase 4. Two CSS
tokens define the palette; both are applied to (a) the toolbar
button when the axis has any active rule, (b) the body cells of
every column participating in that axis, and (c) the column
header background of those same columns.

```css
/*
 * §12 Q10 resolution: match AirTable's colors. The OKLCH
 * values below are PLACEHOLDERS — Step 2 samples the actual
 * AirTable button-active and filter-chip swatches from the
 * 2026-05-23 screenshots (or live in airtable.com if needed)
 * and updates these literals before commit.
 */
:root {
  /* Filter axis — sample from AirTable's `Filtered by …` chip. */
  --data-table-tint-filter: oklch(96% 0.04 145);
  --data-table-tint-filter-header: oklch(93% 0.06 145);

  /* Sort axis — sample from AirTable's active `Sort` button. */
  --data-table-tint-sort: oklch(95% 0.05 50);
  --data-table-tint-sort-header: oklch(91% 0.08 50);
}
```

Cells receive their tint via a `data-axis-tint` attribute on
each body `<td>` and each header `<th>`. The attribute is
computed once per render, in `DataTable.tsx`, from
`view.filter` and `view.sort`:

```ts
const axisTintByFieldKey = useMemo<Map<string, "filter" | "sort" | null>>(() => {
  const out = new Map<string, "filter" | "sort" | null>();
  // Filter wins on overlap (§12 question 3 default).
  const contributingFilters = new Set(
    view.filter
      .filter((rule) => isFilterContributing(rule))
      .map((rule) => rule.fieldKey),
  );
  const sorted = new Set(view.sort.map((rule) => rule.fieldKey));
  for (const fieldDef of fieldDefs) {
    if (contributingFilters.has(fieldDef.field_key)) {
      out.set(fieldDef.field_key, "filter");
    } else if (sorted.has(fieldDef.field_key)) {
      out.set(fieldDef.field_key, "sort");
    } else {
      out.set(fieldDef.field_key, null);
    }
  }
  return out;
}, [fieldDefs, view.filter, view.sort]);
```

`isFilterContributing(rule)` returns false for dormant rules
(blank value / blank value pair / empty value list) — a dormant
rule that passes everything doesn't visually tint its column,
matching AirTable's behaviour (the chip only colors when the
filter is contributing).

The tint CSS is purely attribute-driven:

```css
.data-table th[data-axis-tint="filter"] {
  background: var(--data-table-tint-filter-header);
}
.data-table th[data-axis-tint="sort"] {
  background: var(--data-table-tint-sort-header);
}
.data-table td[data-axis-tint="filter"] {
  background: var(--data-table-tint-filter);
}
.data-table td[data-axis-tint="sort"] {
  background: var(--data-table-tint-sort);
}
```

**Layer order** with existing selection / focus visuals
(matches PoC L9.3 — tint → selection → focus):

- Tint is the base background. It sits behind everything else.
- Selection (Phase 3 perimeter outline + interior fill) is a
  `box-shadow` + a translucent overlay. Overlays composite on
  top of tint correctly because `background` and `box-shadow`
  occupy different rendering channels.
- Focus (Phase 0 active cell) is an `outline`. Outline sits
  above both tint and selection regardless of stacking.

The Phase 3 `.data-table-cell-selected` interior fill uses
`color-mix(in oklab, var(--accent) 10%, transparent)` which
composites *over* the tint background — the user can see a
green tint with a translucent blue selection on top, which is
exactly what AirTable shows for a filtered+selected cell.

**Overlap rule**: when a column is in both `view.filter` (with
a contributing rule) and `view.sort`, the column tints green
(filter wins). Rationale: filter is the more impactful state
(it hides rows; sort only reorders them), and a single tint per
column keeps the visual unambiguous. The full 7-subset blend
palette that AirTable uses for filter ∩ sort ∩ group is
deferred to Phase 6. §12 question 3 records the alternative
(use `color-mix` to blend the two tokens for the overlap case,
or accept Phase 4's filter-wins precedence and let Phase 6
generalize).

### 4.11 Visible-fields path

`editableFieldDefs` (the list the field picker shows) is computed
once in `DataTable.tsx` and threaded down to both popovers:

```ts
// §12 Q2 resolution: read-only fields ARE filterable. The
// catalogue returns operators for them; editability is
// irrelevant to filterability.
const filterableFieldDefs = useMemo(
  () => fieldDefs.filter((fieldDef) =>
    getFilterOperators(fieldDef).length > 0,
  ),
  [fieldDefs],
);
const sortableFieldDefs = useMemo(
  () => fieldDefs.filter((fieldDef) =>
    fieldDef.field_type !== "attachment" &&
    fieldDef.field_type !== "argb_color",
  ),
  [fieldDefs],
);
```

Computed columns are sortable (the sort comparator already
handles them) and filterable (via the `computed_type` slot,
defaulting to text). Read-only fields appear in **both**
pickers (§12 Q2 resolution) — `read_only` governs cell-level
editability only, not whether the column shows up in view-state
rules.

The sort field picker additionally **excludes fields already
in the stack** (§12 Q1 resolution). Implementation: pass the
current `view.sort` to `SortPopover` so it can compute
`alreadyUsed = new Set(view.sort.map((rule) => rule.fieldKey))`
and filter the picker's options. The Add-another-sort button
is disabled when `alreadyUsed.size === sortableFieldDefs.length`.

### 4.12 Test plan

Existing 186 tests pass unchanged. The
`applyTextFilters → applyFilters` rename is a single mechanical
update inside `DataTable.tsx`; existing test inputs (the
hand-typed `{operator: "contains", value: "missing"}` rule)
remain valid `FilterCondition` shapes after the widening.

New tests:

- **`__tests__/applyFilters.test.ts` (NEW)** — pure evaluator
  coverage per operator:
  - `contains` matches case-insensitively; empty value passes
    everything; matches against the formatted display value
    for single_select cells (so the user can filter on label,
    not option id).
  - `does_not_contain` is the negation, with the dormant rule.
  - `is` / `is_not` exact-match (case-insensitive trim).
  - `is_empty` / `is_not_empty` recognise `null`, `undefined`,
    `""`, and (for number cells) `0` — wait: `0` is **not**
    empty for number cells. Test verifies this corner.
  - `eq` / `neq` / `gt` / `lt` parse the string value with
    `Number()`. NaN value → dormant. NaN cell → false (cell
    cannot satisfy a numeric comparison).
  - `between` honours swapped bounds (`{lo: 10, hi: 2}` treated
    as `[2, 10]`). Missing either bound → dormant.
  - `is_any_of` / `is_none_of` compare cell value against the
    option-id list. Empty list → dormant. Null cell + `is_none_of`
    → true (null is not in any non-empty list).
  - Multi-rule combination is AND (verified in `applyFilters` not
    the evaluator, but covered here).
- **`__tests__/filterOperators.test.ts` (NEW)** — registry
  shape:
  - `getFilterOperators({field_type: "text"})` returns the text
    catalogue.
  - `getFilterOperators({field_type: "computed",
    computed_type: "number"})` returns the number catalogue.
  - `getFilterOperators({field_type: "computed"})` (no
    computed_type) falls back to text.
  - `getFilterOperators({field_type: "attachment"})` returns
    `[]`.
- **`__tests__/FilterPopover.test.tsx` (NEW)** — component
  behaviour:
  - Opens from the toolbar button click; closes on Esc.
  - Add Rule appends a row to `view.filter` via `onViewChange`.
  - Changing the field resets the operator to the new
    catalogue's first entry and clears the value slot.
  - Changing the operator from a `string`-shape to a `none`-
    shape clears `value` from the next view state.
  - Drag-reorder calls `onViewChange` with the reordered array
    (synthesise a `dnd-kit` drag-end event in the test).
  - Delete `×` removes the rule.
- **`__tests__/SortPopover.test.tsx` (NEW)** — analogous to the
  filter popover tests.
- **`__tests__/GridToolbar.test.tsx` (NEW small)**:
  - Renders `Filter ▾` / `Sort ▾` buttons with rule counts.
  - Status text reflects current `view.filter.length` /
    `view.sort.length`.
  - `⋯` menu's `Reset view` action calls `onViewChange` with
    `filter: []` and `sort: []` while preserving the other
    `ViewState` keys.
- **`__tests__/DataTable.test.tsx` extensions**:
  - Header chevron / `data-table-header-button` is no longer
    rendered on any `<th>` (replaces the existing
    `expect(screen.getByRole("button", { name: "Number" })).toHaveAttribute("tabindex", "-1")`
    test at `DataTable.test.tsx:85`, which is removed since
    the button itself is gone). The header label is a plain
    `<span>` with text content.
  - `aria-sort` is not set on any `<th>` (replaces the
    existing test that asserts it is).
  - With `view.filter = [{name contains "liv"}]`, the body
    `<td>`s for the `name` column carry `data-axis-tint="filter"`.
    All other columns carry `data-axis-tint=""` (or no
    attribute).
  - With `view.sort = [{number asc}]`, the `number` column's
    cells carry `data-axis-tint="sort"`.
  - With both `view.filter = [{name contains "liv"}]` and
    `view.sort = [{name asc}]` on the same column, the column
    tints filter (overlap precedence rule §4.10).
  - Dormant filter rules (empty value) do NOT produce
    `data-axis-tint="filter"` on their column.
  - Toolbar Filter button has `data-axis-active="true"` when
    any filter rule is present (dormant or not — matches
    AirTable: chip colors as soon as a rule exists).
  - Toolbar Sort button has `data-axis-active="true"` when
    `view.sort.length > 0`.
- **`__tests__/lib.test.ts` extensions**:
  - `applyFilters` short-circuits to `rows` when the filter
    array is empty (preserves array identity for memo).
  - `applyFilters` returns a new array when any rule is active
    (correct memo invalidation).

Mocking `@dnd-kit/sortable` in unit tests: use the library's
documented `keyboardCoordinateGetter` synthetic drag flow or
fire pointer events directly — both are testable in jsdom. The
plan defaults to firing the `dnd-kit` `DndContext`'s
`onDragEnd` handler directly with a synthesized event to keep
the tests fast and engine-agnostic.

## 5. Execution order

Six steps. Each leaves the tree green (`make test`, `make
typecheck`, `make lint`). Commit per step.

### Step 1 — Operator catalogue + evaluator + types widening

- Widen `FilterCondition` in `types.ts` with `valuePair` and
  `valueList` slots; widen `FilterOperator` enum.
- Add `computed_type` slot to `FieldDef`.
- Create `fields/filterOperators.ts` with the three catalogues,
  the `evaluateFilter` function, and the `getFilterOperators`
  helper (re-exported from `fields/registry.ts`).
- Rename `applyTextFilters` → `applyFilters` in `lib.ts`; route
  each condition through the registry's `evaluateFilter`.
- Add `defaultOperatorForField(fieldDef)` to lib.ts.
- Test: `__tests__/applyFilters.test.ts`,
  `__tests__/filterOperators.test.ts`,
  `__tests__/lib.test.ts` extensions for identity-stability.
- At this step, no UI changes are visible. The library can
  now evaluate the full operator set against any field def.

### Step 2 — Header chevron removal + per-axis tint plumbing

- Delete `data-table-header-button`, the chevron span, the
  `aria-sort` derivation, the `onToggleSort` prop, and the
  `sort` prop from `GridHeader.tsx`. Replace with a plain
  `<span className="data-table-header-label">`.
- Delete `DataTable.tsx:289` `toggleSort` and its wiring.
- Compute `axisTintByFieldKey` in `DataTable.tsx` per §4.10
  and thread it to `GridHeader` (header `<th>`'s
  `data-axis-tint`) and `GridBody` (body `<td>`'s
  `data-axis-tint`).
- Add tint CSS tokens (`--data-table-tint-filter`,
  `--data-table-tint-sort`, and their `-header` variants) to
  `App.css`. Add the four selector rules per §4.10.
- Test: `DataTable.test.tsx` extensions for chevron-removal,
  `data-axis-tint` on cells / headers, overlap precedence,
  dormant-rule no-tint.
- At this step, headers are clean (no per-column sort UI),
  and any view state set externally produces the correct
  tint. The popover UI is still absent; the user has no way
  to *build* a stack yet.

### Step 3 — Filter popover (no drag yet)

- Add `@dnd-kit/sortable` to `package.json` (still un-used).
- Create `components/FilterPopover.tsx` with the Radix Popover
  shell, the "Filter / In this view, show records" headings,
  the rule list with Where/And conjunction labels, the
  "+ Add condition" footer, and the per-row editors. No drag
  handle yet — the rule order is locked at append order.
- Extend `GridToolbar.tsx` per §4.8: status chips on the left
  (re-worded to drop the Filtered/Sorted chips), right-aligned
  Filter button with `data-axis="filter"` and dynamic label,
  green tint via §4.10 when active.
- Wire `DataTable.tsx` to thread `view.filter`, `onViewChange`,
  and `filterableFieldDefs` to the toolbar / popover. The
  `axisTintByFieldKey` map from Step 2 now updates live as
  the user edits rules in the popover.
- Test: `__tests__/FilterPopover.test.tsx` (no drag),
  `__tests__/GridToolbar.test.tsx`.
- At this step, the user can build a filter stack via Add
  condition + edit, delete rules, and see the grid filter
  live with the column cells tinted green. Verify §10 steps
  1–7 in browser.

### Step 4 — Sort popover (no drag yet)

- Create `components/SortPopover.tsx` with the "Sort by"
  heading, the simpler rule row (field + A→Z / Z→A + ×),
  and the "+ Add another sort" footer.
- Extend `GridToolbar.tsx` to render the right-aligned Sort
  button with `data-axis="sort"` and peach tint.
- Wire `view.sort` + `onViewChange` to the popover.
- Test: `__tests__/SortPopover.test.tsx`.
- At this step, stacked sort works via the popover. Affected
  columns tint peach. Verify §10 steps 8–10 in browser.

### Step 5 — Drag-to-reorder (both popovers) + Reset menu

- Wire `@dnd-kit/sortable` into both popovers per §4.5
  composition. Add drag handles, `data-dragging` attributes.
- Add CSS for the drag-handle cursor and the dragging state.
- Create `components/ViewMenuOverflow.tsx` with the `⋯` button
  and the `Reset view` action. Render it from the toolbar's
  right-hand slot.
- Test: drag-reorder tests in both popover suites; reset test
  in `GridToolbar.test.tsx`.
- At this step, every Phase 4 acceptance criterion is met in
  the library. Verify §10 steps 1–14 in browser.

### Step 6 — Demo walk + post-walk fixes

- Run `make typecheck && make lint && make test && make format`.
  Run `pnpm run build`.
- `pnpm run dev`, walk §10 end-to-end in Chrome and Safari.
  Record pass/fail in §11.
- Commit any post-walk fixes as a final commit (Phase 0 needed
  three; Phase 1 needed one; Phase 2 needed three; Phase 3
  needed one — expect ~1–3).

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `FilterCondition` widening breaks an existing consumer that constructs conditions inline. | The widening is a strict superset. The only inline-constructed condition in-repo is the one test row at `DataTable.test.tsx:74`; verified to still typecheck and evaluate identically. |
| `applyTextFilters` → `applyFilters` rename misses a caller. | Single in-repo caller (`DataTable.tsx:59`). `grep -rn applyTextFilters` confirms. ESLint + typecheck catch any miss. |
| Number filter with empty value silently hides all rows because `Number("")` is 0. | Evaluator explicitly returns dormant (`true`) when `value` parses to NaN OR the trimmed string is empty. Covered by tests. |
| `between` filter with reversed bounds (lo > hi) hides all rows. | Evaluator swaps bounds defensively (§4.4). Covered by test. |
| Existing user habit: clicking a column header to sort. After removal it is a no-op. | Acceptable design choice — PH-Navigator has no pre-existing user base trained on a sort chevron, so there's no habit to manage. Header clicks route only to the Phase 3 column-select gesture (§12 Q9 resolution). No announcement, no toast, no tooltip. |
| Header-click as a hit zone collides with the Phase 3 column-select strip drag. | Already addressed in Phase 3: the column-select strip is the top 6 px; the header label area is the remaining ~24 px. After Phase 4 removes the header button entirely, the header label `<span>` has no `onClick` and no pointer behaviour — clicking it does nothing. Phase 3 drag is unaffected. |
| Dormant filter rules should not tint the column. | `isFilterContributing(rule)` excludes empty values per shape. Tested explicitly. |
| Filter + sort on same column → ambiguous tint. | Precedence rule: filter wins. Documented in §4.10 and tested. Phase 6 generalizes via the 7-subset palette. |
| Tint tokens become muddy when composited with the Phase 3 selection-fill overlay (10% accent over green) on a filtered column. | `color-mix(in oklab, ...)` composites cleanly across hue families. Manual verification in §10 step 12 (selection inside a filtered column). |
| `@dnd-kit/sortable` in jsdom requires PointerSensor setup that doesn't fire in tests. | Tests bypass the sensor and fire `DndContext.onDragEnd` directly. Documented in `__tests__/FilterPopover.test.tsx` header comment. |
| Popover content that overflows the viewport (long option list inside `is_any_of`) clips. | Radix Popover handles collision avoidance via `side` / `align` props. The `<details>` disclosure inside the row keeps the option list collapsed by default; long lists scroll inside the disclosure (max-height: 240px). |
| Reset clears more than Phase 4 owns and breaks a future Phase 6 grouping that the user has set up. | Reset clears only `filter: []` and `sort: []`. §4.7 documents this scope explicitly so Phase 6 plans accordingly. |
| Native `<select>` inside a Radix Popover refocuses the page body on Mac Safari (known Radix bug). | Use Radix's `onCloseAutoFocus` to keep focus on the popover trigger, not the page. Manual Safari walk in §10. |
| User changes the field on a rule whose value slot doesn't apply to the new field type → orphan value. | Field-change handler clears `value`, `valuePair`, and `valueList` on the next condition. Operator is reset to the new field's first catalogue entry. Tested. |
| Single-select filter `is_any_of` evaluates against option-ids but the user thinks in labels. | The option-list checkboxes show the colored pill + label; the underlying `valueList` carries ids. Hover tooltip on each option = label (acceptable; the colored pill is the canonical visual). |
| Toolbar buttons increase shell height and shove the grid down. | Buttons sit on the existing toolbar row; CSS keeps the row at the current ~28 px height. Verified visually. |
| Sort popover ordering doesn't match the visual order of tinted columns. The user can't tell which sort rule applies to which peach-tinted column. | The popover itself shows the stack in rule order; the per-column tint is a presence indicator, not a precedence indicator. Multi-rule stacks read the rule names + directions verbatim from the popover; the tint just answers "is this column participating?" Phase 6's tint cascade refines this with explicit role overlays. |

## 7. What this phase explicitly does not do

- **No OR mode / nested AND-OR.** All rules combine with AND
  (parent plan §16).
- **No persistence.** View state stays in-memory per session
  (US-Builder-Tables criterion 3). Named / shareable views are
  NEW-TBL-1.
- **No group accordion / aggregation column / tint cascade.**
  Phase 6.
- **No column reorder / hide / width.** Those keys exist on
  `ViewState` (`columnOrder`, `hiddenColumns`, `columnWidths`)
  but Phase 4 does not expose UI for them; Reset does not
  clear them.
- **No filter or sort on `attachment` / `argb_color` fields.**
  The registry returns `[]` for those; the field picker
  excludes them.
- **No per-rule "enable / disable" toggle.** A user who wants
  to temporarily disable a rule deletes and re-adds it. AirTable
  has a checkbox toggle; we defer to keep the popover row tight.
- **No 7-subset overlap palette.** Phase 4 ships per-axis tints
  with filter-wins precedence on overlap. The full
  filter ∩ sort ∩ group palette that handles every subset of
  the three axes lands in Phase 6.
- **No "Automatically sort records" toggle in the sort popover.**
  AirTable surfaces this control; Phase 4 omits it because our
  data path re-sorts unconditionally on every view-state change
  (see §4.6 note). If users ask for manual-apply semantics
  later it can be added without a contract change.
- **No condition-group / nested-AND-OR (`+ Add condition group`
  in the AirTable screenshot).** OR mode is deferred per parent
  plan §16. The filter popover footer shows `+ Add condition`
  only, not the second `+ Add condition group` button.
- **No "Describe what you want to see" natural-language filter
  builder** (the green dotted box at the top of AirTable's
  filter popover). That's AirTable's LLM feature; out of scope.
- **No undo for filter/sort changes.** View state lives outside
  the write reducer's history (per Phase 0 contract — only
  data writes go into history). A user who wants to revert a
  Reset action rebuilds the stack from the popover. AirTable
  matches this.
- **No header `aria-sort` attribute.** Sort state is no longer
  a per-column property of the rendered grid; it's a view-state
  list announced via the live region.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — operator catalogue + evaluator + types | 2.0 | 3.0 |
| 2 — header chevron removal + axis tint     | 1.5 | 2.5 |
| 3 — filter popover (no drag)               | 3.5 | 5.0 |
| 4 — sort popover (no drag)                 | 2.0 | 3.0 |
| 5 — drag-to-reorder + Reset menu           | 2.5 | 4.0 |
| 6 — demo walk + post-walk fixes            | 1.5 | 2.0 |
| **Total**                                  | **13.0** | **19.5** |

Parent plan budgeted 12–18; this estimate's high end pushes
1.5 hr past, allowing for the additional tint-plumbing work
(per-axis tokens, contributing-rule detection, overlap
precedence, CSS layering against the Phase 3 selection
overlay). The 5-hour high on Step 3 is still the largest
single allocation — the per-field-type value editor needs
four distinct shapes (text input, number input, number pair,
option-id checkboxes) and each needs its own keyboard / focus
plumbing.

## 9. Commit plan

One commit per step. Subject prefixes match the data-table
convention from Phases 0–3:

1. `feat(data-table): filter operator catalogue + evaluator`
2. `feat(data-table): remove header chevron + per-axis cell tint`
3. `feat(data-table): stacked filter toolbar popover`
4. `feat(data-table): stacked sort toolbar popover`
5. `feat(data-table): popover drag-reorder + Reset view`
6. `chore(data-table): Phase 4 demo fixes` (only if post-walk
   polish is needed; otherwise omit and let step 5 be the closer)

## 10. Demo script

After Step 6, walk this end-to-end against Rooms in a fresh
browser session. Record pass/fail in §11. Repeat in Safari.

1. `make dev` → Postgres up. `make backend` + `make frontend`.
2. Sign in, open any project, navigate to Equipment → Rooms.
   Confirm the toolbar now shows `Filter ▾` / `Sort ▾` buttons
   on the left and a `⋯` overflow on the right.
3. **Open Filter, add a single rule.** Click `Filter ▾`. Click
   `+ Add filter rule`. The new row defaults to the first
   non-read-only field (e.g. `name`), operator `contains`,
   empty value. Grid is unchanged. Type `liv` in the value
   box → rows narrow to ones whose `name` contains "liv"
   (case-insensitive).
4. **Switch the rule to a single_select operator.** Change the
   field to `floor_level`. Operator dropdown updates to
   `is any of / is none of / is empty / is not empty`. Value
   editor switches to a checkbox list of floor-level options
   (pill + label). Tick `Ground` and `1st`. Grid filters to
   rooms on those floors.
5. **Add a number rule.** `+ Add filter rule`. Change the
   field to `num_people`. Operator `>`. Value `2`. Status chip
   reads `Filtered by 2 fields`.
6. **`between` rule.** Add a third rule, field `icfa_factor`,
   operator `between`, values `0.5` and `1.0`. Grid filters
   accordingly. Swap the bounds (`1.0` and `0.5`) — same rows
   stay visible (defensive bound swap).
7. **Delete a rule.** Click `×` on the second rule
   (`num_people > 2`). Status chip drops to
   `Filtered by 2 fields`.
8. **Open Sort, add a single rule.** Close Filter. Click
   `Sort ▾`. `+ Add sort rule`. Field defaults to first
   sortable field. Set to `number`, direction `asc`. Grid
   sorts. Status chip reads `Sorted by 1 field`.
9. **Add a second sort rule.** Field `name`, direction `asc`.
   Tie-break works: rows with equal `number` order by `name`.
10. **Drag-reorder.** In the Sort popover, drag the second
    rule above the first. Sort precedence flips; grid
    re-orders.
11. **Headers are clean (no chevron).** Visually confirm:
    every column header shows only its label text. No sort
    chevron `▲/▼`, no underlying `<button>`, no hover state on
    the label itself. The Phase 3 column-select strip is still
    there (cursor changes to `cell` near the top edge).
    Clicking the header label is a no-op.
12. **Per-axis cell tint.** With `view.filter = [{name
    contains "liv"}]` and `view.sort = [{number asc}]` active
    from earlier steps:
    - The `name` column's body cells and header are visibly
      tinted green (filter token).
    - The `number` column's body cells and header are tinted
      peach (sort token).
    - The toolbar `Filter` button is green; the `Sort` button
      is peach.
    - All other columns have no tint.
    Now click a single cell in the `name` column to focus it
    (Phase 0). The cell shows: green tint base + active-cell
    blue outline. The two visuals compose without muddiness.
13. **Filter + sort overlap precedence.** Open Filter, add a
    rule `number > 0` (contributing). Open Sort, confirm the
    `number` sort rule is still present. The `number` column
    now appears in both axes; it tints **green** (filter wins
    by precedence rule §4.10).
14. **Dormant rule does not tint.** Open Filter, add a third
    rule `name is`, leave its value empty. The `name` column
    is still green (the first contributing `contains "liv"`
    rule keeps it active). Delete the first rule via 🗑. The
    `name` column's green tint disappears (only the dormant
    rule remains; dormant rules don't tint).
15. **Reset view.** Click the `⋯` overflow → `Reset view`.
    Both filter and sort stacks clear. Toolbar buttons revert
    to neutral (no tint). Grid returns to pre-filter,
    pre-sort order. All column tints clear. Column order /
    hidden columns untouched.
16. **Read-only mode.** Sign in as Viewer (or open a locked
    version). Repeat steps 3, 8, 10. Filter + sort + reorder
    work. Tints render identically. Inline edit and Delete N
    stay blocked from Phase 2.
17. **No Phase 0/1/2/3 regressions.** Mouse-drag still builds
    a range. Shift+Arrow still extends. ⌘C still copies. ⌘V
    still pastes (with the current filter still active —
    pasted values land at the active cell regardless of
    whether the target row is currently visible; if the paste
    target's filtered-out, the cell write still goes through
    but the row becomes visible again if the next filter pass
    matches it). Shift+Enter still inserts a row. Gutter
    checkbox still toggles row select. Toolbar `Delete N`
    still appears with the confirm dialog when rows are
    selected.
18. **Filter dormant rows (data path, not tint).** With the
    Filter popover open and a rule on `name contains` and an
    empty value, the grid shows all rows. Typing into the
    value box narrows progressively. Backspacing the value
    back to empty restores all rows. Tint follows: green
    appears as soon as the first non-empty character is
    typed; disappears on backspace-to-empty.
19. **Type-checks / lint / tests / build.** Run `make
    typecheck && make lint && make test && pnpm run build`
    in a separate terminal — everything clean.
20. **Safari walk.** Repeat steps 3, 8, 10, 12, 15 in Safari.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — operator catalogue + evaluator + types  | — | — | — |
| 2 — header chevron removal + axis tint      | — | — | — |
| 3 — filter popover (no drag)                | — | — | — |
| 4 — sort popover (no drag)                  | — | — | — |
| 5 — drag-reorder + Reset menu               | — | — | — |
| 6 — demo walk + post-walk fixes             | — | — | — |
| Phase 4 overall                             | — | — | — |

## 12. Open questions — resolved 2026-05-23

Ed walked the ten open questions on 2026-05-23. Resolutions
below.

1. **Allow the same field in multiple sort rules?** — RESOLVED.
   Decision: **exclude duplicates from the picker.** A field
   can only appear in one sort rule; once used it disappears
   from the field dropdown of any subsequent rule. When all
   sortable fields are in the stack, "+ Add another sort"
   becomes disabled (or hidden — implementation choice at
   Step 4). Rationale: a second `number asc` rule is a no-op
   and clutters the popover; keeping the picker tight beats
   AirTable's permissiveness here.

2. **Filter on read-only fields?** — RESOLVED.
   Decision: **allow read-only fields in the filter picker.**
   Filtering a Rooms grid by `icfa` (read-only computed
   number) is a real use case; editability is irrelevant to
   filterability. Sort already allows read-only fields, so
   this keeps the two axes symmetric. The
   `filterableFieldDefs` memo in §4.11 drops the
   `!fieldDef.read_only` clause; only the `attachment` /
   `argb_color` exclusion remains.

3. **Overlap precedence: filter wins, or blend the tokens?** — RESOLVED.
   Decision: **filter wins.** When a column is in both
   `view.filter` (contributing) and `view.sort`, the column
   tints green. Clear, easy to test, and Phase 6 will replace
   this with the proper 7-subset palette without a contract
   change.

4. **Reset menu surface — Radix Popover or native `<details>`?** — RESOLVED.
   Decision: **Radix Popover.** Keeps the `⋯` overflow
   visually consistent with the Filter / Sort buttons (same
   surface, same shadow, same border-radius), and the focus
   edge case is small enough to handle if it bites. Native
   `<details>` would have been a pragmatic fallback; not
   needed up front.

5. **Default operator on rule create — first in catalogue, or
   smartest pick?** — RESOLVED.
   Decision: **first in catalogue.** The catalogue is already
   ordered most-useful-first (text → `contains`, number →
   `=`, single_select → `is any of`). No need for a separate
   `defaultOperator` slot. AirTable's `is` default for text
   is a minor mismatch we accept in exchange for a smaller
   surface.

6. **Numeric value input — `<input type="number">` or
   `<input type="text" inputMode="decimal">`?** — RESOLVED.
   Decision: **`<input type="number" step="any">`.** Spinners
   are useful; comma-pasted strings like "1,234" are rare in
   this domain (Rooms uses single-digit floor counts and
   decimal iCFA values). The evaluator's NaN-handling keeps
   the rule dormant if a paste does fail to parse.

7. **Cross-browser verification gating.** — RESOLVED.
   Decision: **Chrome + Safari only; no Firefox.** Matches
   Phase 3 §12 resolution 6. Radix and `@dnd-kit` are
   well-tested in Firefox; revisiting only if a Phase 4 demo
   surfaces an engine-specific quirk.

8. **Operator labels — full word or symbol?** — RESOLVED.
   Decision: **match AirTable verbatim.** That means:
   - **Text operators take an ellipsis** when they accept a
     value: `contains… / does not contain… / is… / is not…`.
     The valueless `is empty` / `is not empty` get no
     ellipsis. (Matches the dropdown screenshot.)
   - **Number operators stay symbolic**: `= / ≠ / > / <` plus
     `between`, `is empty`, `is not empty`.
   - **Single-select operators use the AirTable phrasing**:
     `is any of` / `is none of` / `is empty` / `is not empty`.
   - **Sort direction labels** use AirTable's literal arrows:
     `A → Z` / `Z → A`, regardless of field type.

   The catalogue in §4.2 needs its `label` strings updated to
   carry the ellipsis on text/value-taking operators when
   Step 1 lands.

9. **Header-click hint when sort is unset.** — RESOLVED.
   Decision: **header clicks are select-only; no
   announcement.** The header label region routes only to
   the Phase 3 column-select gesture. PH-Navigator has no
   pre-existing user base trained on a sort chevron, so the
   accessibility-affordance question is moot. The "Sort is
   in the toolbar" announcement is removed from the plan
   entirely (drop the line from §6 risk row about §12 Q9
   mitigation; the row stays as a documented design choice,
   not a deferred mitigation).

10. **Exact tint hues for the two tokens.** — RESOLVED.
    Decision: **match AirTable's colors.** Sample the
    button-active background colours directly from the
    screenshots walked 2026-05-23 (the green
    `Filtered by DISPLAY_NAME` chip and the peach `Sort`
    button) using DevTools' color picker, and use those as
    the `--data-table-tint-filter` /
    `--data-table-tint-sort` body values. The matching
    `-header` variants are ~3% deeper saturation of the same
    hue. Recorded in Step 2's commit message; verified in
    the §10 step-12 walk. Adjust if the demo walk surfaces
    contrast issues against the Phase 3 selection overlay.
    The OKLCH values in §4.10 are a placeholder until Step 2
    samples the AirTable swatches.

## 13. Parent-plan delta

This Phase 4 plan supersedes one rule from
`datatable-airtable-parity.md`:

- **Parent §3 sequencing rule 6** ("Toolbar is the single
  mutation channel for sort/filter/group. Header-click sort
  survives Phase 0 but is rewritten in Phase 4 to call the
  same `onViewChange` path the toolbar popovers do.") — the
  "header-click sort survives" half is reversed by the
  refinement walked 2026-05-23. After Phase 4, header-click
  sort does not survive in any form; sort lives only in the
  toolbar popover. The parent plan should be updated with a
  one-line note pointing here, in the same place where the
  Phase 3 sign-off updated the status table. Suggested edit:

  > 6. **Toolbar is the single mutation channel** for sort/
  >    filter/group (L8.2). ~~Header-click sort survives Phase
  >    0 but is rewritten in Phase 4 to call the same
  >    `onViewChange` path the toolbar popovers do.~~ Phase 4
  >    removes the per-column header chevron entirely; sort is
  >    only reachable from the toolbar popover (see
  >    `phase-4-stacked-filter-sort.md` §4.9).

Also adds two visual deliverables that the parent plan
nominally assigned to Phase 6 (tint cascade):

- Per-axis cell tint (filter=green, sort=peach), single-axis
  only.
- Per-axis toolbar button tint when active.

The Phase 6 §12 plan is unchanged: it still owns the full
7-subset palette that handles every overlap of
filter ∩ sort ∩ group. Phase 4 ships the single-axis
foundation and the overlap-precedence rule (§4.10) that
Phase 6 will generalize.
