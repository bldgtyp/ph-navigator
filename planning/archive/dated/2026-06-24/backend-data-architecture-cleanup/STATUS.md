---
DATE: 2026-06-24
TIME: 22:35 EDT
STATUS: Complete / archived — Phases 1–3, 5, and 6 complete; Phase 4 promoted; Phase 7 deferred to pre-first-deploy gate.
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Current state, next step, blockers for the backend data-architecture cleanup.
RELATED: ./README.md, ./PRD.md, ./PLAN.md, ./decisions.md
---

# STATUS

## Current state

- **Phase 1 complete** on the active branch: repository/layer consistency,
  assets `schemas.py` → `models.py`, assets repo→dict convention, service-side
  mapping, SQL relocation, nits, and `CODING_STANDARDS.md` updates landed.
- **Phase 2 complete** on the active branch: oversized non-aperture modules
  split without intended behavior changes:
  `features.assets.service.AssetService` preserved while bulk-download and
  orphan-sweeper workflows moved to dedicated modules; formula document overlays
  moved to `formula/document_evaluator.py`; `features.mcp.tools` is now a
  compatibility export surface over domain tool modules.
- **Phase 6 complete** on the active branch: DB pool sizing/lifecycle/readiness,
  threshold DB timing, document hot-path timing, R2 timing, authenticated user
  log context, per-request formula/inverse memoization, Render health check,
  and environment/logging docs are implemented.
- **Phase 3 complete** on the active branch: read-time project-document
  migrators were deleted, the current document schema was reset to v1, the
  cross-table validator was extracted, and guarded canonical serialization now
  backs every current document write boundary.
- **Phase 5 complete** on the active branch: Alembic history is squashed to
  one clean baseline, explicit naming conventions are in place, the intended
  FK/index deltas are baked in, boundary lint runs in backend CI, and the
  remaining schema/context doc drift is reconciled.
- Source of truth for findings:
  `planning/code-reviews/2026-06-24/backend-data-architecture-review.md`.
- Context-doc staleness from the review's §8 register: the `[FIXED]` items are
  done; the `[PENDING]` items are folded into Phase 1 (CODING_STANDARDS) and
  Phase 5 (remaining schema-doc reconciliation).

## Phase ledger

| Phase | State | Blocker |
|---|---|---|
| 1 — repo/layer consistency | `Complete` | none |
| 2 — module splits | `Complete` | none |
| 3 — document schema cleanup | `Complete` | none |
| 4 — unify write architecture | `Promoted` | → `planning/refactor/table-write-architecture-unification/` (D5) |
| 5 — relational clean baseline | `Complete` | none |
| 6 — pre-deploy hardening | `Complete` | none |
| 7 — schema-migration mechanism | `Deferred` | pre-first-deploy gate only |

## Next step

1. Continue the promoted sibling refactor
   (`table-write-architecture-unification/`) starts after this folder's Phase 3.
2. Keep **Phase 7** deferred until the pre-first-deploy gate.

## Blockers

- **Resolved:** aperture v12 WIP has landed on `main`. It previously touched
  `document.py`, `tables/apertures.py`, `project_document/aperture_commands/*`,
  `project_document/apertures/*` (+ new `apertures/lookup.py`),
  `assets/registry.py`, and `envelope/commands/registry.py`; Phase 3 can now
  rebase onto that final shape. See [[feedback_concurrent_committer]].

## Verification posture

Every phase ends green: `simplify` + `docs-pass` on the diff, `make format`,
`make ci`, and (for shape-changing phases) a clean dev reseed + fixture regen.
Phase 5 additionally requires a `pg_dump --schema-only` diff proving the squash
reproduces the current schema.

## Latest verification

Phase 1 closeout, 2026-06-24:

- `cd backend && uv run ruff check . --fix && uv run ruff format . && uv run ruff check . && uv run ty check`
- `cd backend && uv run pytest tests/test_assets_service.py tests/test_assets_orphan_sweeper.py tests/test_model_viewer_files.py tests/test_projects.py tests/test_auth.py tests/features/heat_pumps/test_heat_pumps.py` — 73 passed, 1 known deprecation warning.
- `make format`
- `make ci` — backend 1097 passed, 2 skipped; frontend 1902 passed; frontend build passed. Existing warnings: React fast-refresh lint warnings, Vitest `act(...)` warnings, Recharts zero-size warnings, and Vite large-chunk warning.
- `graphify update .` — graph rebuilt: 13499 nodes, 35339 edges, 644 communities.

Phase 2 closeout, 2026-06-24:

- `cd backend && uv run ruff check . --fix && uv run ruff format . && uv run ruff check . && uv run ty check`
- `cd backend && uv run pytest tests/test_project_document_formula_evaluator.py tests/test_mcp.py tests/test_assets_mcp.py tests/test_model_viewer_files.py tests/test_model_viewer_model_data.py tests/test_mcp_custom_fields.py tests/test_project_document_custom_fields_phase_2.py tests/test_assets_service.py tests/test_assets_orphan_sweeper.py` — 140 passed, 1 known asset 413 deprecation warning.
- `make format`
- `make ci` — backend 1097 passed, 2 skipped; frontend 1902 passed; frontend build passed. Existing warnings: React fast-refresh lint warnings, Vitest `act(...)` warnings, Recharts zero-size warnings, Vite large-chunk warning, pnpm ignored build scripts warning, and the known backend asset 413 deprecation warning.
- `graphify update .` — graph rebuilt: 13644 nodes, 36015 edges, 665 communities.

