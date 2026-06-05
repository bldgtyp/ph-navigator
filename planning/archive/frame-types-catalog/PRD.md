---
DATE: 2026-06-04
TIME: 12:00 EDT
STATUS: Draft for implementation.
AUTHOR: Claude (Opus 4.7) + Ed May
SCOPE: Product contract for the Window-Frame-Elements Catalog —
       DataTable-backed manager, JSON import/export, AirTable seed.
RELATED:
  - README.md
  - PLAN.md
  - ../glazing-types-catalog/PRD.md
  - ../../../context/user-stories/10-windows.md  (US-WIN-3, US-WIN-4)
  - ../../../context/PRD.md  (§7 catalog bookshelf, §11.5 units)
  - ../../../context/technical-requirements/data-table.md
  - ../../../backend/features/catalogs/frame_types/
  - ../../../backend/features/catalogs/materials/  (reference)
  - ../../../frontend/src/features/catalogs/materials/  (reference)
  - ../../../research/Frame Data-ALL DATA.csv  (seed dataset)
---

# Window-Frame-Elements Catalog — PRD

## Problem

`/catalog/frame-types` ships today as a stub landing page: a
hand-rolled HTML table over the v2 `catalog_frame_types` REST
endpoints, with a modal editor (`FrameTypeEditorModal.tsx`) for
add/edit. It diverges from the shared `<DataTable>` UX that all V2
catalog managers should use (per the Materials Catalog precedent),
and it has no bulk in/out path.

The BLDGTYP AirTable "Frame Types" base holds ~189 vetted frame
records (exported as `research/Frame Data-ALL DATA.csv`) that we
need to bring into the V2 catalog. The current backend `frame_types`
feature only knows about `width_mm`, `u_value_w_m2k`,
`psi_g_w_mk`, `psi_install_w_mk` — it does not yet know about
`use`, `operation`, `location`, `mull_type`, `prefix`, `suffix`,
or `material`, which is how AirTable distinguishes rows that
share a manufacturer + brand. A faithful seed of the AirTable data
requires schema work before the DataTable can render anything
meaningful.

## Goals

1. The Window-Frame-Elements Catalog page is rendered with the
   shared `<DataTable>` so it inherits selection, copy/paste, fill,
   hide/sort/filter/group, semantic undo, IP/SI display, and the
   "More view actions" overflow menu.
2. The catalog row exposes a fixed built-in field set that
   captures the AirTable-source identity, categorization, and
   performance properties (see *Catalog Field Contract* below), with
   no datasheet / attachment columns. `built_in: true`,
   `locked: ["delete", "duplicate"]` default per the existing
   data-table contract.
3. The page surfaces add / duplicate / soft-delete / reactivate /
   edit-in-place exactly the same way the Materials Catalog does.
4. The "More view actions" overflow menu exposes **Import JSON**
   and **Export JSON** affordances; import is dry-run → preview →
   commit; export is a one-click download of the current catalog.
5. The ~189 frame records from the AirTable CSV are seeded into
   dev environments via a one-command recipe that POSTs a
   canonical JSON file through the new `/import/commit` endpoint.

## Non-Goals

- Datasheet / attachment columns on the catalog. Per-project
  document evidence (PDFs, datasheet URLs) lives on the
  **project**, not the catalog (decided 2026-06-04). The
  AirTable `DATASHEET` and `LINK` columns are intentionally
  dropped during seed import.
- Strict enum validation for `use` / `operation` / `location` /
  `mull_type`. The AirTable data has minor variation; v1 stores
  these as `text` with optional client-side option hints. A
  follow-up may promote to `single_select` with a fixed option
  set after seed analysis.
- A second-pass shared abstraction over Materials / Glazing /
  Frame catalogs. Ships independently.
- CSV import/export. JSON is the durable file format.
- Per-user view-state persistence on the catalog grid.
- Project-level frame copies. Bookshelf-copy semantics are owned
  by US-WIN-4 in the windows feature folder.
