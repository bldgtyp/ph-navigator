---
DATE: 2026-05-13
TIME: 19:30 EDT
STATUS: Code review of P1-08 first-pass deliverable (shared DataTable
        extraction started; Rooms migrated to read/copy/sort surface).
        Reviewer not yet asked to mark the slice done.
SCOPE: Shared `<DataTable>` extraction + Rooms migration off
       `TablePrimitiveStub`. Reviews un-committed changes against the
       P1-08 row in the roadmap, `context/technical-requirements/data-table.md`
       (canonical contract), `context/UI_UX.md §1.7` (interaction model),
       and the POC parity targets in `research/poc-plans/`. Out-of-scope
       items explicitly deferred to P1-09 (single-select option manager)
       and P1-10 (Rooms-on-shared-table completion) are not flagged as
       gaps unless the current extraction makes them harder.
REVIEWER: Claude (Opus 4.7)
RELATED:
  - docs/plans/01_IMPLEMENTATION-ROADMAP.md (P1-08 row + ledger)
  - docs/plans/2026-05-13/phase-1-full-buildout-plan.md (P1-08 slice)
  - docs/plans/2026-05-13/phase-1-baseline-gap-matrix.md
  - docs/code-reviews/2026-05-13/p1-07-code-review.md (preceding slice)
  - context/technical-requirements/data-table.md (contract)
  - context/UI_UX.md §1.7 (interaction model)
  - context/TECH_STACK.md (TanStack v8 + react-virtual + shadcn-table)
  - research/poc-plans/poc-lessons-for-real-build.md
---

# Code Review — P1-08 Shared DataTable Extraction (first pass)

## Scope Check

P1-08's roadmap scope (roadmap lines 203-214) lists nine `Includes`
items: TanStack/shadcn table path; stable row-id state; keyboard
navigation; frozen identifier column; row gutter; selection/copy/paste;
stacked sort/filter/group; read-only mode; a11y baseline.

The roadmap row's `Lessons` text scopes the first extraction more
narrowly than `Includes`: "reusable controlled API, TanStack rendering,
stable row-id identity, keyboard active-cell/range-selection state,
TSV/HTML copy helpers, paste planning helpers, frozen gutter/identifier
column, local sort affordance, read-only chrome, and focused helper
tests" — explicitly deferring write-op emission, grouped accordions,
and the single-select option manager to P1-09/P1-10.

I am reviewing against the narrower lessons-text scope, since the row
status is `[~]` and Ed has not yet marked POC parity reached. Items in
`Includes` that the lessons text defers are flagged as **scope debt to
later P1 slices**, not as P1-08 blockers — except where the current code
shape makes them measurably harder.

## Diff Summary

| File | Status | Notes |
|---|---|---|
| `docs/plans/01_IMPLEMENTATION-ROADMAP.md` | Modified | Updates P1-08 row status + ledger row to "In progress / Shared extraction started; Rooms migrated to first shared read/copy/sort surface". |
| `frontend/src/App.css` | Modified | Adds `.data-table-shell`, `.data-table-toolbar`, `.data-table-wrap`, `.data-table-empty`, `.data-table-gutter`, `.data-table-frozen`, `.data-table-cell-selected`, `.data-table-cell-active`, `.data-table-header-button`, `.numeric-cell`, `.sr-only`. Reuses BLDGTYP tokens (`--bg-card`, `--accent`, etc.). |
| `frontend/src/features/equipment/components/RoomsTable.tsx` | Modified | Replaced `TablePrimitiveStub` with `<DataTable>`; introduces controlled `view` prop; defines `fieldDefs` (decorative for now) and `DataTableColumnDef<RoomRow>[]`; resolves single-select option ids to labels in accessors. |
| `frontend/src/features/equipment/routes/EquipmentTab.tsx` | Modified | Owns `roomsTableView` state (`emptyViewState`); passes `view`/`onViewChange` to `RoomsTable`. |
| `frontend/src/shared/ui/data-table/DataTable.tsx` | Added | New shared component (≈275 lines). |
| `frontend/src/shared/ui/data-table/lib.ts` | Added | Range normalization, active-cell movement, TSV/HTML copy, TSV parse, paste planning, text filters, locale-numeric sort. |
| `frontend/src/shared/ui/data-table/lib.test.ts` | Added | 6 unit tests covering range normalization, arrow navigation, TSV copy, single-cell-into-rectangle paste, paste overflow, numeric-aware sort. |
| `frontend/src/shared/ui/data-table/types.ts` | Added | `FieldDef`, `DataTableColumnDef`, `SortRule`/`FilterCondition`/`GroupRule`, `ViewState`, `CellWrite`/`WriteOp`, `CellCoord`/`CellRange`, `DataTableProps`, `emptyViewState()` factory. |
| `frontend/src/shared/ui/data-table/index.ts` | Added | Public re-exports. |