Phase 6 focused verification, 2026-06-24:

- `cd backend && uv run ruff check . --fix && uv run ruff format . && uv run ruff check . && uv run ty check`
- `cd backend && uv run pytest tests/test_system_routes.py tests/test_auth.py tests/test_mcp.py tests/test_project_document_formula_evaluator.py tests/test_project_document_inverse_view.py tests/test_project_document.py tests/test_assets_service.py tests/test_assets_orphan_sweeper.py tests/test_model_viewer_files.py` — 167 passed, 1 known asset 413 deprecation warning.

Phase 6 closeout, 2026-06-24:

- `make format`
- `make ci` — backend 1100 passed, 2 skipped; frontend 1902 passed; frontend build passed. Existing warnings: React fast-refresh lint warnings, Vitest `act(...)` warnings, Recharts zero-size warnings, Vite large-chunk warning, and the known backend asset 413 deprecation warning.
- `graphify update .` — graph rebuilt: 13689 nodes, 36120 edges, 642 communities.

Phase 3 focused verification, 2026-06-24:

- `cd backend && uv run ruff check features/project_document features/projects features/assets/service.py features/envelope/service.py features/heat_pumps/service.py tests/test_project_document.py tests/test_project_document_aperture_entities.py --fix && uv run ruff format features/project_document features/projects features/assets/service.py features/envelope/service.py features/heat_pumps/service.py tests/test_project_document.py tests/test_project_document_aperture_entities.py && uv run ty check`
- `cd backend && uv run pytest tests/test_project_document.py tests/test_project_document_aperture_entities.py tests/features/heat_pumps/test_heat_pumps.py tests/features/heat_pumps/test_cross_table_cascades.py tests/test_project_document_ventilators.py tests/test_project_document_hot_water_heaters.py tests/test_project_document_hot_water_tanks.py tests/test_project_document_default_option_fill.py tests/test_project_document_thermal_bridges.py tests/test_project_document_fans.py tests/test_project_document_appliances.py tests/test_project_document_pumps.py tests/test_projects.py tests/test_schemas.py tests/test_mcp.py tests/test_mcp_custom_fields.py tests/test_assets_service.py tests/envelope/test_envelope_document_contracts.py tests/envelope/test_envelope_commands_geometry.py tests/envelope/test_envelope_commands_materials.py tests/envelope/test_envelope_attachments.py tests/test_project_document_formula_evaluator.py tests/test_project_document_inverse_view.py` — 278 passed.

Phase 3 closeout, 2026-06-24:

- `make format`
- `make ci` — backend 1104 passed, 2 skipped; frontend 1900 passed; frontend build passed. Existing warnings: React fast-refresh lint warnings, Vitest `act(...)` warnings, Recharts zero-size warnings, Vite large-chunk warning, pnpm ignored build scripts warning, and the known backend asset 413 deprecation warning.
- `graphify update .` — graph rebuilt: 13880 nodes, 36521 edges, 655 communities.

Phase 5 focused verification, 2026-06-24:

- Old chain control DB `phn_phase5_before` upgraded to `20260624_0043`;
  fresh baseline DB `phn_phase5_after` upgraded to `20260624_0001`.
- Schema compare: 246 column signatures unchanged; constraint count changed
  209 → 210 only because `fk_project_location_epw_asset` was added; index diff
  exactly added `project_versions(parent_version_id)`,
  `user_action_log(user_id, created_at)`, and removed
  `user_table_views(project_id, table_key)`.
- Fresh baseline seed counts: `catalog_field_options=71`,
  `catalog_frame_types=1`, `catalog_glazing_types=1`.
- `DATABASE_URL=... uv run pytest tests/test_project_climate_source.py tests/test_projects.py tests/test_system_routes.py tests/test_catalog_field_options.py tests/test_catalog_field_options_glazing.py tests/test_climate_dataset_roster.py`
  — 68 passed.

Phase 5 closeout, 2026-06-24:

- `make format` — backend Ruff format unchanged; frontend Prettier unchanged.
- Recreated `ph_navigator_v2_test` before CI so Alembic starts from the clean
  `20260624_0001` baseline.
- `make ci` — backend 1105 passed, 2 skipped; frontend 1900 passed; frontend
  build passed. Existing warnings: React fast-refresh lint warnings, Vitest
  `act(...)` warnings, Recharts zero-size warnings, Vite large-chunk warning,
  pnpm ignored build scripts warning, and the known backend asset 413
  deprecation warning. During the first xdist bootstrap, stale worker DBs still
  stamped at `20260624_0043` emitted transient Alembic resolution errors before
  recovered workers completed the suite.
- `graphify update .` — graph rebuilt: 13713 nodes, 36309 edges, 610
  communities.
