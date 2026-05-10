---
DATE: 2026-05-07
STATUS: AG Grid Community eliminated. TanStack Table v8 is the candidate, but
        adoption is gated on the AirTable-parity validation work in plan §4
        (see "What this changes downstream" below). The spike answers "is it
        achievable?" — not "does it feel as good as AirTable?"
RELATED-PLAN: catalog-poc-plan.md §3.3, §4
---

# Grid Library Spike — Results & Decision

## TL;DR

**Pick: TanStack Table v8 (`@tanstack/react-table` ^8.21.3).**
AG Grid Community (^35.2.1) fails the binding success criterion in plan §2:
**row grouping is Enterprise-only**, and the POC requires group-by-category
(plan §3.3 behavior 6, PRD §13.4 Q1). TanStack covers all six §3.3 behaviors
plus virtualization and faceted multi-select filtering from the MIT-licensed
core, with no feature wall.

The cost is real and accepted: TanStack is headless, so we own the markup,
styling, and a11y. That cost is consistent with the catalog work anyway —
the schema-driven `<DataTable>` (plan §4, PRD §6) needs full control of
cell rendering for `computed` fields, attachment cells, version-aware
read-only indicators, and AirTable-parity row coloring.

## What was actually built

Both spikes hit the same backend endpoint and the same 405-row Materials
dataset:

- **Backend**: `GET /api/catalog-poc/_spike/materials` reads
  `backend/features/catalog/poc_seeds/airtable_export/Material Data-Grid view.csv`
  and returns it as JSON. DB-independent on purpose (plan §3.3.2).
- **AG Grid spike**: `frontend/src/features/catalog/_components/SandboxAgGrid.tsx`,
  route `/catalog-poc/sandbox-aggrid`. ~230 LOC.
- **TanStack spike**: `frontend/src/features/catalog/_components/SandboxTanStack.tsx`,
  route `/catalog-poc/sandbox-tanstack`. ~535 LOC.

Both render the full Materials field set, exercise inline edit on text and
number cells, expose a category filter, sort by `conductivity_w_mk`, support
resize + reorder, and present a row-coloring rule on conductivity. The TanStack
spike additionally implements group-by-category with aggregated mean values
and `@tanstack/react-virtual` row virtualization.

## Behavior-by-behavior comparison (plan §3.3)

| § | Behavior | AG Grid Community 35.2 | TanStack Table v8 |
|---|----------|------------------------|-------------------|
| 1 | Render all visible fields against 405 real rows | ✅ themed out of the box (`themeQuartz`) | ✅ hand-styled, sticky header |
| 2 | Inline-edit text cell + number cell | ✅ first-class, edits commit on blur/Enter, `valueParser` handles numeric coercion + nulls | ✅ double-click → input pattern, manual numeric coercion + null handling (~25 LOC) |
| 3 | Filter on a `select` column (`category`) | ⚠️ **text filter only**. Set filter (AirTable-style multi-select) is Enterprise. Floating filters built-in. | ✅ faceted multi-select via `getFacetedUniqueValues`. Matches AirTable feel. |
| 4 | Sort on a numeric column (`conductivity_w_mk`) | ✅ click header, indicators included | ✅ click header, indicators hand-rendered (`▲`/`▼`) |
| 5 | Resize + reorder a column | ✅ resize built-in; reorder is drag-and-drop in the column menu | ✅ resize via `header.getResizeHandler()`; reorder is hand-rolled HTML5 drag (~15 LOC) |
| 6 | **Group by `category`** | ❌ **Enterprise-only** (`RowGroupingModule`). Hard fail of the binding success criterion in plan §2. | ✅ `getGroupedRowModel` + `getExpandedRowModel`, with mean aggregation on numeric columns |
| — | Virtualization (plan §4.3) | ✅ built-in | ✅ `@tanstack/react-virtual`, integrated in ~30 LOC |
| — | Row coloring on column value | ✅ `getRowStyle` API | ✅ inline style on row element |
| — | CSV export | ✅ `api.exportDataAsCsv()` | ⚙️ ~25 LOC hand-rolled |
| — | Bulk row selection | ✅ `rowSelection: { mode: 'multiRow' }` | ⚙️ not implemented in spike — TanStack has `getRowSelectionState` but markup is on us |

Legend: ✅ first-class · ⚙️ requires code we own · ⚠️ degraded · ❌ blocked.

## License & feature-wall reality

AG Grid v32+ moved several behaviors out of the Community tier. Of the six
§3.3 behaviors, three intersect Enterprise-only features:

