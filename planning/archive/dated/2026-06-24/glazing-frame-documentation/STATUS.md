---
DATE: 2026-06-24
TIME: 17:58 EDT
STATUS: Complete — implemented, simplified, docs-pass complete, make ci green, archived
AUTHOR: Codex
SCOPE: glazing-frame-documentation
RELATED: ./README.md, ./PRD.md, ./decisions.md, ./PLAN.md, ./phases/
---

# STATUS — Glazing + Frame Documentation

**State:** `Complete`. Phases 0-5 are complete:
`ProjectGlazing`/`ProjectFrame` flat tables exist, apertures store FK ids,
v11 inline refs migrate to v12, aperture write paths upsert/use flat entities,
documentation commands and datasheet attachment support are wired, and the
frontend aperture API hydrates the normalized response for existing builder
components. The packet is archived under
`planning/archive/dated/2026-06-24/glazing-frame-documentation/`.

## Why this feature exists (one line)

Datasheet linking + spec-status are per-product, so glazings/frames must become
flat deduped documented entities (`ProjectGlazing`/`ProjectFrame`) like
`ProjectMaterial` before the report pages can be built. Ed broke this out as the
prerequisite "first feature" (AskUserQuestion, 2026-06-24).

## Done

- Added `ProjectGlazing` / `ProjectFrame`, `project_glazings` /
  `project_frames`, aperture `glazing_id` / frame FK slots, schema version 12,
  cross-table FK validation, and catalog-dedup/hand-enter append helpers.
- Added v11 -> v12 before-validation migration that hoists inline aperture refs
  into flat tables and rewrites elements to FK ids.
- Rewired aperture creation, dimensions, pick, merge/split, paste, refresh,
  manufacturer filters, drift, U-value, HBJSON export, MCP tools, and dev seed
  paths to resolve or write flat entities.
- Added `update_project_glazing`, `update_project_frame`,
  `remove_project_glazing`, `remove_project_frame` through the envelope command
  channel; removals reject still-referenced rows.
- Registered `project_glazings.datasheet_asset_ids` and
  `project_frames.datasheet_asset_ids` in the asset registry and raw row
  iterator.
- Extended the apertures slice with `project_glazings` / `project_frames` and
  hydrated those normalized rows in `frontend/src/features/apertures/api.ts` so
  existing builder components render unchanged.

## Next step — RESUME HERE

The sibling `apertures-glazings-frames-reports` feature can now consume the
normalized `project_glazings` / `project_frames` arrays from the apertures
slice.

## Blockers

- None. All decisions accepted (D-2 = Option A).

## Verification ledger

- `cd backend && uv run pytest tests/test_project_document_aperture_entities.py tests/test_project_document_aperture_documentation_commands.py tests/test_assets_registry.py tests/test_project_document_apertures.py tests/test_aperture_u_value_service.py tests/test_aperture_hbjson_export_service.py tests/test_aperture_drift_comparator.py tests/test_aperture_drift_detector.py tests/test_aperture_refresh_command.py tests/test_aperture_manufacturer_filters.py tests/envelope/test_envelope_document_contracts.py` — 107 passed, 1 skipped.
- `cd frontend && pnpm exec vitest run src/features/apertures/__tests__/ApertureCanvasContainer.test.tsx src/features/apertures/__tests__/ApertureElementCardStack.test.tsx src/features/apertures/__tests__/ApertureSvgCanvas.test.tsx src/features/apertures/__tests__/refsAggregation.test.ts src/features/apertures/__tests__/inUseManufacturers.test.ts src/features/apertures/__tests__/operation-frame-match.test.ts` — 6 files / 32 tests passed.
- `make frontend-dev-check` — passed; existing fast-refresh lint warnings and Vite large-chunk warning remain warnings only.
- `cd backend && uv run ruff check ...` on touched backend files — passed.
- `cd backend && uv run pytest` — 1097 passed, 2 skipped, 1 deprecation warning (`HTTP_413_REQUEST_ENTITY_TOO_LARGE`).
- Simplify pass: excluded non-catalog `specification_status` from
  `catalog_origin.local_overrides` for project glazing/frame update commands.
- Docs-pass: updated `context/technical-requirements/data-model.md`,
  `context/DATA_STORAGE.md`, and `context/GLOSSARY.md` with the v12 flat
  aperture product tables and datasheet attachment keys.
- `graphify update .` — passed; `graphify-out/graph.json` and
  `GRAPH_REPORT.md` refreshed.
- `make format` — passed.
- `make ci` — passed. Backend: ruff format/check, `ty`, Alembic, pytest
  (1097 passed, 2 skipped, 1 warning). Frontend: format check, lint
  (14 existing fast-refresh warnings), `check:all`, Vitest (200 files / 1902
  tests), build (large chunk warning).