Net: backend untouched; one shared frontend primitive landed; Rooms is
the first consumer; old `TablePrimitiveStub` is still referenced in
roadmap history but not used at runtime (Rooms imports `DataTable`
directly, not the stub).

## What's Good

- **Component shape matches the canonical contract.** `DataTableProps`
  exposes `rows`/`getRowId`/`fieldDefs`/`columnDefs`/`view`/`onViewChange`/
  `onWrite`/`readOnly`/`density`, mirroring `data-table.md`. The
  parent-controlled `view` keeps state derivable from user-intent
  shapes rather than TanStack internals. ✓
- **Stable row identity.** `getRowId` flows directly into
  `useReactTable`; no visual-index identity drift. ✓
- **TSV + HTML copy with `ClipboardItem` fallback to `writeText`.** This
  matches the canonical "external paste into Excel/Numbers/AirTable
  preserves row × column shape" goal. ✓
- **Paste planning is pure and well-tested.** `planPaste` handles the
  single-cell-into-rectangle fill case, returns overflow counts without
  silently truncating, and is covered by both happy-path and overflow
  tests in `lib.test.ts`. ✓
- **Frozen identifier column + sticky row gutter.** `.data-table-gutter`
  and `.data-table-frozen` use the layered `position: sticky` + z-index
  lanes the spec calls for. ✓
- **Read-only mode is honest.** When `readOnly` is true the paste
  handler short-circuits and `onRowOpen` is unset by the Rooms consumer
  — no disabled-with-tooltip controls. Matches §1.7 "Edit affordances
  are hidden, not disabled-with-tooltip." ✓
- **Tokens, not hex.** All new CSS uses `var(--bg-card)`, `var(--accent)`,
  `var(--border-subtle)`, etc. — consistent with the P1-04 foundation. ✓
- **`role="grid"` + `aria-rowcount`/`aria-colcount`/`aria-rowindex`/
  `aria-colindex`** are present on the wrap and rows. Polite live region
  for sort announcements. ✓ (Caveats below in **A11y baseline gap**.)
- **Tests are correctly scoped.** Five of six tests target the brittle
  pure helpers (`isCellInRange`, `moveActiveCell`, `rangeToTsv`,
  `planPaste`, `sortRows`); no snapshot/component-test bloat. The
  roadmap explicitly asked for "targeted helper tests for brittle POC
  behaviors". ✓

## Architectural / Contract Divergence

### A1 — Toolbar is text-only, not the five-button popover stack

**Where:** `DataTable.tsx:134-139`, `.data-table-toolbar` in `App.css`.

`UI_UX.md §1.7` and the P1-08 `Includes` line both require a toolbar
with five buttons (Hide / Filter / Group by / Sort by / Color), each
opening a popover; tinted when active; reading as sentence fragments.
The current toolbar renders four `<span>` chips with status text only
("Read-only", "No filters", "Ungrouped", "Unsorted"). There is no
filter popover, no group-by popover, no hide-fields popover.

**Implication:** A consumer cannot actually filter or group via the
shared primitive yet. Sort is reachable only by clicking the column
header (`toggleSort`), which itself only supports single-column sort
(no shift-click stacking — see A6).

**Recommendation:** Either narrow the P1-08 `Includes` line to match
the lessons text (just "local sort affordance + read-only chrome") and
push the toolbar to P1-09/P1-10, or land at least a Sort popover with
stack semantics before declaring POC parity. Right now the row's
`Includes` and `Lessons` disagree about whether stacked filter/sort/group
shipped.

### A2 — `fieldDefs` is decorative; no field-type registry drives behavior

**Where:** `DataTable.tsx:18-26`, `types.ts:11-18`, `RoomsTable.tsx:39-50`.

The canonical contract (`data-table.md` §"Field Definition Registry")
says one typed `FieldDef` should drive render, edit, clipboard
coercion, sort, filter, and aggregation, to avoid scattered field-type
conditionals. In this extraction, `fieldDefs` is accepted but only used
to look up the human display name when announcing a sort change
(`DataTable.tsx:124`). All render/sort coercion lives instead in the
column accessor/`render` functions on `DataTableColumnDef`, with no
dispatch off `field_type`.

That's an understandable cut for a Rooms-only first pass — Rooms has no
typed paste yet, so coercion isn't load-bearing. But it bakes in a
shape where the registry never sees the data; if P1-09 single-select
landing tries to dispatch paste coercion through `field_type:
"single_select"`, it will have to reach back into `fieldDefs` while the
existing code path runs around it.

