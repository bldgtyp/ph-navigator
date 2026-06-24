---
DATE: 2026-06-03
TIME: 20:30 EDT
STATUS: Draft for implementation.
AUTHOR: Claude (Opus 4.7)
SCOPE: Product contract for the Materials Catalog DataTable migration.
RELATED:
  - README.md
  - PLAN.md
  - ../../../context/technical-requirements/data-table.md
  - ../../../context/technical-requirements/frontend-viewer-units.md
  - ../../../backend/features/catalogs/materials/
  - ../../../frontend/src/features/catalogs/
---

# Materials Catalog DataTable — PRD

## Problem

The Materials Catalog page renders a hand-rolled `<table>` with a modal
form editor. It diverges from the shared `<DataTable>` UX used on the
Rooms page (and the planned shape for all V2 catalog managers), and its
schema does not match the field set Ed actually wants in the catalog:

- `category` is free text; we want a fixed twelve-option `single_select`.
- No `url` field, no `comments` field; `notes` and `source_provenance`
  are the closest existing fields and the naming is inconsistent.
- The `catalog_material_versions` layer adds complexity that nothing
  downstream depends on, because the project document already stores
  a full snapshot of each picked material in `ProjectMaterial`
  (`backend/features/project_document/document.py:335-381`).

## Goals

1. Materials Catalog page is rendered with the shared `<DataTable>` so
   it inherits selection, copy/paste, fill, hide/sort/filter/group,
   semantic undo, and SI/IP unit display.
2. The catalog material record exposes exactly the nine catalog fields
   below, each a built-in (`built_in: true`) FieldDef with default
   built-in locks (`["delete", "duplicate"]`).
3. The version layer is gone; one row per material; edits write
   in place.
4. Envelope drift detection continues to work on field-value diffs
   alone (version-id comparison removed).

## Non-Goals

- User-authorable custom fields on the catalog (v1).
- Per-user view-state persistence on catalogs.
- Attachments, comments threads, color tinting from catalog data.
- A second catalog (frame/glazing) migration — scoped separately.

## Catalog Field Contract (v1)

All nine fields are built-in. `locked` defaults to `["delete",
"duplicate"]` (per data-table.md Plan-31 Phase 1a default policy);
display-name / type / options / etc. remain editable per that policy.

| field_key            | field_type      | display_name        | notes |
|----------------------|-----------------|---------------------|-------|
| `name`               | `text`          | Name                | required |
| `category`           | `single_select` | Category            | fixed twelve-option list (see below). User cannot edit the option set. Locked: `["options", "delete", "duplicate"]`. |
| `density_kg_m3`      | `number`        | Density             | `numberUnits` fixed: `kg_m3 ↔ lb_ft3`. SI canonical key per `frontend/src/lib/units/material.ts`. |
| `specific_heat_j_kgk`| `number`        | Specific Heat       | `numberUnits` fixed: `J/(kg-K) ↔ Btu/(lb-F)`. |
| `conductivity_w_mk`  | `number`        | Conductivity        | `numberUnits` fixed: `W/(m-K) ↔ Btu/(hr-ft-F)`. Registry entry already exists (`numberUnits.ts:32`). |
| `emissivity`         | `number`        | Emissivity          | dimensionless 0–1; no `numberUnits`. |
| `color`              | `color`         | Color               | normalized `#rrggbb`; renderer per data-table.md. |
| `source`             | `text`          | Source              | replaces `source_provenance`. |
| `url`                | `text`          | URL                 | new field. Rendered as link in cell (TBD: phase 3 may defer link rendering to v1.1 if it adds scope). |
| `comments`           | `text`          | Comments            | replaces `notes`. |

### Category options (twelve, fixed)

Stored as option ids; display labels driven by FieldDef.options.

| option id                       | label                              |
|---------------------------------|------------------------------------|
| `insulation`                    | Insulation                         |
| `finishes`                      | Finishes                           |
| `woods`                         | Woods                              |
| `metals`                        | Metals                             |
| `masonry`                       | Masonry                            |
| `stud_layers_steel`             | Stud-Layers (Steel)                |
| `stud_layers_wood`              | Stud-Layers (Wood)                 |
| `air_horizontal_heat_flow`      | Air: Horizontal Heat Flow          |
| `air_upward_heat_flow`          | Air: Upward Heat Flow              |
| `air_downward_heat_flow`        | Air: Downward Heat Flow            |
| `rainscreen_insulation`         | Rainscreen Insulation              |
| `doors`                         | Doors                              |

