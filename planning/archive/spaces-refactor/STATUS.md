---
DATE: 2026-06-16
TIME: 17:34 EDT
STATUS: Complete - implemented, verified, archived
AUTHOR: Ed (via Codex)
SCOPE: Current state of Spaces refactor planning.
RELATED:
  - planning/archive/spaces-refactor/README.md
  - planning/archive/spaces-refactor/PRD.md
  - planning/archive/spaces-refactor/PLAN.md
---

# Spaces Refactor - Status

## Current State

`Complete - implemented, verified, archived`.

Phase 01 backend work is implemented and verified:

- Added the `space_types` project-document table, row/envelope models,
  registry contract, table-slice response, inverse-link response fields,
  template seed, schema-version bump, and JSON migration.
- Added focused backend tests for empty new documents, Tag/Name
  FieldDefs, draft replace, contract extraction, duplicate Tag
  rejection, and named-row-without-Tag rejection.
- Updated raw schema-version test fixtures from 5 to 6.

Phase 02 backend Rooms link work is implemented and verified:

- Added the built-in Rooms `Space Type` linked-record FieldDef targeting
  `space_types`.
- Added strict validation for built-in linked-record targets and delete
  cascade cleanup when Space-Type rows are removed.
- Added schema-version bump, migration, and focused backend tests.

Phase 03 frontend route work is implemented:

- Replaced the top-level Rooms project tab with Spaces.
- Added `SpacesPage` with Space-Types and Rooms sub-tabs.
- Moved Rooms rendering under `/projects/:projectId/spaces/rooms`.
- Added legacy `/projects/:projectId/rooms` redirect preserving
  `focus`, `open`, `version`, and hash state.
- Updated inverse Rooms source routes and stale E2E tab selectors.
- Added canonical Spaces path helpers and shared E2E Rooms navigation
  helper during `$ simplify`.

Phase 04 frontend table/link UI work is implemented:

- Added the Space-Types frontend table-slice feature, row/payload types,
  route, DataTable components, slot, empty-row builder, and slice
  payload builders.
- Added Space-Types Tag/Name rendering and read-only inverse Rooms
  columns using backend `inverse_links` / `inverse_link_fields`.
- Wired Rooms to fetch Space-Types, render built-in `space_type_id` as a
  linked-record column, and build `LinkedRecordCellOps` for both
  Space-Types and existing Pumps links.
- Updated frontend Rooms compatibility FieldDefs so `space_type_id`
  matches the backend linked-record contract (`target_table_path:
  ["space_types"]`, `max_links: 1`).
- Added focused frontend coverage for Space-Types payload builders,
  Space-Types table rendering/reverse links/viewer mode, and Rooms Space
  Type linked-record rendering/write metadata.

## Next Step

No active implementation work remains. This planning packet is archived:

`planning/archive/spaces-refactor/`

## Blockers

None.

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
- 2026-06-16 17:18 EDT: Phase 03 started. Scope is route/navigation
  structure only; Phase 04 remains responsible for Space-Types DataTable
  UI and Rooms `space_type_id` picker rendering.
- 2026-06-16 17:25 EDT: Phase 03 implementation and focused frontend
  verification complete. Full `make ci` remains deferred until Phase 05
  per current direction.
- 2026-06-16 17:31 EDT: `$ simplify` complete. Accepted path-helper,
  direct Spaces-tab target, and E2E helper cleanup. Deferred shared
  `AppSubTabLink` accessibility follow-up outside this phase.
- 2026-06-16 17:34 EDT: Phase 03 closeout complete. `$ docs-pass`
  made no stable `context/` edits; final context updates remain in
  Phase 05 after Space-Types table and Rooms link UI verification.
- 2026-06-16 17:49 EDT: Phase 04 implementation and focused frontend
  verification complete. Full `make ci` remains deferred until Phase 05
  per current direction.
- 2026-06-16 18:55 EDT: Phase 04 `$ simplify` closeout complete.
  Accepted cleanup extracted shared project-document table primitives,
  shared field-default readers, shared Space-Types test fixtures, and a
  shared Room display-label helper; it also memoized Space-Type
  sanitizer columns, stabilized reverse-link navigation callbacks, and
  avoided rewriting unchanged Space-Type rows during cell writes.
- 2026-06-16 18:55 EDT: `$ docs-pass` complete. No stable `context/`
  edits were made; Phase 05 remains responsible for final browser smoke,
  full verification, and durable context closeout.
- 2026-06-16 19:05 EDT: Phase 05 started. Stable context docs updated
  for the Spaces parent tab, `tables.space_types`, Rooms
  `space_type_id`, reverse Rooms links, and legacy `/rooms` redirect.
- 2026-06-16 19:45 EDT: Phase 05 closeout complete. `make format`, full
  `make ci`, browser smoke, `graphify update .`, `$ simplify`, and
  `$ docs-pass` all completed. Stable docs now match the implemented
  Spaces route/table/link contract.
- 2026-06-17: Planning packet archived from
  `planning/features/spaces-refactor/` to
  `planning/archive/spaces-refactor/` after all phases were confirmed
  complete.

## Phase 05 Verification

- `make format`
  - Passed on 2026-06-16 19:16 EDT; no source changes.
- First full `make ci`
  - Failed on 2026-06-16 19:19 EDT because
    `frontend/src/features/equipment/lib.test.ts` still expected the
    pre-Spaces Rooms sanitizer column list. Fixed the test expectation
    to include `ROOM_SPACE_TYPE_FIELD_KEY`.
