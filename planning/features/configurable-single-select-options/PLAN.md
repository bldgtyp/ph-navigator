---
DATE: 2026-07-02
TIME: 14:00 EDT
STATUS: Planned
AUTHOR: Codex
SCOPE: Implementation plan for user-configurable single-select options.
RELATED:
  - ./README.md
  - ./PRD.md
  - ./STATUS.md
---

# PLAN - Configurable Single-Select Options

## Phase 00 - Product/Schema Decision

- Inspect the current DataTable field config modal and single-select option
  storage.
- Inspect `planning/features_v1.1/catalog-manage-options-modal/` for reusable
  modal and mutation precedent.
- Decide where the allowlist/configurability flag lives.
- Decide whether Rooms `Floor` and `Zone` share project vocabularies or remain
  field-local.

## Phase 01 - Contract and Guardrails

- Add a field-level contract for configurable single-select options.
- Mark Rooms `Floor` and `Zone` configurable.
- Mark or preserve `STATUS` and other system fields as protected.
- Add backend/write-path guardrails so protected fields cannot be mutated.

## Phase 02 - Manage Options UI

- Reuse or adapt the shared manage-options modal.
- Expose the affordance only for configurable single-select fields.
- Support add, rename, reorder, delete, and delete-with-replacement.

## Phase 03 - Rooms Integration

- Wire Rooms `Floor` and `Zone`.
- Verify option edits update the cell picker and persist across reload.
- Handle existing values during rename/delete.

## Phase 04 - Verification and Docs

- Add focused backend/frontend tests.
- Browser-smoke Rooms option management and protected `STATUS` behavior.
- Fold durable DataTable field-contract decisions into
  `context/technical-requirements/data-table.md`.
- Update this packet's `STATUS.md`.

## Split Guidance

This is too large for a quick UI tweak. Do Phase 00 as a separate decision pass
before implementation.

