---
DATE: 2026-05-24
TIME: planning (guidelines only — no implementation details yet)
STATUS: Draft. Feature refactor guidelines for AirTable-style column
        sizing on the shared `<DataTable>`. Implementation phasing is
        deferred to a follow-up plan once these guidelines are agreed.
SCOPE: Reshape how `<DataTable>` lays out columns so that:
       (1) the table no longer auto-fills its wrapper,
       (2) every column has an explicit, user-resizable width,
       (3) widths persist per (user, project, table_key) across page
           navigation, sort/filter/group/reorder/hide, sign-out/in,
           and devices,
       (4) the wrapper handles both horizontal underflow (grey tail
           space) and overflow (scroll) cleanly,
       (5) the contract stays reusable for every future tabular
           surface (Rooms, ERVs, Pumps, Fans, Specifications,
           catalog managers, bookshelf pickers).
PARENT-STORY: context/user-stories/31-data-table-enhancements.md
              (new US-TBL-COLWIDTH-1, to be appended)
RELATED:
  - context/technical-requirements/data-table.md
    (`ViewState.columnWidths` field already exists; render path does
    not consume it yet)
  - context/UI_UX.md §1.7 (DataTable interaction model)
  - docs/plans/2026-05-24/plan-09-tbl-view-state-persistence.md
    (`useProjectTableViewState` already round-trips `columnWidths`
    through the persistence boundary; this plan wires it to render)
  - frontend/src/shared/ui/data-table/DataTable.tsx
    (the `<colgroup>` block + `data-table-wrap` div)
  - frontend/src/shared/ui/data-table/components/GridHeader.tsx
    (resize handle will live on the trailing edge of every `<th>`)
  - frontend/src/features/equipment/components/RoomsTable.tsx
    (first migration target; static `width: 120` on `number` column
    becomes a `defaultWidth`)
BACKWARDS-COMPATIBILITY: None required. Pre-deployment, no users, no
        saved view-state rows in production. Reshape freely.
---

# Plan 11 — DataTable column resize, persistence, and overflow

This is a **guidelines** document, not an implementation plan. It
fixes the design direction, the contract changes, and the open
questions that need answers before any code lands. Implementation
phasing comes in a follow-up plan.

## 1. Why this plan exists

Today, `<DataTable>` columns auto-fit. `<table>` is set to
`width: 100%; min-width: 760px`. Each `<col>` either takes a static
pixel width from `DataTableColumnDef.width` (used only on the Rooms
`number` column) or has no declared width and stretches to fill the
remaining space. The wrapper has `overflow-x: auto` but never
triggers because the table is sized to the wrapper.

The desired model is AirTable's:

- **Every column has an explicit pixel width** that the user can
  change by dragging the right edge of its header. The width belongs
  to the user (view state), not the column declaration.
- **The table is the sum of its column widths**, not the size of its
  wrapper. The wrapper is a window; the table is a sheet that may be
  narrower or wider than the window.
- **Underflow** (sum of columns < wrapper width) leaves grey "outside
  the table" space to the right and below the data — a strong visual
  signal that the table is bounded and that adding columns / rows is
  a deliberate action, not an automatic re-flow.
- **Overflow** (sum of columns > wrapper width) scrolls horizontally
  inside the wrapper; vertical overflow scrolls vertically inside the
  same wrapper. The toolbar above and the summary bar below do not
  scroll horizontally with the body — they are sticky relative to the
  wrapper.
- **The frozen first data column** plus the row-number gutter remain
  pinned to the left while the body scrolls.

The `ViewState.columnWidths: Record<columnId, number>` field already
exists in the type and is already sanitized on load (`lib.ts`) and
round-tripped by `useProjectTableViewState` (Plan 09). What is
missing is the render path that reads it, the gesture that writes
to it, and the layout discipline that makes the body and the header
agree on column geometry.

## 2. Principles

The reshape must obey these, in order. When two principles conflict,
the earlier one wins.

1. **One source of truth for column geometry.** At render time the
   width of any given column comes from exactly one place: a derived
   number computed as
   `view.columnWidths[id] ?? columnDef.defaultWidth ?? typeDefault`.
   Nothing else may set a column width. No CSS `width: auto`, no
   per-cell inline styles, no `min-width: 760px` on the table, no
   `<table style="table-layout: auto">`. The `<colgroup>` is the only
   place that says how wide a column is.

2. **The table sizes itself; the wrapper is a window.** The `<table>`
   element's width is `sum(column widths) + gutter width`, full stop.
   The wrapper (`.data-table-wrap`) gets both `overflow-x` and
   `overflow-y` and never lets the table inherit its size.

