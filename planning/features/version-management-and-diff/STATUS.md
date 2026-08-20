---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Active — Phases 00–01 complete; Phase 02 next
AUTHOR: Codex
SCOPE: Current state of Version management and Diff redesign
RELATED:
  - planning/features/version-management-and-diff/PRD.md
  - planning/features/version-management-and-diff/PLAN.md
---

# STATUS — Version Management and Diff

**State:** `Active` implementation. Phase 00 contract fixtures and Phase 01
rename/delete backend are complete; structured browser diffs remain.

## Next step

Start Phase 02 by implementing additive structured diff entries for operation,
before/after values, human table/record/field labels, attachments, and nested
aperture/envelope records. Preserve the existing raw `changed_paths` contract.
Remove the remaining `PENDING_STRUCTURED_DIFF` markers only as those contracts
become real.

## Known current state

- Timestamp data is already on `ProjectVersion.updated_at`.
- Diff modal already sets `resizable`, but uses generic width and raw paths.
- Rename/delete now use shared project-then-Version row locking, stable conflict
  codes, refreshed project responses, and audit events.
- Existing FK behavior supports draft cascade and child preservation but does
  not enforce the product's active/last-Version deletion guards.

## Verification ledger

- [x] Phase 00 strict contract fixtures for request supplied-field semantics,
      rename/conflict, delete guards/cascades/audit, structured labels,
      attachments, nested apertures, unchanged-table omission, and raw-path
      compatibility.
- [x] Rename API, validation, uniqueness conflict, audit, project refresh.
- [x] Delete permission, confirmation, active/last guards, cascades, audit.
- [ ] Structured diff operation/value/label fixtures across table families.
- [ ] Existing MCP/raw diff compatibility decision tested.
- [ ] Popover timestamp and management-modal RTL.
- [ ] Wide/resizable Diff modal long-content and keyboard tests.
- [ ] Mounted multi-Version browser acceptance.
- [ ] Full `make ci`, Graphify update, and save-versioning docs pass.

## Blockers

None external. The structured-diff presenter is the largest design seam and is
intentionally backend-first.

## Phase 00 evidence

- `uv run pytest -q tests/test_project_version_management_contract.py` —
  `1 passed, 10 xfailed`.
- `uv run pytest -q --runxfail tests/test_project_version_management_contract.py`
  — `10 failed, 1 passed`, confirming every pending Phase 01/02 contract is
  genuinely red.
- `uv run ruff check tests/test_project_version_management_contract.py` —
  passed.
- `make format` — no source changes.
- `make ci` — passed: backend `1871 passed, 7 skipped, 10 xfailed`;
  frontend `2475 passed`; production build and structural guards passed.

## Phase 01 evidence

- Focused Version/Save/MCP contract run — `39 passed, 55 deselected, 4 xfailed`.
- `uv run ruff check` for changed backend files — passed.
- `uv run ty check` — passed.
- `make format` — no source changes.
- `graphify update .` — rebuilt `20,527` nodes and `61,045` edges.
- `make ci` — passed: backend `1882 passed, 7 skipped, 4 xfailed`;
  frontend `2475 passed`; production build and structural guards passed.
