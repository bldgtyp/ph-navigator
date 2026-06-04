---
DATE: 2026-06-03
TIME: 22:00 EDT
STATUS: Draft for implementation.
AUTHOR: Claude (Opus 4.7)
SCOPE: Add a stable, server-assigned `external_id` to
       `catalog_materials` and expose it on the public payload.
RELATED:
  - ../PRD.md
  - ../PLAN.md
  - ../../../../backend/features/catalogs/materials/
  - ../../../../backend/alembic/versions/
---

# Phase 1 — Backend `external_id`

## Objective

Give every `catalog_materials` row a stable, opaque, server-assigned
identifier (`external_id`) that survives renames and is portable
across databases. This is the dedup key the import pipeline will
use (Phase 2) and the key every export will emit.

Decoupling this from the internal `id` (UUID PK) lets us keep
`id` as a database-internal value and treat `external_id` as the
shared, exported identity.

## Schema target

Add one column to `catalog_materials`:

| column | type | notes |
|---|---|---|
| `external_id` | text not null, unique | server-assigned at create; never reused; stable across renames; immutable after insert |

## Work

1. **Id generator.**
   In `backend/features/catalogs/materials/service.py`, add:

   ```python
   def generated_material_external_id() -> str:
       return f"mat_{datetime.now(tz=UTC).strftime('%Y%m%d%H%M%S%f')}"
   ```

   Matches the existing convention in
   `backend/features/assets/service.py:50` (`asset_*`, `job_*`).
   Opaque, sortable by creation time, human-recognizable prefix.
   ULID would also work — pick the existing pattern for
   consistency unless we adopt ULID across the codebase.

2. **Alembic revision.** New file
   `backend/alembic/versions/<stamp>_catalog_materials_external_id.py`:
   - `op.add_column("catalog_materials", sa.Column("external_id", sa.Text(), nullable=True))`.
   - Data migration: for every existing row with `external_id IS NULL`,
     UPDATE to a generated value. Use a single SQL `UPDATE`
     with `mat_` || `to_char(now(), …)` || row-unique suffix, or
     iterate row-by-row in the migration with a Python loop calling
     the generator. Row-by-row is fine — catalog tables are small
     (hundreds, not millions).
   - `op.alter_column("catalog_materials", "external_id", nullable=False)`.
   - `op.create_unique_constraint("uq_catalog_materials_external_id", "catalog_materials", ["external_id"])`.
   - Downgrade: drop constraint + column.

3. **Pydantic models** (`backend/features/catalogs/materials/models.py`).
   - Add `external_id: str` to `CatalogMaterialPublic`.
   - **Do not** add it to `CatalogMaterialCreateRequest` or
     `CatalogMaterialUpdateRequest`. External id is assigned by
     the server on insert and is immutable thereafter. The import
     pipeline (Phase 2) accepts it through a separate request
     model.

4. **Repository.** Wherever `catalog_materials` rows are
   `INSERT`-ed, set `external_id` to a freshly-generated value.
   Wherever rows are `SELECT`-ed, include the column in the
   projection and surface it on the returned dataclass / dict.

5. **Service.** Pass the generated id through on create. Reject
   update requests that try to set `external_id` (defense-in-depth;
   the request model already won't carry it).

6. **Routes.** No URL changes. The `list_materials`, `get_material`,
   `create_material`, and `patch_material` responses now include
   `external_id`.

7. **Frontend type sync.** In
   `frontend/src/features/catalogs/materials/` (and any shared
   `catalogs` type files), add `external_id: string` to the
   `MaterialRow` shape. The DataTable does not display it in v1;
   it just needs to round-trip through the controller so Phase 3
   can read it for export.

8. **Tests.**
   - `backend/tests/test_catalogs.py`: assert `external_id` is
     present, non-empty, and unique across created rows.
   - Migration test (or manual verification step): apply against
     a DB pre-seeded with three materials and confirm each gets
     a distinct generated id.

## Verification

- `cd backend && uv run alembic upgrade head` applies cleanly on
  a populated DB; all rows have non-null distinct `external_id`.
- `cd backend && uv run pytest tests/test_catalogs.py` green.
- `make check-backend` green.
- A `GET /api/v1/catalogs/materials` response includes
  `external_id` for every row.
- A `POST /api/v1/catalogs/materials` response includes the newly
  minted `external_id`.

## Out of scope

- Any import / export code (Phase 2 + 3).
- Exposing `external_id` in the DataTable UI (not needed in v1).
- Frame / Glazing catalogs — `external_id` for those is a
  follow-up if/when we extend import/export to them.
