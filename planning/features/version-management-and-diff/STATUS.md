---
DATE: 2026-08-19
TIME: 22:34 EDT
STATUS: Active — Phases 00–04 complete; Phase 05 next
AUTHOR: Codex
SCOPE: Current state of Version management and Diff redesign
RELATED:
  - planning/features/version-management-and-diff/PRD.md
  - planning/features/version-management-and-diff/PLAN.md
---

# STATUS — Version Management and Diff

**State:** `Active` implementation. Backend contracts, Version mutations,
structured diffs, the Version Management UI, and the structured Diff modal are
complete. Mounted acceptance and durable closeout remain.

## Next step

Run Phase 05 mounted multi-Version browser acceptance, verify normal and narrow
Diff layout bounds, then finish durable docs and archive this packet.

## Known current state

- Timestamp data is already on `ProjectVersion.updated_at`.
- Diff modal already sets `resizable`, but the frontend still uses generic width
  and raw paths instead of the new structured response.
- Rename/delete now use shared project-then-Version row locking, stable conflict
  codes, refreshed project responses, and audit events.
- Existing FK behavior supports draft cascade and child preservation but does
  not enforce the product's active/last-Version deletion guards.
- The Version popover now shows localized last-edited timestamps. The manager
  provides Version-specific Open/Rename/Delete actions, exact-name confirmation,
  visible deletion guards, pending-action dismissal protection, and rejected
  mutation refresh/reconciliation.
- The Diff modal now has explicit directional selectors, semantic operation /
  record / field / value rows, lazy table and technical disclosures, quoted
  string summaries, bounded resize/scroll chrome, and a footer Close action.

## Verification ledger

- [x] Phase 00 strict contract fixtures for request supplied-field semantics,
      rename/conflict, delete guards/cascades/audit, structured labels,
      attachments, nested apertures, unchanged-table omission, and raw-path
      compatibility.
- [x] Rename API, validation, uniqueness conflict, audit, project refresh.
- [x] Delete permission, confirmation, active/last guards, cascades, audit.
- [x] Structured diff operation/value/label fixtures across table families.
- [x] Existing MCP/raw diff compatibility decision tested.
- [x] Popover timestamp and management-modal RTL, including pending dismissal,
      double-submit, rejected rename, stale-row reconciliation, and accessible
      Version-specific action names.
- [x] Wide/resizable Diff modal semantic, long-string, empty, loading, error,
      selector-direction, lazy-disclosure, and Escape keyboard tests.
- [ ] Mounted multi-Version browser acceptance.
- [ ] Full `make ci`, Graphify update, and save-versioning docs pass.

## Blockers

None external.

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

## Phase 02 evidence

- Focused Version/diff/document/MCP/inverse suite — `89 passed, 29 deselected`.
- `uv run ruff check` for changed backend files — passed.
- `uv run ty check` — passed.
- `make format` — no source changes.
- `graphify update .` — rebuilt `20,543` nodes and `61,097` edges.
- `make ci` — passed: backend `1889 passed, 7 skipped`; frontend
  `2475 passed`; production build and structural guards passed.

## Phase 03 evidence

- Focused Version popover/manager RTL — `9 passed`.
- Frontend TypeScript and changed-file ESLint checks — passed.
- Three-agent simplify review completed; accepted fixes cover shared Version
  summaries/kind labels, targeted query invalidation, pending action safety,
  stale-error refresh, and accessible action names/guard explanations.
- `make format` — passed with no source changes.
- `graphify update .` — rebuilt `20,557` nodes and `61,147` edges.
- `make ci` — passed: backend `1889 passed, 7 skipped`; frontend
  `2482 passed`; production build and structural guards passed.

## Phase 04 evidence

- Focused Version manager/Diff RTL and state tests — `16 passed`.
- Frontend TypeScript, changed-file ESLint, and structural guards — passed.
- Three-agent simplify review completed; accepted fixes cover shared chip and
  state reuse, lazy large-diff rendering, selector Escape precedence,
  assistive before/after semantics, and explicit whitespace values.
- Mounted computed-style checks at normal and sub-720 px viewport sizes remain
  assigned to Phase 05 browser acceptance.
- `make format` — passed with no source changes.
- `graphify update .` — rebuilt `20,575` nodes and `61,178` edges.
- `make ci` — passed: backend `1889 passed, 7 skipped`; frontend
  `2489 passed`; production build and structural guards passed.
