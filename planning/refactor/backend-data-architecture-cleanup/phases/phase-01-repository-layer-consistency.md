---
DATE: 2026-06-24
TIME: 18:05 EDT
STATUS: Ready
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
  `assets/repository.py::list_document_bodies_for_project` (or, better, see the
  Phase-6/REPO-3 note — a JSONB-side extraction; for Phase 1 just relocate the
  SQL verbatim, don't optimize).
- `assets/service.py:604` `_location_asset_ids_for_project` →
  `assets/repository.py::list_location_asset_ids`.
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
