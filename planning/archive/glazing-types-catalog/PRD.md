---
DATE: 2026-06-04
TIME: 12:00 EDT
STATUS: Draft for implementation.
AUTHOR: Claude (Opus 4.7) + Ed May
SCOPE: Product contract for the Window-Glazing Catalog —
       DataTable-backed manager, JSON import/export, AirTable seed.
RELATED:
  - README.md
  - PLAN.md
  - ../frame-types-catalog/PRD.md
  - ../../../context/user-stories/10-windows.md  (US-WIN-3, US-WIN-4)
  - ../../../context/PRD.md  (§7 catalog bookshelf, §11.5 units)
  - ../../../context/technical-requirements/data-table.md
  - ../../../backend/features/catalogs/glazing_types/
  - ../../../backend/features/catalogs/materials/  (reference)
  - ../../../frontend/src/features/catalogs/materials/  (reference)
  - ../../../research/Glazing Data-ALL DATA.csv  (seed dataset)
---

# Window-Glazing Catalog — PRD

## Problem

`/catalog/glazing-types` ships today as a stub landing page: a
hand-rolled HTML table over the v2 `catalog_glazing_types` REST
endpoints, with a modal editor (`GlazingTypeEditorModal.tsx`) for
add/edit. It diverges from the shared `<DataTable>` UX that all V2
catalog managers should use (per the Materials Catalog precedent),
and it has no bulk in/out path — every row must be entered by hand.

We have ~42 vetted glazing records sitting in the BLDGTYP AirTable
"Glazing Types" base (exported as
`research/Glazing Data-ALL DATA.csv`) that we need to bring into the
V2 catalog. Doing that one-by-one through a modal is not realistic.

## Goals

1. The Window-Glazing Catalog page is rendered with the shared
   `<DataTable>` so it inherits selection, copy/paste, fill,
   hide/sort/filter/group, semantic undo, IP/SI display, and the
   "More view actions" overflow menu.
2. The catalog row exposes a fixed built-in field set that captures
   the AirTable-source identity and performance properties (see
   *Catalog Field Contract* below), with no datasheet / attachment
   columns. `built_in: true`, `locked: ["delete", "duplicate"]`
   default per the existing data-table contract.
3. The page surfaces add / duplicate / soft-delete / reactivate /
   edit-in-place exactly the same way the Materials Catalog does.
4. The "More view actions" overflow menu exposes **Import JSON** and
   **Export JSON** affordances; import is dry-run → preview →
   commit; export is a one-click download of the current catalog.
5. The ~42 glazing records from the AirTable CSV are seeded into
   dev environments via a one-command recipe that POSTs a canonical
   JSON file through the new `/import/commit` endpoint.

## Non-Goals

- Datasheet / attachment columns on the catalog. Per-project
  document evidence (PDFs, datasheet URLs) lives on the **project**,
  not the catalog (decided 2026-06-04). The AirTable `DATASHEET`
  column is intentionally dropped during seed import.
- A second-pass shared abstraction over Materials / Glazing / Frame
  catalogs. The three catalogs are structurally similar but ship
  independently; consolidation is a candidate follow-up.
- CSV import/export. JSON is the durable file format. The CSV in
  `research/` is a one-shot seed source, transformed to JSON during
  Phase 4 prep.
- Per-user view-state persistence on the catalog grid.
- Project-level glazing copies. Bookshelf-copy semantics are owned
  by US-WIN-4 in the windows feature folder.
- Custom user-authored fields on catalog rows.
- Version history beyond the current `version_label` / `version_date`
  pair. The Materials Catalog removed its version layer in the
  archived "materials-catalog-datatable" PRD; we have not yet made
  the analogous call for Glazing. **Decision below in §Open
  questions.**

## Users & Stories

Primary user: Ed / BLDGTYP staff curating the global glazing
catalog. Secondary: any future user picking a glazing record on a
project Window element via the bookshelf-copy flow
(US-WIN-3 / US-WIN-4).

### Story 1 — Seed the catalog from AirTable