- **Row grouping** (§3.3 behavior 6) — `RowGroupingModule` is Enterprise.
- **Set filter** (AirTable's multi-select facet UI) — Enterprise. Community
  offers text/number filters only.
- **Range / cell selection** — Enterprise. Community offers row selection only.

`ENTERPRISE_FEATURES_REMOVED` in `SandboxAgGrid.tsx:43` documents these
explicitly. The plan §2 success bar is "as good as AirTable for our limited
use … group, color, drag-reorder, inline edit, bulk select." Without
Enterprise, AG Grid cannot meet that bar.

AG Grid Enterprise is paid and per-developer. Even if we were willing to
pay, a paid feature wall on every future contributor is a long-running
friction tax that does not exist with MIT-licensed TanStack.

TanStack Table v8 is MIT, single tier. There is no Enterprise version
to be locked out of. `@tanstack/react-virtual` is also MIT.

## Bundle weight

Not measured precisely (plan does not require it). Rough order of magnitude:

- AG Grid Community: ~1.0–1.3 MB minified (core + community modules), even
  with v35's modular registry.
- TanStack Table v8 + react-virtual: ~50–80 KB minified combined.

This is a 15–25× difference. Not load-bearing for a desktop-first internal
tool, but worth noting since plan §3.3 asks for bundle-weight notes.

## Time-to-first-render

Both spikes load the 405-row payload and render in well under one second on
a local-dev machine. Reported `loadMs` values during manual testing were
~50–150 ms for both, dominated by network + JSON parse. No observable
difference at 405 rows. Plan §4.3 calls for a 10k-row virtualization
verification — TanStack already has `@tanstack/react-virtual` wired; AG
Grid Community has built-in virtualization. Both pass at this scale.

## Cost of choosing TanStack

Honest accounting of what we take on by picking the headless library:

1. **More code in the `<DataTable>` component.** The TanStack spike is ~2.3×
   the LOC of the AG Grid spike. Real `<DataTable>` will be larger again
   once it carries schema-driven cell rendering, validation surfaces,
   keyboard navigation, and accessibility.
2. **A11y is on us.** AG Grid ships ARIA roles for grids; TanStack ships
   none. Plan and PRD don't enumerate a11y requirements explicitly, but
   keyboard nav + focus management is table stakes for an internal data
   tool. Budget time in week 1 (plan §4.3) to land basic keyboard nav.
3. **Styling is on us.** No theme system. The good news: the catalog
   needs AirTable-parity look-and-feel (plan §2 binding criterion), which
   means we'd have been overriding any vendor theme heavily anyway.
4. **Drag-reorder polish.** The HTML5 drag implementation in the spike has
   no insertion indicator and no animation. Acceptable for the spike,
   needs polish for the real component (a `dnd-kit` integration is the
   well-trodden path).
5. **Bulk selection markup.** Not in the spike. Will need ~30–50 LOC plus
   a header checkbox column.

These are all "we own the markup" costs, and they are predictable. None
of them is novel risk.

## What this changes downstream

- **Plan §3.3 step 6** — "delete the loser's route + deps" → remove
  `ag-grid-community` and `ag-grid-react` from `frontend/package.json`,
  delete `SandboxAgGrid.tsx`, delete the `/catalog-poc/sandbox-aggrid`
  route. Keep `SandboxTanStack.tsx` and the `/catalog-poc/sandbox-tanstack`
  route as a reference until plan §4 builds the real `<DataTable>`.
- **Plan §4 (week 1)** — `<DataTable>` is built on TanStack Table v8.
  First a11y / keyboard-nav pass lands here (was implicit, now explicit).
- **Plan §4.3 — 10k-row virtualization** — exercise against
  `@tanstack/react-virtual` rather than AG Grid's built-in virtualization.
- **PRD §13.4 Q1 ("does the table feel as good as AirTable?")** — the
  spike does not yet answer this. The TanStack spike proves that *every*
  required behavior is achievable; whether the feel matches AirTable
  depends on the polish in plan §4–5. Re-evaluate at week 1 close.

## Pointers

- AG Grid spike: `frontend/src/features/catalog/_components/SandboxAgGrid.tsx`,
  commits `63804e6`, `2404ef3`.
- TanStack spike: `frontend/src/features/catalog/_components/SandboxTanStack.tsx`,
  commit `677210f`.
- Backend spike route: `backend/features/catalog/spike_routes.py`.
- Materials CSV: `backend/features/catalog/poc_seeds/airtable_export/Material Data-Grid view.csv`.
