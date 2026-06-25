---
DATE: 2026-06-24
TIME: 18:38 EDT
STATUS: Complete
AUTHOR: Claude (Opus 4.8) with Ed May
SCOPE: Phase 1 — repository/service/route layer consistency.
RELATED: ../decisions.md (D3, D4), ../PLAN.md,
         planning/code-reviews/2026-06-24/backend-data-architecture-review.md (REPO-1..4)
DEPENDS_ON: none. WIP-independent except `assets/registry.py` (coordinate).
---

# Phase 1 — Repository & Layer Consistency

## Goal

Exactly one way to cross each layer boundary: all SQL lives in repositories,
repositories return `dict`/scalars, services validate to Pydantic, and the
boundary file is always `models.py`. Low-risk, mostly mechanical. Sets the
convention the later phases inherit.

## Changes

### 1.1 Move SQL out of services (REPO-1)
Move the inline `conn.execute(SELECT …)` calls into named repository functions:
- `assets/service.py:583` `_referenced_asset_ids_for_project` →
  `project_document.repository::list_bodies_for_project` (or, better, see the
  Phase-6/REPO-3 note — a JSONB-side extraction; for Phase 1 just relocate the
  SQL verbatim to the owning repository, don't optimize).
- `assets/service.py:604` `_location_asset_ids_for_project` →
  `project_location.repository::get_epw_asset_id`.
- `projects/service.py:570` `_owner_display_name` →
  `projects/repository.py::get_owner_display_name`.
- `model_viewer/service.py` inline content-hash dedup SELECT →
  `model_viewer/repository.py`.
- Leave catalog import/export `SAVEPOINT`/`RELEASE` in services — that is
  transaction control, not data SQL (acceptable).

### 1.2 Unify the repo-return convention (REPO-2, D3)
- `assets/repository.py:69,85,102` currently returns
  `AssetRow.model_validate(row)`. Change to return `dict[str, Any]`; move the
  `model_validate` into `assets/service.py`, matching `projects`, `catalogs/*`,
  `auth`, `project_document`, etc.

### 1.3 Rename the assets boundary file (REPO-2)
- `features/assets/schemas.py` → `features/assets/models.py`; update all imports.
  (Do **not** confuse with `model_viewer/schemas/`, which holds external
  honeybee schema mirrors and correctly keeps its own `models.py`.)

### 1.4 Nits (REPO-4)
- `auth/repository.py` `create_session` → `insert_session` (align with the
  majority `insert_*` repo verb).
- `heat_pumps/routes.py:116` `_active_version_id` (opens a connection in a route
  helper) → move into `heat_pumps/service.py`.
- `catalogs/_shared.py` SQL helpers: either rename the module to read as a
  repository (`_shared_repository.py`) or add a header comment formally
  declaring it the catalogs' shared repository surface, so the "no SQL outside
  repository" rule is honest.

### 1.5 Document the conventions + draft the lint (D3, D4)
- In `context/CODING_STANDARDS.md`: state the repo-return convention (repo→dict,
  service validates); bless the domain-exception→boundary-translation pattern
  that `mcp`/`climate`/`catalog import_export` use; note `models.py` is the
  required boundary-file name (no `schemas.py` alias).
- Draft (do **not** enforce yet — violations clear here, enforcement turns on in
  Phase 5) the two lint rules: feature-shape check; import-boundary check
  (`routes.py` ⊅ `database`; `repository.py` ⊅ FastAPI).

## Step sequence
1. 1.3 rename (mechanical, isolated) → run tests.
2. 1.2 repo-return change for `assets` → run tests.
3. 1.1 SQL relocations, one feature at a time → run tests after each.
4. 1.4 nits.
5. 1.5 docs + lint draft.

## Acceptance criteria
- `grep -rn "conn.execute\|cursor" backend/features --include=*.py | grep -v repository.py` returns only documented `_shared` repo-equivalents and savepoint transaction control.
- No `features/*/schemas.py` remains (except `model_viewer/schemas/` external mirrors).
- `assets` repository returns dicts; `model_validate` is in its service.
- `make ci` green; `CODING_STANDARDS.md` updated.

## Risks
- Import churn from the `schemas.py` rename and SQL relocations. Mechanical;
  caught by `ty` + tests.
- `assets/registry.py` is WIP-hot — Phase 1 does not touch `registry.py`, but
  coordinate the `schemas.py`→`models.py` rename if the WIP imports from it.

## Implementation notes — 2026-06-24

- `features/assets/schemas.py` was renamed to `features/assets/models.py`; all
  imports now point at `features.assets.models`.
- `features/assets/repository.py` now returns raw `dict[str, Any]` rows/scalars.
  `features/assets/mapping.py` centralizes conversion to `AssetRow` /
  `JobResponse` for service-boundary consumers.
- SQL previously embedded in asset/project/heat-pump service/route seams moved
  to owning repositories:
  `project_document.repository.list_bodies_for_project`,
  `project_location.repository.get_epw_asset_id`,
  `projects.repository.get_owner_display_name`, and
  `heat_pumps.service.active_version_id_for_project`.
- `auth.repository.create_session` was renamed to `insert_session`.
- `catalogs/_shared.py` now explicitly documents its role as a shared catalog
  repository surface; import/export `SAVEPOINT` transaction control remains in
  services.
- `context/CODING_STANDARDS.md` now records the repo→dict/service-validates
  convention, `models.py` boundary naming, domain-exception translation, and
  draft feature-shape/import-boundary lint rules.
- Residual raw SQL outside repository-equivalent surfaces is limited to the
  known aperture WIP seam (`project_document/apertures/default_refs.py`), which
  this phase intentionally avoids per the Phase 3/4 aperture sequencing
  constraint.

## Verification — 2026-06-24

- Simplify skill: three-agent reuse/quality/efficiency review completed; all
  fix-before-commit findings were applied.
- Docs-pass skill: `context/CODING_STANDARDS.md`, this phase doc, `README.md`,
  and `STATUS.md` updated.
- `cd backend && uv run ruff check . --fix && uv run ruff format . && uv run ruff check . && uv run ty check`
- `cd backend && uv run pytest tests/test_assets_service.py tests/test_assets_orphan_sweeper.py tests/test_model_viewer_files.py tests/test_projects.py tests/test_auth.py tests/features/heat_pumps/test_heat_pumps.py` — 73 passed, 1 known deprecation warning.
- `make format`
- `make ci` — backend 1097 passed, 2 skipped; frontend 1902 passed; frontend
  build passed. Existing warnings only: React fast-refresh lint warnings,
  Vitest `act(...)` warnings, Recharts zero-size warnings, and Vite large-chunk
  warning.
- `graphify update .` — graph rebuilt: 13499 nodes, 35339 edges, 644
  communities.
