---
DATE: 2026-08-19
TIME: 19:05 EDT
STATUS: Active implementation sequence — Phases 00–01 complete
AUTHOR: Codex
SCOPE: Backend-first phase plan for Version management and diff UX
RELATED:
  - planning/features/version-management-and-diff/PRD.md
  - planning/features/version-management-and-diff/STATUS.md
---

# PLAN — Version Management and Diff

## Phase 00 — Contract fixtures — Complete

- Capture current Version list, patch, diff, draft, and active/default behavior.
- Add representative diff fixtures for registered tables, custom fields,
  option lists, added/removed rows, attachments, and nested aperture/envelope
  records.
- Lock the PRD's stable error codes, additive structured diff response, and
  saved-From/saved-or-draft-To selector asymmetry.

## Phase 01 — Version rename/delete backend — Complete

- Extend typed request/response models and services.
- Add transactional rename validation and audit.
- Refactor Save, Save As, make-active, and delete to the common
  project-then-Version lock order before enabling deletion.
- Add confirmed deletion with active/last-Version guards and a
  `project_version_deleted` audit row. Actor and timestamp remain in their
  existing audit columns; details contain Version ID/name/kind,
  discarded-draft count, and detached-child count.
- Verify draft cascade and child-parent nulling explicitly.
- Update REST and MCP contract docs; do not add MCP mutation tools unless
  separately requested.

## Phase 02 — Structured diff backend

- Extend the diff walker to retain before/after values and operations.
- Add table/record/field presentation metadata without coupling generic diff
  recursion to frontend copy.
- Collapse row additions/removals into one meaningful record change.
- Preserve each existing table item's `table`, `change_count`, and
  `changed_paths` fields while adding structured fields for the browser.

## Phase 03 — Version Management UI

- Add timestamps to the existing Version popover.
- Add manager state, modal, rename flow, delete confirmation, refresh, and error
  recovery.
- Verify locked/submitted/closed and active/default presentations.

## Phase 04 — Diff modal redesign

- Build From/To selection and human-readable result components against the
  structured response.
- Add wide/resizable/viewport-safe layout and standardized footer.
- Add empty, loading, error, long-value, and technical-disclosure states.

## Phase 05 — Acceptance and durable docs

- Run focused backend and frontend suites followed by full CI because Version
  lifecycle mutations are high-risk.
- Run `make agent-browser-ready` and exercise rename/delete/diff in a seeded
  project, including a dirty draft and locked Version.
- Update `context/technical-requirements/save-versioning.md`, workspace UI docs,
  API docs, Graphify, and the feature status ledger.