- Custom user-authored fields on catalog rows.
- IP-native columns in the CSV (`WIDTH_IN`,
  `U_VALUE_BTU_HR_FT2_F`, `PSI_G_BTU_HR_FT_F`). These are
  computed mirrors of SI values; v2 stores SI canonical and
  computes IP for display per `frontend/src/lib/units/`. The
  CSV's IP columns are dropped during seed import.

## Users & Stories

Primary user: Ed / BLDGTYP staff curating the global frame
catalog. Secondary: any future user picking a frame record on a
project Window element via the bookshelf-copy flow (US-WIN-3 /
US-WIN-4).

### Story 1 — Seed the catalog from AirTable

> As a CPHC, I have ~189 frame rows in our BLDGTYP AirTable base.
> From the repo root I run `make seed-frames` (or equivalent),
> which POSTs a versioned JSON file to `/import/commit`, and
> within seconds I see all 189 rows in `/catalog/frame-types`.

### Story 2 — Filter to a manufacturer + location

> As an editor checking a window detail, I open the catalog and
> filter `manufacturer = "Alpen"` + `location = "Jamb"` to see
> only the jamb profiles available from Alpen across all
> operation types. I sort by `u_value_w_m2k` ascending to find
> the highest-performance option.

### Story 3 — Duplicate a record for a new operation type

> As an editor, I see Alpen has a "Tyrol | Window | Casement |
> Head" entry but no "Tyrol | Window | Casement | Sill" entry. I
> right-click "Casement | Head", choose "Duplicate", change
> `location = "Sill"` and update the `u_value_w_m2k`, then save.

### Story 4 — Back up + restore before a bulk edit

> As an editor, before bulk-editing every Alpen row to fix a
> psi-g calibration drift, I download the catalog as JSON. The
> edit goes wrong; I re-import the backup JSON; the catalog is
> restored.

## Catalog Field Contract (v1)

All fields are built-in (`built_in: true`), default
`locked: ["delete", "duplicate"]`. SI canonical units in storage;
frontend converts for IP display per
`context/technical-requirements/data-table.md` and
`frontend/src/lib/units/`.

| field_key            | field_type | display_name | notes |
|----------------------|------------|--------------|-------|
| `name`               | `text`     | Name         | Required. Max 200. Often pipe-delimited (e.g. `"Alpen \| Tyrol \| Window \| Casement \| Head"`). |
| `manufacturer`       | `text`     | Manufacturer | Max 200. Optional. |
| `brand`              | `text`     | Brand        | Max 200. Optional. Frame-system / product-line name. |
| `use`                | `text`     | Use          | **NEW.** Max 40. Optional. Soft-enum: `Door`, `Window`, `Lift & Slide`. |
| `operation`          | `text`     | Operation    | **NEW.** Max 40. Optional. Soft-enum: `Inswing`, `Outswing`, `Casement`, `Tilt-Turn`, `Fixed`, `Sliding`. |
| `location`           | `text`     | Location     | **NEW.** Max 40. Optional. Soft-enum: `Head`, `Jamb`, `Sill`, `Mull-V`, `Mull-H`. |
| `mull_type`          | `text`     | Mull type    | **NEW.** Max 40. Optional. Soft-enum: `OP-to-OP`, `OP-to-FX`, `FX-to-FX`. Empty when `location` is not a mullion. |
| `prefix`             | `text`     | Prefix       | **NEW.** Max 80. Optional. Used by some manufacturers as a leading variant code. |
| `suffix`             | `text`     | Suffix       | **NEW.** Max 80. Optional. Trailing variant code. |
| `material`           | `text`     | Material     | **NEW.** Max 80. Optional. Soft-enum: `Aluminum`, `Wood`, `uPVC`, `Steel`, `Fiberglass`, `Composite`. Mostly empty in seed; tracked for future spec work. |
| `width_mm`           | `number`   | Width        | SI mm. `numberUnits` fixed: `mm ↔ in`. `>= 0`. Optional. |
| `u_value_w_m2k`      | `number`   | U-value      | SI W/(m²·K). `numberUnits` fixed: `W/(m²·K) ↔ Btu/(hr·ft²·°F)`. `>= 0`. Optional. |
| `psi_g_w_mk`         | `number`   | Ψ-glazing    | SI W/(m·K). `numberUnits` fixed: `W/(m·K) ↔ Btu/(hr·ft·°F)`. `>= 0`. Optional. |
| `psi_install_w_mk`   | `number`   | Ψ-install    | SI W/(m·K). `numberUnits` fixed: `W/(m·K) ↔ Btu/(hr·ft·°F)`. `>= 0`. Optional. Not present in the AirTable CSV — kept on the catalog because the model already exposes it and downstream Window-builder code reads it. Seeds as `null` for all 189 imported rows; users fill in over time as install-condition data surfaces. |
| `color`              | `color`    | Color        | `#rrggbb`. Optional. UI tinting only. |
| `source`             | `text`     | Source       | **Renamed from `source_provenance`** for cross-catalog parity with Materials. Max 400. Where the values came from (e.g. "Manufacturer"). |
| `comments`           | `text`     | Comments     | **Renamed from `notes`** for cross-catalog parity with Materials. Max 4000. Free-form. |

