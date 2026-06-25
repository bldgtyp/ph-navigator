---
DATE: 2026-06-24
TIME: 19:47 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 3 — document-model schema cleanup using the no-backcompat window.
RELATED: ../decisions.md (D2), ../PLAN.md,
         planning/code-reviews/2026-06-24/backend-data-architecture-review.md (DOC-1, DOC-5, DOC-6, §4),
         context/technical-requirements/llm-mcp-schema.md §10.5
DEPENDS_ON: aperture v12 merged to main; decision D2 resolved.
---

# Phase 3 — Document Schema Cleanup

## Goal

Make the document-model schema story honest and minimal: one current-schema
validator, no accreted read-time shims, a meaningful `schema_version`, a guarded
body size, and a single serialization per save. This is the headline use of the
no-backcompat window — we **delete** the migration cruft rather than chain it.

## Why this is safe now
There are no saved bodies. The only consumers of the document shape are the dev
seed and the test fixtures, which we regenerate. After a deploy, none of the
below would be possible without a shim chain (Phase 7).

## Changes

### 3.1 Delete the read-time migration shims (DOC-5, §4)
Complete. `ProjectDocumentTables._migrate_legacy_manufacturer_filters`,
`ProjectDocumentV1._migrate_v11_aperture_refs`, and the aperture inline-ref
shim helpers were deleted from `backend/features/project_document/document.py`.
No `mode="before"` project-document reader migrator remains.

### 3.2 Collapse to one current-schema validator + reset version (D2)
Complete. `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 1`; `ProjectDocumentV1`
uses `schema_version: Literal[1]`. Legacy raw v11/v12 bodies are no longer
upgraded at read time.

### 3.3 Body-size guard (DOC-1)
Complete. `PROJECT_DOCUMENT_MAX_BODY_BYTES` defaults to `8388608`, is documented
in env/context docs, and all current project-document persistence boundaries
enforce HTTP 413 `project_document_too_large` before writing:
`drafts.py`, aperture commands, envelope commands, heat-pump commands, asset
attachment mutation, and project creation.

### 3.4 Single canonical serialization (DOC-6)
Complete. `SerializedProjectDocument` / `serialize_document()` derive canonical
JSON text, bytes, etag, and byte size from one dump. Repository calls accept the
serialized payload so guarded write paths do not reserialize for JSONB storage or
logging.

### 3.5 Extract the cross-table validator (the `document.py` split)
Complete. Cross-table validation now lives in
`backend/features/project_document/document_validation.py`; `document.py` is 408
lines and keeps the schema model plus the current-schema validation entry point.

### 3.6 Reseed + regenerate fixtures
Complete for the active generated fixtures/test corpus: raw test documents now
use schema version 1, and the legacy aperture migration test now asserts legacy
inline refs are rejected rather than migrated. No committed seed file changed in
this phase.

## Step sequence
1. 3.5 split first (mechanical, makes the rest legible).
2. 3.1 delete shims → 3.2 collapse/renumber.
3. 3.6 reseed/regenerate; fix tests.
4. 3.3 size guard, 3.4 serialization (independent, can be either order).

## Acceptance criteria
- No `mode="before"` migrators remain in `document.py`; grep for the deleted
  function names is clean outside historical planning notes.
- `CURRENT_PROJECT_DOCUMENT_SCHEMA_VERSION = 1`; the field is a single
  `Literal[1]`.
- Oversized document writes return 413 with structured
  `project_document_too_large`; coverage includes table-slice writes and the MCP
  schema-mutation path.
- One canonical serialization object feeds etag, size, JSONB storage, and
  document write logging on guarded write paths.
- `document.py` is 408 lines; cross-table validation lives in
  `document_validation.py`.
- Full closeout gates are green.

## Verification

Focused verification, 2026-06-24:

- `cd backend && uv run ruff check features/project_document features/projects features/assets/service.py features/envelope/service.py features/heat_pumps/service.py tests/test_project_document.py tests/test_project_document_aperture_entities.py --fix && uv run ruff format features/project_document features/projects features/assets/service.py features/envelope/service.py features/heat_pumps/service.py tests/test_project_document.py tests/test_project_document_aperture_entities.py && uv run ty check`
- `cd backend && uv run pytest tests/test_project_document.py tests/test_project_document_aperture_entities.py tests/features/heat_pumps/test_heat_pumps.py tests/features/heat_pumps/test_cross_table_cascades.py tests/test_project_document_ventilators.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_hot_water_tanks.py tests/test_project_document_default_option_fill.py tests/test_project_document_thermal_bridges.py tests/test_project_document_fans.py tests/test_project_document_appliances.py tests/test_project_document_pumps.py tests/test_projects.py tests/test_schemas.py tests/test_mcp.py tests/test_mcp_custom_fields.py tests/test_assets_service.py tests/envelope/test_envelope_document_contracts.py tests/envelope/test_envelope_commands_geometry.py tests/envelope/test_envelope_commands_materials.py tests/envelope/test_envelope_attachments.py tests/test_project_document_formula_evaluator.py tests/test_project_document_inverse_view.py` — 278 passed.

Phase closeout, 2026-06-24:

- `make format`
- `make ci` — backend 1104 passed, 2 skipped; frontend 1900 passed; frontend
  build passed. Existing warnings: React fast-refresh lint warnings, Vitest
  `act(...)` warnings, Recharts zero-size warnings, Vite large-chunk warning,
  pnpm ignored build scripts warning, and the known backend asset 413
  deprecation warning.
- `graphify update .` — graph rebuilt: 13880 nodes, 36521 edges, 655
  communities.

## Risks
- **Aperture v12 dependency** — this phase must work against the landed
  aperture v12 shape. The shim it deletes (`_migrate_v11_aperture_refs`) is
  exactly the old v11→v12 transform, so confirm the current seed/fixtures
  persist the v12 shape natively before deleting.
- Deleting a shim could hide a still-needed transform. Mitigation: no data
  exists; reseed + corpus validation is the proof.