**Recommendation:** Before P1-09 builds single-select editing on top of
this, decide whether coercion/render lives on `FieldDef.config` (per
spec) or `DataTableColumnDef`. Don't let the two shapes drift further
apart.

### A3 — Click-drag range selection and shift-click anchor extension are not implemented

**Where:** `DataTable.tsx:218-222` (cell `onClick`), `:188-195` (gutter
button `onClick`), `:166-172` (header `onClick`).

`UI_UX.md §1.7` mandates: "Click-drag or Shift+arrow extends a
rectangle. Shift+click sets the head, anchor unchanged." The current
implementation supports only Shift+arrow (`:111-115`). Cell mouse
events are `onClick` only — no `onMouseDown`/`onMouseMove`/`onMouseUp`,
so click-drag selection is impossible. Shift+click on a cell clears
selection (`setSelection(null)` runs unconditionally). Shift+click on a
gutter button replaces, not extends. Header click runs `toggleSort`
instead of selecting the column.

**Implication:** A core part of the "feels like a spreadsheet"
interaction model is missing. This is on the P1-08 `Includes` line
(selection/copy/paste) but absent.

**Recommendation:** Track explicitly in the gap matrix and either land
mouse-drag selection in this slice's close-out or move it to the
follow-up slice that owns the toolbar.

### A4 — Tab does not "leave the table"; inner buttons trap focus

**Where:** Gutter row-select `<button>` (`DataTable.tsx:184-198`),
header sort `<button>` (`:166-175`).

The spec (`data-table.md` §"Layout, Styling, And Accessibility" and
`UI_UX.md §1.7`) says: "Container has `tabIndex={0}` and owns bubbled
keyboard handling," "Tab should leave the table when there is no next
visible cell." The container at `:148` does have `tabIndex={0}`, but
the gutter and header buttons inside the table are themselves tabbable.
A keyboard user pressing Tab inside the table will walk through every
gutter row-select button and every header sort button before exiting.
For a Rooms table this is annoying; for a 200-row catalog manager
table it's broken.

**Recommendation:** Set `tabIndex={-1}` on the gutter/header buttons
(roving-tabindex hardening) or replace the click-target with
`onMouseDown` on the parent `<th>`/`<td>`. The spec calls roving-tabindex
"a post-extraction lane" but the leaky Tab order should be cleaned up
before this primitive is reused for the much larger catalog tables.

### A5 — Cmd+V plans the paste but never writes anything (silent dead-end)

**Where:** `DataTable.tsx:79-89, 257-275`.

The keyboard handler responds to Cmd+V, calls `pasteIntoSelection`,
which calls `planPaste`, computes overflow, and then calls
`setAnnounce(...)` with the cell count. No `onWrite` is ever invoked.
For an `onWrite`-less consumer (Rooms today), the behavior is "Cmd+V
silently runs a screen-reader announcement and nothing visible
happens."