The version layer (`catalog_frame_type_versions` table,
`current_version_id`, `catalog_schema_version`, `version_label`,
`version_date`) is **dropped** in Phase 1, mirroring the
Materials Catalog destructive reshape. One row per frame type;
edits write in place. Phase 1 verification grep confirms no
downstream code reads the version pointers (see §Backend Shape).

### Field provenance vs. CSV columns

| CSV column                | V2 field            | Treatment |
|---------------------------|---------------------|-----------|
| `NAME`                    | `name`              | Direct. |
| `MANUFACTURER`            | `manufacturer`      | Direct. |
| `BRAND`                   | `brand`             | Direct. |
| `USE`                     | `use`               | **New column added in Phase 1.** |
| `OPERATION`               | `operation`         | **New column added in Phase 1.** |
| `LOCATION`                | `location`          | **New column added in Phase 1.** |
| `MULL-TYPE`               | `mull_type`         | **New column added in Phase 1.** |
| `PREFIX`                  | `prefix`            | **New column added in Phase 1.** |
| `SUFFIX`                  | `suffix`            | **New column added in Phase 1.** |
| `MATERIAL`                | `material`          | **New column added in Phase 1.** |
| `WIDTH_MM`                | `width_mm`          | Direct. |
| `U_VALUE_W_M2K`           | `u_value_w_m2k`     | Direct. |
| `PSI_G_W_MK`              | `psi_g_w_mk`        | Direct. |
| `SOURCE`                  | `source`            | Direct (column renamed in Phase 1). |
| `DATASHEET`               | —                   | **Dropped** (project-level concern). |
| `LINK`                    | —                   | **Dropped** (project-level concern). |
| `COMMENTS`                | `comments`          | Direct (column renamed in Phase 1). |
| `WIDTH_IN`                | —                   | **Dropped** (IP mirror of `WIDTH_MM`, recomputed in frontend). |
| `U_VALUE_BTU_HR_FT2_F`    | —                   | **Dropped** (IP mirror). |
| `PSI_G_BTU_HR_FT_F`       | —                   | **Dropped** (IP mirror). |

Audit / lifecycle columns (`is_active`, `created_at`,
`created_by`, `updated_at`, `updated_by`) are managed server-side
and not editable in the grid.

## Backend Shape

