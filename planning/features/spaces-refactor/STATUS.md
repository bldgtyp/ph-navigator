---
DATE: 2026-06-16
TIME: 16:24 EDT
STATUS: Active - Phase 01 complete; Phase 02 next
AUTHOR: Ed (via Codex)
SCOPE: Current state of Spaces refactor planning.
RELATED:
  - planning/features/spaces-refactor/README.md
  - planning/features/spaces-refactor/PRD.md
  - planning/features/spaces-refactor/PLAN.md
---

# Spaces Refactor - Status

## Current State

`Active - Phase 01 complete; Phase 02 next`.

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

Begin Phase 02:

`planning/features/spaces-refactor/phases/phase-02-rooms-space-type-link.md`

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

## Verification Status

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
