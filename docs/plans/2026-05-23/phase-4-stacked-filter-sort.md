---
DATE: 2026-05-23
TIME: planning
STATUS: Draft — not yet walked. Awaiting open-questions answers in §12
        before execution begins.
SCOPE: Phase 4 of the `<DataTable>` AirTable-parity plan. Stacked
       filter + sort toolbar popovers wired to user-intent `ViewState`
       (PoC L8.1). Per-field-type operator sets via the field
       registry (L2.3), one mutation channel per axis (L8.2),
       dormant-row-passes-everything semantics (L8.4), drag-to-reorder
       within each popover, and a Reset action in the toolbar
       overflow. Header-click sort survives but routes through
       `onViewChange` (replaces today's direct `view.sort`
       single-rule overwrite); Shift+Click appends. Driven against
       Rooms (US-EQ-2). No other consumers touched. Closes wishlist
       item #1e (stacked filter / sort with toolbar-tinted state) —
       minus the tint cascade itself, which lands in Phase 6.
PARENT-PLAN: docs/plans/2026-05-23/datatable-airtable-parity.md
RELATED:
  - context/technical-requirements/data-table.md (canonical contract,
    §View State + §Behavior + §Field-Type Registry)
  - context/user-stories/30-tables-equipment.md
    (US-Builder-Tables criterion 2 — stacked toolbar; criterion 3 —
    session-only view state + reset)
  - docs/plans/2026-05-23/phase-0-foundation-refactor.md
  - docs/plans/2026-05-23/phase-1-inline-edit-popover.md
  - docs/plans/2026-05-23/phase-2-row-insert-delete.md
  - docs/plans/2026-05-23/phase-3-pointer-drag-selection.md
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
   in `DataTable.tsx:289` overwrites `view.sort` with one rule.
   There is no way to ask for "sort by floor_level asc, then by
   number asc" — and no way to remove sort short of clicking the
   same header twice into "desc" then once more to start over. A
   user who wants the AirTable behaviour ("stack any number of
   sorts, drag to reorder, X to remove") has nowhere to express
   that intent.
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
sort/filter change — header-click, popover edit, drag-reorder,
reset — flows through `onViewChange(nextViewState)` (L8.2), and the
view state is *derived* into TanStack shapes via memo (L8.1).
Operator semantics live in the typed `FieldDef` registry so adding
a new field type later adds its operator bundle once and every
consumer table gets the new operators for free (L2.3). The drag
handle inside each popover row uses `@dnd-kit/sortable` — the one
new dependency this phase introduces (parent plan §15).

After Phase 4, the toolbar is the **single mutation channel** for
sort and filter on every consumer table, the rule lists in
`ViewState` are the user-intent source of truth, and any cell
that wants to be filtered or sorted by a future field type only
has to declare its operator bundle in the registry.

## 2. Binding constraints

1. **Library-only.** All changes land in
   `frontend/src/shared/ui/data-table/` plus `frontend/src/App.css`
   for the new popover surface, toolbar button, and reset menu.
   **Zero touches** to `RoomsTable.tsx`, `EquipmentTab.tsx`, or
   anything under `features/`. If a consumer file changes during
   this phase, pause and re-evaluate.
2. **`onViewChange` is the only mutation channel for sort/filter**
   (L8.2). Every gesture — popover Add Rule, popover row edit,
   popover row reorder, popover row delete, header-click,
   Shift+Click header, Reset — calls `onViewChange(nextView)`
   exactly once with a fully-shaped `ViewState`. No partial-update
   prop, no per-axis callback.
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
8. **Header-click sort is preserved and re-routed**, not removed
   (parent plan §3 sequencing rule 6). The existing sort indicator
   chevron in `GridHeader.tsx:75` continues to render. The click
   behaviour switches: plain click sets a single-rule
   `view.sort = [{fieldKey, direction}]` (replacing the stack);
   Shift+Click appends to the stack; clicking a column already
   in the stack toggles its direction without removing other
   rules.
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
11. **Header-click sort still works.** With the sort popover
    empty, click the `Number` column header. `view.sort` becomes
    `[{fieldKey: "number", direction: "asc"}]`; the sort
    indicator chevron renders. Click again → direction flips to
    `desc`. Click a third time → does **not** clear the rule
    (Phase 4 keeps the existing two-state toggle; clearing is
    done via the popover `×` or the Reset action).
12. **Shift+Click appends.** With `number asc` already in the
    stack, Shift+Click the `Name` header. `view.sort` becomes
    `[{number asc}, {name asc}]`. Shift+Click `Name` again
    flips the second rule to `desc`. The popover reflects this
    state if opened.
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
                             view + onViewChange down; replaces the
                             inline `toggleSort` body with the new
                             onHeaderSort dispatcher (still ≤ ~280 LOC)
  components/
    GridHeader.tsx           extended — onHeaderSort gains a
                             `shiftKey` parameter so Shift+Click
                             routes through the append path
    GridBody.tsx             UNCHANGED
    GridGutter.tsx           UNCHANGED
    GridToolbar.tsx          extended — adds Filter / Sort buttons
                             on the left of the status row and the
                             ⋯ overflow menu on the right; existing
                             `actions` slot stays for the Phase 2
                             Delete button
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

export const TEXT_OPERATORS: readonly FilterOperatorDef[] = [
  { operator: "contains",         label: "contains",          shape: { kind: "string" } },
  { operator: "does_not_contain", label: "does not contain",  shape: { kind: "string" } },
  { operator: "is",               label: "is",                shape: { kind: "string" } },
  { operator: "is_not",           label: "is not",            shape: { kind: "string" } },
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

```
┌────────────────────────────────────────────────────────────┐
│ Filter by                                                  │
│                                                            │
│ ⋮⋮  [Field ▾]  [Operator ▾]  [Value ───────]     ×        │ ← rule row
│ ⋮⋮  [Field ▾]  [Operator ▾]  [Value ───────]     ×        │
│                                                            │
│ + Add filter rule                                          │
└────────────────────────────────────────────────────────────┘
```

- **Drag handle (`⋮⋮`)** — `@dnd-kit/sortable` listener. Pointer-
  down + drag reorders the rule within `view.filter`. ARIA grab
  handle, focusable, Space + arrow-keys also reorder for
  keyboard users.
- **Field picker** — native `<select>` (L10.2 — native controls
  good enough for popover MVPs). Lists every `FieldDef` whose
  `read_only !== true` and whose registry catalogue is
  non-empty (excludes `attachment` and `argb_color`). Defaults
  to the first such field on rule create.
- **Operator picker** — native `<select>`. Options come from
  `getFilterOperators(fieldDef)`. Switching the field resets
  the operator to the catalogue's first entry and clears the
  value slot (the previous operator's value shape may not
  match).
- **Value editor** — chosen by `FilterValueShape`:
  - `none` → no editor rendered.
  - `string` → borderless `<input type="text">`.
  - `number` → `<input type="number" inputMode="decimal">`. The
    raw string is stored on `value`; parsing happens in the
    evaluator. Non-numeric input keeps the rule dormant.
  - `numberPair` → two `<input type="number">`s with an `and`
    label between them.
  - `optionIdList` → a `<details><summary>` disclosure listing
    the field's options as checkboxes (label + colored pill).
    Multi-select; checked ids accumulate in `valueList`.
- **Delete (`×`)** — splices the rule out of `view.filter`.
- **Add filter rule** — appends a dormant rule (first field /
  first operator / empty value) so the user can start filling
  it in. Until the value is filled in, the row passes
  everything (L8.4).

Markup composition (sketch):

```tsx
<Popover.Root open={open} onOpenChange={setOpen}>
  <Popover.Trigger asChild>
    <button className="data-table-toolbar-button">
      Filter
      {view.filter.length ? ` (${view.filter.length})` : ""}
      <span aria-hidden>▾</span>
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

```
┌────────────────────────────────────────────────────────────┐
│ Sort by                                                    │
│                                                            │
│ ⋮⋮  [Field ▾]  [asc | desc]                       ×        │
│ ⋮⋮  [Field ▾]  [asc | desc]                       ×        │
│                                                            │
│ + Add sort rule                                            │
└────────────────────────────────────────────────────────────┘
```

Same shell as the filter popover; rule row is simpler:

- **Drag handle** — same as filter.
- **Field picker** — `<select>` of every `FieldDef` (read-only
  fields included — sorting by a computed read-only column is
  valid). The same field is allowed in multiple sort rules only
  if Ed says so in §12 question 1; the default plan is to
  exclude already-used fields from the picker so the stack
  cannot trivially duplicate itself.
- **Direction toggle** — pair of radio-style buttons
  `[asc | desc]` driven by `rule.direction`.
- **Delete (`×`)** — splices the rule out of `view.sort`.

`sortRows` in `lib.ts` already walks `sortRules` in order and
returns the first non-zero comparator result, so the data path
needs no change.

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

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [Filter ▾]  [Sort ▾]   Editable · Filtered by 2 · Sorted by 1 · Ungrp  ⋯ │
│                                                              [Delete 3]  │
└──────────────────────────────────────────────────────────────────────────┘
```

- Buttons on the left of the status chips: `Filter ▾`, `Sort ▾`,
  each rendering its rule count next to the label when non-zero.
- Status chips remain, slightly re-worded: `Filtered by N fields`
  / `Sorted by N fields` (plural-aware, matches Phase 0 status
  text wording).
- `⋯` overflow menu on the right. The existing `actions` slot
  (Phase 2 Delete) renders below the status row when present, so
  it doesn't fight the buttons for horizontal space.
- All toolbar controls keep `tabIndex={-1}` semantics consistent
  with Phase 2 (the grid wrapper is the keyboard-focus host;
  toolbar controls are reachable by Tab from the wrapper).

CSS additions (sketch — colors / spacing match the existing
toolbar):

```css
.data-table-toolbar { display: flex; align-items: center; gap: 8px; }
.data-table-toolbar-buttons { display: flex; gap: 4px; }
.data-table-toolbar-button {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 4px 8px; border-radius: 4px;
  background: transparent; border: 1px solid var(--border);
  font-size: 12px;
}
.data-table-toolbar-button[aria-expanded="true"] {
  background: color-mix(in oklab, var(--accent) 12%, transparent);
}
.data-table-view-popover {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  min-width: 380px;
  box-shadow: 0 4px 14px rgba(0,0,0,0.12);
}
.data-table-view-popover-rule {
  display: grid;
  grid-template-columns: 16px 1fr 1fr 2fr 20px;
  gap: 6px;
  align-items: center;
  padding: 4px 0;
}
.data-table-view-popover-drag {
  cursor: grab;
  color: var(--muted);
}
.data-table-view-popover-add {
  margin-top: 6px;
  font-size: 12px;
  color: var(--accent);
}
.data-table-view-popover-rule[data-dragging="true"] {
  opacity: 0.6;
  cursor: grabbing;
}
```

### 4.9 Header-click sort rewrite

`DataTable.tsx:289` `toggleSort` is rewritten to accept the
mouse event's `shiftKey`. `GridHeader.tsx`'s sort button passes
the event through:

```tsx
<button
  type="button"
  className="data-table-header-button"
  tabIndex={-1}
  onClick={(event) => {
    if (column) onToggleSort(column.fieldKey, event.shiftKey);
  }}
>
```

The dispatcher:

```ts
const onHeaderSort = (fieldKey: string, shiftKey: boolean) => {
  const existing = view.sort.findIndex((rule) => rule.fieldKey === fieldKey);
  if (!shiftKey) {
    // Plain click: replace stack with a single rule, toggling
    // direction if already at the top of the stack.
    const direction: "asc" | "desc" =
      existing === 0 && view.sort[0]?.direction === "asc" ? "desc" : "asc";
    onViewChange({ ...view, sort: [{ fieldKey, direction }] });
    return;
  }
  // Shift+Click: append or toggle in place.
  if (existing === -1) {
    onViewChange({
      ...view,
      sort: [...view.sort, { fieldKey, direction: "asc" }],
    });
    return;
  }
  const next = [...view.sort];
  next[existing] = {
    fieldKey,
    direction: next[existing]!.direction === "asc" ? "desc" : "asc",
  };
  onViewChange({ ...view, sort: next });
};
```

Header-click never deletes a rule. The user removes a rule via
the popover `×` or Reset. This is intentional: a stack of 4 sort
rules accidentally cleared by a wayward header click would be
maddening.

The aria-sort attribute on each `<th>` continues to derive from
`directionByFieldKey.get(column.fieldKey)`, so multi-rule stacks
correctly announce per-column sort direction.

### 4.10 Visible-fields path

`editableFieldDefs` (the list the field picker shows) is computed
once in `DataTable.tsx` and threaded down to both popovers:

```ts
const filterableFieldDefs = useMemo(
  () => fieldDefs.filter((fieldDef) =>
    !fieldDef.read_only &&
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
defaulting to text). Read-only computed columns can be filtered
but not edited — the popover treats `read_only` as "not editable
through the popover" only at the cell-edit level (Phase 1); the
filter/sort registry does not respect `read_only` for sort, and
respects it for filter only to the extent it has nothing
meaningful to filter on (which is rare; even read-only text is
filterable).

(Decision point in §12 question 2 — confirm or reverse: today's
plan filters read-only fields, which matches AirTable. Excluding
them would simplify the picker but lose useful behaviour.)

### 4.11 Test plan

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
  - Header-click on `name` with `shiftKey: true` and an
    existing single rule appends a second rule.
  - Header-click on a field already in the stack toggles its
    direction in place without removing other rules.
  - Plain header-click with a non-empty stack replaces the
    stack with a single rule on the clicked field.
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

### Step 2 — Header-click sort dispatcher

- Replace `DataTable.tsx:289` `toggleSort` with `onHeaderSort`
  per §4.9. Thread `shiftKey` through `GridHeader.tsx:69`.
- Update `aria-sort` derivation to read from the full stack
  (already correct; verify).
- Test: `DataTable.test.tsx` extensions for plain-click replace,
  Shift+Click append, Shift+Click toggle-in-place.
- At this step, header-click behaviour matches the parent
  plan's Phase 4 contract. The popover UI is still absent;
  the stack is observable via the chip text.

### Step 3 — Filter popover (no drag yet)

- Add `@dnd-kit/sortable` to `package.json` (still un-used).
- Create `components/FilterPopover.tsx` with the Radix Popover
  shell, rule list, Add Rule footer, per-row editors. No drag
  handle yet — the rule order is locked at append order.
- Extend `GridToolbar.tsx` to render the `Filter ▾` button on
  the left of the status row. The button toggles popover open
  state.
- Wire `DataTable.tsx` to thread `view.filter`, `onViewChange`,
  and `filterableFieldDefs` to the toolbar / popover.
- Test: `__tests__/FilterPopover.test.tsx` (no drag),
  `__tests__/GridToolbar.test.tsx`.
- At this step, the user can build a filter stack via Add Rule
  + edit, delete rules, and see the grid filter live. Verify
  §10 steps 1–7 in browser.

### Step 4 — Sort popover (no drag yet)

- Create `components/SortPopover.tsx` with the same shell as
  FilterPopover and the simpler rule row (field + asc/desc + ×).
- Extend `GridToolbar.tsx` to render the `Sort ▾` button next
  to `Filter ▾`.
- Wire `view.sort` + `onViewChange` to the popover.
- Test: `__tests__/SortPopover.test.tsx`.
- At this step, stacked sort works via popover + via
  Shift+Click on headers. Verify §10 steps 8–12 in browser.

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
| Shift+Click header sort collides with the drag-pointer handler. | The Phase 3 column-select strip lives **above** the header button, so Shift+Click on the button passes only the `shiftKey` through `onClick`. The drag hook short-circuits when `closest('.data-table-column-select-strip')` succeeds; the sort button isn't inside that strip. Verified in §10 step 12. |
| `@dnd-kit/sortable` in jsdom requires PointerSensor setup that doesn't fire in tests. | Tests bypass the sensor and fire `DndContext.onDragEnd` directly. Documented in `__tests__/FilterPopover.test.tsx` header comment. |
| Popover content that overflows the viewport (long option list inside `is_any_of`) clips. | Radix Popover handles collision avoidance via `side` / `align` props. The `<details>` disclosure inside the row keeps the option list collapsed by default; long lists scroll inside the disclosure (max-height: 240px). |
| Reset clears more than Phase 4 owns and breaks a future Phase 6 grouping that the user has set up. | Reset clears only `filter: []` and `sort: []`. §4.7 documents this scope explicitly so Phase 6 plans accordingly. |
| Native `<select>` inside a Radix Popover refocuses the page body on Mac Safari (known Radix bug). | Use Radix's `onCloseAutoFocus` to keep focus on the popover trigger, not the page. Manual Safari walk in §10. |
| User changes the field on a rule whose value slot doesn't apply to the new field type → orphan value. | Field-change handler clears `value`, `valuePair`, and `valueList` on the next condition. Operator is reset to the new field's first catalogue entry. Tested. |
| Single-select filter `is_any_of` evaluates against option-ids but the user thinks in labels. | The option-list checkboxes show the colored pill + label; the underlying `valueList` carries ids. Hover tooltip on each option = label (acceptable; the colored pill is the canonical visual). |
| Toolbar buttons increase shell height and shove the grid down. | Buttons sit on the existing toolbar row; CSS keeps the row at the current ~28 px height. Verified visually. |
| Header sort indicator only shows the chevron for the top rule, not multi-rule stacks. | Acceptable Phase 4 visual. Phase 6 (`stacked group accordion + per-column aggregations + tint cascade`) introduces toolbar-tinted columns; per-rule index numbering on the header chevron is a Phase 6 polish item. |

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
- **No filter / sort tinting on columns.** That visual is Phase
  6's `ROLE_BACKGROUNDS.body` palette. Phase 4 ships the
  *behaviour*; Phase 6 layers the *colour* on top.
- **No header chevron per-rule index numbering** (e.g. "1▲ 2▼"
  on multi-rule stacks). Acceptable visual gap — Phase 6 polish.
- **No undo for filter/sort changes.** View state lives outside
  the write reducer's history (per Phase 0 contract — only
  data writes go into history). A user who wants to revert a
  Reset action rebuilds the stack from the popover. AirTable
  matches this.

## 8. Effort estimate

| Step | Hours (low) | Hours (high) |
|------|------------:|-------------:|
| 1 — operator catalogue + evaluator + types | 2.0 | 3.0 |
| 2 — header-click sort dispatcher           | 0.5 | 1.0 |
| 3 — filter popover (no drag)               | 3.5 | 5.0 |
| 4 — sort popover (no drag)                 | 2.0 | 3.0 |
| 5 — drag-to-reorder + Reset menu           | 2.5 | 4.0 |
| 6 — demo walk + post-walk fixes            | 1.5 | 2.0 |
| **Total**                                  | **12.0** | **18.0** |

Parent plan budgeted 12–18; this estimate lands inside that
window. The 5-hour high on Step 3 is the largest single
allocation — the per-field-type value editor needs four
distinct shapes (text input, number input, number pair,
option-id checkboxes) and each needs its own keyboard / focus
plumbing.

## 9. Commit plan

One commit per step. Subject prefixes match the data-table
convention from Phases 0–3:

1. `feat(data-table): filter operator catalogue + evaluator`
2. `feat(data-table): header-click sort routes through onViewChange`
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
11. **Header-click plain.** Close popover. Click the `Floor`
    column header. `view.sort` collapses to a single rule
    `[{floor_level asc}]` (plain click replaces). Sort
    popover, when reopened, shows the single rule.
12. **Header-click Shift to append.** Shift+Click the `Number`
    column header. `view.sort` becomes
    `[{floor_level asc}, {number asc}]`. Shift+Click `Number`
    again — the second rule flips to `desc`. Other rules
    untouched.
13. **Reset view.** Click the `⋯` overflow → `Reset view`.
    Both filter and sort stacks clear. Grid returns to
    pre-filter, pre-sort order. Column order / hidden columns
    untouched (verify by visually checking the column order).
14. **Read-only mode.** Sign in as Viewer (or open a locked
    version). Repeat steps 3, 8, 10. Filter + sort + reorder
    work. Inline edit and Delete N stay blocked from Phase 2.
15. **No Phase 0/1/2/3 regressions.** Mouse-drag still builds
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
16. **Filter dormant rows.** With the Filter popover open and
    a rule on `name contains` and an empty value, the grid
    shows all rows. Typing into the value box narrows
    progressively. Backspacing the value back to empty
    restores all rows.
17. **Type-checks / lint / tests / build.** Run `make
    typecheck && make lint && make test && pnpm run build`
    in a separate terminal — everything clean.
18. **Safari walk.** Repeat steps 3, 8, 10, 13 in Safari.

## 11. Sign-off

| Step | Date | Demo passed | Notes |
|------|------|-------------|-------|
| 1 — operator catalogue + evaluator + types  | — | — | — |
| 2 — header-click sort dispatcher            | — | — | — |
| 3 — filter popover (no drag)                | — | — | — |
| 4 — sort popover (no drag)                  | — | — | — |
| 5 — drag-reorder + Reset menu               | — | — | — |
| 6 — demo walk + post-walk fixes             | — | — | — |
| Phase 4 overall                             | — | — | — |

## 12. Open questions — awaiting Ed

These need answers before execution begins. Each defaults to
a concrete choice in the plan above; an alternative is recorded
here so a quick walk can lock it in.

1. **Allow the same field in multiple sort rules?**
   The default plan **excludes** already-used fields from the
   sort popover's field picker (the user cannot trivially
   stack two `number asc` rules; that would be a no-op). The
   alternative is to **allow** duplicates and let the user
   discover the no-op themselves. AirTable allows duplicates.
   - **Default**: exclude duplicates from the picker; show a
     subtle hint when only one field remains unused.
   - **Alternative**: allow duplicates; silent no-op.

2. **Filter on read-only fields?**
   The default plan **allows** filtering on read-only fields
   (matching AirTable). The user can filter a Rooms grid by
   `icfa` (a read-only computed number) without being able to
   edit those cells. The alternative is to exclude read-only
   fields from the filter field picker. Sort already allows
   read-only fields (the comparator handles them; no
   editability is required to sort).
   - **Default**: allow read-only fields in the filter
     picker.
   - **Alternative**: exclude them; users would have to add a
     non-read-only proxy field to filter on it.

3. **Header chevron behaviour with multi-rule sort stacks.**
   The default plan renders the chevron on every column that
   appears in the stack, but the chevron shows only direction
   (▲ / ▼), not the rule's position in the stack. A user
   reading the headers cannot tell whether `floor_level` is
   the primary or tertiary sort. The alternative is to render
   a small numeric badge next to the chevron ("▲1", "▲2") on
   multi-rule stacks.
   - **Default**: chevron only; no numeric badge. Phase 6
     polish.
   - **Alternative**: numeric badge from Phase 4.

4. **Reset menu surface — Radix Popover or native `<details>`?**
   The default plan uses a Radix Popover for the `⋯` overflow
   menu, matching the Filter / Sort buttons. The alternative
   is a native `<details><summary>` element, which sidesteps
   focus-management edge cases on Safari (§6 risk) and adds
   zero dependency surface. Visually they end up the same.
   - **Default**: Radix Popover. Consistency with the rest of
     the toolbar.
   - **Alternative**: native `<details>`. Zero focus risk.

5. **Default operator on rule create — first in catalogue, or
   smartest pick?**
   The default plan picks the first operator in the field's
   catalogue (text → `contains`, number → `=`, single_select
   → `is any of`). AirTable's default is `is` for text, which
   surprises users when they're trying to do a substring
   search. The alternative is to bake the "smartest pick" into
   the catalogue itself by ordering operators most-useful-first.
   - **Default**: first in catalogue; catalogue is already
     ordered most-useful-first (`contains` is first for text).
   - **Alternative**: separate `defaultOperator` field on
     each catalogue entry. Adds a slot for marginal benefit.

6. **Numeric value input — `<input type="number">` or
   `<input type="text" inputMode="decimal">`?**
   `type="number"` gives free up/down spinners + automatic
   numeric IME on mobile but blocks pasting "1,234" (the
   comma confuses parsing). `type="text" inputMode="decimal"`
   accepts anything and the evaluator handles the parse. Phase
   4 lives on desktop so the mobile IME concern is moot; the
   comma-paste case matters more.
   - **Default**: `<input type="number" step="any">`. Spinners
     are useful; comma-pasting is rare in this domain (Rooms
     uses single-digit floor counts and decimal iCFA).
   - **Alternative**: `type="text" inputMode="decimal"`.
     Trades spinners for tolerance.

7. **Cross-browser verification gating.**
   Phase 3's resolution: "Chrome (Vivaldi) or Safari is
   sufficient; no Firefox walk required." Phase 4 reuses that
   default — the popover + DnD machinery is the same across
   engines (Radix is well-tested in Firefox; `@dnd-kit` has
   no engine-specific quirks documented for jsdom-compatible
   pointer events).
   - **Default**: Chrome + Safari walk in §10. No Firefox.
   - **Alternative**: add a Firefox walk.

8. **Operator labels — full word or symbol?**
   The default plan uses symbolic labels for number operators
   (`= / ≠ / > / <`) and word labels for everything else
   (`contains / does not contain / is any of`). The
   alternative is fully-symbolic everywhere or fully-worded
   everywhere. AirTable mixes; we match.
   - **Default**: mixed per §4.2 catalogue.
   - **Alternative**: all-words or all-symbols.

Capture decisions inline above (replace the **Default** line
with a `Decision: …` line and a one-sentence rationale) before
Step 1 begins, mirroring the Phase 3 §12 resolution pattern.
