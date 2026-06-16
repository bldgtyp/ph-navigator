---
DATE: 2026-06-16
TIME: 17:15 EDT
STATUS: Active - Phase 02 complete; Phase 03 next
AUTHOR: Ed (via Codex)
SCOPE: Current state of Spaces refactor planning.
RELATED:
  - planning/features/spaces-refactor/README.md
  - planning/features/spaces-refactor/PRD.md
  - planning/features/spaces-refactor/PLAN.md
---

# Spaces Refactor - Status

## Current State

`Active - Phase 02 complete; Phase 03 next`.

Phase 01 backend work is implemented and verified in the current
checkout:

- Added the `space_types` project-document table, row/envelope models,
  registry contract, table-slice response, inverse-link response fields,
  template seed, schema-version bump, and JSON migration.
- Added focused backend tests for empty new documents, Tag/Name
  FieldDefs, draft replace, contract extraction, duplicate Tag
  rejection, and named-row-without-Tag rejection.
- Updated raw schema-version test fixtures from 5 to 6.

## Next Step

`planning/features/spaces-refactor/phases/phase-02-rooms-space-type-link.md`

Then begin Phase 03:

`planning/features/spaces-refactor/phases/phase-03-frontend-spaces-parent.md`

## Blockers

None for starting Phase 01.

## Decisions Recorded

- Use top-level project tab label **Spaces**.
- Use sub-tabs **Space-Types** and **Rooms**.
- Add a new project-document table key `space_types`.
- Do not pre-populate Space-Types rows.
- Treat Space-Type **Tag** as the user-facing primary identifier.
- Add a Rooms single-link field to one Space-Type.
- Surface a read-only reverse Rooms link on Space-Types.

## Historical Verification

- `cd backend && uv run pytest tests/test_project_document_space_types.py`
  - 7 passed on 2026-06-16 16:20 EDT.
- Focused backend regression suite:
  `cd backend && uv run pytest tests/test_project_document.py tests/test_project_document_fans.py tests/test_project_document_pumps.py tests/test_project_document_ventilators.py tests/test_project_document_thermal_bridges.py tests/test_project_document_electric_heaters.py tests/test_project_document_appliances.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_hot_water_tanks.py tests/test_project_document_default_option_fill.py tests/features/heat_pumps/test_heat_pumps.py tests/features/heat_pumps/test_cross_table_cascades.py tests/test_project_document_space_types.py`
  - 91 passed on 2026-06-16 16:20 EDT.
- `$ simplify` completed on 2026-06-16; accepted findings were folded
  into the implementation.
- `make format` passed on 2026-06-16.
- `make ci` passed on 2026-06-16.
- `graphify update .` passed on 2026-06-16.
- `$ docs-pass` completed on 2026-06-16; no stable `context/` update is
  needed until the Spaces UI/link behavior lands in later phases.

## Current Phase Notes

- 2026-06-16 17:05 EDT: Phase 02 started. Scope is backend Rooms
  `space_type_id` linked-record FieldDef, strict link validation,
  Space-Types delete cascade to Rooms links, inverse overlay evidence,
  schema migration, focused tests, `$ simplify`, `$ docs-pass`, and
  commit. Full `make ci` is intentionally deferred until Phase 05.
- 2026-06-16 17:13 EDT: Phase 02 implementation and `$ simplify`
  cleanup complete. Full `make ci` remains deferred until Phase 05 per
  current direction.
- 2026-06-16 17:15 EDT: Phase 02 closeout complete. `$ docs-pass`
  kept stable `context/` updates deferred to Phase 05 because the
  backend link contract is not user-visible until the Spaces route/UI
  phases land.

## Phase 02 Verification

- `cd backend && uv run pytest tests/test_project_document_space_types.py tests/test_project_document_linked_record.py tests/test_project_document_inverse_view.py tests/test_project_document_record_linking_rollups.py tests/test_project_document.py::test_project_download_returns_raw_body_when_schema_is_invalid`
  - 52 passed on 2026-06-16 17:13 EDT.
- `cd backend && uv run ruff check .`
  - Passed on 2026-06-16 17:13 EDT.
- `cd backend && uv run ty check`
  - Passed on 2026-06-16 17:13 EDT.
- `cd backend && uv run alembic downgrade 20260616_0030 && uv run alembic upgrade head`
  - Passed on 2026-06-16 17:13 EDT.
- `make format`
  - Passed on 2026-06-16 17:13 EDT.
- `graphify update .`
  - Passed on 2026-06-16 17:15 EDT.
- `$ docs-pass`
  - Completed on 2026-06-16 17:15 EDT; no stable `context/` edits.
- Full `make ci`
  - Deferred until Phase 05 per current direction.
