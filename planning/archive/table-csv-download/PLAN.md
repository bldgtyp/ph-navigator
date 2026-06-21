---
DATE: 2026-06-21
TIME: 09:38 EDT
STATUS: Implemented
AUTHOR: Claude (for Ed May)
SCOPE: Implementation sequence for the parent-level DataTable "Download CSV" affordance.
RELATED: ./README.md, ./PRD.md, context/CODING_STANDARDS.md
---

# PLAN — Table CSV Download

## 0. Backend search (done first, per Ed's instruction)

An exhaustive backend route search was run before considering any new code.
Findings:

- The only existing export route is JSON: `aperture_hbjson_export` and
  `GET …/versions/{version_id}/download` + `…/download/tables/{table_name}`
  (`backend/features/project_document/routes.py`), backed by
  `json_download_response()` in `features/shared/responses.py` and
  `get_saved_table_slice()` in `features/project_document/store.py`. These
  return `{ field_defs, rows, single_select_options, rows_computed }`.
- A backend CSV route is *feasible* by reuse (swap `media_type` to `text/csv`,
  add a renderer) **but rejected** for this feature because:
  1. **Not uniform.** That generic route is project-document-only. Catalogs
     (Materials/Glazing/Frame) use separate, non-versioned CRUD routes with no
     `{table_name}` path. A backend approach needs per-family endpoints +
     per-family frontend wiring → the opposite of "every table, parent-level".
  2. **Units.** Backend stores SI canonical and does **not** compute IP display
     values (unit conversion is a frontend responsibility per
     `CODING_STANDARDS.md`). A server CSV is SI-only unless we re-implement the
     frontend's unit formatting server-side.
  3. **Duplication.** The frontend already resolves single-select labels,
     number-units, and formula values for "copy as TSV". A server renderer
     re-derives display text the frontend owns.

→ **Decision: frontend-only** (confirmed with Ed). The backend is untouched.

## 1. Architecture

```
ViewMenuOverflow (built-in "Download CSV" item)  ← new menu item
        ▲ onDownloadCsv  (REQUIRED prop)
GridToolbar (threads the prop)
        ▲ onDownloadCsv
DataTable.tsx
   builds handler from data already in scope:
     filteredRows  (current-view rows: filter + sort)
     visibleColumnDefs  (ordered, hidden-excluded, identifier pinned)
     fieldDefByKey, unitSystem, tableName (new required prop)
   → tableToCsv(...)  → downloadBlob(blob, filename)
```

All logic is inside `shared/ui/data-table/`. The serializer is a pure
function with its own unit tests.

## 2. Reuse inventory (do not re-implement)

| Need | Reuse | Location |
|---|---|---|
| per-cell text (single-select label, number-units in active system) | `formatClipboardCellValue` | `lib/paste/tsv.ts:17` |
| computed-error detection | `isComputedErrorValue` / `COMPUTED_ERROR_MESSAGES` | `lib/formula/computedValues.ts:13` |
| current-view rows | `filteredRows` (already memoized) | `DataTable.tsx:150` |
| visible/ordered/pinned columns | `visibleColumnDefs` | `DataTable.tsx:131` |
| active unit system | `unitSystem` (UnitPreferenceContext) | `DataTable.tsx:128` |
| fieldDef lookup | `fieldDefByKey` | `DataTable.tsx:145` |
| header text per column | `DataTableColumnDef.header` (plain string) | `types.ts:147` |
| trigger a browser download | `downloadBlob(blob, filename)` | `shared/lib/downloadBlob.ts:1` |
| menu surface + "Reset view" precedent | `ViewMenuOverflow` | `components/ViewMenuOverflow.tsx` |

## 3. Build sequence

### Phase 1 — Serializer (pure, test-first)

