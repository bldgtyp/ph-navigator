---
DATE: 2026-06-21
TIME: 09:38 EDT
STATUS: Implemented
AUTHOR: Claude (for Ed May)
SCOPE: Behavior contract for the parent-level DataTable "Download CSV" affordance.
RELATED: ./README.md, ./PLAN.md, context/technical-requirements/data-table.md
---

# PRD — Table CSV Download

## 1. Goal

Give the user a one-click way to download a CSV of a single DataTable for
local use (open in Excel / Numbers / Sheets, paste into an email, archive a
snapshot). It is a *copy* of the data the user is currently looking at, not a
new system of record.

## 2. Decisions (resolved with Ed, 2026-06-21)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Frontend-only** — no new backend route. | Reuses the existing client-side cell serializer + `downloadBlob`; the only uniform surface that *every* table passes through is the `<DataTable>` component, not the backend (catalogs use different, non-versioned routes; the generic table route is project-document-only). The backend stores SI canonical and does not compute IP display values, so a server CSV would be SI-only or would duplicate the frontend's unit/label/formula rendering. |
| D2 | **Parent-level, not per-table.** The button is built into the shared component and enforced by a required prop + structural guard. | "Every table gets this affordance"; matches the DataTable uniformity iron-law (basic affordances are parent-owned and enforced, never per-table opt-in). The existing per-consumer `overflowMenuActions` slot is explicitly **not** used for this. |
| D3 | **Current view (WYSIWYG)** scope. | The CSV mirrors the active sort, filters, hidden columns, and column order — what the user sees. Matches AirTable's per-view export and the "copy what's on screen" mental model. |
| D4 | Single-select serializes as the **option label**; formula/computed cells serialize as their **computed display text**. | Explicit Ed requirement ("serialize as text any single-select / formula fields"). Labels and computed values are already resolved frontend-side. |

## 3. Where it lives & when it is enabled

- **Location:** a built-in `Download CSV` `<button>` inside `ViewMenuOverflow`
  (`components/ViewMenuOverflow.tsx`), rendered alongside the existing
  `Reset view` item. It is **not** injected via the per-consumer `actions`
  slot. Order: any consumer `{actions}` first (unchanged), then the built-in
  items `Download CSV` then `Reset view`.
- **Always present and always enabled**, including:
  - **Read-only / Viewer / anonymous mode** — download is a read action; it
    must not be gated on `onWrite`. (Mirrors clipboard copy, which works
    read-only.)
  - **Empty table (0 rows)** — exports a header-only CSV (a useful template);
    the button stays enabled.
  - **Grouped view** — enabled (copy is allowed while grouped; only *paste*
    is disabled). Group-header rows are not serialized; the underlying
    filtered+sorted rows are exported.
- **Edits in flight:** the CSV reflects committed row data (`rows`). An open,
  uncommitted inline-cell draft is not included — same as clipboard copy.

## 4. Output contract

### 4.1 Scope (which rows / which columns)

- **Rows = the current-view rows**: `DataTable.tsx`'s `filteredRows`
  (`applyFilters` → `sortRows`). Filters and sort are applied; hidden-by-filter
  rows are excluded. Collapsed groups still export their member rows (collapse
  is a display state, not a filter).
- **Columns = `visibleColumnDefs`**: the ordered, hidden-excluded column set,
  with the pinned identifier column forced to the first column (it can never be
  hidden). Column order matches the user's current `columnOrder`.

### 4.2 Header row

- One header row, first line of the file.
- Header text per column = `DataTableColumnDef.header` (the plain-string label
  the user sees — e.g. "Display Name", "Tag").
- **Number-with-units columns** append the active-system unit label, e.g.
  `Floor Area (m²)` / `Floor Area (ft²)`, so the file is self-describing about
  which unit system it was exported in.

### 4.3 Per-field-type cell serialization

The serializer reuses `formatClipboardCellValue` (single-select + number-units
already handled there) and adds the computed/formula branch it lacks:

| Field type | CSV cell |
|---|---|
| `text` | raw string |
| `number` (plain) | numeric value as string |
| `number` + `numberUnits` | value formatted in the **active SI/IP system** (`formatNumberUnitsDisplay`) — the bare displayed value, no per-cell suffix (unit is on the header) |
| `single_select` | option **label** (resolved from `fieldDef.options` by id); empty / missing-option → `""` |
| `computed` / formula | computed display text; a computed-**error** sentinel (`isComputedErrorValue`) → `""` in v1 (see Open Q1) |
| `color` | stored `#rrggbb` hex |
| `linked_record` | the column accessor's text — display labels for display-accessor / inverse columns; raw ids for true `accessorValue:"ids"` columns in v1 (see Open Q2) |
| `attachment` | `""` in v1 — matches the contract's "clipboard copy/paste of attachment cells is disabled" |

### 4.4 CSV file format (RFC-4180)

- **Delimiter:** comma.
- **Quoting:** a field is wrapped in double quotes iff it contains a comma,
  double quote, CR, or LF. Embedded double quotes are escaped by doubling
  (`"` → `""`). (Minimal quoting; values without special chars are bare.)
- **Line terminator:** `\r\n` between records (RFC-4180; Excel-safe).
- **Encoding:** UTF-8 **with a leading BOM** (`﻿`). The BOM is required so
  Excel renders non-ASCII correctly — the Rooms `{Number} — {Name}` em-dash,
  `m²`, `µ`, and accented project/material names all appear in this app.
- **MIME / Blob type:** `text/csv;charset=utf-8`.

### 4.5 Filename

- `${sanitize(tableName)}.csv` where `sanitize` replaces filesystem-illegal
  characters (`\ / : * ? " < > |` and control chars) with `-`, trims, and
  falls back to `table` if empty.
- No timestamp in v1 (predictable name; the browser de-dupes repeat downloads
  as `name (1).csv`). Timestamp is a possible later option.
- `tableName` is supplied by each consumer through a **required** DataTable
  prop (see `PLAN.md`), so every table ships a meaningful filename.

## 5. Non-goals (v1)

- No backend CSV route, no server-side rendering, no streaming.
- No column/row selection dialog, no "export selection only" (that is what
  clipboard copy already does), no format options UI.
- No XLSX, no JSON-from-this-menu (Materials' existing JSON import/export in
  its own `overflowMenuActions` is untouched — see Open Q3).
- No CSV-injection sanitization (leading `= + - @`). This is the user's own
  data for local use; we preserve fidelity rather than mutating values.
  Documented as an accepted non-mitigation.
- No filenames carrying project/version context (DataTable does not know the
  project name; can be added later if disambiguation is wanted).

## 6. Open questions (safe defaults chosen; confirm during build)

- **Q1 — formula error cells:** v1 emits `""`. Alternative: the human
  `COMPUTED_ERROR_MESSAGES[code]` text. Default `""` keeps a clean data
  column; revisit if Ed wants errors visible in the export.
- **Q2 — true linked_record id columns:** v1 exports whatever the column
  accessor yields (ids for `accessorValue:"ids"` columns). Resolving those to
  joined target labels is a small follow-up if needed.
- **Q3 — Materials/Glazing/Frame:** these already have a bespoke
  `Export JSON` / `Import JSON…` pair in their consumer `overflowMenuActions`.
  The new universal `Download CSV` coexists with them (different format, same
  menu). Confirm we are not creating user confusion with two "export"-ish
  items; rename if needed during build.

## 7. Acceptance criteria

1. Every DataTable (project tables, equipment, heat-pump leaves, catalogs,
   read-only/viewer) shows a `Download CSV` item in its `...` menu.
2. Clicking it downloads a `.csv` whose header + rows match the current view
   (sort/filter/hidden/order), with the pinned identifier first.
3. Single-select cells show labels; formula cells show computed text;
   number-with-units cells show active-system values with the unit on the
   header.
4. A value containing a comma, quote, or newline round-trips correctly through
   a CSV reader (RFC-4180 quoting).
5. Non-ASCII (em-dash, `m²`, accents) opens correctly in Excel (BOM present).
6. Works in read-only/viewer mode and on an empty table (header-only file).
7. The affordance cannot be removed or made per-table-optional without failing
   the structural guard (`check-data-table-contract.mjs`) or TypeScript.
</content>