This is consistent with the roadmap deferral ("does not yet emit write
ops for inline edit/paste/fill"), but the current UX is misleading —
the table looks like it accepted the paste. Two cleaner options:

1. Gate Cmd+V on `onWrite` being passed: if absent, no-op without the
   announcement, so paste is observably unsupported until P1-09/P1-10
   wires the pipeline.
2. Render an explicit "Paste not yet enabled in this table" announcement
   so screen-reader users aren't told "12 cells ready to paste" that
   never become a real write.

Either way, do not ship to staging with the current ambiguous state.

### A6 — Sort is single-column; Shift+click on a header does not stack

**Where:** `DataTable.tsx:118-126`.

`UI_UX.md §1.7` Sort by: "Stacked rows; first row primary, rest are
tiebreakers. Shift+click on a column header adds to the sort stack."
The current `toggleSort` always replaces `view.sort` with a single
rule. Acceptable for Rooms-only behavior (one sort by `number`) but
worth flagging as POC-parity debt — and `sortRows` already iterates
multiple rules, so the only missing piece is the header handler.

### A7 — Single-select columns sort by display label, not option order

**Where:** `RoomsTable.tsx:67-79` (floor_level / building_zone
accessors resolve to `optionLabel(...)` strings).

`data-table.md` table of v1 field types says single_select should "sort
by option order." The current Rooms accessors return the resolved
label string before sort sees it, so sorting by Floor goes alphabetic
on the label rather than following the project-defined option order
(B1 / 2 / 3 vs. an explicit user-defined ordering).

This is correctly deferred per the lessons text (single-select option
manager is P1-09), but I want it on the record so the P1-09 slice
remembers to push sort/filter/paste through the option list rather than
the display label. If P1-09 inherits "sort by accessor string", the
field-type registry never gets exercised.

### A8 — `@tanstack/react-virtual` is a declared dependency but unused

**Where:** `frontend/package.json:20`, no import anywhere in
`shared/ui/data-table/`.

`TECH_STACK.md` calls for TanStack Table v8 + `@tanstack/react-virtual`
+ shadcn-table primitives. Rooms is small so virtualization isn't
performance-critical here, but the first catalog manager consumer will
likely have hundreds-to-thousands of rows. The current shape uses
TanStack only for header/cell `flexRender`; data flows through pre-
filtered/pre-sorted arrays. Wiring `useVirtualizer` later means
rewriting the `<tbody>` render loop and reasoning about row height
again (we hardcoded 32 px in `App.css:1131-1134` — good, virtualization
can pick that up).

**Recommendation:** Either uninstall `@tanstack/react-virtual` to make
the gap explicit, or land a minimal virtualizer pass before P1-09
catalogs build on top.

### A9 — TanStack data flows around filter/sort instead of through it

**Where:** `DataTable.tsx:49-67`.

`filteredRows` (memoized via `applyTextFilters` + `sortRows`) is what
gets passed to `useReactTable({ data: filteredRows })`. The `columnDef`
objects mapped into TanStack carry an `accessorFn` but no
sort/filter/group config, so TanStack's internal models stay unused.
This is consistent with the spec rule "derive TanStack shapes from
user-intent state," but combined with A1/A2 it means TanStack provides
almost nothing here beyond `flexRender` — which is a heavy dep cost for
a thin payoff. Not a blocker; flag because if A8 (virtualization) lands
the virtualizer will need access to the same `filteredRows` length, and
the TanStack row model should be the single source of truth for visible
row order.

### A10 — Header column-select gesture not wired

**Where:** `DataTable.tsx:166-175`.

`UI_UX.md §1.7`: "Click the header strip selects the full column;
Shift+click extends a contiguous block of columns." Current header
click runs `toggleSort` only; column selection is unreachable. POC
parity gap; flag for the follow-up that adds shift-click stack sorting
(A6).

## Smaller Correctness / Polish Notes

- `DataTable.tsx:128-130`: `if (rows.length === 0)` triggers the empty
  message **before** filtering. If `rows.length > 0` but `filteredRows`
  is empty (e.g., a filter excluded every row), the table renders an
  empty `<tbody>` with no empty state. Switch the check to
  `filteredRows.length === 0`.
- `DataTable.tsx:49-60`: `meta: { className: column.className, width:
  column.width }` is set on the TanStack column but never read; the
  width/className that actually drive rendering come from
  `visibleColumnDefs[columnIndex]` directly. Drop the dead `meta` or
  read it during render.
- `DataTable.tsx:72-115`: `metaKey`-only shortcuts will not fire on
  Windows/Linux (`ctrlKey` is the platform convention). BLDGTYP is
  macOS-dominant, but contractors on Windows do exist; consider
  `event.metaKey || event.ctrlKey` for Cmd+C / Cmd+V / Cmd+A.
- `DataTable.tsx:72-89`: `pasteIntoSelection` reads
  `navigator.clipboard?.readText()` — many browsers gate this behind a
  permission prompt. If `raw === undefined` (user denied / no
  permission) the handler silently no-ops. Once paste actually writes,
  add a "Clipboard permission required" error path.
- `DataTable.tsx:223`: `onDoubleClick={() => onRowOpen?.(row.original)}`
  conflicts with the spec contract "Enter or double-click opens the
  **cell editor**". For Rooms (no cell editor yet) this opens the row
  modal, which is fine. Once cell editing lands, double-click will
  fight with cell-editor open. Plan the semantic split (Enter →
  cell editor, click row-number → row detail) before P1-09.
- `lib.ts:182-188`: `escapeHtml` escapes `& < > "` but not `'`. For
  `<td>` body content it's fine; the function is reusable enough that
  someone will eventually drop it into an attribute value where the
  missing apostrophe escape matters. Either keep the current scope and
  rename it `escapeHtmlText`, or escape `'` too.
- `lib.ts:84-91`: `parseTsv` doesn't handle quoted cells with embedded
  tabs (`"a\tb"` from Excel). Acceptable for the v1 helper; document
  the deferral once paste actually writes.
- `RoomsTable.tsx:39-50`: `fieldDefs` array is in a `useMemo` with `[]`
  deps — fine, but it's static and could just live as a module-level
  const. Same for `columns` if `floorLabels`/`zoneLabels` were derived
  inside via lookup props — but the current memo with `[floorLabels,
  zoneLabels]` is correct as written.
- `EquipmentTab.tsx:29`: `useState(emptyViewState)` uses the lazy
  initializer form — good. ✓

## Security

No new security surface. The DataTable does not render arbitrary HTML
(React escapes children by default); the clipboard HTML output uses
`escapeHtml` correctly for `<td>` text; no `dangerouslySetInnerHTML`.
Clipboard reads are `navigator.clipboard?.readText()`, which is gated
by the browser permission prompt. No issues.

## Performance

- Small tables (Rooms = tens of rows): fine. `useMemo` boundaries are
  reasonable; `filteredRows` recomputes only on rows/columns/filter/sort
  change.
- Catalog-scale tables (hundreds-thousands of rows): blocked by A8
  (no virtualization) and A9 (TanStack data flows around its own row
  model). Wiring virtualization later is straightforward but should
  happen before the catalog manager slice lands.
- `tanstackColumns` rebuilds whenever `visibleColumnDefs` changes
  identity — currently fine, but a future toolbar that toggles
  `hiddenColumns` will create a new array each render. Memoize on the
  set/string of hidden ids, not the array reference, if this becomes a
  hotspot.

## Tests

The six helper tests in `lib.test.ts` cover the brittle pure
helpers the roadmap called out — selection normalization, arrow
movement, TSV copy, single-cell-into-rectangle paste planning, paste
overflow accounting, and numeric-aware sort. Coverage is appropriate
for "first extraction lands the controlled API."

Gaps worth filling before P1-09 builds on top:

- **No test of `applyTextFilters`** (contains / is / is_empty branches,
  case-folding, dormant rows passing).
- **No test of read-only behavior** — the roadmap names "read-only
  behavior" in the test scope. A single Vitest assertion that paste is
  skipped when `readOnly` is true would lock the invariant.
- **No test of the keyboard handler** — `moveActiveCell` is tested,
  but the Cmd+C / Cmd+V / Cmd+A flows route through `handleKeyDown`
  and are uncovered. A small render-and-fire-event test would catch
  regressions like A4 (focus trap) when roving-tabindex lands.

No need to add component snapshot tests; the helper-focused approach
is correct per the roadmap budget.

## Roadmap Ledger / Status Markings

Roadmap row P1-08 is correctly marked `[~]` with status text "Shared
extraction started; Rooms migrated to first shared read/copy/sort
surface". The ledger row at line 603 matches. The lessons text
(roadmap line 214) is honest about what this slice does **not** yet
do.

**Inconsistency:** P1-08 `Includes` (line 211) still lists "stacked
sort/filter/group" and "selection/copy/paste" as in-scope, while the
lessons text scopes the first pass to "local sort affordance" and
"keyboard active-cell/range-selection state, TSV/HTML copy helpers,
paste planning helpers" — i.e., not stacked sort, not actual paste
writes. Either tighten the `Includes` row to match the lessons text,
or land the missing pieces before closing the slice. The current
status `[~]` is the right marker; do not promote to `[x]` until A1
(toolbar), A3 (click-drag selection), and A5 (Cmd+V dead-end) are
resolved or explicitly re-scoped to P1-09/P1-10 in the gap matrix.

## Recommendation

Hold the slice at `[~]` and resolve the following before checking it
complete:

1. **A5 (Cmd+V silent dead-end).** Either gate paste on `onWrite`
   presence or change the announce message so users aren't told writes
   happened. Cheapest fix; do it now.
2. **A1 + A6 (toolbar / stacked sort).** Decide: tighten the `Includes`
   to match the lessons text, or land the Sort popover and stacked
   sort before closing. Document the decision in the P1-08 row.
3. **A4 (focus trap on inner buttons).** Add `tabIndex={-1}` to the
   gutter row-select and header sort buttons so Tab leaves the table.
   This is a one-line fix that prevents the issue from being copied
   into every future catalog-scale consumer.
4. **A3 (click-drag range selection).** Document explicitly in the gap
   matrix whether this is P1-08 or P1-09 — `Includes` says P1-08;
   lessons text implies later.

The architectural divergences (A2 field-def registry, A7 single-select
sort order, A8 virtualization, A9 TanStack data flow) are real but
acceptable deferrals — flag them in the P1-09/P1-10 plan so the next
slice on top of `<DataTable>` doesn't inherit the wrong shape.

Backend untouched, scope of the change is appropriately bounded, and
the controlled-API shape is the right place to land for future
reuse. The work is on the right track; the row is correctly marked
`[~]` rather than `[x]`.
