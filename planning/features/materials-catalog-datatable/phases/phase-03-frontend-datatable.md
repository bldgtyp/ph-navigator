---
DATE: 2026-06-03
TIME: 20:30 EDT
STATUS: Implemented on `feat/materials-catalog-datatable`; see
        ../STATUS.md.
AUTHOR: Claude (Opus 4.7)
SCOPE: Rebuild the Materials Catalog page on the shared DataTable.
RELATED:
  - ../PRD.md
  - phase-01-backend-schema.md
  - phase-02-drift-and-envelope.md
  - ../../../../frontend/src/features/catalogs/
  - ../../../../frontend/src/features/equipment/routes/RoomsPage.tsx
  - ../../../../frontend/src/features/equipment/components/RoomsTable.tsx
  - ../../../../frontend/src/features/equipment/lib.ts
  - ../../../../frontend/src/shared/ui/data-table/
  - ../../../../frontend/src/lib/units/material.ts
  - ../../../../frontend/src/lib/units/thermal.ts
  - ../../../../frontend/src/lib/units/numberUnits.ts
---

# Phase 3 — Frontend DataTable

## Objective

Replace the hand-rolled `MaterialsCatalogPage` table + modal with the
shared `<DataTable>`. Wire the nine built-in fields. Drive writes
through the existing REST endpoints. Keep `MaterialEditorModal`'s
deletion in the same phase so the codebase doesn't carry dead UI.

## Architecture

The Rooms page rides `useSliceTableController`, which is bound to the
project-document save pipeline (single_select_options on a slice,
draft buffer, save-versioning, optimistic writes). Catalog materials
are globally scoped REST resources — there is no slice. The pattern:

- Build a **smaller, catalog-shaped controller** —
  `useCatalogTableController` (or, scoped narrower for v1,
  `useMaterialsCatalogController`) — that takes `rows`, `fieldDefs`,
  and per-WriteOp REST callbacks, and returns the props `<DataTable>`
  expects. No persistence of `ViewState`; sort/filter/group live in
  React state.
- Keep the controller co-located under
  `frontend/src/features/catalogs/materials/` until a second catalog
  needs the same shape, then promote to
  `frontend/src/features/catalogs/_shared/`.

## Built-in field defs

New file: `frontend/src/features/catalogs/materials/fieldDefs.ts`.

Exports:

- `MATERIALS_TABLE_KEY = "catalog_materials"`.
- `MATERIAL_CATEGORY_OPTIONS: FieldOption[]` — twelve fixed
  `{ id, label }` entries from the PRD.
- `MATERIALS_BUILT_IN_FIELD_DEFS: TableFieldDef[]` — nine entries
  with `origin: "built_in"` and the right `field_type`.
- `materialsFieldOverlay(): Record<string, TableFieldRenderOverlay>`
  with:
  - `name`: `DEFAULT_BUILT_IN_LOCKS`.
  - `category`: `locked: ["field_type", "options", "delete", "duplicate"]`,
    `options: MATERIAL_CATEGORY_OPTIONS`.
  - `density_kg_m3`: `DEFAULT_BUILT_IN_LOCKS`, `numberUnits:
    { mode: "fixed", kind: "density" }`.
  - `specific_heat_j_kgk`: `DEFAULT_BUILT_IN_LOCKS`, `numberUnits:
    { mode: "fixed", kind: "specific_heat" }` — verify the
    registry id; add to `numberUnits.ts` if absent.
  - `conductivity_w_mk`: `DEFAULT_BUILT_IN_LOCKS`, `numberUnits:
    { mode: "fixed", kind: "conductivity" }`.
  - `emissivity`: `DEFAULT_BUILT_IN_LOCKS`, no `numberUnits`.
  - `color`: `DEFAULT_BUILT_IN_LOCKS`.
  - `source`, `url`, `comments`: `DEFAULT_BUILT_IN_LOCKS`.

If `numberUnits` lacks a `specific_heat` registry entry, add one in
this phase using the helpers already in `lib/units/material.ts`
(`jKgKToBtuLbF` / `btuLbFToJKgK`, label `J/(kg-K)` ↔ `Btu/(lb-F)`).

## REST adapter / write pipeline

New file: `frontend/src/features/catalogs/materials/controller.ts`.

Maps `WriteOp` → REST:

- `kind: "cell"` → PATCH `/api/v1/catalogs/materials/{id}` with the
  changed fields as the partial body. Batch contiguous edits per
  row into a single PATCH where possible; otherwise one PATCH per
  affected row is acceptable for v1.
- `kind: "paste"`, `kind: "fill"` → reuse the cell path per row.
- `kind: "rowInsert"` → POST per inserted row.
- `kind: "rowDelete"` → DELETE per row (soft-delete). The reactivate
  endpoint stays available through the include-inactive toggle.
- `kind: "schemaMutation"` → not applicable in v1 (no custom fields).
  Surface a typed error from the controller if the DataTable ever
  emits one.

Use the existing `useMaterialsQuery()` for reads; invalidate after
each successful write. Optimistic updates are encouraged but not
required for v1 — the failing-write-rolls-back contract from
data-table.md still applies.

## Page rewrite

`MaterialsCatalogPage.tsx`:

- Drop the hand-rolled `<table>`, the row-action buttons, the modal
  invocation.
- Keep the page header, the include-inactive toggle, and the count
  display.
- Mount `<DataTable>` via `<MaterialsTableSlot>` (modeled on
  `RoomsTableSlot`), wired to `useMaterialsCatalogController`.
- Identifier column: `kind: "field", field: "name"`.
- Empty state: when no rows, show a single empty row with the
  "Shift-Enter to add a material" hint (DataTable already handles
  this if there are zero rows; verify).

Delete: `MaterialEditorModal.tsx` and any supporting form
components used only by the modal. Confirm nothing else imports them
before deleting.

## Frontend drift banner follow-on

From Phase 2 grep: any frontend code reading
`pinned_catalog_version_id` / `current_catalog_version_id` is patched
here. Likely a banner / drift-detail UI under
`features/envelope/components/`.

## Tests

- Component test for `<MaterialsTableSlot>`: render with seed rows,
  assert nine column headers, assert category popover shows twelve
  options, assert unit chip on density column.
- Adapter test for `controller.ts`: synthesize each `WriteOp`,
  assert the right REST verb + body + URL.
- Optional: extend `frontend/tests/e2e/` with a Playwright path that
  adds a material, edits a cell, soft-deletes the row.

## Verification

- `pnpm run format`, `pnpm run lint`, `pnpm run typecheck`,
  `pnpm test` from `frontend/` green.
- `make check-frontend` green.
- Manual MCP browser pass:
  - `mcp__plugin_playwright_playwright__browser_navigate` to
    `/catalog/materials`;
  - take screenshot;
  - flip SI/IP toggle, confirm Density / Specific Heat / Conductivity
    column labels swap and values convert without trailing
    suffixes per cell;
  - open the Category popover and confirm twelve options;
  - Shift-Enter to add a row, type a name, paste category,
    confirm PATCH/POST round-trip.

## Out of scope

- User-authorable custom fields on the catalog (PRD non-goal).
- Catalog-scoped persistent `ViewState`.
- Glazing / frame catalog migration.