- One table: `catalog_frame_types`. Phase 1 is a **destructive
  reshape** mirroring the Materials Catalog precedent
  (`planning/archive/materials-catalog-datatable/PRD.md`):
  - **Add columns** (seven nullable `text`): `use`, `operation`,
    `location`, `mull_type`, `prefix`, `suffix`, `material`.
  - **Rename columns**: `source_provenance → source`,
    `notes → comments`.
  - **Drop columns**: `current_version_id`,
    `catalog_schema_version`, `version_label`, `version_date`.
  - **Drop table**: `catalog_frame_type_versions`.
  - Migration is destructive (no production users; app is in
    dev). One Alembic revision performs all four operations.
    Final column list: `id`, `name`, `manufacturer`, `brand`,
    `use`, `operation`, `location`, `mull_type`, `prefix`,
    `suffix`, `material`, `width_mm`, `u_value_w_m2k`,
    `psi_g_w_mk`, `psi_install_w_mk`, `color`, `source`,
    `comments`, `is_active`, `created_at`, `created_by`,
    `updated_at`, `updated_by`.
- REST surface stays at `/api/v1/catalogs/frame-types` with the
  existing verbs (list, create, get, patch, soft-delete,
  reactivate). Phase 2 wires `POST /duplicate` (mirror
  Materials). Phase 3 adds `POST /import/preview` and
  `POST /import/commit`.
- New `text` columns follow the same `strip_optional` validator
  pattern used by `manufacturer` / `brand`. Per-column
  `max_length` per the table above. All nullable.
- Existing `width_mm >= 0`, `u_value_w_m2k >= 0`,
  `psi_g_w_mk >= 0`, `psi_install_w_mk >= 0` validators stay in
  place.
- **Phase 1 verification before dropping the version layer:**
  grep the codebase for `catalog_version_id`,
  `current_version_id`, `catalog_frame_type_versions`,
  `catalog_schema_version`, and `FrameRef.catalog_origin`
  references. If any project-document, envelope-drift, or
  bookshelf-copy code points at them, that work must land in the
  same migration commit (mirrors Materials Phase 2 in the
  archived plan).

## Frontend Shape

- New folder `frontend/src/features/catalogs/frame-types/`
  mirroring `materials/`:
  - `controller.ts` — DataTable write-op orchestration, row
    converters (`toFrameTypeRow`, `fromFrameTypeRow`), insert /
    duplicate / cell-write handlers using the existing
    `useCreateFrameTypeMutation` / `useUpdateFrameTypeMutation`
    / `useDeactivateFrameTypeMutation` /
    `useReactivateFrameTypeMutation` hooks.
  - `fieldDefs.ts` — `FRAME_TYPES_BUILT_IN_FIELD_DEFS`,
    `FRAME_TYPES_FIELD_OVERLAY`, `FRAME_TYPES_TABLE_KEY`. Overlay
    declares the soft-enum option lists (`use`, `operation`,
    `location`, `mull_type`, `material`) as `text`-with-suggestions
    — i.e. the DataTable surfaces a dropdown picker for known
    values but accepts any string (Phase 2 deferral; full
    `single_select` promotion is a follow-up).
  - `import_export/` — added in Phase 3:
    `ImportDialog.tsx`, `OverflowMenuItems.tsx`, `export.ts`,
    `useImportMutations.ts`, `api.ts`, `types.ts`.
  - `__tests__/` — `controller.test.tsx`, `fieldDefs.test.ts`.
- `routes/FrameTypesCatalogPage.tsx` is rewritten in Phase 2 to
  wire the DataTable and the `CatalogMenu` topbar, replacing the
  current HTML table. The `FrameTypeEditorModal` component is
  retired at the end of Phase 2 (DataTable covers all edit paths).

## JSON File Format

Reuse the Materials Catalog import/export envelope verbatim where
possible (defined in
`backend/features/catalogs/materials/import_export/file_format.py`).
The Frame variant looks like:

