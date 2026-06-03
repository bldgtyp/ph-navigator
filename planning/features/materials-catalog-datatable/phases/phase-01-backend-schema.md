---
DATE: 2026-06-03
TIME: 20:30 EDT
STATUS: Planned.
AUTHOR: Claude (Opus 4.7)
SCOPE: Reshape the materials catalog backend to the nine-field flat
       schema and drop the version layer.
RELATED:
  - ../PRD.md
  - ../../../../backend/features/catalogs/materials/
  - ../../../../backend/alembic/versions/20260514_0007_catalog_materials.py
  - ../../../../backend/alembic/versions/20260514_0008_catalog_materials_rec_ids.py
  - ../../../../backend/alembic/versions/20260603_0014_catalog_color_rename.py
---

# Phase 1 — Backend Schema

## Objective

Land a single Alembic revision that (a) drops
`catalog_material_versions`, (b) flattens the per-version columns
onto `catalog_materials`, (c) renames columns to match the PRD, and
(d) adds the new `url` column. Update the Pydantic models, repository,
service, and routes to the new shape. Update backend tests.

## Schema target

`catalog_materials` columns after migration:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | unchanged |
| `name` | text not null | unchanged |
| `category` | text not null | constrained to fixed option-id set via CHECK constraint or service-layer validation (prefer service-layer to avoid a migration each time the list changes — but the list is fixed in v1, so CHECK is acceptable; document the policy in the migration). |
| `density_kg_m3` | float null | moved from versions |
| `specific_heat_j_kgk` | float null | moved from versions |
| `conductivity_w_mk` | float null | moved from versions |
| `emissivity` | float null | moved from versions; 0–1 service-layer check |
| `color` | text null | normalized `#rrggbb` |
| `source` | text null | rename from `source_provenance` |
| `url` | text null | new |
| `comments` | text null | rename from `notes` |
| `is_active` | bool not null default true | unchanged |
| `created_at` / `created_by` / `updated_at` / `updated_by` | unchanged |

Dropped: `current_version_id`, `catalog_schema_version`.
Dropped table: `catalog_material_versions`.

## Work

1. **Alembic revision.** New file under
   `backend/alembic/versions/` with today's stamp.
   - `op.drop_table("catalog_material_versions")`.
   - `op.drop_constraint(...)` for the `current_version_id` FK.
   - `op.drop_column("catalog_materials", "current_version_id")`.
   - `op.drop_column("catalog_materials", "catalog_schema_version")`.
   - `op.add_column` for each flattened field.
   - `op.alter_column` to rename `notes` → `comments`,
     `source_provenance` → `source`.
   - `op.create_check_constraint` for the twelve category option ids.
   - Downgrade may be a stub (`raise NotImplementedError`) — call
     out in the file header that the change is destructive and
     pre-deployment.
2. **Pydantic models** (`backend/features/catalogs/materials/models.py`).
   - Collapse `CatalogMaterialPublic` to the flat shape.
   - Drop `current_version_id`, `version_label`, `version_date`,
     `catalog_schema_version`.
   - Add `url: str | None`, rename `notes` → `comments`, rename
     `source_provenance` → `source`.
   - `category` becomes `Literal[...]` of the twelve option ids.
   - Update `CatalogMaterialCreateRequest` /
     `CatalogMaterialUpdateRequest` accordingly.
3. **Repository.** Rewrite `get_material`, `list_materials`,
   `create_material`, `update_material`, `delete_material`,
   `reactivate_material` against the flat schema. Delete any
   helper that touched the version table.
4. **Service.** Drop version-emission logic; in-place edits become
   plain UPDATEs.
5. **Routes.** Unchanged URLs; updated response/request models.
6. **Tests.** Rewrite `backend/tests/test_catalogs.py` and the
   materials-specific sections of `test_catalogs_shared.py` against
   the new shape. Add coverage for:
   - Category CHECK constraint (rejects unknown option ids).
   - `url` round-trip.
   - `comments` round-trip (rename).
   - Soft-delete + reactivate still work.

## Verification

- `cd backend && uv run alembic upgrade head` against a fresh local
  Postgres applies cleanly.
- `cd backend && uv run pytest tests/test_catalogs.py
  tests/test_catalogs_shared.py` green.
- `make check-backend` green.

## Out of scope

- Touching `catalog_frame_*` or `catalog_glazing_*` tables.
- Envelope-side adjustments — Phase 2.
- Frontend — Phase 3.