3. **`ViewState.columnWidths` is the persistence anchor.** No
   localStorage, no per-render memo, no Zustand sliver. The same
   `ViewState` shape already used by sort/filter/group/order/hidden
   carries widths. The same per-(user, project, table_key) adapter
   already used by Plan 09 persists it. This means: **nothing new is
   required for persistence** beyond exercising the field on writes.

4. **Columns have a declared minimum, a declared default, and an
   enforced maximum.** Implementation defaults are stated in §6 so
   that "min/default/max" is a contract, not an emergent behavior.

5. **Reusability beats convenience.** The shape that lets Rooms work
   must also let ERVs, Pumps, Fans, Specifications, and catalog
   tables work. No Rooms-specific branch in `<DataTable>`. Every new
   table consumer should need to do exactly two things to opt into
   resize: (a) declare each column's `defaultWidth` (or accept the
   type default), (b) plumb a `ViewState` that survives long enough
   to be persisted. The hook `useProjectTableViewState` already
   covers (b) for project-document tables.

6. **No backwards-compatibility shims.** Pre-deployment. Saved
   view-state rows in `user_table_views` may be wiped before this
   ships, or migrated by the sanitizer dropping unknown column ids
   (already implemented). The `DataTableColumnDef.width?: number`
   field is renamed and re-purposed (see §4) without aliasing.

## 3. User-facing behavior (the contract)

A user opening any DataTable surface should experience:

- **Resize.** Hover the right edge of any column header — a 4 px wide
  grab zone shows a column-resize cursor. Press and drag horizontally
  to resize. A faint vertical guide line shows the candidate width
  during drag. Release commits. Drag below the column's minimum
  snaps to minimum; drag above the maximum snaps to maximum.
- **Persisted across navigation.** Navigating away from the page and
  back, reloading, signing out and back in, or opening the same
  project on another device restores every column to the last width
  the user chose. (Inherits from Plan 09 once `columnWidths` is part
  of `ViewState`.)
- **Independent of order / sort / filter / group / hide.** Reordering
  columns, sorting, filtering, grouping, hiding columns and re-
  showing them: none of these reset, shift, or otherwise touch
  widths. Widths key on column `id`, not display index.
- **Underflow.** If the sum of visible column widths is less than the
  wrapper width, the data ends where the last column ends. To the
  right of the last column is the AirTable grey "outside" area,
  rendered with the new `--bg-table-outside` token (see §8
  Q-RESIZE-6). The table does **not** stretch to fill.
- **Tail "+" affordance.** A 42 px "+" cell sits at the right edge of
  the header strip and as a tail cell on every data row, visually
  matching the gutter on the left. In v1 it is **disabled** — laid
  out only so the eventual "add field" feature has no layout work
  left to do (see §8 Q-RESIZE-7).
- **Overflow.** If the sum of visible column widths exceeds the
  wrapper width, the wrapper scrolls horizontally. The frozen first
  data column and the row-number gutter stay pinned to the left
  edge of the wrapper. The header strip stays pinned to the top edge
  of the wrapper while the body scrolls vertically. The summary bar
  stays pinned to the bottom edge of the wrapper.
- **Read-only mode.** Locked-version and Viewer modes still allow
  resize; widths are user-view state, not project data. (Anonymous
  Viewer mode reads defaults only because there is no user to save
  against — same rule as Plan 09 criterion 7.)
- **Double-click on resize handle: fit-to-content.** Sets the column
  width to the widest non-truncated content currently visible (post-
  filter, post-group, including header label), clamped to min/max.
  Ships in v1 (Q-RESIZE-3 resolved).
- **No reflow during inline edit.** Editing a cell never changes any
  column width — see US-TBL-EDIT-1, already specified. This plan
  reinforces that by removing the last path where content size could
  influence column width (`table-layout: auto`).

## 4. Contract changes to `<DataTable>`

These are the **shape** changes. Implementation details (how the
resize hook works, where the drag handle DOM lives, how the
`<colgroup>` is computed) are deferred.

### 4.1 `DataTableColumnDef<TRow>` changes

```ts
// Before (today)
type DataTableColumnDef<TRow> = {
  id: string;
  fieldKey: string;
  header: string;
  accessor: (row: TRow) => unknown;
  render?: (row: TRow) => ReactNode;
  className?: string;
  width?: number;   // ← static, ignored by view state
};

// After
type DataTableColumnDef<TRow> = {
  id: string;
  fieldKey: string;
  header: string;
  accessor: (row: TRow) => unknown;
  render?: (row: TRow) => ReactNode;
  className?: string;
  defaultWidth?: number;   // initial width when view has none
  minWidth?: number;       // optional per-column floor
  maxWidth?: number;       // optional per-column ceiling
  resizable?: boolean;     // default true; false locks the column
};
```

Notes:

- `width` is removed, not aliased. Pre-deploy, no callers to break.
- `defaultWidth` is **the seed** for `view.columnWidths[id]` when the
  user has never resized this column. It is not consulted again once
  the user resizes once.
- Field-type defaults (§6) cover the case where `defaultWidth` is
  also omitted.

### 4.2 `ViewState.columnWidths` semantics (clarified)

The field exists but the rules around it need to be written down:

- Key: `DataTableColumnDef.id` (not `field_key`). Stable across
  re-renders; allows two columns of the same field type in the same
  table to have distinct widths.
- Value: positive integer pixels. Floats are rounded on write.
- Absence: a missing key means "use seed (defaultWidth or type
  default)". An explicit value means "the user has resized".
- Reset-to-default in the toolbar overflow clears `columnWidths` to
  `{}` (alongside the existing sort/filter/group/aggregations reset
  paths). Per Plan 09, this DELETEs the persisted row.
- The sanitizer (`sanitizeViewStateForSchema`) already drops widths
  for column ids that are no longer present; no change needed there.

### 4.3 `<DataTable>` props — no additions

The public component prop signature does not gain a prop. Width
mutation flows through the existing `onViewChange` path the same way
sort/filter/group/order/hidden already do. The consumer does not opt
in or out; resize is a built-in behavior of the primitive.

### 4.4 Layout model

- `<table class="data-table">` gets `table-layout: fixed` and
  `width: max-content`. Its `min-width` constraint is removed.
- `<colgroup>` is built from `(gutter, ...visibleColumns)`; each
  `<col>` has an inline `width: ${resolved}px`. This is the only
  place column widths live in the DOM.
- `.data-table-wrap` gets `overflow: auto` (both axes) and a fixed
  background color matching the AirTable "outside" grey. Wrapper
  size is owned by its parent (`EquipmentTab`, `RoomsPage`, etc.);
  this plan does not change parent layout.
- Sticky lanes (existing): header strip at `top: 0`, gutter at
  `left: 0`, summary bar at `bottom: 0`. **New:** the frozen first
  data column ("primary") at `left: var(--gutter-width)`. This is
  needed for the first time once horizontal scrolling becomes a real
  state — today the wrapper never scrolls so the bug is invisible.

### 4.5 Resize gesture

Lives entirely inside the DataTable primitive. Surface (not
implementation):

- A 4 px right-edge grab zone on every `<th>` whose column is
  resizable. Hover shows `cursor: col-resize`.
- Pointer-down captures the pointer, computes a delta against the
  starting width, emits `onViewChange` continuously during drag
  (throttled to animation frames) so the layout reflects the live
  width; the persistence debounce inside `useProjectTableViewState`
  collapses the burst into one PUT.
- Pointer-up commits as one user gesture. Esc during drag cancels
  and restores the starting width.
- Touch / pen pointer events use the same path (pointer events, not
  mouse-only).
- **Double-click on the handle** triggers fit-to-content (§3).
- Keyboard resize is **not shipped in v1** (Q-RESIZE-2 resolved —
  deferred).

## 5. Reusability for future tables (ERVs, Pumps, Fans, Specs, …)

The point of doing this on the shared primitive is so that every
future table inherits it automatically. The reuse contract:

1. **New table consumer file** lives at
   `features/<domain>/components/<X>Table.tsx`, mirrors `RoomsTable.tsx`.
2. **Declare columns** with `defaultWidth` per column (or accept the
   type default from §6).
3. **Plumb `ViewState`** through the existing
   `useProjectTableViewState({ projectId, tableKey: "ervs" })` hook.
   The hook does not need to change. The `table_key` is the only
   per-table-unique value.
4. **Done.** Resize, persistence, overflow, sticky lanes, and the
   grey underflow area are inherited from the primitive.

Implications:

- Catalog manager tables (no `project_id`) need a parallel hook
  (`useCatalogTableViewState`?) before they can persist widths.
  Out of scope for this plan; flagged in §8 Q-RESIZE-5.
- Bookshelf pickers in read/select-only mode use the same primitive
  with `readOnly`. They still allow local resize but skip the
  persistence call (already the Plan 09 anonymous-Viewer rule).

## 6. Defaults

Seed widths when both `view.columnWidths[id]` and
`DataTableColumnDef.defaultWidth` are absent:

| Field type      | Default px |
|-----------------|-----------|
| `text`          | 200       |
| `number`        | 120       |
| `single_select` | 160       |
| `computed`      | 140       |
| `attachment`    | 120       |
| `argb_color`    | 100       |

Min/max:

- Global `minWidth = 60` (matches AirTable). Per-column override via
  `DataTableColumnDef.minWidth`.
- Global `maxWidth = 800`. Per-column override via
  `DataTableColumnDef.maxWidth`. Cap exists so a stray drag does not
  produce a 30000 px column.

