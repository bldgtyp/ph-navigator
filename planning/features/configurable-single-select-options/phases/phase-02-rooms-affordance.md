---
DATE: 2026-07-02
TIME: 15:06 EDT
STATUS: Pending
AUTHOR: Codex
SCOPE: Expose manageable Rooms Floor/Zone options after guardrails exist.
RELATED:
  - ../PLAN.md
  - ./phase-01-api-guardrails.md
---

# Phase 02 - Rooms Affordance

## Goal

Expose manage-options for Rooms `Floor` and `Zone` using the shared DataTable
field-config surface.

## Scope

- Remove only the `"options"` lock from Rooms `Floor` and `Zone` overlay.
- Keep `"field_type"`, `"delete"`, and `"duplicate"` locked.
- Ensure protected fields such as `status` do not expose manage-options.
- Dispatch option-list edits through the Phase 00-selected typed path.
- Support add, rename, reorder, recolor, color-code toggle, and unused-option
  delete.

## Explicit Deferral

Referenced-option replacement UX is deferred to Phase 03. For this phase,
nullable Rooms referenced deletes may clear cells through the typed backend path.

## Tests

- Header menu opens field-config modal for Rooms `Floor`.
- Header menu opens field-config modal for Rooms `Zone`.
- Add option appears in cell picker after save/refetch.
- Rename preserves existing row references by id.
- Reorder persists across reload and affects picker order.
- Protected `status` remains unavailable.

## Exit Criteria

- Rooms users can curate Floor/Zone vocabularies without developer intervention.
- No protected single-select option list becomes user-editable.
