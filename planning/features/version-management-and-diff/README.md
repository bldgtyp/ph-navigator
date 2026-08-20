---
DATE: 2026-08-19
TIME: 22:24 EDT
STATUS: Active — Phases 00–03 complete
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
- `PATCH .../versions/{version_id}` now supports rename alongside lock and
  make-active mutations. Confirmed non-active, non-sole Version deletion is
  available at `POST .../versions/{version_id}/delete`.
- The database already enforces unique `(project_id, name)`, cascades Version
  deletion to drafts, sets child `parent_version_id` to null, and sets
  `projects.active_version_id` to null if an active Version is deleted. Product
  safety must be stricter than those raw FK behaviors.
- `DiffDialog` already opts into `ModalDialog resizable`, but starts from the
  generic modal width and renders only `changed_paths` strings. The screenshot's
  resize handle is therefore not evidence of a usable diff design.
- `backend/features/project_document/diff.py` now preserves raw paths while
  adding operations, before/after values, counts, and human table/record/field
  labels. Derived overlays are excluded from the structured presentation.
- Phase 00–02 contracts live in
  `backend/tests/test_project_version_management_contract.py`. Strict xfail
  scaffolding is fully removed now that the backend contracts are implemented.
- The Version popover now renders localized `updated_at` timestamps and links
  to a dedicated manager for opening, renaming, and confirmed deletion. The
  manager preserves pending actions, refreshes stale project state after
  rejected mutations, and explains active deletion guards in visible UI.

## Primary code anchors

- `frontend/src/features/project_document/components/VersionControls*.tsx`
- `frontend/src/features/project_document/version-controls.css`
- `backend/features/project_document/models.py`
- `backend/features/project_document/versions.py`
- `backend/features/project_document/diff.py`
- `backend/features/project_document/repository.py`
- `context/technical-requirements/save-versioning.md`