Gutter width: stays `42 px`. Not part of `columnWidths`.

## 7. Out of scope (for this plan)

- **Row height resize.** AirTable supports row-height presets (short,
  medium, tall, extra tall). Out of scope until a real consumer
  needs it. `density` prop already exists for the compact /
  comfortable axis.
- **Per-cell wrap toggle.** Same.
- **Named / shareable views** (NEW-TBL-1) — column widths will
  serialize as part of any future named view because they already
  ride on `ViewState`. No new design.
- **Column auto-fit ("fit table to viewport") toolbar action.** A
  one-shot "distribute remaining width across visible columns"
  action is nice-to-have. Defer.
- **Catalog manager persistence** of column widths (see §5).

## 8. Resolved questions (2026-05-24, Ed)

- **Q-RESIZE-1 — Persistence debounce.** **Resolved: confirmed.** The
  debounce inside `useProjectTableViewState` stays at 500 ms after
  the last `onViewChange`. A drag of N intermediate widths collapses
  into exactly one PUT after release.
- **Q-RESIZE-2 — Keyboard resize.** **Resolved: deferred.** Ship
  mouse / touch / pen only. Matches AirTable's web app. May be
  revisited if an accessibility audit requires it.
- **Q-RESIZE-3 — Double-click on the handle = fit-to-content.**
  **Resolved: ship in v1.** Sets the column width to the widest
  *currently visible* (post-filter, post-group) non-truncated content
  measured against the column's CSS metrics, including the header
  label, clamped to `[minWidth, maxWidth]`. Users expect this
  affordance from AirTable / Excel / Numbers.
- **Q-RESIZE-4 — Resize while grouped.** **Resolved: yes.** Mouse
  drag and double-click-to-fit both work the same in grouped and
  ungrouped modes. Paste is the only gesture disabled while grouped
  (existing rule — see UI_UX.md §1.7).
- **Q-RESIZE-5 — Catalog manager view-state persistence.**
  **Resolved: deferred to catalog development.** This plan ships
  resize against the project-document persistence adapter only.
  Catalog tables will resize locally (in-memory `ViewState`) but
  will not persist widths until a `useCatalogTableViewState`
  equivalent lands. Cross-link from the catalog plan when it begins.
- **Q-RESIZE-6 — Underflow background.** **Resolved.** Use
  `color-mix(in oklab, var(--accent) 4%, var(--bg-page))` as the
  starting value, exposed as a new token `--bg-table-outside`
  in the existing token sheet. One token, one declaration; tune the
  mix percentage once we see it in context rather than threading
  inline values through `.data-table-wrap` and the parent shell.
- **Q-RESIZE-7 — Tail "+" column for adding a field.** **Resolved:
  include in layout now, leave the action unwired.** Render a fixed-
  width (~42 px) `+` "add field" affordance at the right edge of the
  header strip and a matching tail cell on every data row, sized to
  match the gutter on the left. The button is **visually present and
  styled** so future "user-created fields" work has nothing to add
  to the layout — only behavior. Until that lands the button is
  disabled (`aria-disabled="true"`, no click handler, no tooltip
  beyond a generic "Add field — coming soon" if any). The tail "+"
  lives *inside* the table's flow (so horizontal scroll reveals it
  as the rightmost element), not in the grey underflow area.

## 9. Story to append

Add to `context/user-stories/31-data-table-enhancements.md`:

> ### US-TBL-COLWIDTH-1 — User-resizable, persisted column widths
>
> **Status:** Draft · **Priority:** MVP enhancement
> **Reference:** AirTable column-resize behavior (see attached
> screenshot, 2026-05-24).
>
> As an editor, I want every column in any data table to have a
> width I can set by dragging the right edge of its header, and I
> want that width to persist exactly like my sort / filter / group
> / hide / reorder choices already do — so that opening a table
> after sign-out, on another device, or after I navigate away and
> come back shows the table the way I shaped it.
>
> Acceptance criteria mirror §3 above.

Authoritative wording lands when this guidelines doc is approved;
the user story file gets the polished story body and acceptance
list at that point.

## 10. Sequencing (what comes next, not this plan)

Once these guidelines are agreed:

1. Promote §9 to a real user story in
   `context/user-stories/31-data-table-enhancements.md`.
2. Write the implementation plan as `plan-12-...md`: column-def
   rename, layout-model swap (`table-layout: fixed`,
   `width: max-content`, `overflow: auto`), resize-handle DOM and
   pointer hook, sticky-left for the frozen primary column, fit-to-
   content double-click (if Q-RESIZE-3 = ship), tests.
3. Run the migration in two atomic commits: (a) primitive +
   contract change + Rooms migration, (b) the rename across the
   small surface area (`width` → `defaultWidth`). No deprecation
   period — both commits in the same PR.