- `cd frontend && pnpm exec vitest run src/features/equipment/lib.test.ts --reporter=dot`
  - 69 passed on 2026-06-16 19:20 EDT.
- Full `make ci`
  - Passed on 2026-06-16 19:31 EDT: backend 887 passed, 2 skipped;
    frontend 172 files / 1651 tests passed; production build passed with
    the existing Vite large-chunk warning.
- Browser smoke on `http://localhost:5173` / `http://localhost:8000` as
  `codex@example.com`
  - Passed on 2026-06-16 19:38 EDT using project
    `543563a1-7a26-4b5f-90e1-3302f7e34728`.
  - Created Space-Types `APT` / Apartment and `CORR` / Corridor.
  - Created Room `101` / Living Room and linked it to Space-Type `APT`.
  - Verified the Space-Types reverse Rooms pill displays
    `101 - Living Room`.
  - Clicked the reverse Rooms pill and confirmed the Room editor opens
    under `/spaces/rooms?focus=<room_id>`. `RoomsPage` consumes
    `open=1` after opening the modal.
  - Verified legacy `/projects/:projectId/rooms?focus=rm_fake&open=1#legacy`
    redirects to `/projects/:projectId/spaces/rooms?focus=rm_fake&open=1#legacy`.
- `$ simplify`
  - Completed on 2026-06-16 19:43 EDT. Reuse and efficiency passes had
    no findings; quality pass found stale stable-doc contradictions,
    which were corrected.
- `make format && cd frontend && pnpm exec vitest run src/features/equipment/lib.test.ts src/features/equipment/__tests__/PumpsTable.reuse.test.tsx --reporter=dot`
  - Passed on 2026-06-16 19:44 EDT; 75 passed.
- Final full `make ci`
  - Passed on 2026-06-16 19:48 EDT: backend 887 passed, 2 skipped;
    frontend 172 files / 1651 tests passed; production build passed with
    the existing Vite large-chunk warning.
- `graphify update .`
  - Passed on 2026-06-16 19:49 EDT.
- `$ docs-pass`
  - Completed on 2026-06-16 19:50 EDT; updated the Spaces phase/status
    docs and planning index with closeout evidence.

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

## Phase 03 Verification

- `cd frontend && pnpm exec vitest run src/App.test.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx`
  - 33 passed on 2026-06-16 17:30 EDT.
- `cd frontend && pnpm exec eslint src/App.test.tsx src/app/router.tsx src/features/spaces src/features/projects/lib.ts src/features/projects/components/ProjectTabContent.tsx src/features/equipment/lib/inverseRoutes.ts src/features/equipment/routes/RoomsPage.tsx src/features/equipment/heat-pumps/components/IndoorUnitsTable.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx`
  - Passed on 2026-06-16 17:30 EDT.
- `cd frontend && pnpm run check:shape`
  - Passed on 2026-06-16 17:30 EDT.
- `cd frontend && pnpm exec prettier --check src/features/spaces/README.md src/features/spaces/api.ts src/features/spaces/hooks.ts src/features/spaces/query-keys.ts src/features/spaces/types.ts src/features/spaces/routes/SpacesPage.tsx src/App.test.tsx`
  - Passed on 2026-06-16 17:24 EDT.
- `cd frontend && pnpm run build`
  - Passed on 2026-06-16 17:30 EDT; Vite emitted the existing large
    chunk warning.
- `make format`
  - Passed on 2026-06-16 17:33 EDT; no files changed.
- `graphify update .`
  - Passed on 2026-06-16 17:33 EDT.
- `$ docs-pass`
  - Completed on 2026-06-16 17:34 EDT; no stable `context/` edits.
- Full `make ci`
  - Deferred until Phase 05 per current direction.

## Phase 04 Verification

- `cd frontend && pnpm exec vitest run src/features/spaces/__tests__/spaceTypesController.test.ts src/features/spaces/__tests__/SpaceTypesTable.test.tsx src/features/equipment/__tests__/RoomsTable.linkedRecord.test.tsx --reporter=dot`
  - 14 passed on 2026-06-16 17:48 EDT.
- `make frontend-dev-check`
  - Passed on 2026-06-16 17:49 EDT; ESLint reported only the existing
    Apertures Fast Refresh warnings and Vite reported the existing large
    chunk warning.
- `make format`
  - Passed on 2026-06-16 18:52 EDT; no files changed.
- `$ simplify`
  - Completed on 2026-06-16 18:55 EDT with shared-helper and
    controller-stability cleanup folded into Phase 04.
- `cd frontend && pnpm exec vitest run src/features/spaces/__tests__/spaceTypesController.test.ts src/features/spaces/__tests__/SpaceTypesTable.test.tsx src/features/equipment/__tests__/RoomsTable.linkedRecord.test.tsx src/features/equipment/__tests__/PumpsTable.reuse.test.tsx --reporter=dot`
  - 20 passed on 2026-06-16 18:53 EDT.
- `make frontend-dev-check`
  - Passed on 2026-06-16 18:53 EDT; ESLint reported only the existing
    Apertures Fast Refresh warnings and Vite reported the existing large
    chunk warning.
- `graphify update .`
  - Passed on 2026-06-16 18:54 EDT.
- `$ docs-pass`
  - Completed on 2026-06-16 18:55 EDT; no stable `context/` edits.
- Full `make ci`
  - Deferred until Phase 05 per current direction.