```json
{
  "format": "ph-navigator/catalog-frame-types",
  "format_version": 1,
  "exported_at": "2026-06-04T12:00:00Z",
  "items": [
    {
      "id": "rec_frame_...",            // match key on re-import; see below
      "name": "Alpen | Tyrol | Window | Casement | Head",
      "manufacturer": "Alpen",
      "brand": "Tyrol",
      "use": "Window",
      "operation": "Casement",
      "location": "Head",
      "mull_type": null,
      "prefix": null,
      "suffix": null,
      "material": null,
      "width_mm": 109.5,
      "u_value_w_m2k": 0.9752,
      "psi_g_w_mk": 0.025,
      "psi_install_w_mk": null,
      "color": null,
      "source": null,
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
- All `text` identity / categorization fields (`manufacturer`,
  `brand`, `use`, `operation`, `location`, `mull_type`, `prefix`,
  `suffix`, `material`, `source`, `comments`) —
  `strip_optional`, max-length enforced.
- All `number` performance fields (`width_mm`, `u_value_w_m2k`,
  `psi_g_w_mk`, `psi_install_w_mk`) — `>= 0` when present.
- `color` normalized via `normalize_optional_hex_color`.
- Soft-delete / reactivate transitions remain idempotent.
- Import: per-row warnings collected; preview never writes;
  commit uses one transaction.

Client-side (DataTable + controller):
- Inline cell edits send a `PATCH` for the changed cell;
  controller surfaces the `name`-required violation immediately
  if the user blanks the name cell.
- Shift-Enter on an empty grid inserts a row with safe defaults
  (`name = "New frame type"`), mirroring the Materials Catalog
  `buildEmptyMaterialRow`.
- Soft-enum columns offer dropdown suggestions but accept
  free-form text (Phase 2 deferral on strict enums).

## Acceptance Criteria

A1. `/catalog/frame-types` renders with `<DataTable>` showing
    the seventeen fields above; no hand-rolled HTML table remains.
A2. Sort, filter, group, hide, and column-reorder work for every
    field. IP/SI topbar toggle flips the `width_mm`,
    `u_value_w_m2k`, `psi_g_w_mk`, and `psi_install_w_mk` display
    appropriately without server calls; the underlying value is
    unchanged.
A3. Shift-Enter inserts a row with safe defaults; cell edits
    `PATCH` the catalog row; the row context menu (existing
    `rowActions` slot) exposes Duplicate + Delete + Reactivate
    (when soft-deleted) and they all work.
A4. The "More view actions" overflow menu shows **Import JSON**
    and **Export JSON**. Export downloads a valid file matching
    the *JSON File Format* shape above; re-importing that file
    is a no-op (all rows resolve to "match → skip" or "match →
    update" with no field changes).
A5. `make seed-frames` (Phase 4) ingests the AirTable-derived
    JSON seed, leaving the dev catalog at 189 rows.
A6. `make ci` is green at the end of each phase. Backend pytest
    covers each new `text` column round-trip (CRUD + import).
    Vitest covers the new `controller.ts` and `fieldDefs.ts`.
    Playwright E2E covers the import → edit → export cycle.

## Resolved decisions (2026-06-04)

D1. **Version layer is stripped** in Phase 1 (drop
`catalog_frame_type_versions`, `current_version_id`,
`catalog_schema_version`, `version_label`, `version_date`). Match
Materials Catalog. One row per frame type; edits write in place.
See §Backend Shape.

D2. **Import match key is `id`** (the existing catalog primary
key — opaque, stable, `rec`-prefixed). Match Materials. See
§JSON File Format.

D3. **`source_provenance` → `source` and `notes` → `comments`**
renames are part of Phase 1, for cross-catalog parity with
Materials.

D4. **Soft-enum stays as `text`-with-suggestions** for v1.
Strict-enum (`single_select`) promotion for `use` / `operation`
/ `location` / `mull_type` / `material` is deferred to a
follow-up that runs after the Phase 4 seed lands, when the real
option distribution is observable. v1 ships flexible enough to
absorb the AirTable import without seed-time validator
collisions.

D5. **`psi_install_w_mk` stays on the catalog and seeds as
`null`.** The AirTable CSV doesn't include this column; the
backend model already exposes it; downstream window-U-value math
reads it. Users fill it in over time as install-condition data
surfaces on projects.

## Out of scope deferrals (mirrors README)

See `README.md` § Out of scope.