## Backend Shape

- One table: `catalog_materials`. Columns: `id`, `name`, `category`,
  `density_kg_m3`, `specific_heat_j_kgk`, `conductivity_w_mk`,
  `emissivity`, `color`, `source`, `url`, `comments`, `is_active`,
  `created_at`, `created_by`, `updated_at`, `updated_by`.
- Drop columns / tables: `current_version_id`, `catalog_schema_version`,
  `version_label`, `version_date`, `notes`, `source_provenance`, and
  the entire `catalog_material_versions` table.
- REST surface stays at `/api/v1/catalogs/materials` with the existing
  verbs (list, create, get, patch, soft-delete, reactivate). Response
  shape changes; URL contract does not.
- `category` is validated server-side against the fixed option-id set.
- Migration is destructive (no users; app in dev). A single Alembic
  revision drops the version table and reshapes columns. No data
  preservation, no down-migration parity required beyond Alembic
  hygiene.

## Envelope Drift After Version Removal

`backend/features/envelope/drift.py:55` currently compares
`pinned.catalog_version_id` against `catalog_materials.current_version_id`.
After this PRD:

- `CatalogOrigin.catalog_version_id` is removed from
  `ProjectMaterial.catalog_origin` (the field, the snapshot writer,
  and the drift comparator).
- Drift state collapses to field-value comparison only: any of the
  nine catalog fields differing between the project snapshot and the
  current catalog row is "drifted".
- `pick_catalog_material` writes the same snapshot it does today,
  minus the `catalog_version_id` slot.
- `drift.py` returns the field-level diff set unchanged; the
  `pinned_catalog_version_id` / `current_catalog_version_id` fields
  are removed from the report payload.
- Test `tests/envelope/test_envelope_catalog_drift.py` is rewritten
  to assert field-value drift only.

## Frontend Wiring

- New module `frontend/src/features/catalogs/materials/` (or co-located
  under existing `features/catalogs/`) defines:
  - `BUILT_IN_FIELD_DEFS: TableFieldDef[]` for the nine fields.
  - `fieldOverlay(): Record<string, TableFieldRenderOverlay>` carrying
    locks, runtime `single_select` options for category, and
    fixed-mode `numberUnits` configs.
  - REST→DataTable adapter that translates list responses to `rows`
    and `WriteOp` callbacks (cell, paste, fill, rowInsert, rowDelete)
    to the existing PATCH / POST / DELETE endpoints. No slice
    controller; no draft buffer; no project-version save/restore
    interplay.
- `MaterialsCatalogPage` is replaced: header + `<DataTable>` mounted
  with the adapter. The include-inactive toggle stays.
- `MaterialEditorModal` and its supporting components are deleted —
  all editing happens inline in the grid per the DataTable contract.
  Row creation uses Shift-Enter row append (data-table.md
  Identifier Column rule).
- Identifier column: `kind: "field", field: "name"`. Name is promoted
  to the pinned slot 0 with the "Record-ID" header label.

## View State on Catalogs

Per data-table.md Deferred section: "column widths persist for
project-document tables only; catalog tables resize locally." This
PRD does not introduce catalog-scoped persistence. `ViewState` is
in-memory only for catalog pages — sort/filter/group/widths/order
are remembered for the session and reset on reload. A future feature
may add `scope_type/scope_id` storage.

## Acceptance

- `make ci` green from repo root.
- Materials Catalog page renders with the shared DataTable and all
  nine fields visible with the correct types, locks, and unit chips.
- SI/IP toggle flips Density / Specific Heat / Conductivity column
  labels and cell values; stored SI values do not change.
- Category cell shows the twelve options in the popover; pasting a
  matching label resolves to the right option id; pasting a
  non-matching value triggers the paste review dialog.
- Adding a new material via Shift-Enter writes a row through POST and
  the optimistic row appears in the grid.
- Editing a cell PATCHes the row; soft-delete via row delete invokes
  DELETE; reactivate stays available through the include-inactive
  toggle.
- Envelope tests pass with the new drift comparator.
