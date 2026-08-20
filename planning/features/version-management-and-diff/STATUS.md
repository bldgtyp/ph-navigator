---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Active — Phase 00 complete; Phase 01 next
AUTHOR: Codex
SCOPE: Current state of Version management and Diff redesign
RELATED:
  - planning/features/version-management-and-diff/PRD.md
  - planning/features/version-management-and-diff/PLAN.md
---

# STATUS — Version Management and Diff

**State:** `Active` implementation. Phase 00 contract fixtures are complete;
rename/delete and structured browser diffs remain intentionally unimplemented.

## Next step

Start Phase 01 by implementing the rename/delete backend against the strict
contract tests for:

1. rename success/name conflict;
2. active and sole-Version delete blocks;
3. non-active deletion with a draft and child Version;
4. confirmation mismatch, draft cascade, child detachment, and audit details.

Remove only `PENDING_VERSION_MUTATIONS` xfail markers in Phase 01. The
`PENDING_STRUCTURED_DIFF` markers remain until Phase 02.

## Known current state

- Timestamp data is already on `ProjectVersion.updated_at`.
- Diff modal already sets `resizable`, but uses generic width and raw paths.
- Rename/delete require new backend boundaries and audit events.
- Existing FK behavior supports draft cascade and child preservation but does
  not enforce the product's active/last-Version deletion guards.

## Verification ledger

- [x] Phase 00 strict contract fixtures for request supplied-field semantics,
      rename/conflict, delete guards/cascades/audit, structured labels,
      attachments, nested apertures, unchanged-table omission, and raw-path
      compatibility.
- [ ] Rename API, validation, uniqueness conflict, audit, project refresh.
- [ ] Delete permission, confirmation, active/last guards, cascades, audit.
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
