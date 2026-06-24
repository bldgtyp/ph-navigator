---
DATE: 2026-06-03
TIME: 20:30 EDT
STATUS: Implemented (merged with phase 01 into one commit on
        `feat/materials-catalog-datatable`; see ../STATUS.md).
AUTHOR: Claude (Opus 4.7)
SCOPE: Remove version-id-based drift from the envelope pipeline.
RELATED:
  - ../PRD.md
  - phase-01-backend-schema.md
  - ../../../../backend/features/envelope/drift.py
  - ../../../../backend/features/envelope/commands/materials.py
  - ../../../../backend/features/envelope/material_fields.py
  - ../../../../backend/features/project_document/document.py
  - ../../../../backend/tests/envelope/test_envelope_catalog_drift.py
  - ../../../../backend/tests/envelope/test_envelope_commands_materials.py
---

# Phase 2 — Envelope Drift & CatalogOrigin

## Objective

Phase 1 deleted `catalog_material_versions` and
`current_version_id`. This phase removes the now-dangling references
from the envelope pipeline and rewrites the drift comparator to use
field-value comparison only.

## Touch points

- `backend/features/project_document/document.py` — `CatalogOrigin`
  struct (~lines 185–196): drop `catalog_version_id` and
  `catalog_schema_version`. Keep `catalog_table`,
  `catalog_record_id`, `synced_at`, `local_overrides`.
- `backend/features/envelope/commands/materials.py` —
  `project_material_from_catalog()` (~lines 261–282): stop reading
  `current_version_id`; CatalogOrigin construction shrinks. Also
  drop any `comments`/`source`/`url` snapshot lines now that the
  catalog row carries the new field names — copy `comments` (was
  `notes`), `source` (was `source_provenance`), and add `url`.
- `backend/features/envelope/drift.py` — `report_material_drift()`
  (or whatever the public function is named):
  - Remove `pinned_catalog_version_id` and
    `current_catalog_version_id` from the response payload.
  - State machine collapses to `synced` vs `drifted` based on
    field-level comparison only.
  - The set of fields compared updates to the nine-field contract:
    `name`, `category`, `density_kg_m3`, `specific_heat_j_kgk`,
    `conductivity_w_mk`, `emissivity`, `color`, `source`, `url`,
    `comments`. (Identity field `name` is included so renames show
    as drift.)
- `backend/features/envelope/material_fields.py` — list of
  drift-tracked field keys. Update to the new contract; drop
  `source_provenance` and `notes` keys.

## Tests

- Rewrite `tests/envelope/test_envelope_catalog_drift.py`:
  - Drop assertions on `pinned_catalog_version_id` /
    `current_catalog_version_id`.
  - Assert pick → unchanged catalog ⇒ `synced`.
  - Assert pick → catalog field edit ⇒ `drifted` with the right
    field name(s) in the `differs` set.
  - Add coverage for the new fields (`url`, `comments`).
- Update `tests/envelope/test_envelope_commands_materials.py` for the
  reshaped snapshot. Pick must still produce a project material with
  full field values.
- Add a small unit test asserting `CatalogOrigin` round-trips with no
  `catalog_version_id` slot.

## Frontend follow-on

Any frontend code that reads `pinned_catalog_version_id` /
`current_catalog_version_id` from the drift response must be patched
in Phase 3 (likely envelope-side drift banner). Grep frontend in
Phase 3:

```sh
grep -rn "catalog_version_id\|pinned_catalog_version_id" frontend/src
```

## Verification

- `make check-backend` green.
- `cd backend && uv run pytest tests/envelope` green.

## Out of scope

- Frontend wiring of the new drift response — Phase 3.
- Schema mutations — Phase 1 owned that.