> As a CPHC, I have ~42 glazing rows in our BLDGTYP AirTable base.
> From the repo root I run `make seed-glazing` (or equivalent),
> which POSTs a versioned JSON file to `/import/commit`, and within
> seconds I see all 42 rows in `/catalog/glazing-types`.

### Story 2 — Browse + edit in the grid

> As an editor, I open the Window-Glazing Catalog and use the
> standard DataTable affordances — sort by `u_value_w_m2k`, filter
> by `manufacturer = "INTUS"`, fix a typo in a name inline, add a
> new row via Shift-Enter — without ever opening a modal. IP/SI
> toggle in the topbar flips the U-value column display
> appropriately.

### Story 3 — Duplicate a record as a starting point

> As an editor, I right-click an existing glazing row and choose
> "Duplicate". A copy appears with the same field values, a `-
> Copy` suffix on the name, and a fresh record id. I edit it to
> match the new product variant.

### Story 4 — Back up + restore a catalog state

> As an editor, before a bulk edit I download the catalog as JSON,
> then experiment freely. If the experiment goes wrong I re-import
> the backup JSON and the catalog is back to its prior state.

## Catalog Field Contract (v1)

All fields are built-in (`built_in: true`), default
`locked: ["delete", "duplicate"]`. SI canonical units in storage;
frontend converts for IP display per
`context/technical-requirements/data-table.md` and
`frontend/src/lib/units/`.

| field_key           | field_type      | display_name | notes |
|---------------------|-----------------|--------------|-------|
| `name`              | `text`          | Name         | Required. Max 200. Sortable. |
| `manufacturer`      | `text`          | Manufacturer | Max 200. Optional. |
| `brand`             | `text`          | Brand        | Max 200. Optional. Free-text variant label (e.g. "SolarControl-6 TGT, Triple Pane, Argon Fill"). |
| `suffix`            | `text`          | Suffix       | **NEW.** Max 80. Optional. Variant/sub-code from AirTable (e.g. "3CK-IL", "T", "Horizontal"). |
| `u_value_w_m2k`     | `number`        | U-value      | SI W/(m²·K). `numberUnits` fixed: `W/(m²·K) ↔ Btu/(hr·ft²·°F)`. `>= 0`. Optional. |
| `g_value`           | `number`        | g-value      | SHGC, dimensionless 0–1; no `numberUnits`. Optional. |
| `color`             | `color`         | Color        | `#rrggbb`. Optional. UI tinting only. |
| `source`            | `text`          | Source       | **Renamed from `source_provenance`** for cross-catalog parity with Materials. Max 400. Where the values came from (e.g. "Manufacturer", "NFRC #1234"). |
| `comments`          | `text`          | Comments     | **Renamed from `notes`** for cross-catalog parity with Materials. Max 4000. Free-form. |

The version layer (`catalog_glazing_type_versions` table,
`current_version_id`, `catalog_schema_version`, `version_label`,
`version_date`) is **dropped** in Phase 1, mirroring the Materials
Catalog destructive reshape. One row per glazing type; edits write
in place. No envelope-drift refactor required because no project-
document code reads `catalog_version_id` for glazing yet (V2 is
still early; verify in Phase 1).

### Field provenance vs. CSV columns

| CSV column        | V2 field            | Treatment |
|-------------------|---------------------|-----------|
| `NAME`            | `name`              | Direct. |
| `MANUFACTURER`    | `manufacturer`      | Direct. |
| `BRAND`           | `brand`             | Direct. |
| `SUFFIX`          | `suffix`            | **New column added in Phase 1.** |
| `U_VALUE_W_M2K`   | `u_value_w_m2k`     | Direct. |
| `G_VALUE`         | `g_value`           | Direct. |
| `SOURCE`          | `source`            | Direct (column renamed in Phase 1). |
| `DATASHEET`       | —                   | **Dropped** (project-level concern). |
| `LINK`            | —                   | **Dropped** (project-level concern). |
| `COMMENTS`        | `comments`          | Direct (column renamed in Phase 1). |