- **NEW** `shared/ui/data-table/lib/export/csv.ts`:
  - `formatExportCellValue(value, fieldDef, unitSystem)`: `if
    (isComputedErrorValue(value)) return ""` (Open Q1), else delegate to
    `formatClipboardCellValue`. This is the only behavioral addition over the
    clipboard path.
  - `csvField(text)`: RFC-4180 quoting (quote iff contains `, " \r \n`; double
    embedded quotes).
  - `headerLabel(column, fieldDef, unitSystem)`: `column.header`, plus
    ` (unitLabel)` when `fieldDef.numberUnits` (use the units lib's active-
    system label helper).
  - `tableToCsv({ rows, columns, fieldDefByKey, unitSystem, tableName })`:
    builds BOM + header line + one line per row; `\r\n` terminators; returns
    `{ filename, content }` (or a `Blob`). Filename via `sanitizeFilename`.
  - `sanitizeFilename(tableName)`: strip `\ / : * ? " < > |` + control chars →
    `-`; fallback `table`.
- **NEW** `shared/ui/data-table/lib/export/__tests__/csv.test.ts` (React-free,
  fast): see § 4.

### Phase 2 — Menu item (parent-level, required prop)

- **MODIFY** `components/ViewMenuOverflow.tsx`:
  - Add `onDownloadCsv: () => void` to `ViewMenuOverflowProps` (**required**,
    not optional — iron-law: enforced, never opt-in).
  - Render a built-in `Download CSV` `<button class="data-table-overflow-menu-item">`
    next to `Reset view` (calls `onDownloadCsv()` then closes the popover).
- **MODIFY** `components/GridToolbar.tsx`:
  - Add `onDownloadCsv: () => void` to its props; pass it to `ViewMenuOverflow`.
    (Leaves `overflowMenuActions` / `onResetView` exactly as-is.)

### Phase 3 — Wire the data in DataTable

- **MODIFY** `DataTable.tsx`:
  - Destructure the new `tableName` prop.
  - Add a memoized `handleDownloadCsv` that calls `tableToCsv` with
    `filteredRows`, `visibleColumnDefs`, `fieldDefByKey`, `unitSystem`,
    `tableName`, then `downloadBlob`. (Place near `handleResetView`.)
  - Pass `onDownloadCsv={handleDownloadCsv}` into `<GridToolbar>`.
- **MODIFY** `types.ts`: add `tableName: string` to `DataTableProps` (required).

### Phase 4 — Thread `tableName` through every mount site

There is **no single render wrapper** — `SliceTableShell` is only a banner
stack (`feature/SliceTableShell.tsx`); each feature mounts `<DataTable>`
itself. So this is a bounded, mechanical fan-out. **First step: run
`rg -n "<DataTable[<\s]" frontend/src -g '!**/__tests__/**'` for the exact,
current list.** Known production mount sites to update:

- `features/catalogs/routes/MaterialsCatalogPage.tsx` → `tableName="Materials"`
- `features/catalogs/routes/GlazingTypesCatalogPage.tsx` → `"Glazing Types"`
- `features/catalogs/routes/FrameTypesCatalogPage.tsx` → `"Frame Types"`
- `features/equipment/components/EquipmentPlaceholders.tsx` (generic equipment
  table host) → derive from the active table / tab label
- `features/spaces/components/SpaceTypesTable.tsx` → `"Space Types"`
- Heat-pump leaves: `OutdoorEquipTable.tsx`, `IndoorEquipTable.tsx`,
  `OutdoorUnitsTable.tsx`, `IndoorUnitsTable.tsx` → their leaf labels
- Rooms / Ventilators / Pumps / Fans / Hot-Water-Heaters / Hot-Water-Tanks /
  Electric-Heaters / Appliances / Thermal Bridges — wherever their
  `<DataTable>` is mounted (confirm via the grep; several share a host
  component, so one edit can cover multiple tables via a prop/tab label).
- **Test mount sites** under `data-table/__tests__/*` also need `tableName`
  (TypeScript will list them when the required prop lands). Prefer a tiny test
  default like `tableName="Test"`.

