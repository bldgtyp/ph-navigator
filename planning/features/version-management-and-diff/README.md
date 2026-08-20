---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Active — Phase 00 contract fixtures complete
AUTHOR: Ed May / Codex
SCOPE: Project Version management and human-readable comparison UX
RELATED:
  - planning/features/version-management-and-diff/PRD.md
  - planning/features/version-management-and-diff/PLAN.md
  - planning/features/version-management-and-diff/STATUS.md
  - context/technical-requirements/save-versioning.md
  - context/ui/pages/project-workspace.md
  - planning/2026-08-19-ui-batch.md
---

# Version Management and Diff

Create one coherent Version workflow where an editor can inspect timestamps,
switch, rename, and safely delete saved Versions, then compare meaningful
changes without reading storage paths or record UUIDs.

## Read order

1. `PRD.md` — mutation, safety, diff, and modal contracts.
2. `PLAN.md` — backend-first implementation sequence.
3. `STATUS.md` — current state and verification ledger.

## Current truth

- `ProjectVersion` already includes `created_at` and `updated_at`; the current
  `VersionPopover` simply does not render them.
- `PATCH .../versions/{version_id}` supports `locked` and `make_active` only.
  Rename and saved-Version delete do not exist.
- The database already enforces unique `(project_id, name)`, cascades Version
  deletion to drafts, sets child `parent_version_id` to null, and sets
  `projects.active_version_id` to null if an active Version is deleted. Product
  safety must be stricter than those raw FK behaviors.
- `DiffDialog` already opts into `ModalDialog resizable`, but starts from the
  generic modal width and renders only `changed_paths` strings. The screenshot's
  resize handle is therefore not evidence of a usable diff design.
- `backend/features/project_document/diff.py` returns table keys and raw paths,
  with no before/after values or human labels.
- Phase 00 contracts live in
  `backend/tests/test_project_version_management_contract.py`. Strict xfail
  markers keep CI green while `--runxfail` proves Phase 01/02 behavior is
  absent; remove each marker as its owning phase implements the contract.

## Primary code anchors

- `frontend/src/features/project_document/components/VersionControls*.tsx`
- `frontend/src/features/project_document/version-controls.css`
- `backend/features/project_document/models.py`
- `backend/features/project_document/versions.py`
- `backend/features/project_document/diff.py`
- `backend/features/project_document/repository.py`
- `context/technical-requirements/save-versioning.md`