Audit / lifecycle columns (`is_active`, `created_at`,
`created_by`, `updated_at`, `updated_by`) are managed server-side
and not editable in the grid; they remain in the read response
shape for the detail/list endpoints.

## Backend Shape

- One table: `catalog_glazing_types`. Phase 1 is a **destructive
  reshape** mirroring the Materials Catalog precedent
  (`planning/archive/materials-catalog-datatable/PRD.md`):
  - **Add column**: `suffix text null`.
  - **Rename columns**: `source_provenance → source`,
    `notes → comments`.
  - **Drop columns**: `current_version_id`,
    `catalog_schema_version`, `version_label`, `version_date`.
  - **Drop table**: `catalog_glazing_type_versions`.
  - Migration is destructive (no production users; app is in
    dev). One Alembic revision performs all four operations. No
    down-migration data preservation required beyond Alembic
    hygiene. Final column list: `id`, `name`, `manufacturer`,
    `brand`, `suffix`, `u_value_w_m2k`, `g_value`, `color`,
    `source`, `comments`, `is_active`, `created_at`,
    `created_by`, `updated_at`, `updated_by`.
- REST surface stays at `/api/v1/catalogs/glazing-types` with the
  existing verbs (list, create, get, patch, soft-delete,
  reactivate). Phase 2 wires `POST /duplicate` (mirror
  Materials). Phase 3 adds `POST /import/preview` and
  `POST /import/commit`.
- `suffix` follows the same `strip_optional` validator pattern
  used by `manufacturer` / `brand`. `max_length=80`, nullable.
- Existing `u_value_w_m2k >= 0` and `g_value ∈ [0, 1]`
  validators stay in place.
- **Phase 1 verification before dropping the version layer:**
  grep the codebase for `catalog_version_id`,
  `current_version_id`, `catalog_glazing_type_versions`,
  `catalog_schema_version`, and `GlazingRef.catalog_origin`
  references. If any project-document, envelope-drift, or
  bookshelf-copy code points at them, that work must land in the
  same migration commit (mirrors Materials Phase 2 in the
  archived plan).

## Frontend Shape

- New folder `frontend/src/features/catalogs/glazing-types/`
  mirroring `materials/`:
  - `controller.ts` — DataTable write-op orchestration, row
    converters (`toGlazingTypeRow`, `fromGlazingTypeRow`), insert /
    duplicate / cell-write handlers using the existing
    `useCreateGlazingTypeMutation` / `useUpdateGlazingTypeMutation`
    / `useDeactivateGlazingTypeMutation` /
    `useReactivateGlazingTypeMutation` hooks.
  - `fieldDefs.ts` — `GLAZING_TYPES_BUILT_IN_FIELD_DEFS`,
    `GLAZING_TYPES_FIELD_OVERLAY`, `GLAZING_TYPES_TABLE_KEY`.
  - `import_export/` — added in Phase 3:
    `ImportDialog.tsx`, `OverflowMenuItems.tsx`, `export.ts`,
    `useImportMutations.ts`, `api.ts`, `types.ts`.
  - `__tests__/` — `controller.test.tsx`, `fieldDefs.test.ts`.
- `routes/GlazingTypesCatalogPage.tsx` is rewritten in Phase 2 to
  wire the DataTable and the `CatalogMenu` topbar, replacing the
  current HTML table. The `GlazingTypeEditorModal` component is
  retired at the end of Phase 2 (DataTable covers all edit paths).

## JSON File Format

Reuse the Materials Catalog import/export envelope verbatim where
possible (defined in
`backend/features/catalogs/materials/import_export/file_format.py`).
The Glazing variant looks like:

```json
{
  "format": "ph-navigator/catalog-glazing-types",
  "format_version": 1,
  "exported_at": "2026-06-04T12:00:00Z",
  "items": [
    {
      "id": "rec_glaz_...",            // match key on re-import; see below
      "name": "INTUS | 44.2_CG/12Ar/4/14Ar/CG_6",
      "manufacturer": "INTUS",
      "brand": "44.2_CG/12Ar/4/14Ar/CG_6",
      "suffix": null,
      "u_value_w_m2k": 0.625,
      "g_value": 0.368,
      "color": null,
      "source": "Manufacturer",
      "comments": null
    }
  ]
}
```