Prefer sourcing `tableName` from an existing table-label/tab registry where one
exists, so the names stay consistent with the UI.

### Phase 5 — Structural guard (pin the iron-law)

- **MODIFY** `frontend/scripts/check-data-table-contract.mjs`: add assertions,
  in the same spirit as the existing row-expand guard, that:
  - `ViewMenuOverflow.tsx` renders a `Download CSV` built-in item (regex for
    the label inside a `data-table-overflow-menu-item` button), and
  - `onDownloadCsv` appears as a non-optional prop at the
    `ViewMenuOverflow` / `GridToolbar` seam (guard against
    `onDownloadCsv?:`).
  This fails the build if the affordance is removed or quietly made optional.

## 4. Tests

- **Unit (`csv.test.ts`, primary):**
  - header line uses `column.header`; number-units header gets ` (unit)`.
  - single_select → label; missing/empty option → `""`.
  - formula value → text; computed-error → `""`.
  - number-units value formatted per active SI **and** IP.
  - RFC-4180: comma, embedded `"`, and newline each quoted/escaped correctly.
  - empty `rows` → header-only output (single line + trailing terminator).
  - BOM present as first code unit; `\r\n` between records.
  - filename sanitization (illegal chars, empty fallback).
- **Component/integration (focused Vitest):** rendering a DataTable, the `...`
  menu contains `Download CSV`; clicking it calls a mocked `downloadBlob` once
  with the expected filename and a content string whose first data line matches
  the visible first row. Assert it is present in **read-only** mode too.
- **Guard:** `node scripts/check-data-table-contract.mjs` passes with the new
  assertions and fails when the item/prop is removed (verify by hand once).
- **E2E (optional, light):** one `@table-export`-style check on Rooms that the
  menu item exists; full browser matrix not required for v1.

## 5. Validation policy / closeout

This touches the shared DataTable interaction layer, so per
`context/technical-requirements/data-table.md` run policy:

1. `cd frontend && pnpm exec vitest run src/shared/ui/data-table/lib/export/__tests__/csv.test.ts`
   (+ the focused component test).
2. `make frontend-dev-check` (Prettier, ESLint, structural guards incl. the
   new one, production build).
3. Mandatory closeout gate (CLAUDE.md): run `simplify` skill, then `docs-pass`
   skill on the diff, then `make format`, then — since this is a meaningful
   change — `make ci`. Fold any accepted decisions back into
   `context/technical-requirements/data-table.md` (add a short "Download CSV"
   note under the overflow-menu / interaction section) in the same docs pass.

## 6. Risks & mitigations

- **Required-prop churn breaks the build across many call sites.** Expected and
  desired (that *is* the enforcement). Mitigation: land Phases 1–3 first, then
  let `tsc` enumerate every missing `tableName`; fix them in one mechanical
  pass (Phase 4). Keep test mounts on a trivial default.
- **Formula value not reaching the serializer.** `tableToCsv` reads
  `column.accessor(row)`, the same accessor the grid renders through
  (`formatDisplayCellValue` in `tanstackColumns`), so computed columns already
  surface their value there. Verify with a formula-column case in the unit test
  (Rooms `{Number} — {Name}`).
- **Grouped view ordering.** v1 exports `filteredRows` (filter+sort), no group
  headers. Documented in PRD § 3 / § 4.1; acceptable and AirTable-consistent.
- **Double "export" affordance on catalogs.** Materials/Glazing/Frame already
  expose JSON import/export. Reconcile labels during build (PRD Open Q3).

## 7. Estimated surface

- New: 2 files (`csv.ts`, `csv.test.ts`).
- Modified: `ViewMenuOverflow.tsx`, `GridToolbar.tsx`, `DataTable.tsx`,
  `types.ts`, `check-data-table-contract.mjs`, plus `tableName` on each mount
  site (Phase 4) and affected test mounts.
- No backend changes. No new dependencies.
</content>
