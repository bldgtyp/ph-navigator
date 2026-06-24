---
DATE: 2026-06-09
TIME: afternoon ET
STATUS: Implemented — shipped in #13 (commit 51dcd77).
AUTHOR: Claude (Opus 4.7)
SCOPE: Phase 2 — extract `empty_project_document` and any peer
       template builders out of `projects/service.py` into
       `backend/features/project_document/templates.py`.
EFFORT: ~30 min
BUCKET: Now
DEPENDS_ON: none (prereq for Phase 6)
RELATED:
  - `planning/code-reviews/2026-06-07/backend-data-structure-review.md` §1c
  - `backend/features/projects/service.py:90` (function start)
  - `backend/features/project_document/` (target package)
---

# Phase 2 — Extract `empty_project_document`

## Goal

Move the `empty_project_document(payload: CreateProjectRequest) ->
ProjectDocumentV1` factory out of `projects/service.py` and into a new
`backend/features/project_document/templates.py` module. After this
phase, `projects/service.py` drops ~140 lines and is purely project
CRUD / lifecycle; document construction lives next to the document
model.

## Background

From the review §1c:

> The 137-line `empty_project_document` (lines ~90–227) is a separate
> concern from project CRUD/lifecycle. Pull it into
> `projects/document.py` (or, better, co-locate with item 1a above in
> `project_document/templates.py`).

We pick **`project_document/templates.py`**. The `project_document/`
package already owns the `ProjectDocumentV1` model and Phase 6 will
make this the canonical home for construction / template helpers. Both
the function and its eventual neighbours in Phase 6 belong together.

## Pre-work

1. Read `backend/features/projects/service.py` lines 1–250 to see
   `empty_project_document` and any helpers it uses (e.g. private
   factory functions for `EmptyEquipmentTables`, etc. that are only
   referenced from this function).
2. Note every name imported at the top of `projects/service.py` that
   is only used by `empty_project_document`. Those imports move with
   the function.

## Steps

1. Create `backend/features/project_document/templates.py` with the
   standard module docstring matching neighbours (e.g. `document.py`).
2. Cut `empty_project_document` and any private helper functions only
   called by it from `projects/service.py` and paste into
   `templates.py`. Move the imports those helpers require.
3. Add `from backend.features.project_document.templates import
   empty_project_document` to `projects/service.py`.
4. Run `ruff` and `ty` from `backend/`:

   ```bash
   cd backend && uv run ruff check . && uv run ty
   ```

   Fix any unused-import warnings in `projects/service.py` left by the
   move.
5. Grep for any other call sites of `empty_project_document` in the
   codebase (e.g. tests, MCP tools) and point them at the new location
   if they imported it directly:

   ```bash
   grep -rn "empty_project_document" backend/
   ```

6. Run the project-document and project tests:

   ```bash
   cd backend && uv run pytest tests/features/projects tests/features/project_document -q
   ```

7. `make ci`.

## Files touched

- New: `backend/features/project_document/templates.py`
- Modified: `backend/features/projects/service.py`
- Possibly modified: tests or MCP tools that imported the function
  directly (most likely they go through `projects.service`).

## Verification

- `wc -l backend/features/projects/service.py` drops below ~560.
- `make ci` green.
- All previously passing tests still pass with no test edits required
  except for import path updates if any.

## Risks

- **Cross-import**: `templates.py` will need access to the same
  schema types (`ProjectDocumentV1`, row models, etc.) currently
  imported at the top of `projects/service.py`. Confirm none of those
  imports would create a cycle with `project_document/__init__.py`.
- **Hidden helpers**: `empty_project_document` may rely on
  module-private constants or helpers in `projects/service.py` that
  also belong with the template. Be greedy in moving co-dependent
  symbols; do not leave the template depending on private state in the
  old module.

## Done when

- `empty_project_document` lives in `project_document/templates.py`,
  `projects/service.py` imports it, all tests pass, CI green,
  `STATUS.md` updated.