Import semantics mirror Materials Catalog
(`planning/archive/materials-catalog-import-export/PRD.md`):

- **Match key is `id`** — the existing catalog primary key
  (a stable, opaque, `rec`-prefixed string). Rows with an `id`
  that matches an existing catalog row are treated as
  matched; rows without an `id` (or with an `id` that no longer
  exists) are treated as new.
- **New** — no `id` (or `id` not found) → insert. The server
  assigns a fresh `rec`-prefixed `id`.
- **Match** — `id` matches an existing row → update or skip per
  conflict policy (default policy: update on field-value diff,
  skip on identity match).
- **Schema drift** — unknown fields are silently dropped;
  missing fields fall back to defaults; per-row warnings
  collected and surfaced in the preview.
- Two-phase: `/import/preview` returns counts and warnings
  without writing; `/import/commit` performs the write.

## Validation

Server-side (Pydantic + service):
- `name` required, 1–200 chars.
- `manufacturer`, `brand`, `suffix`, `source`, `comments` —
  `strip_optional`, max-length enforced.
- `u_value_w_m2k >= 0` (when present).
- `g_value ∈ [0, 1]` (when present).
- `color` normalized via `normalize_optional_hex_color`.
- Soft-delete / reactivate transitions remain idempotent.
- Import: per-row warnings collected; preview never writes;
  commit uses one transaction.

Client-side (DataTable + controller):
- Inline cell edits send a `PATCH` for the changed cell;
  controller surfaces the `name`-required violation immediately
  if the user blanks the name cell.
- Shift-Enter on an empty grid inserts a row with safe defaults
  (`name = "New glazing type"`), mirroring the Materials Catalog
  `buildEmptyMaterialRow`.

## Acceptance Criteria

A1. `/catalog/glazing-types` renders with `<DataTable>` showing
    the nine fields above; no hand-rolled HTML table remains.
A2. Sort, filter, group, hide, and column-reorder work for every
    field. IP/SI topbar toggle flips the `u_value_w_m2k` display
    between `W/(m²·K)` and `Btu/(hr·ft²·°F)` without server calls;
    the underlying value is unchanged.
A3. Shift-Enter inserts a row with safe defaults; cell edits
    `PATCH` the catalog row; the row context menu (existing
    `rowActions` slot) exposes Duplicate + Delete + Reactivate
    (when soft-deleted) and they all work.
A4. The "More view actions" overflow menu shows **Import JSON** and
    **Export JSON**. Export downloads a valid file matching the
    *JSON File Format* shape above; re-importing that file is a
    no-op (all rows resolve to "match → skip" or "match → update"
    with no field changes).
A5. `make seed-glazing` (Phase 4) ingests the AirTable-derived
    JSON seed, leaving the dev catalog at 42 rows.
A6. `make ci` is green at the end of each phase. Backend pytest
    covers the new `suffix` column round-trip (CRUD + import). Vitest
    covers the new `controller.ts` and `fieldDefs.ts`. Playwright
    E2E covers the import → edit → export cycle.

## Resolved decisions (2026-06-04)

D1. **Version layer is stripped** in Phase 1 (drop
`catalog_glazing_type_versions`, `current_version_id`,
`catalog_schema_version`, `version_label`, `version_date`). Match
Materials Catalog. One row per glazing type; edits write in
place. See §Backend Shape.

D2. **Import match key is `id`** (the existing catalog primary
key — opaque, stable, `rec`-prefixed). Match Materials. See
§JSON File Format. No reliance on `name` for matching, so a
post-import rename of an existing row remains a single in-place
edit, not a duplicate.

D3. **`source_provenance` → `source` and `notes` → `comments`**
renames are part of Phase 1, for cross-catalog parity with
Materials.

## Out of scope deferrals (mirrors README)

See `README.md` § Out of scope.
