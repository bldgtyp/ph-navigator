---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Draft — not started
AUTHOR: Codex
SCOPE: Current state of Version management and Diff redesign
RELATED:
  - planning/features/version-management-and-diff/PRD.md
  - planning/features/version-management-and-diff/PLAN.md
---

# STATUS — Version Management and Diff

**State:** `Active` planning; no implementation exists for rename/delete or
structured browser diffs.

## Next step

Start Phase 00 with red contract tests for:

1. rename success/name conflict;
2. active and sole-Version delete blocks;
3. non-active deletion with a draft and child Version;
4. a structured field change with resolvable record and field labels.

Do not redesign the modal against the current raw-path response and promise to
humanize it later; the backend presentation contract is Phase 02.

## Known current state

- Timestamp data is already on `ProjectVersion.updated_at`.
- Diff modal already sets `resizable`, but uses generic width and raw paths.
- Rename/delete require new backend boundaries and audit events.
- Existing FK behavior supports draft cascade and child preservation but does
  not enforce the product's active/last-Version deletion guards.

## Verification ledger

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
